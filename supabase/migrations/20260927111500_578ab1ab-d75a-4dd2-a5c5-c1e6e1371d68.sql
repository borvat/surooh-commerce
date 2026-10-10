alter table public.sales_channels
  add column if not exists account_label text,
  add column if not exists last_product_sync_at timestamptz,
  add column if not exists last_order_sync_at timestamptz,
  add column if not exists is_demo boolean not null default false;

alter table public.channel_listings
  add column if not exists reference text,
  add column if not exists title text,
  add column if not exists bol_stock integer,
  add column if not exists bol_corrected_stock integer,
  add column if not exists for_sale boolean,
  add column if not exists countries text[],
  add column if not exists remote_modified_at timestamptz,
  add column if not exists raw jsonb;

drop index if exists public.cl_channel_product_method_uniq;
create index if not exists cl_product_idx on public.channel_listings(product_id);

alter table public.products
  add column if not exists stock_component_id uuid references public.components(id),
  add column if not exists image_url text,
  add column if not exists is_demo boolean not null default false;
create unique index if not exists products_stock_component_uniq on public.products(stock_component_id) where stock_component_id is not null;

-- credentials: encrypted by the server; no browser access at all
create table public.channel_credentials (
  channel_id uuid primary key references public.sales_channels(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  client_id text not null,
  client_id_last4 text not null,
  secret_ciphertext text not null,
  secret_iv text not null,
  status text not null default 'saved',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.channel_credentials to service_role;
alter table public.channel_credentials enable row level security;

-- safe status view for the browser (no secret material)
create or replace function public.channel_credential_status()
returns table(channel_id uuid, client_id_last4 text, status text, last_error text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.channel_id, c.client_id_last4, c.status, c.last_error, c.updated_at
  from public.channel_credentials c where public.is_org_member(c.organization_id)
$$;
revoke execute on function public.channel_credential_status() from public, anon;
grant execute on function public.channel_credential_status() to authenticated;

-- link existing demo stock to single products
update public.products p set stock_component_id = c.id
from public.components c
where p.sku = 'GAS-1' and c.sku = 'GAS-001' and c.organization_id = p.organization_id and p.stock_component_id is null;

insert into public.products(organization_id, sku, name, ean, product_type, stock_component_id)
select c.organization_id, v.psku, v.pname, v.ean, 'SIMPLE', c.id
from (values ('BURNER-001','BURNER-1','Burner','8712345000509'),('STOVE-001','STOVE-1','Stove','8712345000608')) v(csku, psku, pname, ean)
join public.components c on c.sku = v.csku
where not exists (select 1 from public.products p where p.organization_id = c.organization_id and p.sku = v.psku);

insert into public.bom_lines(product_id, component_id, quantity_required)
select p.id, p.stock_component_id, 1 from public.products p
where p.sku in ('BURNER-1','STOVE-1') and p.stock_component_id is not null
on conflict (product_id, component_id) do nothing;

update public.products set is_demo = true where sku in ('GAS-1','GAS-4','GAS-10','GAS4-BURNER1','GAS6-STOVE1','BURNER-1','STOVE-1');

-- placeholder listings (no bol offer) are replaced by real imports
delete from public.channel_listings where external_offer_id is null;

update public.sales_channels set account_label = case code when 'CH-1' then 'bol.com الحساب 1' when 'CH-2' then 'bol.com الحساب 2' else name end
where account_label is null;

-- mark a product as a stock item (creates hidden stock record once)
create or replace function public.set_product_as_stock_item(_product_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _p public.products; _cid uuid; _sku text;
begin
  select * into _p from public.products where id = _product_id for update;
  if _p.id is null then raise exception 'Product not found'; end if;
  if not public.has_org_role(_p.organization_id, array['admin']::public.app_role[]) then raise exception 'Only admins can change products'; end if;
  if _p.stock_component_id is not null then return _p.stock_component_id; end if;
  _sku := _p.sku;
  if exists (select 1 from public.components where organization_id = _p.organization_id and sku = _sku) then
    _sku := _sku || '-STK-' || substr(md5(_p.id::text), 1, 4);
  end if;
  insert into public.components(organization_id, sku, name, unit_of_measure, safety_stock, low_stock_threshold)
    values (_p.organization_id, _sku, _p.name, 'pcs', 0, 0) returning id into _cid;
  delete from public.bom_lines where product_id = _p.id;
  update public.products set stock_component_id = _cid, product_type = 'SIMPLE' where id = _p.id;
  insert into public.bom_lines(product_id, component_id, quantity_required) values (_p.id, _cid, 1);
  return _cid;
end $$;

-- set bundle contents from other products: [{product_id, qty}]
create or replace function public.set_bundle_contents(_product_id uuid, _items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare _p public.products; _it jsonb; _cid uuid; _lines jsonb := '[]'::jsonb; _phys int;
begin
  select * into _p from public.products where id = _product_id for update;
  if _p.id is null then raise exception 'Product not found'; end if;
  if not public.has_org_role(_p.organization_id, array['admin']::public.app_role[]) then raise exception 'Only admins can change products'; end if;
  if jsonb_array_length(coalesce(_items,'[]'::jsonb)) = 0 then raise exception 'اختر منتجاً واحداً على الأقل'; end if;
  for _it in select * from jsonb_array_elements(_items) loop
    if (_it->>'product_id')::uuid = _product_id then raise exception 'لا يمكن أن يحتوي المنتج على نفسه'; end if;
    if coalesce((_it->>'qty')::int, 0) <= 0 then raise exception 'الكمية يجب أن تكون أكبر من صفر'; end if;
    if not exists (select 1 from public.products where id = (_it->>'product_id')::uuid and organization_id = _p.organization_id) then
      raise exception 'Product not in this company'; end if;
    if exists (select 1 from public.products where id = (_it->>'product_id')::uuid and product_type = 'BUNDLE') then
      raise exception 'لا يمكن استخدام بندل داخل بندل آخر'; end if;
    _cid := public.set_product_as_stock_item((_it->>'product_id')::uuid);
    _lines := _lines || jsonb_build_object('component_id', _cid, 'quantity_required', (_it->>'qty')::int);
  end loop;
  if _p.stock_component_id is not null then
    select coalesce(sum(physical_qty),0) into _phys from public.component_stock where component_id = _p.stock_component_id;
    if _phys > 0 then raise exception 'هذا المنتج له مخزون خاص به (%). صفّر مخزونه أولاً قبل تحويله إلى بندل', _phys; end if;
    if exists (select 1 from public.bom_lines b join public.products x on x.id = b.product_id
               where b.component_id = _p.stock_component_id and x.id <> _p.id) then
      raise exception 'هذا المنتج مستخدم داخل بندل آخر، لا يمكن تحويله إلى بندل'; end if;
  end if;
  delete from public.bom_lines where product_id = _p.id;
  update public.products set product_type = 'BUNDLE', stock_component_id = null where id = _p.id;
  perform public.set_product_bom(_p.id, _lines);
end $$;

-- make a bundle a normal product again
create or replace function public.set_product_normal(_product_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _org uuid;
begin
  select organization_id into _org from public.products where id = _product_id;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can change products'; end if;
  delete from public.bom_lines where product_id = _product_id;
  update public.products set product_type = 'SIMPLE' where id = _product_id;
  perform public.set_product_as_stock_item(_product_id);
end $$;

-- save imported bol offers; matches products by EAN (suggestion only)
create or replace function public.upsert_bol_offers(_channel_id uuid, _offers jsonb, _full boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _org uuid; _o jsonb; _pid uuid; _ean text; _sku text; _n int := 0; _new int := 0; _ids text[] := '{}';
  _fm public.fulfillment_method; _title text;
begin
  select organization_id into _org from public.sales_channels where id = _channel_id;
  if _org is null then raise exception 'Account not found'; end if;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can import'; end if;
  for _o in select * from jsonb_array_elements(_offers) loop
    if coalesce(_o->>'offerId','') = '' then continue; end if;
    _ean := nullif(regexp_replace(coalesce(_o->>'ean',''), '\D', '', 'g'), '');
    _fm := case when upper(coalesce(_o->>'fulfilmentMethod','FBR')) in ('FBB','LVB') then 'FBB' else 'FBR' end;
    _title := nullif(_o->>'title','');
    _pid := null;
    if _ean is not null then select id into _pid from public.products where organization_id = _org and ean = _ean limit 1; end if;
    if _pid is null then
      _sku := coalesce(nullif(_o->>'reference',''), 'BOL-' || coalesce(_ean, _o->>'offerId'));
      if exists (select 1 from public.products where organization_id = _org and sku = _sku) then
        _sku := _sku || '-' || substr(md5(_o->>'offerId'), 1, 4); end if;
      insert into public.products(organization_id, sku, name, ean, product_type, is_demo)
        values (_org, _sku, coalesce(_title, 'EAN ' || coalesce(_ean, _o->>'offerId')),
                case when _ean ~ '^\d{8,14}$' then _ean end, 'SIMPLE', coalesce((_o->>'demo')::boolean,false))
        returning id into _pid;
      _new := _new + 1;
    elsif _title is not null then
      update public.products set name = _title where id = _pid and name like 'EAN %';
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
      countries = excluded.countries, remote_modified_at = excluded.remote_modified_at, raw = excluded.raw,
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

-- point a listing at a product and confirm
create or replace function public.confirm_listing(_listing_id uuid, _product_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _org uuid;
begin
  select organization_id into _org from public.channel_listings where id = _listing_id;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can confirm'; end if;
  if not exists (select 1 from public.products where id = _product_id and organization_id = _org) then raise exception 'Product not found'; end if;
  update public.channel_listings set product_id = _product_id, mapping_status = 'CONFIRMED' where id = _listing_id;
end $$;

-- set sync status (used by the server after testing a connection)
create or replace function public.set_channel_status(_channel_id uuid, _status text, _message text)
returns void language plpgsql security definer set search_path = public as $$
declare _org uuid;
begin
  select organization_id into _org from public.sales_channels where id = _channel_id;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins'; end if;
  if _status not in ('not_connected','connected','error','paused') then raise exception 'bad status'; end if;
  update public.sales_channels set status = _status, last_sync_message = _message where id = _channel_id;
end $$;

do $$ declare f text; begin
  foreach f in array array['set_product_as_stock_item(uuid)','set_bundle_contents(uuid,jsonb)','set_product_normal(uuid)',
    'upsert_bol_offers(uuid,jsonb,boolean)','confirm_listing(uuid,uuid)','set_channel_status(uuid,text,text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;