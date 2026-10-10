-- ===================== 1. ORGANIZATIONS =====================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index on public.organization_members(user_id);
grant select on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant all on public.organizations to service_role;
grant all on public.organization_members to service_role;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

insert into public.organizations(name, slug) values ('QNAN B.V.', 'qnan');
insert into public.organization_members(organization_id, user_id, role)
select (select id from public.organizations where slug='qnan'), user_id,
  (array_agg(role order by case role when 'admin' then 1 when 'warehouse' then 2 else 3 end))[1]
from public.user_roles group by user_id;

create or replace function public.is_org_member(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where organization_id = _org and user_id = auth.uid())
$$;
create or replace function public.has_org_role(_org uuid, _roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where organization_id = _org and user_id = auth.uid() and role = any(_roles))
$$;
create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select m.organization_id from public.organization_members m join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid() order by o.created_at limit 1
$$;

create policy "org read" on public.organizations for select to authenticated using (public.is_org_member(id));
create policy "members read" on public.organization_members for select to authenticated using (public.is_org_member(organization_id));

-- ===================== 2. ORG COLUMNS + BACKFILL =====================
alter table public.warehouses add column organization_id uuid references public.organizations(id);
alter table public.components add column organization_id uuid references public.organizations(id);
alter table public.products add column organization_id uuid references public.organizations(id);
alter table public.sales_channels add column organization_id uuid references public.organizations(id);
alter table public.channel_listings add column organization_id uuid references public.organizations(id);
alter table public.orders add column organization_id uuid references public.organizations(id);
alter table public.stock_movements add column organization_id uuid references public.organizations(id);
alter table public.audit_log add column organization_id uuid references public.organizations(id);

alter table public.warehouses disable trigger user;
alter table public.components disable trigger user;
alter table public.products disable trigger user;
alter table public.sales_channels disable trigger user;
alter table public.channel_listings disable trigger user;
alter table public.orders disable trigger user;
alter table public.stock_movements disable trigger user;
alter table public.audit_log disable trigger user;
update public.warehouses set organization_id = (select id from public.organizations where slug='qnan');
update public.components set organization_id = (select id from public.organizations where slug='qnan');
update public.products set organization_id = (select id from public.organizations where slug='qnan');
update public.sales_channels set organization_id = (select id from public.organizations where slug='qnan');
update public.channel_listings set organization_id = (select id from public.organizations where slug='qnan');
update public.orders set organization_id = (select id from public.organizations where slug='qnan');
update public.stock_movements set organization_id = (select id from public.organizations where slug='qnan');
update public.audit_log set organization_id = (select id from public.organizations where slug='qnan');
alter table public.warehouses enable trigger user;
alter table public.components enable trigger user;
alter table public.products enable trigger user;
alter table public.sales_channels enable trigger user;
alter table public.channel_listings enable trigger user;
alter table public.orders enable trigger user;
alter table public.stock_movements enable trigger user;
alter table public.audit_log enable trigger user;

alter table public.warehouses alter column organization_id set not null;
alter table public.components alter column organization_id set not null;
alter table public.products alter column organization_id set not null;
alter table public.sales_channels alter column organization_id set not null;
alter table public.channel_listings alter column organization_id set not null;
alter table public.orders alter column organization_id set not null;
alter table public.stock_movements alter column organization_id set not null;
create index on public.warehouses(organization_id);
create index on public.components(organization_id);
create index on public.products(organization_id);
create index on public.sales_channels(organization_id);
create index on public.channel_listings(organization_id);
create index on public.orders(organization_id, status);
create index on public.stock_movements(organization_id, created_at desc);
create index on public.audit_log(organization_id, id desc);

-- org-scoped uniqueness
alter table public.components drop constraint components_sku_key;
alter table public.components add constraint components_org_sku_key unique (organization_id, sku);
drop index public.components_barcode_uniq;
create unique index components_org_barcode_uniq on public.components(organization_id, barcode) where barcode is not null;
alter table public.products drop constraint products_sku_key;
alter table public.products add constraint products_org_sku_key unique (organization_id, sku);
alter table public.products drop constraint products_ean_key;
create unique index products_org_ean_uniq on public.products(organization_id, ean) where ean is not null;
alter table public.sales_channels drop constraint sales_channels_code_key;
alter table public.sales_channels add constraint sales_channels_org_code_key unique (organization_id, code);
alter table public.warehouses drop constraint warehouses_code_key;
alter table public.warehouses add constraint warehouses_org_code_key unique (organization_id, code);
drop index public.warehouses_one_default;
create unique index warehouses_one_default_per_org on public.warehouses(organization_id) where is_default;

-- default + immutable org on insert/update
create or replace function public.set_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' then
    if NEW.organization_id is distinct from OLD.organization_id then raise exception 'Organization cannot be changed'; end if;
    return NEW;
  end if;
  if TG_TABLE_NAME = 'channel_listings' then
    NEW.organization_id := (select organization_id from public.sales_channels where id = NEW.channel_id);
  elsif TG_TABLE_NAME = 'orders' then
    NEW.organization_id := (select organization_id from public.warehouses where id = NEW.warehouse_id);
  else
    NEW.organization_id := coalesce(NEW.organization_id, public.current_org_id());
  end if;
  if NEW.organization_id is null then raise exception 'No organization for this record'; end if;
  return NEW;
end $$;
create trigger wh_org before insert or update on public.warehouses for each row execute function public.set_org();
create trigger comp_org before insert or update on public.components for each row execute function public.set_org();
create trigger prod_org before insert or update on public.products for each row execute function public.set_org();
create trigger ch_org before insert or update on public.sales_channels for each row execute function public.set_org();
create trigger cl_org before insert or update on public.channel_listings for each row execute function public.set_org();
create trigger orders_org before insert or update on public.orders for each row execute function public.set_org();

-- ===================== 3. OWNERSHIP ENUMS / LISTINGS / CHANNELS =====================
create type public.fulfillment_method as enum ('FBR','FBB');
create type public.inventory_owner as enum ('INTERNAL','BOL');
create type public.mapping_status as enum ('UNMAPPED','SUGGESTED','CONFIRMED','EXCEPTION');
create type public.outbox_status as enum ('queued','sending','succeeded','failed','superseded');

alter table public.sales_channels
  add column stock_buffer integer not null default 0 check (stock_buffer >= 0),
  add column stock_cap integer check (stock_cap is null or stock_cap >= 0),
  add column live_write_enabled boolean not null default false,
  add column external_account_ref text;
-- Live marketplace writes are hard-disabled until a later migration explicitly lifts this.
alter table public.sales_channels add constraint sales_channels_live_write_disabled check (live_write_enabled = false);

alter table public.channel_listings drop constraint channel_listings_channel_id_product_id_key;
alter table public.channel_listings alter column product_id drop not null;
alter table public.channel_listings
  add column external_ean text,
  add column fulfillment_method public.fulfillment_method not null default 'FBR',
  add column inventory_owner public.inventory_owner not null default 'INTERNAL',
  add column desired_publish_qty integer,
  add column remote_reported_qty integer,
  add column last_synced_at timestamptz,
  add column sync_status text not null default 'never',
  add column mapping_status public.mapping_status not null default 'UNMAPPED',
  add column note text,
  add column updated_at timestamptz not null default now();
