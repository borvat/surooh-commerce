"""Synthetic-only candidate HTTP boundary. No arbitrary SQL/RPC, token signing or admin API."""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import queue
import threading
import uuid

import jwt
import psycopg

ISSUER = "surooh-synthetic-issuer"
AUDIENCE = "surooh-wms-candidate"


class Denial(Exception):
    def __init__(self, status):
        self.status = status


class Boundary:
    def __init__(self, config):
        self.config = config
        self.pool = queue.Queue()
        self.audit_lock = threading.Lock()
        for _ in range(config["pool_size"]):
            self.pool.put(
                psycopg.connect(
                    **config["database"],
                    autocommit=True,
                    options="-c statement_timeout=15000 -c lock_timeout=10000",
                )
            )

    def execute(self, token, method, path, body):
        try:
            claims = jwt.decode(
                token,
                self.config["jwt_key"],
                algorithms=["HS256"],
                issuer=ISSUER,
                audience=AUDIENCE,
                options={
                    "require": [
                        "exp",
                        "iat",
                        "nbf",
                        "sub",
                        "jti",
                        "company_id",
                        "source",
                        "iss",
                        "aud",
                    ]
                },
            )
            actor = str(uuid.UUID(claims["sub"]))
            company = str(uuid.UUID(claims["company_id"]))
            if not isinstance(claims["source"], str) or not isinstance(
                claims["jti"], str
            ):
                raise ValueError("claims")
        except (jwt.PyJWTError, ValueError, TypeError, KeyError):
            raise Denial(401)
        conn = self.pool.get(timeout=10)
        status = 500
        pid = conn.info.backend_pid
        try:
            # Remove all prior request context, including after errors. No token-supplied SET ROLE.
            conn.execute("RESET ALL")
            identity = conn.execute(
                "select session_user,current_user,rolsuper,rolbypassrls from pg_roles where rolname=current_user"
            ).fetchone()
            if identity != ("trusted_wms_http", "trusted_wms_http", False, False):
                raise RuntimeError("Unexpected SQL service identity")
            with conn.transaction():
                conn.execute(
                    "select set_config('request.jwt.claim.sub',%s,true),set_config('request.jwt.claims',%s,true)",
                    (actor, json.dumps(claims)),
                )
                if conn.execute(
                    "select exists(select 1 from surooh_boundary.revoked_tokens where issuer=%s and jti=%s)",
                    (ISSUER, claims["jti"]),
                ).fetchone()[0]:
                    raise Denial(401)
                if not conn.execute(
                    "select public.is_org_member(%s)", (company,)
                ).fetchone()[0]:
                    raise Denial(403)
                if method == "GET" and path == "/products":
                    result = {
                        "products": [
                            str(r[0])
                            for r in conn.execute(
                                "select id from public.products where organization_id=%s order by id",
                                (company,),
                            )
                        ]
                    }
                elif method == "POST" and path == "/orders":
                    if claims.get("scope") != "orders:write":
                        raise Denial(403)
                    allowed = {
                        "company_id",
                        "source",
                        "request_id",
                        "lines",
                        "channel_id",
                        "warehouse_id",
                        "note",
                    }
                    if set(body) - allowed or not {
                        "source",
                        "request_id",
                        "lines",
                        "channel_id",
                        "warehouse_id",
                    } <= set(body):
                        raise Denial(400)
                    if (
                        body.get("company_id", company) != company
                        or body["source"] != claims["source"]
                    ):
                        raise Denial(403)
                    result = conn.execute(
                        "select surooh_boundary.submit_order(%s,%s,%s,%s::jsonb,%s,%s,%s)",
                        (
                            company,
                            claims["source"],
                            body["request_id"],
                            json.dumps(body["lines"]),
                            body["channel_id"],
                            body["warehouse_id"],
                            body.get("note"),
                        ),
                    ).fetchone()[0]
                else:
                    raise Denial(404)
            status = 200
            return result
        except Denial as e:
            status = e.status
            raise
        except psycopg.Error as e:
            status = (
                403 if e.sqlstate == "42501" else 409 if e.sqlstate == "P0002" else 400
            )
            raise Denial(status)
        finally:
            # Both successful and rejected requests must release without tenant identity.
            try:
                conn.execute("RESET ALL")
                clean = conn.execute(
                    "select nullif(current_setting('request.jwt.claim.sub',true),'') is null, nullif(current_setting('request.jwt.claims',true),'') is null"
                ).fetchone()
                if clean != (True, True):
                    raise RuntimeError("Pool identity leak")
                with self.audit_lock:
                    with Path(self.config["audit_file"]).open("a") as f:
                        f.write(
                            json.dumps(
                                {
                                    "actor": actor,
                                    "company": company,
                                    "pid": pid,
                                    "status": status,
                                    "reset_clean": True,
                                    "sql_service_identity": "trusted_wms_http",
                                    "sql_superuser": False,
                                }
                            )
                            + "\n"
                        )
                self.pool.put(conn)
            except Exception:
                conn.close()
                raise


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--config", type=Path, required=True)
    a = p.parse_args()
    if os.environ.get("WMS_TEST_ISOLATED") != "true":
        p.error("Synthetic boundary requires explicit isolated flag")
    config = json.loads(a.config.read_text())
    if (
        config["database"]["host"] != "127.0.0.1"
        or not config["database"]["dbname"].startswith("wms_test_")
        or config["database"]["user"] != "trusted_wms_http"
    ):
        p.error("Isolated trusted role/database required")
    boundary = Boundary(config)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # Never serialize Authorization headers or tokens.

        def respond(self, method):
            if self.path == "/health" and method == "GET":
                status, result = 200, {"status": "ready"}
            else:
                try:
                    header = self.headers.get("Authorization", "")
                    if not header.startswith("Bearer "):
                        raise Denial(401)
                    length = int(self.headers.get("Content-Length", "0"))
                    if length < 0 or length > 65536:
                        raise Denial(400)
                    body = json.loads(self.rfile.read(length) or b"{}")
                    if not isinstance(body, dict):
                        raise Denial(400)
                    result = boundary.execute(header[7:], method, self.path, body)
                    status = 200
                except Denial as e:
                    status, result = e.status, {"error": "request rejected"}
                except (ValueError, TypeError, json.JSONDecodeError):
                    status, result = 400, {"error": "invalid request"}
                except Exception:
                    status, result = 500, {"error": "boundary failure"}
            data = json.dumps(result).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_GET(self):
            self.respond("GET")

        def do_POST(self):
            self.respond("POST")

    ThreadingHTTPServer(("127.0.0.1", config["port"]), Handler).serve_forever()


if __name__ == "__main__":
    main()
