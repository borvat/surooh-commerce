alter table public.sales_channels
  add column if not exists retailer_id text,
  add column if not exists retailer_name text,
  add column if not exists retailer_info jsonb,
  add column if not exists retailer_synced_at timestamptz;

alter table public.channel_listings
  add column if not exists unit_price numeric(12,2),
  add column if not exists condition text,
  add column if not exists enriched_at timestamptz;

create index if not exists cl_enrich_idx on public.channel_listings(channel_id, enriched_at);

-- store the bol shop identity (name, id, rating) on the account
create or replace function public.set_channel_retailer(_channel_id uuid, _info jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare _org uuid;
begin
  select organization_id into _org from public.sales_channels where id = _channel_id;
  if _org is null then raise exception 'Account not found'; end if;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins'; end if;
  update public.sales_channels set
    retailer_id = nullif(_info->>'retailerId',''),
    retailer_name = nullif(_info->>'displayName',''),
    retailer_info = _info,
    retailer_synced_at = now(),
    account_label = coalesce(nullif(_info->>'displayName',''), account_label)
  where id = _channel_id;
end $$;

-- apply names, images, prices pulled from bol onto listings + products
create or replace function public.apply_bol_enrichment(_channel_id uuid, _rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare _org uuid; _r jsonb; _n int := 0; _pid uuid; _title text; _img text;
begin
  select organization_id into _org from public.sales_channels where id = _channel_id;
  if _org is null then raise exception 'Account not found'; end if;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins'; end if;
  for _r in select * from jsonb_array_elements(coalesce(_rows,'[]'::jsonb)) loop
    _title := nullif(btrim(coalesce(_r->>'title','')), '');
    _img := nullif(_r->>'imageUrl','');
    update public.channel_listings set
      title = coalesce(_title, title),
      unit_price = coalesce(nullif(_r->>'unitPrice','')::numeric, unit_price),
      condition = coalesce(nullif(_r->>'condition',''), condition),
      bol_stock = coalesce(nullif(_r->>'stock','')::int, bol_stock),
      bol_corrected_stock = coalesce(nullif(_r->>'correctedStock','')::int, bol_corrected_stock),
      for_sale = coalesce(case when _r ? 'forSale' then (_r->>'forSale')::boolean end, for_sale),
      countries = coalesce(case when jsonb_typeof(_r->'countries') = 'array'
        then array(select jsonb_array_elements_text(_r->'countries')) end, countries),
      enriched_at = now()
    where channel_id = _channel_id and external_offer_id = _r->>'offerId'
    returning product_id into _pid;
    if _pid is not null then
      update public.products set
        name = case when _title is not null and (name like 'EAN %' or name = sku or _r->>'force' = 'true') then _title else name end,
        image_url = coalesce(_img, image_url)
      where id = _pid and organization_id = _org;
    end if;
    _n := _n + 1;
  end loop;
  return _n;
end $$;

-- new imports: prefer the real title, then the internal reference, and only then EAN
create or replace function public.upsert_bol_offers(_channel_id uuid, _offers jsonb, _full boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _org uuid; _o jsonb; _pid uuid; _ean text; _sku text; _n int := 0; _new int := 0; _ids text[] := '{}';
  _fm public.fulfillment_method; _title text; _ref text; _label text;
begin
  select organization_id into _org from public.sales_channels where id = _channel_id;
  if _org is null then raise exception 'Account not found'; end if;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can import'; end if;
  for _o in select * from jsonb_array_elements(_offers) loop
    if coalesce(_o->>'offerId','') = '' then continue; end if;
    _ean := nullif(regexp_replace(coalesce(_o->>'ean',''), '\D', '', 'g'), '');
    _fm := case when upper(coalesce(_o->>'fulfilmentMethod','FBR')) in ('FBB','LVB') then 'FBB' else 'FBR' end;
    _title := nullif(btrim(coalesce(_o->>'title','')), '');
    _ref := nullif(btrim(regexp_replace(coalesce(_o->>'reference',''), '^@\s*', '')), '');
    _label := coalesce(_title, _ref, 'EAN ' || coalesce(_ean, _o->>'offerId'));
    _pid := null;
    if _ean is not null then select id into _pid from public.products where organization_id = _org and ean = _ean limit 1; end if;
    if _pid is null then
      _sku := coalesce(nullif(_o->>'reference',''), 'BOL-' || coalesce(_ean, _o->>'offerId'));
      if exists (select 1 from public.products where organization_id = _org and sku = _sku) then
        _sku := _sku || '-' || substr(md5(_o->>'offerId'), 1, 4); end if;
      insert into public.products(organization_id, sku, name, ean, product_type, is_demo)
        values (_org, _sku, _label, case when _ean ~ '^\d{8,14}$' then _ean end, 'SIMPLE', coalesce((_o->>'demo')::boolean,false))
        returning id into _pid;
      _new := _new + 1;
    else
      update public.products set name = _label where id = _pid and (name like 'EAN %' or name = sku) and _label not like 'EAN %';
    end if;
    insert into public.channel_listings(channel_id, organization_id, product_id, external_offer_id, external_ean, reference, title,
        fulfillment_method, inventory_owner, bol_stock, bol_corrected_stock, for_sale, countries, remote_modified_at, raw,
        mapping_status, active, last_synced_at)
      values (_channel_id, _org, _pid, _o->>'offerId', _ean, nullif(_o->>'reference',''), _title,
        _fm, case when _fm = 'FBB' then 'BOL' else 'INTERNAL' end::public.inventory_owner,
        nullif(_o->>'stock','')::int, nullif(_o->>'correctedStock','')::int,
        case when _o ? 'forSale' then (_o->>'forSale')::boolean end,
        case when jsonb_typeof(_o->'countries') = 'array' then array(select jsonb_array_elements_text(_o->'countries')) end,
        nullif(_o->>'modifiedAt','')::timestamptz, _o, 'SUGGESTED', true, now())
    on conflict (channel_id, external_offer_id) where external_offer_id is not null do update set
      external_ean = excluded.external_ean, reference = excluded.reference, title = coalesce(excluded.title, channel_listings.title),
      fulfillment_method = excluded.fulfillment_method, inventory_owner = excluded.inventory_owner,
      bol_stock = excluded.bol_stock, bol_corrected_stock = excluded.bol_corrected_stock, for_sale = excluded.for_sale,
      countries = coalesce(excluded.countries, channel_listings.countries),
      remote_modified_at = excluded.remote_modified_at, raw = excluded.raw,
      active = true, last_synced_at = now(),
      product_id = coalesce(channel_listings.product_id, excluded.product_id),
      mapping_status = case when channel_listings.mapping_status = 'UNMAPPED' then 'SUGGESTED' else channel_listings.mapping_status end;
    _ids := _ids || (_o->>'offerId');
    _n := _n + 1;
  end loop;
  if _full then
    update public.channel_listings set active = false where channel_id = _channel_id and external_offer_id is not null and not (external_offer_id = any(_ids));
  end if;
  update public.sales_channels set last_product_sync_at = now(), last_sync_message = null where id = _channel_id;
  return jsonb_build_object(
    'imported', _n, 'new_products', _new,
    'needs_review', (select count(*) from public.channel_listings where channel_id = _channel_id and active and mapping_status <> 'CONFIRMED'),
    'bundles', (select count(distinct l.product_id) from public.channel_listings l join public.products p on p.id = l.product_id where l.channel_id = _channel_id and l.active and p.product_type = 'BUNDLE'));
end $$;

do $$ declare f text; begin
  foreach f in array array['set_channel_retailer(uuid,jsonb)','apply_bol_enrichment(uuid,jsonb)','upsert_bol_offers(uuid,jsonb,boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- name existing imported products from their internal reference instead of "EAN ..."
update public.products p
set name = x.label
from (
  select l.product_id, nullif(btrim(regexp_replace(coalesce(l.title, l.reference, ''), '^@\s*', '')), '') as label
  from public.channel_listings l
  where l.product_id is not null and l.external_offer_id not like 'DEMO%'
) x
where p.id = x.product_id and x.label is not null and p.name like 'EAN %';

-- remove the old example (gas / burner / stove) data from the catalog
delete from public.channel_listings where external_offer_id like 'DEMO%';
update public.products set active = false, archived_at = now() where is_demo = true and archived_at is null;
update public.components set active = false, archived_at = now()
  where id in (select stock_component_id from public.products where is_demo = true and stock_component_id is not null)
  and archived_at is null;
update public.sales_channels set is_demo = false where is_demo = true;