alter table public.channel_listings add constraint cl_owner_matches_method check (
  (fulfillment_method = 'FBR' and inventory_owner = 'INTERNAL') or (fulfillment_method = 'FBB' and inventory_owner = 'BOL'));
alter table public.channel_listings add constraint cl_mapped_needs_product check (
  mapping_status in ('UNMAPPED','EXCEPTION') or product_id is not null);
alter table public.channel_listings add constraint cl_sync_status_check check (
  sync_status in ('never','pending','in_sync','drift','error','disabled'));
create unique index cl_channel_product_method_uniq on public.channel_listings(channel_id, product_id, fulfillment_method) where product_id is not null;
create unique index cl_channel_offer_uniq on public.channel_listings(channel_id, external_offer_id) where external_offer_id is not null;
create trigger cl_touch before update on public.channel_listings for each row execute function public.touch_updated_at();
-- existing auto-generated listings were never confirmed by a human: mark as suggestions
update public.channel_listings set mapping_status = 'SUGGESTED';

alter table public.order_lines
  add column fulfillment_method public.fulfillment_method not null default 'FBR',
  add column inventory_owner public.inventory_owner not null default 'INTERNAL',
  add column listing_id uuid references public.channel_listings(id),
  add column remote_status text;
alter table public.order_lines add constraint ol_owner_matches_method check (
  (fulfillment_method = 'FBR' and inventory_owner = 'INTERNAL') or (fulfillment_method = 'FBB' and inventory_owner = 'BOL'));

-- ===================== 4. OUTBOX =====================
create table public.inventory_outbox (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  channel_id uuid not null references public.sales_channels(id),
  listing_id uuid not null references public.channel_listings(id),
  operation text not null default 'set_stock' check (operation in ('set_stock')),
  desired_qty integer not null check (desired_qty >= 0),
  payload jsonb not null,
  payload_hash text not null,
  idempotency_key text not null unique,
  status public.outbox_status not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  completed_at timestamptz
);
create unique index outbox_one_queued_per_listing on public.inventory_outbox(listing_id) where status = 'queued';
create unique index outbox_one_sending_per_listing on public.inventory_outbox(listing_id) where status = 'sending';
create index on public.inventory_outbox(organization_id, id desc);
grant select on public.inventory_outbox to authenticated;
grant all on public.inventory_outbox to service_role;
alter table public.inventory_outbox enable row level security;
create policy "outbox read" on public.inventory_outbox for select to authenticated using (public.is_org_member(organization_id));
create trigger outbox_touch before update on public.inventory_outbox for each row execute function public.touch_updated_at();

-- ===================== 5. REMOVE PLAINTEXT CREDENTIALS =====================
drop function if exists public.save_channel_credentials(uuid, text, text);
drop function if exists public.channel_credential_status();
drop table if exists public.channel_credentials;

-- ===================== 6. VIEWS =====================
create or replace view public.v_component_availability with (security_invoker = true) as
SELECT c.id, c.sku, c.name, c.barcode, c.unit_of_measure, c.safety_stock, c.low_stock_threshold, c.active, c.archived_at, c.created_at, c.updated_at,
  (COALESCE(sum(s.physical_qty), 0))::integer AS physical_qty,
  (COALESCE(sum(s.reserved_qty), 0))::integer AS reserved_qty,
  (GREATEST(COALESCE(sum(s.physical_qty), 0) - COALESCE(sum(s.reserved_qty), 0) - c.safety_stock, 0))::integer AS available_qty,
  (GREATEST(COALESCE(sum(s.physical_qty), 0) - COALESCE(sum(s.reserved_qty), 0) - c.safety_stock, 0) <= c.low_stock_threshold) AS is_low,
  c.organization_id
FROM components c LEFT JOIN component_stock s ON s.component_id = c.id
GROUP BY c.id;

create or replace view public.v_product_availability with (security_invoker = true) as
SELECT p.id, p.sku, p.name, p.ean, p.product_type, p.active, p.archived_at, p.created_at, p.updated_at,
  (count(b.id))::integer AS bom_line_count,
  CASE WHEN count(b.id) = 0 OR bool_or(NOT ca.active) THEN 0
       ELSE (min(floor(ca.available_qty::numeric / b.quantity_required::numeric)))::integer END AS available_qty,
  (array_agg(ca.sku ORDER BY floor(ca.available_qty::numeric / b.quantity_required::numeric), ca.sku) FILTER (WHERE b.id IS NOT NULL))[1] AS bottleneck_sku,
  p.organization_id
FROM products p
  LEFT JOIN bom_lines b ON b.product_id = p.id
  LEFT JOIN v_component_availability ca ON ca.id = b.component_id
GROUP BY p.id;

create view public.v_listing_sync with (security_invoker = true) as
select l.id, l.organization_id, l.channel_id, ch.code as channel_code, ch.name as channel_name,
  l.product_id, p.sku as product_sku, p.ean as product_ean, l.external_offer_id, l.external_ean,
  l.fulfillment_method, l.inventory_owner, l.mapping_status, l.active, l.note,
  pa.available_qty as derived_available, ch.stock_buffer, ch.stock_cap,
  case when l.inventory_owner = 'INTERNAL' and l.mapping_status = 'CONFIRMED' and l.active and pa.id is not null
    then least(coalesce(ch.stock_cap, 2147483647), greatest(0, pa.available_qty - ch.stock_buffer)) end as computed_desired_qty,
  l.desired_publish_qty, l.last_pushed_qty, l.last_pushed_at, l.remote_reported_qty, l.last_synced_at, l.sync_status,
  case
    when not l.active then 'inactive'
    when l.mapping_status <> 'CONFIRMED' then 'not_mapped'
    when l.inventory_owner = 'BOL' then 'remote_only'
    when l.last_pushed_qty is null then 'never_pushed'
    when least(coalesce(ch.stock_cap, 2147483647), greatest(0, pa.available_qty - ch.stock_buffer)) <> l.last_pushed_qty then 'pending_push'
    when l.remote_reported_qty is not null and l.remote_reported_qty <> l.last_pushed_qty then 'remote_mismatch'
    else 'in_sync' end as reconciliation_state
from channel_listings l
join sales_channels ch on ch.id = l.channel_id
left join products p on p.id = l.product_id
left join v_product_availability pa on pa.id = l.product_id;
grant select on public.v_listing_sync to authenticated;

-- ===================== 7. RLS REWRITE (org-scoped) =====================
drop policy "bom admin delete" on public.bom_lines;
drop policy "bom admin insert" on public.bom_lines;
drop policy "bom admin update" on public.bom_lines;
drop policy "bom read" on public.bom_lines;
drop policy "cl admin all" on public.channel_listings;
drop policy "cl read" on public.channel_listings;
drop policy "stock read" on public.component_stock;
drop policy "comp read" on public.components;
drop policy "comp write insert" on public.components;
drop policy "comp write update" on public.components;
drop policy "ol read" on public.order_lines;
drop policy "or read" on public.order_reservations;
drop policy "orders read" on public.orders;
drop policy "prod admin insert" on public.products;
drop policy "prod admin update" on public.products;
drop policy "prod read" on public.products;
drop policy "profiles readable by signed-in" on public.profiles;
drop policy "ch admin insert" on public.sales_channels;
drop policy "ch admin update" on public.sales_channels;
drop policy "ch read" on public.sales_channels;
drop policy "sm read" on public.stock_movements;
drop policy "wh admin insert" on public.warehouses;
drop policy "wh admin update" on public.warehouses;
drop policy "wh read" on public.warehouses;
drop policy "audit readable" on public.audit_log;

