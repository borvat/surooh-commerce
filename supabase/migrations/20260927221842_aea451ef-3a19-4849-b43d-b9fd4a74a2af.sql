DROP FUNCTION IF EXISTS public.merge_products(uuid, uuid[], integer, boolean);

CREATE OR REPLACE FUNCTION public.merge_products(_target uuid, _sources uuid[], _stock_value integer DEFAULT NULL, _keep_target boolean DEFAULT false, _master_reference text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _t public.products; _s public.products; _sid uuid; _tc uuid; _r record; _wh uuid; _cur int; _conflict boolean := false;
  _refs text[]; _chosen text := nullif(btrim(coalesce(_master_reference, '')), ''); _final text;
begin
  select * into _t from public.products where id = _target for update;
  if _t.id is null or _t.archived_at is not null then raise exception 'Target product not found'; end if;
  if not public.has_org_role(_t.organization_id, array['admin']::public.app_role[]) then raise exception 'Only admins can merge products'; end if;
  if _t.product_type = 'BUNDLE' then raise exception 'لا يمكن دمج بندل'; end if;
  if _stock_value is not null and _stock_value < 0 then raise exception 'الكمية لا يمكن أن تكون سالبة'; end if;

  -- ONE master reference: retain a single existing one; owner must choose when none or conflicting.
  select coalesce(array_agg(distinct btrim(master_reference)), '{}') into _refs from public.products
    where id = any(array_append(_sources, _target)) and nullif(btrim(coalesce(master_reference, '')), '') is not null;
  if cardinality(_refs) = 1 then
    if _chosen is not null and _chosen <> _refs[1] then
      raise exception 'يوجد مرجع موحّد معتمد (%) — لن نستبدله أثناء الربط', _refs[1]; end if;
    _final := _refs[1];
  elsif _chosen is null then
    if cardinality(_refs) = 0 then raise exception 'اختر أو أدخل المرجع الموحّد قبل الربط';
    else raise exception 'المراجع الموحّدة مختلفة (%) — اختر مرجعاً واحداً قبل الربط', array_to_string(_refs, ' / '); end if;
  else
    _final := _chosen;
  end if;

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
        -- retire the source's stock record (zero it, ledgered) — it is NOT added to the target
        for _r in select warehouse_id, physical_qty from public.component_stock where component_id = _s.stock_component_id and physical_qty <> 0 loop
          perform public._apply_stock(_s.stock_component_id, _r.warehouse_id, 'adjustment', -_r.physical_qty, 0, 'ربط مع ' || _t.name || ' (بدون جمع)', 'MERGE', null, auth.uid());
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
    update public.channel_listings set product_id = _target, mapping_status = 'CONFIRMED' where product_id = _s.id and active;
    update public.channel_listings set product_id = _target where product_id = _s.id and not active;
    update public.products set active = false, archived_at = now(), ean = null where id = _s.id;
    update public.products set image_url = coalesce(image_url, _s.image_url) where id = _target;
  end loop;

  -- the owner confirmed the whole group: target's own active offers are confirmed too
  update public.channel_listings set mapping_status = 'CONFIRMED' where product_id = _target and active and mapping_status <> 'CONFIRMED';
  update public.products set master_reference = _final where id = _target and master_reference is distinct from _final;

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

-- Internal plan only: every confirmed FBR offer of the same product gets the SAME target (cap 999).
-- FBB / unconfirmed / inactive are excluded. Outbox rows are never dispatched while live_write_enabled is locked false.
CREATE OR REPLACE FUNCTION public.plan_stock_sync(_channel_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _org uuid; _rec record; _n int := 0; _payload jsonb; _hash text; _q int;
begin
  select organization_id into _org from public.sales_channels where id = _channel_id;
  if _org is null then raise exception 'Channel not found'; end if;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can plan stock sync'; end if;
  for _rec in select * from public.v_listing_sync where channel_id = _channel_id and computed_desired_qty is not null
      and fulfillment_method = 'FBR' and inventory_owner = 'INTERNAL' and mapping_status = 'CONFIRMED' and active loop
    _q := least(999, _rec.computed_desired_qty);
    update public.channel_listings set desired_publish_qty = _q where id = _rec.id;
    if _rec.last_pushed_qty is distinct from _q then
      _payload := jsonb_build_object('offer_id', _rec.external_offer_id, 'ean', coalesce(_rec.external_ean, _rec.product_ean), 'amount', _q);
      _hash := md5(_payload::text);
      update public.inventory_outbox set status = 'superseded' where listing_id = _rec.id and status = 'queued' and payload_hash <> _hash;
      insert into public.inventory_outbox(organization_id, channel_id, listing_id, desired_qty, payload, payload_hash, idempotency_key)
        values (_org, _channel_id, _rec.id, _q, _payload, _hash, _rec.id::text || ':' || _hash || ':' || coalesce(_rec.last_pushed_qty::text, 'none'))
        on conflict do nothing;
      update public.channel_listings set sync_status = 'pending' where id = _rec.id;
      _n := _n + 1;
    end if;
  end loop;
  return _n;
end $function$;