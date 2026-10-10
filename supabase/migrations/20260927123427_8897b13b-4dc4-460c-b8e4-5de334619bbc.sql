create or replace function public.merge_products(_target uuid, _sources uuid[])
returns void language plpgsql security definer set search_path to 'public' as $$
declare _t public.products; _s public.products; _sid uuid; _tc uuid; _r record;
begin
  select * into _t from public.products where id = _target for update;
  if _t.id is null or _t.archived_at is not null then raise exception 'Target product not found'; end if;
  if not public.has_org_role(_t.organization_id, array['admin']::public.app_role[]) then raise exception 'Only admins can merge products'; end if;
  if _t.product_type = 'BUNDLE' then raise exception 'لا يمكن دمج بندل'; end if;
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
        -- hand the source's stock item to the target
        delete from public.bom_lines where product_id = _s.id;
        update public.products set stock_component_id = null where id = _s.id;
        update public.products set stock_component_id = _s.stock_component_id where id = _target;
        delete from public.bom_lines where product_id = _target;
        insert into public.bom_lines(product_id, component_id, quantity_required) values (_target, _s.stock_component_id, 1);
        update public.components set name = _t.name where id = _s.stock_component_id;
      else
        for _r in select warehouse_id, physical_qty from public.component_stock where component_id = _s.stock_component_id and physical_qty <> 0 loop
          perform public._apply_stock(_s.stock_component_id, _r.warehouse_id, 'adjustment', -_r.physical_qty, 0, 'دمج مع ' || _t.name, 'MERGE', null, auth.uid());
          perform public._apply_stock(_tc, _r.warehouse_id, 'adjustment', _r.physical_qty, 0, 'دمج من ' || _s.name, 'MERGE', null, auth.uid());
        end loop;
        -- bundles that used the source now use the target
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
    update public.products set active = false, archived_at = now(), ean = null,
      image_url = coalesce(image_url, null) where id = _s.id;
    update public.products set image_url = coalesce(image_url, _s.image_url) where id = _target;
  end loop;
end $$;

create or replace function public.unmerge_listing(_listing_id uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare _l public.channel_listings; _p public.products; _pid uuid; _ean text; _sku text;
begin
  select * into _l from public.channel_listings where id = _listing_id for update;
  if _l.id is null then raise exception 'Offer not found'; end if;
  if not public.has_org_role(_l.organization_id, array['admin']::public.app_role[]) then raise exception 'Only admins can change products'; end if;
  select * into _p from public.products where id = _l.product_id;
  if (select count(*) from public.channel_listings where product_id = _l.product_id and active) < 2 then
    raise exception 'هذا العرض هو الوحيد في المنتج'; end if;
  _ean := case when _l.external_ean ~ '^\d{8,14}$' and not exists (select 1 from public.products where organization_id = _l.organization_id and ean = _l.external_ean) then _l.external_ean end;
  _sku := 'BOL-' || coalesce(_l.external_ean, _l.external_offer_id, _l.id::text);
  if exists (select 1 from public.products where organization_id = _l.organization_id and sku = _sku) then
    _sku := _sku || '-' || substr(md5(_l.id::text || now()::text), 1, 4); end if;
  insert into public.products(organization_id, sku, name, ean, product_type, image_url)
    values (_l.organization_id, _sku, coalesce(_l.title, nullif(btrim(regexp_replace(coalesce(_l.reference,''), '^@\s*', '')), ''), 'EAN ' || coalesce(_l.external_ean, '')), _ean, 'SIMPLE', _p.image_url)
    returning id into _pid;
  update public.channel_listings set product_id = _pid, mapping_status = 'CONFIRMED' where id = _l.id;
  return _pid;
end $$;

revoke execute on function public.merge_products(uuid, uuid[]) from anon, public;
revoke execute on function public.unmerge_listing(uuid) from anon, public;
grant execute on function public.merge_products(uuid, uuid[]) to authenticated;
grant execute on function public.unmerge_listing(uuid) to authenticated;

-- import: an EAN already attached to a (merged) product's offer keeps going to that product
create or replace function public._product_for_ean(_org uuid, _ean text) returns uuid
language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select id from public.products where organization_id = _org and ean = _ean and archived_at is null limit 1),
    (select l.product_id from public.channel_listings l join public.products p on p.id = l.product_id
      where l.organization_id = _org and l.external_ean = _ean and p.archived_at is null order by l.active desc limit 1))
$$;
revoke execute on function public._product_for_ean(uuid, text) from anon, public, authenticated;