create policy "wh read" on public.warehouses for select to authenticated using (public.is_org_member(organization_id));
create policy "wh admin insert" on public.warehouses for insert to authenticated with check (public.has_org_role(organization_id, array['admin']::public.app_role[]));
create policy "wh admin update" on public.warehouses for update to authenticated using (public.has_org_role(organization_id, array['admin']::public.app_role[]));

create policy "comp read" on public.components for select to authenticated using (public.is_org_member(organization_id));
create policy "comp insert" on public.components for insert to authenticated with check (public.has_org_role(organization_id, array['admin','warehouse']::public.app_role[]));
create policy "comp update" on public.components for update to authenticated using (public.has_org_role(organization_id, array['admin','warehouse']::public.app_role[]));

create policy "prod read" on public.products for select to authenticated using (public.is_org_member(organization_id));
create policy "prod insert" on public.products for insert to authenticated with check (public.has_org_role(organization_id, array['admin']::public.app_role[]));
create policy "prod update" on public.products for update to authenticated using (public.has_org_role(organization_id, array['admin']::public.app_role[]));

create policy "bom read" on public.bom_lines for select to authenticated using (exists (select 1 from public.products p where p.id = product_id and public.is_org_member(p.organization_id)));

create policy "stock read" on public.component_stock for select to authenticated using (exists (select 1 from public.components c where c.id = component_id and public.is_org_member(c.organization_id)));

create policy "ch read" on public.sales_channels for select to authenticated using (public.is_org_member(organization_id));
create policy "ch insert" on public.sales_channels for insert to authenticated with check (public.has_org_role(organization_id, array['admin']::public.app_role[]));
create policy "ch update" on public.sales_channels for update to authenticated using (public.has_org_role(organization_id, array['admin']::public.app_role[]));

create policy "cl read" on public.channel_listings for select to authenticated using (public.is_org_member(organization_id));
create policy "cl insert" on public.channel_listings for insert to authenticated with check (public.has_org_role(organization_id, array['admin']::public.app_role[]));
create policy "cl update" on public.channel_listings for update to authenticated using (public.has_org_role(organization_id, array['admin']::public.app_role[]));

create policy "orders read" on public.orders for select to authenticated using (public.is_org_member(organization_id));
create policy "ol read" on public.order_lines for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and public.is_org_member(o.organization_id)));
create policy "or read" on public.order_reservations for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and public.is_org_member(o.organization_id)));
create policy "sm read" on public.stock_movements for select to authenticated using (public.is_org_member(organization_id));
create policy "audit read" on public.audit_log for select to authenticated using (organization_id is not null and public.is_org_member(organization_id));
create policy "profiles read" on public.profiles for select to authenticated using (
  id = auth.uid() or exists (select 1 from public.organization_members a join public.organization_members b on a.organization_id = b.organization_id
    where a.user_id = auth.uid() and b.user_id = profiles.id));

grant select, insert, update on public.channel_listings to authenticated;
revoke delete on public.channel_listings from authenticated;

-- ===================== 8. FUNCTIONS =====================
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare _row jsonb := coalesce(to_jsonb(NEW), to_jsonb(OLD)); _org uuid;
begin
  _org := nullif(_row->>'organization_id','')::uuid;
  if _org is null and TG_TABLE_NAME = 'bom_lines' then
    select organization_id into _org from public.products where id = (_row->>'product_id')::uuid;
  end if;
  insert into public.audit_log(entity, entity_id, action, old_data, new_data, user_id, organization_id)
  values (TG_TABLE_NAME, coalesce(_row->>'id', _row->>'component_id'), lower(TG_OP),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) end, auth.uid(), _org);
  return coalesce(NEW, OLD);
end $$;
create trigger cl_audit after insert or update on public.channel_listings for each row execute function public.audit_trigger();

create or replace function public.validate_bom() returns trigger
language plpgsql set search_path = public as $$
declare _t public.product_type; _n int; _po uuid; _co uuid;
begin
  select product_type, organization_id into _t, _po from public.products where id = NEW.product_id;
  select organization_id into _co from public.components where id = NEW.component_id;
  if _po is distinct from _co then raise exception 'Product and component must belong to the same organization'; end if;
  if _t = 'SIMPLE' then
    select count(*) into _n from public.bom_lines where product_id = NEW.product_id and id <> NEW.id;
    if _n > 0 or NEW.quantity_required <> 1 then
      raise exception 'SIMPLE products must map to exactly one component with quantity 1'; end if;
  end if;
  return NEW;
end $$;

create or replace function public.validate_listing() returns trigger
language plpgsql set search_path = public as $$
begin
  if NEW.product_id is not null and not exists (select 1 from public.products where id = NEW.product_id and organization_id = NEW.organization_id) then
    raise exception 'Listing product must belong to the same organization as the channel'; end if;
  return NEW;
end $$;
create trigger cl_validate before insert or update on public.channel_listings for each row execute function public.validate_listing();

