CREATE TABLE public.product_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_families TO authenticated;
GRANT ALL ON public.product_families TO service_role;
ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read families" ON public.product_families FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "admins write families" ON public.product_families FOR ALL TO authenticated USING (public.has_org_role(organization_id, ARRAY['admin']::app_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY['admin']::app_role[]));
CREATE TRIGGER fam_touch BEFORE UPDATE ON public.product_families FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.products
  ADD COLUMN family_id uuid REFERENCES public.product_families(id) ON DELETE SET NULL,
  ADD COLUMN relationship_type text CHECK (relationship_type IN ('MULTIPACK','BUNDLE','KIT','SET')),
  ADD COLUMN relationship_status text NOT NULL DEFAULT 'none' CHECK (relationship_status IN ('none','needs_review','confirmed'));

CREATE TABLE public.product_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key IN ('brand','manufacturer','model','mpn','product_family','variant_name','color','size','material','capacity','power','dimensions','weight','pack_quantity','unit_quantity','unit_type')),
  value_text text,
  value_numeric numeric,
  source text NOT NULL CHECK (source IN ('bol','imported','inferred','manual')),
  status text NOT NULL CHECK (status IN ('confirmed','suggested','conflict','unknown')),
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, key)
);
GRANT SELECT ON public.product_attributes TO authenticated;
GRANT ALL ON public.product_attributes TO service_role;
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read attributes" ON public.product_attributes FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE TRIGGER attr_touch BEFORE UPDATE ON public.product_attributes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Internal-only writes, admin-checked
CREATE OR REPLACE FUNCTION public.set_product_attribute(_product_id uuid, _key text, _value text, _source text, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _num numeric;
BEGIN
  SELECT organization_id INTO _org FROM products WHERE id = _product_id;
  IF _org IS NULL OR NOT has_org_role(_org, ARRAY['admin']::app_role[]) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  _value := nullif(btrim(coalesce(_value,'')), '');
  IF _value ~ '^\d+(\.\d+)?$' THEN _num := _value::numeric; END IF;
  INSERT INTO product_attributes(organization_id, product_id, key, value_text, value_numeric, source, status, confirmed_by)
  VALUES (_org, _product_id, _key, _value, _num, _source, _status, CASE WHEN _status='confirmed' THEN auth.uid() END)
  ON CONFLICT (product_id, key) DO UPDATE SET value_text = EXCLUDED.value_text, value_numeric = EXCLUDED.value_numeric,
    source = EXCLUDED.source, status = EXCLUDED.status, confirmed_by = EXCLUDED.confirmed_by, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.reset_product_attribute(_product_id uuid, _key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  SELECT organization_id INTO _org FROM products WHERE id = _product_id;
  IF _org IS NULL OR NOT has_org_role(_org, ARRAY['admin']::app_role[]) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM product_attributes WHERE product_id = _product_id AND key = _key;
END $$;

CREATE OR REPLACE FUNCTION public.set_product_family(_product_id uuid, _name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _fid uuid;
BEGIN
  SELECT organization_id INTO _org FROM products WHERE id = _product_id;
  IF _org IS NULL OR NOT has_org_role(_org, ARRAY['admin']::app_role[]) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  _name := nullif(btrim(coalesce(_name,'')), '');
  IF _name IS NULL THEN
    UPDATE products SET family_id = NULL, family_key = NULL WHERE id = _product_id; RETURN;
  END IF;
  INSERT INTO product_families(organization_id, name) VALUES (_org, _name) ON CONFLICT (organization_id, name) DO UPDATE SET updated_at = now() RETURNING id INTO _fid;
  UPDATE products SET family_id = _fid, family_key = lower(_name) WHERE id = _product_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_product_relationship(_product_id uuid, _type text, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  SELECT organization_id INTO _org FROM products WHERE id = _product_id;
  IF _org IS NULL OR NOT has_org_role(_org, ARRAY['admin']::app_role[]) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _type IS NOT NULL AND _type NOT IN ('MULTIPACK','BUNDLE','KIT','SET') THEN RAISE EXCEPTION 'Unknown relationship type'; END IF;
  UPDATE products SET relationship_type = _type, relationship_status = CASE WHEN _type IS NULL THEN 'none' ELSE _status END WHERE id = _product_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.set_product_attribute(uuid,text,text,text,text), public.reset_product_attribute(uuid,text), public.set_product_family(uuid,text), public.set_product_relationship(uuid,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_product_attribute(uuid,text,text,text,text), public.reset_product_attribute(uuid,text), public.set_product_family(uuid,text), public.set_product_relationship(uuid,text,text) TO authenticated;

-- Backfill: preserve existing families and bundles (non-destructive)
INSERT INTO public.product_families(organization_id, name)
SELECT DISTINCT organization_id, family_key FROM public.products WHERE family_key IS NOT NULL AND family_key <> ''
ON CONFLICT DO NOTHING;
UPDATE public.products p SET family_id = f.id FROM public.product_families f
WHERE p.family_key IS NOT NULL AND f.organization_id = p.organization_id AND f.name = p.family_key;

UPDATE public.products p SET
  relationship_type = CASE WHEN (SELECT count(*) FROM public.bom_lines b WHERE b.product_id = p.id) = 1 THEN 'MULTIPACK' ELSE 'BUNDLE' END,
  relationship_status = 'confirmed'
WHERE p.product_type = 'BUNDLE' AND EXISTS (SELECT 1 FROM public.bom_lines b WHERE b.product_id = p.id);
UPDATE public.products SET relationship_type = 'BUNDLE', relationship_status = 'needs_review'
WHERE product_type = 'BUNDLE' AND relationship_type IS NULL;