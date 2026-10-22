-- CANDIDATE ONLY: explicit disposable-lab application after the 23 unchanged migrations.
CREATE SCHEMA surooh_boundary;
REVOKE ALL ON SCHEMA surooh_boundary FROM PUBLIC;
CREATE TABLE surooh_boundary.login_principals (
 login_name name PRIMARY KEY, subject uuid NOT NULL REFERENCES auth.users(id)
);
CREATE TABLE surooh_boundary.sources (
 company_id uuid NOT NULL REFERENCES public.organizations(id), source_id text NOT NULL,
 allow_null_channel boolean NOT NULL DEFAULT false, PRIMARY KEY(company_id,source_id)
);
CREATE TABLE surooh_boundary.source_grants (
 company_id uuid NOT NULL, source_id text NOT NULL, subject uuid NOT NULL REFERENCES auth.users(id),
 PRIMARY KEY(company_id,source_id,subject),
 FOREIGN KEY(company_id,source_id) REFERENCES surooh_boundary.sources(company_id,source_id)
);
CREATE TABLE surooh_boundary.commands (
 company_id uuid NOT NULL, source_id text NOT NULL, request_id text NOT NULL,
 payload_hash text NOT NULL, payload jsonb NOT NULL, result jsonb,
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,source_id,request_id),
 FOREIGN KEY(company_id,source_id) REFERENCES surooh_boundary.sources(company_id,source_id)
);
CREATE TABLE surooh_boundary.revoked_tokens (
 issuer text NOT NULL,jti text NOT NULL,PRIMARY KEY(issuer,jti)
);
REVOKE ALL ON ALL TABLES IN SCHEMA surooh_boundary FROM PUBLIC,anon,authenticated;
-- session_user does not change inside SECURITY DEFINER; claims are never identity for SQL users.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE subject uuid;
BEGIN
 IF session_user = 'trusted_wms_http' THEN
  RETURN nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 END IF;
 SELECT p.subject INTO subject FROM surooh_boundary.login_principals p WHERE p.login_name=session_user;
 RETURN subject;
END $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 IF session_user = 'trusted_wms_http' THEN
  RETURN coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
 END IF;
 RETURN jsonb_build_object('sub',auth.uid());
END $$;
-- All new writes enter once through an authorized transactional command. No direct raw reserve RPC.
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION surooh_boundary.submit_order(
 _company uuid,_source text,_request text,_lines jsonb,_channel uuid,_warehouse uuid,_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); allowed_null boolean; body jsonb; digest text; prior surooh_boundary.commands%ROWTYPE; oid uuid; response jsonb;
BEGIN
 IF actor IS NULL OR NOT public.has_org_role(_company,ARRAY['admin','warehouse']::public.app_role[]) THEN
  RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 IF _source IS NULL OR _source !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' OR
    _request IS NULL OR _request !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' THEN
  RAISE EXCEPTION 'Invalid source/request identity' USING ERRCODE='22023';
 END IF;
 SELECT s.allow_null_channel INTO allowed_null FROM surooh_boundary.sources s
 JOIN surooh_boundary.source_grants g USING(company_id,source_id)
 WHERE s.company_id=_company AND s.source_id=_source AND g.subject=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Source not authorized' USING ERRCODE='42501'; END IF;
 IF _channel IS NULL AND NOT allowed_null THEN RAISE EXCEPTION 'Channel required for source' USING ERRCODE='22023'; END IF;
 IF _channel IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sales_channels WHERE id=_channel AND organization_id=_company) THEN
  RAISE EXCEPTION 'Foreign channel' USING ERRCODE='42501'; END IF;
 IF _warehouse IS NULL OR NOT EXISTS(SELECT 1 FROM public.warehouses WHERE id=_warehouse AND organization_id=_company) THEN
  RAISE EXCEPTION 'Foreign warehouse' USING ERRCODE='42501'; END IF;
 IF _lines IS NULL OR jsonb_typeof(_lines)<>'array' OR jsonb_array_length(_lines)=0 THEN
  RAISE EXCEPTION 'Lines required' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_lines) l
   WHERE jsonb_typeof(l)<>'object' OR l->>'product_id' IS NULL OR jsonb_typeof(l->'quantity') IS DISTINCT FROM 'number'
   OR (l->>'quantity') !~ '^[1-9][0-9]{0,6}$') THEN
  RAISE EXCEPTION 'Invalid line' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_lines) l WHERE NOT EXISTS(
  SELECT 1 FROM public.products p WHERE p.id=(l->>'product_id')::uuid AND p.organization_id=_company)) THEN
  RAISE EXCEPTION 'Foreign product' USING ERRCODE='42501'; END IF;
 body:=jsonb_build_object('operation','place_order','lines',_lines,'channel_id',_channel,'warehouse_id',_warehouse,'note',_note);
 digest:=encode(sha256(convert_to(body::text,'UTF8')),'hex');
 INSERT INTO surooh_boundary.commands(company_id,source_id,request_id,payload_hash,payload,created_by)
 VALUES(_company,_source,_request,digest,body,actor) ON CONFLICT DO NOTHING;
 -- Unique-key conflict waits for its owning transaction; READ COMMITTED now sees committed result.
 SELECT * INTO STRICT prior FROM surooh_boundary.commands
 WHERE company_id=_company AND source_id=_source AND request_id=_request FOR UPDATE;
 IF prior.payload_hash<>digest OR prior.payload<>body THEN RAISE EXCEPTION 'Idempotency payload conflict' USING ERRCODE='P0002'; END IF;
 IF prior.result IS NOT NULL THEN RETURN prior.result; END IF;
 -- Cross-source request IDs must not collide with legacy external_ref uniqueness.
 oid:=public.place_order(_lines,_channel,'surooh:'||encode(sha256(convert_to(_company::text||':'||_source||':'||_request,'UTF8')),'hex'),_note,_warehouse);
 response:=jsonb_build_object('order_id',oid);
 UPDATE surooh_boundary.commands SET result=response
 WHERE company_id=_company AND source_id=_source AND request_id=_request;
 RETURN response;
END $$;
REVOKE ALL ON FUNCTION surooh_boundary.submit_order(uuid,text,text,jsonb,uuid,uuid,text) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA surooh_boundary TO authenticated;
GRANT EXECUTE ON FUNCTION surooh_boundary.submit_order(uuid,text,text,jsonb,uuid,uuid,text) TO authenticated;
-- HTTP role is provisioned by the lab with a random password, not by this SQL file.