drop function if exists public.set_user_role(uuid, public.app_role);
drop function if exists public.default_warehouse_id();
create or replace function public.default_warehouse_id(_org uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.warehouses where organization_id = _org and is_default limit 1
$$;

-- no more global "first user is admin": membership only
create or replace function public.bootstrap_user() returns text
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _role public.app_role;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  insert into public.profiles(id, email) values (_uid, auth.jwt() ->> 'email')
    on conflict (id) do update set email = excluded.email;
  select role into _role from public.organization_members where user_id = _uid and organization_id = public.current_org_id();
  return _role::text;
end $$;

create or replace function public.set_member_role(_org uuid, _email text, _role public.app_role) returns void
language plpgsql security definer set search_path = public as $$
declare _uid uuid;
begin
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only organization admins can manage members'; end if;
  select id into _uid from public.profiles where lower(email) = lower(trim(_email));
  if _uid is null then raise exception 'No user with that email has signed in yet'; end if;
  if _uid = auth.uid() and _role <> 'admin' then raise exception 'You cannot remove your own admin role'; end if;
  insert into public.organization_members(organization_id, user_id, role) values (_org, _uid, _role)
    on conflict (organization_id, user_id) do update set role = excluded.role;
  insert into public.audit_log(entity, entity_id, action, new_data, user_id, organization_id)
    values ('organization_member', _uid::text, 'set_role', jsonb_build_object('role', _role), auth.uid(), _org);
end $$;

create or replace function public.remove_member(_org uuid, _user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only organization admins can manage members'; end if;
  if _user_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  delete from public.organization_members where organization_id = _org and user_id = _user_id;
  insert into public.audit_log(entity, entity_id, action, user_id, organization_id)
    values ('organization_member', _user_id::text, 'removed', auth.uid(), _org);
end $$;

create or replace function public._apply_stock(_component uuid, _warehouse uuid, _type movement_type, _pdelta integer, _rdelta integer, _reason text, _reference text, _order uuid, _user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _p int; _r int; _org uuid;
begin
  select organization_id into _org from public.components where id = _component;
  if not exists (select 1 from public.warehouses where id = _warehouse and organization_id = _org) then
    raise exception 'Warehouse does not belong to the component''s organization'; end if;
  insert into public.component_stock(component_id, warehouse_id) values (_component, _warehouse) on conflict do nothing;
  select physical_qty, reserved_qty into _p, _r from public.component_stock
    where component_id = _component and warehouse_id = _warehouse for update;
  _p := _p + _pdelta; _r := _r + _rdelta;
  if _p < 0 then raise exception 'Physical stock cannot go negative'; end if;
  if _r < 0 then raise exception 'Reserved stock cannot go negative'; end if;
  if _r > _p then raise exception 'Physical stock cannot drop below reserved stock (% reserved)', _r; end if;
  update public.component_stock set physical_qty = _p, reserved_qty = _r, updated_at = now()
    where component_id = _component and warehouse_id = _warehouse;
  insert into public.stock_movements(component_id, warehouse_id, movement_type, physical_delta, reserved_delta,
    physical_after, reserved_after, reason, reference, order_id, user_id, organization_id)
  values (_component, _warehouse, _type, _pdelta, _rdelta, _p, _r, _reason, _reference, _order, _user, _org);
end $$;

create or replace function public.post_stock_movement(_component_id uuid, _movement_type movement_type, _quantity integer, _reason text, _reference text default null, _warehouse_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare _org uuid; _wh uuid; _delta int;
begin
  select organization_id into _org from public.components where id = _component_id;
  if _org is null then raise exception 'Component not found'; end if;
  if not public.has_org_role(_org, array['admin','warehouse']::public.app_role[]) then raise exception 'Insufficient permissions'; end if;
  _wh := coalesce(_warehouse_id, public.default_warehouse_id(_org));
  if _reason is null or length(trim(_reason)) = 0 then raise exception 'A reason is required'; end if;
  if _movement_type in ('receipt','return') then
    if _quantity <= 0 then raise exception 'Quantity must be positive'; end if; _delta := _quantity;
  elsif _movement_type = 'damaged' then
    if _quantity <= 0 then raise exception 'Quantity must be positive'; end if; _delta := -_quantity;
  elsif _movement_type = 'adjustment' then
    if _quantity = 0 then raise exception 'Adjustment cannot be zero'; end if; _delta := _quantity;
  else raise exception 'Use order actions for % movements', _movement_type; end if;
  perform public._apply_stock(_component_id, _wh, _movement_type, _delta, 0, _reason, _reference, null, auth.uid());
  insert into public.audit_log(entity, entity_id, action, new_data, user_id, organization_id)
  values ('component_stock', _component_id::text, 'movement_' || _movement_type,
    jsonb_build_object('quantity', _delta, 'reason', _reason, 'reference', _reference, 'warehouse_id', _wh), auth.uid(), _org);
end $$;

-- place_order: lines [{product_id, quantity, fulfillment_method?, listing_id?}]
-- FBR/INTERNAL lines reserve BOM components; FBB/BOL lines are recorded only (bol owns that stock).
create or replace function public.place_order(_lines jsonb, _channel_id uuid default null, _external_ref text default null, _note text default null, _warehouse_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _org uuid; _wh uuid; _order uuid; _rec record; _avail int;
begin
  if jsonb_typeof(_lines) <> 'array' or jsonb_array_length(_lines) = 0 then raise exception 'Order needs at least one line'; end if;
  drop table if exists _ol_raw; drop table if exists _ol; drop table if exists _need;
  create temp table _ol_raw on commit drop as
    select (l->>'product_id')::uuid as product_id, (l->>'quantity')::int as quantity,
      nullif(l->>'listing_id','')::uuid as listing_id,
      coalesce(nullif(l->>'fulfillment_method',''), 'FBR')::public.fulfillment_method as fm
    from jsonb_array_elements(_lines) l;
  -- listing (if given) is the authority for method/owner
  update _ol_raw r set fm = cl.fulfillment_method from public.channel_listings cl where cl.id = r.listing_id;
  if exists (select 1 from _ol_raw r left join public.channel_listings cl on cl.id = r.listing_id
             where r.listing_id is not null and (cl.id is null or cl.mapping_status <> 'CONFIRMED' or cl.product_id is distinct from r.product_id)) then
    raise exception 'Order line references a listing that is not a confirmed mapping for that product'; end if;
  select distinct organization_id into _org from public.products where id in (select product_id from _ol_raw);
  if _org is null or (select count(distinct organization_id) from public.products where id in (select product_id from _ol_raw)) <> 1 then
    raise exception 'Order contains unknown products or products from several organizations'; end if;
  if not public.has_org_role(_org, array['admin','warehouse']::public.app_role[]) then raise exception 'Insufficient permissions'; end if;
  if _channel_id is not null and not exists (select 1 from public.sales_channels where id = _channel_id and organization_id = _org) then
    raise exception 'Channel belongs to another organization'; end if;
  _wh := coalesce(_warehouse_id, public.default_warehouse_id(_org));
  if _wh is null or not exists (select 1 from public.warehouses where id = _wh and organization_id = _org) then raise exception 'No warehouse configured'; end if;

  create temp table _ol on commit drop as
    select product_id, fm, max(listing_id::text)::uuid as listing_id, sum(quantity)::int as quantity from _ol_raw group by product_id, fm;
  if exists (select 1 from _ol where quantity is null or quantity <= 0) then raise exception 'Line quantities must be positive'; end if;
  if exists (select 1 from _ol o join public.products p on p.id = o.product_id where not p.active) then raise exception 'Order contains inactive products'; end if;
  if exists (select 1 from _ol o where o.fm = 'FBR' and not exists (select 1 from public.bom_lines b where b.product_id = o.product_id)) then
    raise exception 'An FBR line contains a product without a BOM'; end if;

  -- only inventory-owned (FBR/INTERNAL) lines touch internal components
  create temp table _need on commit drop as
    select b.component_id, sum(b.quantity_required * o.quantity)::int as qty
    from _ol o join public.bom_lines b on b.product_id = o.product_id where o.fm = 'FBR' group by 1;

  insert into public.component_stock(component_id, warehouse_id) select component_id, _wh from _need on conflict do nothing;
  perform 1 from public.component_stock s where s.warehouse_id = _wh and s.component_id in (select component_id from _need)
    order by s.component_id for update;
  for _rec in select n.component_id, n.qty, c.sku, c.safety_stock, c.active, s.physical_qty, s.reserved_qty
      from _need n join public.components c on c.id = n.component_id
      join public.component_stock s on s.component_id = n.component_id and s.warehouse_id = _wh loop
    if not _rec.active then raise exception 'Component % is inactive', _rec.sku; end if;
    _avail := greatest(_rec.physical_qty - _rec.reserved_qty - _rec.safety_stock, 0);
    if _avail < _rec.qty then raise exception 'Insufficient stock for %: need %, available %', _rec.sku, _rec.qty, _avail; end if;
  end loop;

  insert into public.orders(channel_id, warehouse_id, external_ref, note, created_by)
    values (_channel_id, _wh, nullif(trim(_external_ref),''), _note, auth.uid()) returning id into _order;
  insert into public.order_lines(order_id, product_id, quantity, fulfillment_method, inventory_owner, listing_id, remote_status)
    select _order, product_id, quantity, fm, case fm when 'FBB' then 'BOL'::public.inventory_owner else 'INTERNAL'::public.inventory_owner end,
      listing_id, case fm when 'FBB' then 'awaiting_bol' end from _ol;
  insert into public.order_reservations(order_id, component_id, warehouse_id, quantity) select _order, component_id, _wh, qty from _need;
  for _rec in select component_id, qty from _need order by component_id loop
    perform public._apply_stock(_rec.component_id, _wh, 'reservation', 0, _rec.qty, 'Order reservation', coalesce(_external_ref, _order::text), _order, auth.uid());
  end loop;
  return _order;
end $$;

create or replace function public.fulfill_order(_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare _o record; _rec record;
begin
  select * into _o from public.orders where id = _order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not public.has_org_role(_o.organization_id, array['admin','warehouse']::public.app_role[]) then raise exception 'Insufficient permissions'; end if;
  if _o.status <> 'placed' then raise exception 'Only placed orders can be fulfilled (current: %)', _o.status; end if;
  for _rec in select * from public.order_reservations where order_id = _order_id order by component_id loop
    perform public._apply_stock(_rec.component_id, _rec.warehouse_id, 'sale', -_rec.quantity, -_rec.quantity,
      'Order fulfilled', coalesce(_o.external_ref, _o.id::text), _o.id, auth.uid());
  end loop;
  update public.order_lines set remote_status = 'fulfilled_by_bol' where order_id = _order_id and inventory_owner = 'BOL';
  update public.orders set status = 'fulfilled', fulfilled_at = now() where id = _order_id;
end $$;

create or replace function public.cancel_order(_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare _o record; _rec record;
begin
  select * into _o from public.orders where id = _order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not public.has_org_role(_o.organization_id, array['admin','warehouse']::public.app_role[]) then raise exception 'Insufficient permissions'; end if;
  if _o.status <> 'placed' then raise exception 'Only placed orders can be cancelled (current: %)', _o.status; end if;
  for _rec in select * from public.order_reservations where order_id = _order_id order by component_id loop
    perform public._apply_stock(_rec.component_id, _rec.warehouse_id, 'release', 0, -_rec.quantity,
      'Order cancelled', coalesce(_o.external_ref, _o.id::text), _o.id, auth.uid());
  end loop;
  update public.order_lines set remote_status = 'cancelled' where order_id = _order_id and inventory_owner = 'BOL';
  update public.orders set status = 'cancelled', cancelled_at = now() where id = _order_id;
end $$;

create or replace function public.set_product_bom(_product_id uuid, _lines jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare _org uuid;
begin
  select organization_id into _org from public.products where id = _product_id;
  if _org is null then raise exception 'Product not found'; end if;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can edit BOMs'; end if;
  if exists (select 1 from jsonb_array_elements(_lines) l where coalesce((l->>'quantity_required')::int,0) <= 0) then
    raise exception 'quantity_required must be greater than 0'; end if;
  delete from public.bom_lines where product_id = _product_id
    and component_id not in (select (l->>'component_id')::uuid from jsonb_array_elements(_lines) l);
  insert into public.bom_lines(product_id, component_id, quantity_required)
    select _product_id, (l->>'component_id')::uuid, (l->>'quantity_required')::int from jsonb_array_elements(_lines) l
  on conflict (product_id, component_id) do update set quantity_required = excluded.quantity_required
    where public.bom_lines.quantity_required <> excluded.quantity_required;
end $$;

-- Plan a stock push: compute desired qty per confirmed INTERNAL listing and queue an outbox entry.
-- Nothing is sent: there is no worker, and live writes are hard-disabled on every channel.
create or replace function public.plan_stock_sync(_channel_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare _org uuid; _rec record; _n int := 0; _payload jsonb; _hash text;
begin
  select organization_id into _org from public.sales_channels where id = _channel_id;
  if _org is null then raise exception 'Channel not found'; end if;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can plan stock sync'; end if;
  for _rec in select * from public.v_listing_sync where channel_id = _channel_id and computed_desired_qty is not null loop
    update public.channel_listings set desired_publish_qty = _rec.computed_desired_qty where id = _rec.id;
    if _rec.last_pushed_qty is distinct from _rec.computed_desired_qty then
      _payload := jsonb_build_object('offer_id', _rec.external_offer_id, 'ean', coalesce(_rec.external_ean, _rec.product_ean), 'amount', _rec.computed_desired_qty);
      _hash := md5(_payload::text);
      update public.inventory_outbox set status = 'superseded' where listing_id = _rec.id and status = 'queued' and payload_hash <> _hash;
      insert into public.inventory_outbox(organization_id, channel_id, listing_id, desired_qty, payload, payload_hash, idempotency_key)
        values (_org, _channel_id, _rec.id, _rec.computed_desired_qty, _payload, _hash,
          _rec.id::text || ':' || _hash || ':' || coalesce(_rec.last_pushed_qty::text, 'none'))
        on conflict do nothing;
      update public.channel_listings set sync_status = 'pending' where id = _rec.id;
      _n := _n + 1;
    end if;
  end loop;
  return _n;
end $$;

-- ===================== 9. CSV IMPORTS (validate first; apply is all-or-nothing) =====================
create or replace function public._is_int(_t text) returns boolean language sql immutable as $$ select _t ~ '^\s*\d+\s*$' $$;
create or replace function public._err(_row int, _msg text) returns jsonb language sql immutable as $$ select jsonb_build_array(jsonb_build_object('row', _row, 'message', _msg)) $$;

create or replace function public.import_components(_rows jsonb, _apply boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare _org uuid := public.current_org_id(); r jsonb; i int := 0; errs jsonb := '[]'; _new int := 0; _upd int := 0;
  _sku text; _wh uuid; _cid uuid; _cur int; _res int; _target int;
begin
  if not public.has_org_role(_org, array['admin','warehouse']::public.app_role[]) then raise exception 'Insufficient permissions'; end if;
  for r in select * from jsonb_array_elements(_rows) loop
    i := i + 1; _sku := trim(coalesce(r->>'component_sku',''));
    if _sku = '' then errs := errs || public._err(i, 'component_sku is required'); continue; end if;
    if trim(coalesce(r->>'name','')) = '' then errs := errs || public._err(i, 'name is required'); end if;
    if (select count(*) from jsonb_array_elements(_rows) x where trim(x->>'component_sku') = _sku) > 1 then errs := errs || public._err(i, 'duplicate component_sku in file: ' || _sku); end if;
    if not public._is_int(coalesce(r->>'physical_qty','')) then errs := errs || public._err(i, 'physical_qty must be a whole number ≥ 0'); end if;
    if coalesce(r->>'safety_stock','') <> '' and not public._is_int(r->>'safety_stock') then errs := errs || public._err(i, 'safety_stock must be a whole number ≥ 0'); end if;
    if coalesce(r->>'low_stock_threshold','') <> '' and not public._is_int(r->>'low_stock_threshold') then errs := errs || public._err(i, 'low_stock_threshold must be a whole number ≥ 0'); end if;
    _wh := case when coalesce(trim(r->>'warehouse'),'') = '' then public.default_warehouse_id(_org)
      else (select id from public.warehouses where organization_id = _org and code = trim(r->>'warehouse')) end;
    if _wh is null then errs := errs || public._err(i, 'unknown warehouse: ' || coalesce(r->>'warehouse','(default)')); end if;
    if coalesce(trim(r->>'barcode'),'') <> '' and exists (select 1 from public.components where organization_id = _org and barcode = trim(r->>'barcode') and sku <> _sku) then
      errs := errs || public._err(i, 'barcode already used by another component'); end if;
    select id into _cid from public.components where organization_id = _org and sku = _sku;
    if _cid is null then _new := _new + 1; else
      _upd := _upd + 1;
      select reserved_qty into _res from public.component_stock where component_id = _cid and warehouse_id = _wh;
      if public._is_int(coalesce(r->>'physical_qty','')) and (r->>'physical_qty')::int < coalesce(_res,0) then
        errs := errs || public._err(i, format('physical_qty %s is below reserved %s', r->>'physical_qty', _res)); end if;
    end if;
  end loop;
  if jsonb_array_length(errs) > 0 or not _apply then
    return jsonb_build_object('ok', jsonb_array_length(errs) = 0, 'applied', false, 'errors', errs, 'rows', i, 'creates', _new, 'updates', _upd);
  end if;
  for r in select * from jsonb_array_elements(_rows) loop
    _sku := trim(r->>'component_sku');
    _wh := case when coalesce(trim(r->>'warehouse'),'') = '' then public.default_warehouse_id(_org)
      else (select id from public.warehouses where organization_id = _org and code = trim(r->>'warehouse')) end;
    insert into public.components(organization_id, sku, name, barcode, safety_stock, low_stock_threshold)
      values (_org, _sku, trim(r->>'name'), nullif(trim(coalesce(r->>'barcode','')),''),
        coalesce(nullif(trim(coalesce(r->>'safety_stock','')),'')::int, 0), coalesce(nullif(trim(coalesce(r->>'low_stock_threshold','')),'')::int, 0))
    on conflict (organization_id, sku) do update set name = excluded.name, barcode = excluded.barcode,
      safety_stock = excluded.safety_stock, low_stock_threshold = excluded.low_stock_threshold
    returning id into _cid;
    select coalesce(physical_qty,0) into _cur from public.component_stock where component_id = _cid and warehouse_id = _wh;
    _target := (r->>'physical_qty')::int;
    if _target - coalesce(_cur,0) <> 0 then
      perform public._apply_stock(_cid, _wh, 'adjustment', _target - coalesce(_cur,0), 0, 'CSV import (set to ' || _target || ')', 'csv-import', null, auth.uid());
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'applied', true, 'errors', '[]'::jsonb, 'rows', i, 'creates', _new, 'updates', _upd);
end $$;

create or replace function public.import_products(_rows jsonb, _apply boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare _org uuid := public.current_org_id(); r jsonb; i int := 0; errs jsonb := '[]'; _new int := 0; _upd int := 0; _sku text; _ean text; _type text;
begin
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can import products'; end if;
  for r in select * from jsonb_array_elements(_rows) loop
    i := i + 1; _sku := trim(coalesce(r->>'product_sku','')); _ean := nullif(trim(coalesce(r->>'ean','')),''); _type := upper(coalesce(nullif(trim(r->>'type'),''),'BUNDLE'));
    if _sku = '' then errs := errs || public._err(i, 'product_sku is required'); continue; end if;
    if trim(coalesce(r->>'name','')) = '' then errs := errs || public._err(i, 'name is required'); end if;
    if _type not in ('SIMPLE','BUNDLE') then errs := errs || public._err(i, 'type must be SIMPLE or BUNDLE'); end if;
    if (select count(*) from jsonb_array_elements(_rows) x where trim(x->>'product_sku') = _sku) > 1 then errs := errs || public._err(i, 'duplicate product_sku in file'); end if;
    if _ean is not null then
      if _ean !~ '^[0-9]{8,14}$' then errs := errs || public._err(i, 'ean must be 8–14 digits'); end if;
      if (select count(*) from jsonb_array_elements(_rows) x where trim(x->>'ean') = _ean) > 1 then errs := errs || public._err(i, 'duplicate ean in file'); end if;
      if exists (select 1 from public.products where organization_id = _org and ean = _ean and sku <> _sku) then errs := errs || public._err(i, 'ean already used by another product'); end if;
    end if;
    if exists (select 1 from public.products where organization_id = _org and sku = _sku) then _upd := _upd + 1; else _new := _new + 1; end if;
  end loop;
  if jsonb_array_length(errs) > 0 or not _apply then
    return jsonb_build_object('ok', jsonb_array_length(errs) = 0, 'applied', false, 'errors', errs, 'rows', i, 'creates', _new, 'updates', _upd);
  end if;
  for r in select * from jsonb_array_elements(_rows) loop
    insert into public.products(organization_id, sku, name, ean, product_type)
      values (_org, trim(r->>'product_sku'), trim(r->>'name'), nullif(trim(coalesce(r->>'ean','')),''), upper(coalesce(nullif(trim(r->>'type'),''),'BUNDLE'))::public.product_type)
    on conflict (organization_id, sku) do update set name = excluded.name, ean = excluded.ean, product_type = excluded.product_type;
  end loop;
  return jsonb_build_object('ok', true, 'applied', true, 'errors', '[]'::jsonb, 'rows', i, 'creates', _new, 'updates', _upd);
end $$;

create or replace function public.import_bom(_rows jsonb, _apply boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare _org uuid := public.current_org_id(); r jsonb; i int := 0; errs jsonb := '[]'; _p record; _c uuid; _prod record;
begin
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can import BOMs'; end if;
  for r in select * from jsonb_array_elements(_rows) loop
    i := i + 1;
    select id, product_type into _p from public.products where organization_id = _org and sku = trim(coalesce(r->>'product_sku',''));
    if _p.id is null then errs := errs || public._err(i, 'unknown product_sku: ' || coalesce(r->>'product_sku','')); end if;
    select id into _c from public.components where organization_id = _org and sku = trim(coalesce(r->>'component_sku','')) and active;
    if _c is null then errs := errs || public._err(i, 'unknown or archived component_sku: ' || coalesce(r->>'component_sku','')); end if;
    if not public._is_int(coalesce(r->>'quantity_required','')) or (r->>'quantity_required')::int <= 0 then errs := errs || public._err(i, 'quantity_required must be a whole number > 0'); end if;
    if (select count(*) from jsonb_array_elements(_rows) x where trim(x->>'product_sku') = trim(r->>'product_sku') and trim(x->>'component_sku') = trim(r->>'component_sku')) > 1 then
      errs := errs || public._err(i, 'duplicate product/component pair in file'); end if;
    if _p.product_type = 'SIMPLE' and ((select count(*) from jsonb_array_elements(_rows) x where trim(x->>'product_sku') = trim(r->>'product_sku')) > 1 or coalesce(r->>'quantity_required','') <> '1') then
      errs := errs || public._err(i, 'SIMPLE product must have exactly one component with quantity 1'); end if;
    _p := null; _c := null;
  end loop;
  if jsonb_array_length(errs) > 0 or not _apply then
    return jsonb_build_object('ok', jsonb_array_length(errs) = 0, 'applied', false, 'errors', errs, 'rows', i,
      'products', (select count(distinct trim(x->>'product_sku')) from jsonb_array_elements(_rows) x));
  end if;
  -- each product listed in the file gets its BOM replaced by exactly the file's lines
  for _prod in select p.id, jsonb_agg(jsonb_build_object('component_id', c.id, 'quantity_required', (x->>'quantity_required')::int)) as lines
      from jsonb_array_elements(_rows) x
      join public.products p on p.organization_id = _org and p.sku = trim(x->>'product_sku')
      join public.components c on c.organization_id = _org and c.sku = trim(x->>'component_sku')
      group by p.id loop
    perform public.set_product_bom(_prod.id, _prod.lines);
  end loop;
  return jsonb_build_object('ok', true, 'applied', true, 'errors', '[]'::jsonb, 'rows', i);
end $$;

create or replace function public.import_listings(_rows jsonb, _apply boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare _org uuid := public.current_org_id(); r jsonb; i int := 0; errs jsonb := '[]'; warns jsonb := '[]';
  _ch uuid; _pid uuid; _pean text; _fm text; _own text; _ms text; _offer text; _lid uuid;
begin
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can import listings'; end if;
  for r in select * from jsonb_array_elements(_rows) loop
    i := i + 1;
    _ch := (select id from public.sales_channels where organization_id = _org and code = trim(coalesce(r->>'channel_code','')));
    if _ch is null then errs := errs || public._err(i, 'unknown channel_code: ' || coalesce(r->>'channel_code','')); end if;
    _fm := upper(trim(coalesce(r->>'fulfillment_method',''))); _own := upper(trim(coalesce(r->>'inventory_owner','')));
    _ms := upper(coalesce(nullif(trim(r->>'mapping_status'),''),'SUGGESTED'));
    if _fm not in ('FBR','FBB') then errs := errs || public._err(i, 'fulfillment_method must be FBR or FBB'); end if;
    if not ((_fm = 'FBR' and _own = 'INTERNAL') or (_fm = 'FBB' and _own = 'BOL')) then
      errs := errs || public._err(i, 'inventory_owner must be INTERNAL for FBR and BOL for FBB'); end if;
    if _ms not in ('UNMAPPED','SUGGESTED','CONFIRMED','EXCEPTION') then errs := errs || public._err(i, 'invalid mapping_status'); end if;
    _pid := null; _pean := null;
    if coalesce(trim(r->>'product_sku'),'') <> '' then
      select id, ean into _pid, _pean from public.products where organization_id = _org and sku = trim(r->>'product_sku');
      if _pid is null then errs := errs || public._err(i, 'unknown product_sku: ' || (r->>'product_sku')); end if;
    elsif _ms in ('SUGGESTED','CONFIRMED') then errs := errs || public._err(i, 'product_sku is required for SUGGESTED/CONFIRMED'); end if;
    _offer := nullif(trim(coalesce(r->>'external_offer_id','')),'');
    if _offer is not null and (select count(*) from jsonb_array_elements(_rows) x where trim(x->>'channel_code') = trim(r->>'channel_code') and trim(x->>'external_offer_id') = _offer) > 1 then
      errs := errs || public._err(i, 'duplicate external_offer_id for this channel in file'); end if;
    if _pean is not null and nullif(trim(coalesce(r->>'external_ean','')),'') is not null and _pean <> trim(r->>'external_ean') then
      warns := warns || public._err(i, 'external_ean differs from the product EAN — check the mapping (EAN is only a hint)'); end if;
  end loop;
  if jsonb_array_length(errs) > 0 or not _apply then
    return jsonb_build_object('ok', jsonb_array_length(errs) = 0, 'applied', false, 'errors', errs, 'warnings', warns, 'rows', i);
  end if;
  for r in select * from jsonb_array_elements(_rows) loop
    _ch := (select id from public.sales_channels where organization_id = _org and code = trim(r->>'channel_code'));
    _pid := (select id from public.products where organization_id = _org and sku = nullif(trim(coalesce(r->>'product_sku','')),''));
    _fm := upper(trim(r->>'fulfillment_method')); _offer := nullif(trim(coalesce(r->>'external_offer_id','')),'');
    _lid := null;
    if _offer is not null then select id into _lid from public.channel_listings where channel_id = _ch and external_offer_id = _offer; end if;
    if _lid is null and _pid is not null then select id into _lid from public.channel_listings where channel_id = _ch and product_id = _pid and fulfillment_method = _fm::public.fulfillment_method; end if;
    if _lid is null then
      insert into public.channel_listings(channel_id, product_id, external_offer_id, external_ean, fulfillment_method, inventory_owner, mapping_status)
      values (_ch, _pid, _offer, nullif(trim(coalesce(r->>'external_ean','')),''), _fm::public.fulfillment_method,
        upper(trim(r->>'inventory_owner'))::public.inventory_owner, upper(coalesce(nullif(trim(r->>'mapping_status'),''),'SUGGESTED'))::public.mapping_status);
    else
      update public.channel_listings set product_id = _pid, external_offer_id = coalesce(_offer, external_offer_id),
        external_ean = nullif(trim(coalesce(r->>'external_ean','')),''), fulfillment_method = _fm::public.fulfillment_method,
        inventory_owner = upper(trim(r->>'inventory_owner'))::public.inventory_owner,
        mapping_status = upper(coalesce(nullif(trim(r->>'mapping_status'),''),'SUGGESTED'))::public.mapping_status
      where id = _lid;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'applied', true, 'errors', '[]'::jsonb, 'warnings', warns, 'rows', i);
end $$;

-- ===================== 10. ACCEPTANCE TEST (fully rolled back) =====================
create or replace function public._chk(_step text, _name text, _exp int, _act int) returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('step', _step, 'check', _name, 'expected', _exp, 'actual', _act, 'pass', _exp is not distinct from _act))
$$;

create or replace function public.run_acceptance_test() returns jsonb
language plpgsql security definer set search_path = public as $$
declare _org uuid := public.current_org_id(); _wh uuid; checks jsonb := '[]';
  _gas uuid; _bur uuid; _sto uuid; _g10 uuid; _o uuid; _rec record;
  function_ok boolean;
begin
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can run the acceptance test'; end if;
  _wh := public.default_warehouse_id(_org);
  select id into _gas from public.components where organization_id = _org and sku = 'GAS-001';
  select id into _bur from public.components where organization_id = _org and sku = 'BURNER-001';
  select id into _sto from public.components where organization_id = _org and sku = 'STOVE-001';
  select id into _g10 from public.products where organization_id = _org and sku = 'GAS-10';
  if _gas is null or _bur is null or _sto is null or _g10 is null then
    return jsonb_build_object('ok', false, 'error', 'Demo components/products (GAS-001, BURNER-001, STOVE-001, GAS-10) not found');
  end if;
  begin
    -- sandbox: clear open orders and reset the demo stock to the brief's values (all rolled back below)
    for _rec in select id from public.orders where organization_id = _org and status = 'placed' loop perform public.cancel_order(_rec.id); end loop;
    update public.components set safety_stock = 50 where id = _gas;
    update public.components set safety_stock = 10 where id = _bur;
    update public.components set safety_stock = 5 where id = _sto;
    for _rec in select * from (values (_gas, 3000), (_bur, 500), (_sto, 200)) v(cid, target) loop
      if _rec.target - coalesce((select physical_qty from public.component_stock where component_id = _rec.cid and warehouse_id = _wh), 0) <> 0 then
        perform public._apply_stock(_rec.cid, _wh, 'adjustment',
          _rec.target - coalesce((select physical_qty from public.component_stock where component_id = _rec.cid and warehouse_id = _wh), 0), 0,
          'acceptance test (rolled back)', 'test', null, auth.uid());
      end if;
    end loop;

    checks := checks || public._chk('1 Baseline', 'GAS-001 available', 2950, (select available_qty from public.v_component_availability where id = _gas));
    checks := checks || public._chk('1 Baseline', 'GAS-1', 2950, (select available_qty from public.v_product_availability where organization_id = _org and sku = 'GAS-1'));
    checks := checks || public._chk('1 Baseline', 'GAS-4', 737, (select available_qty from public.v_product_availability where organization_id = _org and sku = 'GAS-4'));
    checks := checks || public._chk('1 Baseline', 'GAS-10', 295, (select available_qty from public.v_product_availability where organization_id = _org and sku = 'GAS-10'));
    checks := checks || public._chk('1 Baseline', 'GAS4-BURNER1', 490, (select available_qty from public.v_product_availability where organization_id = _org and sku = 'GAS4-BURNER1'));
    checks := checks || public._chk('1 Baseline', 'GAS6-STOVE1', 195, (select available_qty from public.v_product_availability where organization_id = _org and sku = 'GAS6-STOVE1'));

    _o := public.place_order(jsonb_build_array(jsonb_build_object('product_id', _g10, 'quantity', 2, 'fulfillment_method', 'FBR')), null, 'TEST-FBR-1', 'acceptance');
    checks := checks || public._chk('2 FBR order 2× GAS-10', 'GAS-001 reserved', 20, (select reserved_qty from public.v_component_availability where id = _gas));
    checks := checks || public._chk('2 FBR order 2× GAS-10', 'GAS-001 available', 2930, (select available_qty from public.v_component_availability where id = _gas));
    checks := checks || public._chk('2 FBR order 2× GAS-10', 'GAS-1', 2930, (select available_qty from public.v_product_availability where organization_id = _org and sku = 'GAS-1'));
    checks := checks || public._chk('2 FBR order 2× GAS-10', 'GAS-4', 732, (select available_qty from public.v_product_availability where organization_id = _org and sku = 'GAS-4'));
    checks := checks || public._chk('2 FBR order 2× GAS-10', 'GAS-10', 293, (select available_qty from public.v_product_availability where organization_id = _org and sku = 'GAS-10'));
    checks := checks || public._chk('2 FBR order 2× GAS-10', 'GAS4-BURNER1', 490, (select available_qty from public.v_product_availability where organization_id = _org and sku = 'GAS4-BURNER1'));
    checks := checks || public._chk('2 FBR order 2× GAS-10', 'GAS6-STOVE1', 195, (select available_qty from public.v_product_availability where organization_id = _org and sku = 'GAS6-STOVE1'));

    perform public.cancel_order(_o);
    checks := checks || public._chk('3 Cancel', 'GAS-001 reserved', 0, (select reserved_qty from public.v_component_availability where id = _gas));
    checks := checks || public._chk('3 Cancel', 'GAS-001 available', 2950, (select available_qty from public.v_component_availability where id = _gas));
    checks := checks || public._chk('3 Cancel', 'GAS-10', 295, (select available_qty from public.v_product_availability where organization_id = _org and sku = 'GAS-10'));

    _o := public.place_order(jsonb_build_array(jsonb_build_object('product_id', _g10, 'quantity', 2, 'fulfillment_method', 'FBR')), null, 'TEST-FBR-2', 'acceptance');
    perform public.fulfill_order(_o);
    checks := checks || public._chk('4 Fulfil 2× GAS-10', 'GAS-001 physical', 2980, (select physical_qty from public.v_component_availability where id = _gas));
    checks := checks || public._chk('4 Fulfil 2× GAS-10', 'GAS-001 reserved', 0, (select reserved_qty from public.v_component_availability where id = _gas));
    checks := checks || public._chk('4 Fulfil 2× GAS-10', 'GAS-001 available', 2930, (select available_qty from public.v_component_availability where id = _gas));

    _o := public.place_order(jsonb_build_array(jsonb_build_object('product_id', _g10, 'quantity', 5, 'fulfillment_method', 'FBB')), null, 'TEST-FBB-1', 'acceptance');
    checks := checks || public._chk('5 FBB order 5× GAS-10', 'GAS-001 physical unchanged', 2980, (select physical_qty from public.v_component_availability where id = _gas));
    checks := checks || public._chk('5 FBB order 5× GAS-10', 'GAS-001 reserved unchanged', 0, (select reserved_qty from public.v_component_availability where id = _gas));
    checks := checks || public._chk('5 FBB order 5× GAS-10', 'internal reservations created', 0, (select count(*)::int from public.order_reservations where order_id = _o));
    perform public.fulfill_order(_o);
    checks := checks || public._chk('5 FBB order 5× GAS-10', 'GAS-001 physical after FBB fulfil', 2980, (select physical_qty from public.v_component_availability where id = _gas));

    raise exception using errcode = 'P0001', message = '__acceptance_rollback__';
  exception when others then
    if sqlerrm <> '__acceptance_rollback__' then
      return jsonb_build_object('ok', false, 'error', sqlerrm, 'checks', checks);
    end if;
  end;
  return jsonb_build_object('ok', not exists (select 1 from jsonb_array_elements(checks) c where not (c->>'pass')::boolean), 'checks', checks);
end $$;

-- ===================== 11. EXECUTE PRIVILEGES =====================
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.has_org_role(uuid, public.app_role[]) from public, anon;
revoke execute on function public.current_org_id() from public, anon;
revoke execute on function public.set_org() from public, anon, authenticated;
revoke execute on function public.default_warehouse_id(uuid) from public, anon, authenticated;
revoke execute on function public._apply_stock(uuid, uuid, movement_type, integer, integer, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.bootstrap_user() from public, anon;
revoke execute on function public.set_member_role(uuid, text, public.app_role) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.post_stock_movement(uuid, movement_type, integer, text, text, uuid) from public, anon;
revoke execute on function public.place_order(jsonb, uuid, text, text, uuid) from public, anon;
revoke execute on function public.fulfill_order(uuid) from public, anon;
revoke execute on function public.cancel_order(uuid) from public, anon;
revoke execute on function public.set_product_bom(uuid, jsonb) from public, anon;
revoke execute on function public.plan_stock_sync(uuid) from public, anon;
revoke execute on function public.import_components(jsonb, boolean) from public, anon;
revoke execute on function public.import_products(jsonb, boolean) from public, anon;
revoke execute on function public.import_bom(jsonb, boolean) from public, anon;
revoke execute on function public.import_listings(jsonb, boolean) from public, anon;
revoke execute on function public.run_acceptance_test() from public, anon;
grant execute on function public.is_org_member(uuid), public.has_org_role(uuid, public.app_role[]), public.current_org_id(),
  public.bootstrap_user(), public.set_member_role(uuid, text, public.app_role), public.remove_member(uuid, uuid),
  public.post_stock_movement(uuid, movement_type, integer, text, text, uuid), public.place_order(jsonb, uuid, text, text, uuid),
  public.fulfill_order(uuid), public.cancel_order(uuid), public.set_product_bom(uuid, jsonb), public.plan_stock_sync(uuid),
  public.import_components(jsonb, boolean), public.import_products(jsonb, boolean), public.import_bom(jsonb, boolean),
  public.import_listings(jsonb, boolean), public.run_acceptance_test() to authenticated;