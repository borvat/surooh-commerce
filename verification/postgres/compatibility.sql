-- Synthetic Supabase SQL surface only. No JWT verification, PostgREST or storage emulation.
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
   nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub',''))::uuid
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;
