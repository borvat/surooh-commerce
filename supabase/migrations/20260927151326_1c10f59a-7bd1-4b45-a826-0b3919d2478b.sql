CREATE TABLE public.product_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('same','multipack','variant')),
  product_ids uuid[] NOT NULL,
  decision text NOT NULL CHECK (decision IN ('confirmed','rejected')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_review_decisions TO authenticated;
GRANT ALL ON public.product_review_decisions TO service_role;
ALTER TABLE public.product_review_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read decisions" ON public.product_review_decisions FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "admins insert decisions" ON public.product_review_decisions FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, array['admin']::public.app_role[]));
CREATE POLICY "admins update decisions" ON public.product_review_decisions FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, array['admin']::public.app_role[]));
CREATE POLICY "admins delete decisions" ON public.product_review_decisions FOR DELETE TO authenticated USING (public.has_org_role(organization_id, array['admin']::public.app_role[]));
CREATE TRIGGER trg_prd_touch BEFORE UPDATE ON public.product_review_decisions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS family_key text;

DROP FUNCTION IF EXISTS public.merge_products(uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.merge_products(_target uuid, _sources uuid[], _stock_value integer DEFAULT NULL, _keep_target boolean DEFAULT false)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _t public.products; _s public.products; _sid uuid; _tc uuid; _r record; _wh uuid; _cur int; _conflict boolean := false;
begin
  select * into _t from public.products where id = _target for update;
  if _t.id is null or _t.archived_at is not null then raise exception 'Target product not found'; end if;
  if not public.has_org_role(_t.organization_id, array['admin']::public.app_role[]) then raise exception 'Only admins can merge products'; end if;
  if _t.product_type = 'BUNDLE' then raise exception 'لا يمكن دمج بندل'; end if;
  if _stock_value is not null and _stock_value < 0 then raise exception 'الكمية لا يمكن أن تكون سالبة'; end if;

  -- Never auto-sum: if more than one side holds physical stock, require an explicit decision.
  select count(*) > 1 into _conflict from (
    select p.id from public.products p join public.component_stock cs on cs.component_id = p.stock_component_id
    where p.id = any(array_append(_sources, _target)) group by p.id having sum(cs.physical_qty) <> 0) x;
  if _conflict and _stock_value is null and not _keep_target then
    raise exception 'لكل منتج مخزون مستقل — اختر أي مخزون نعتمد أو أدخل العدد الصحيح'; end if;

  foreach _sid in array _sources loop
    if _sid = _target then continue; end if;
    select * into _s from public.products where id = _sid for update;
    if _s.id is null or _s.organization_id <> _t.organization_id or _s.archived_at is not null then raise exception 'Product not found'; end if;
    if _s.product_type = 'BUNDLE' then raise exception 'لا يمكن دمج بندل: %', _s.name; end if;
    if _s.stock_component_id is not null then
      if exists (select 1 from public.component_stock where component_id = _s.stock_component_id and reserved_qty > 0) then
        raise exception 'المنتج % عليه كمية محجوزة لطلبات، أكمل الطلبات أولاً', _s.name; end if;
      select stock_component_id into _tc from public.products where id = _target;
      if _tc is null then
        delete from public.bom_lines where product_id = _s.id;
        update public.products set stock_component_id = null where id = _s.id;
        update public.products set stock_component_id = _s.stock_component_id where id = _target;
        delete from public.bom_lines where product_id = _target;
        insert into public.bom_lines(product_id, component_id, quantity_required) values (_target, _s.stock_component_id, 1);
        update public.components set name = _t.name where id = _s.stock_component_id;
      else
        -- retire the source's stock record (zero it) — it is NOT added to the target
        for _r in select warehouse_id, physical_qty from public.component_stock where component_id = _s.stock_component_id and physical_qty <> 0 loop
          perform public._apply_stock(_s.stock_component_id, _r.warehouse_id, 'adjustment', -_r.physical_qty, 0, 'دمج مع ' || _t.name || ' (بدون جمع)', 'MERGE', null, auth.uid());
        end loop;
        for _r in select id, product_id, quantity_required from public.bom_lines where component_id = _s.stock_component_id and product_id <> _s.id loop
          if exists (select 1 from public.bom_lines where product_id = _r.product_id and component_id = _tc) then
            update public.bom_lines set quantity_required = quantity_required + _r.quantity_required where product_id = _r.product_id and component_id = _tc;
            delete from public.bom_lines where id = _r.id;
          else
            update public.bom_lines set component_id = _tc where id = _r.id;
          end if;
        end loop;
        delete from public.bom_lines where product_id = _s.id;
        _tc := _s.stock_component_id;
        update public.products set stock_component_id = null where id = _s.id;
        update public.components set active = false, archived_at = now() where id = _tc;
      end if;
    end if;
    update public.channel_listings set product_id = _target, mapping_status = 'CONFIRMED' where product_id = _s.id;
    update public.products set active = false, archived_at = now(), ean = null where id = _s.id;
    update public.products set image_url = coalesce(image_url, _s.image_url) where id = _target;
  end loop;

  if _stock_value is not null then
    select stock_component_id into _tc from public.products where id = _target;
    if _tc is null then _tc := public.set_product_as_stock_item(_target); end if;
    _wh := public.default_warehouse_id(_t.organization_id);
    select coalesce(physical_qty, 0) into _cur from public.component_stock where component_id = _tc and warehouse_id = _wh;
    if coalesce(_cur, 0) <> _stock_value then
      perform public._apply_stock(_tc, _wh, 'adjustment', _stock_value - coalesce(_cur, 0), 0, 'جرد عند الربط كنفس المنتج', 'MERGE', null, auth.uid());
    end if;
  end if;
  perform public._ensure_primary(_target);
end $function$;
GRANT EXECUTE ON FUNCTION public.merge_products(uuid, uuid[], integer, boolean) TO authenticated;