-- ============ ENUMS ============
create type public.app_role as enum ('admin','warehouse','viewer');
create type public.product_type as enum ('SIMPLE','BUNDLE');
create type public.movement_type as enum ('receipt','adjustment','reservation','release','sale','return','damaged');
create type public.order_status as enum ('placed','fulfilled','cancelled');

-- ============ ROLES / PROFILES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.profiles (
  id uuid primary key,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by signed-in" on public.profiles for select to authenticated using (true);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = any(_roles))
$$;

create policy "own roles or admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- Called after sign-in: creates profile; first user ever becomes admin, others viewer.
create or replace function public.bootstrap_user()
returns text language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _email text := auth.jwt() ->> 'email'; _role public.app_role;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  insert into public.profiles(id, email) values (_uid, _email)
    on conflict (id) do update set email = excluded.email;
  if not exists (select 1 from public.user_roles where user_id = _uid) then
    perform pg_advisory_xact_lock(424242);
    if not exists (select 1 from public.user_roles where role = 'admin') then
      insert into public.user_roles(user_id, role) values (_uid, 'admin');
    else
      insert into public.user_roles(user_id, role) values (_uid, 'viewer');
    end if;
  end if;
  select role into _role from public.user_roles where user_id = _uid
    order by case role when 'admin' then 1 when 'warehouse' then 2 else 3 end limit 1;
  return _role::text;
end $$;

create or replace function public.set_user_role(_user_id uuid, _role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only admins can change roles'; end if;
  if _user_id = auth.uid() and _role <> 'admin' then raise exception 'You cannot remove your own admin role'; end if;
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles(user_id, role) values (_user_id, _role);
  insert into public.audit_log(entity, entity_id, action, new_data, user_id)
    values ('user_role', _user_id::text, 'set_role', jsonb_build_object('role', _role), auth.uid());
end $$;

-- ============ AUDIT LOG ============
create table public.audit_log (
  id bigint generated always as identity primary key,
  entity text not null,
  entity_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log(entity, entity_id);
create index audit_log_created_idx on public.audit_log(created_at desc);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "audit readable" on public.audit_log for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin','warehouse','viewer']::public.app_role[]));

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(entity, entity_id, action, old_data, new_data, user_id)
  values (TG_TABLE_NAME,
          coalesce((case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end)->>'id',
                   (case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end)->>'component_id'),
          lower(TG_OP),
          case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) end,
          case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) end,
          auth.uid());
  return coalesce(NEW, OLD);
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin NEW.updated_at = now(); return NEW; end $$;

-- ============ WAREHOUSES ============
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index warehouses_one_default on public.warehouses(is_default) where is_default;
grant select, insert, update on public.warehouses to authenticated;
grant all on public.warehouses to service_role;
alter table public.warehouses enable row level security;
create policy "wh read" on public.warehouses for select to authenticated using (true);
create policy "wh admin insert" on public.warehouses for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "wh admin update" on public.warehouses for update to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger warehouses_touch before update on public.warehouses for each row execute function public.touch_updated_at();

-- ============ COMPONENTS ============
create table public.components (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  barcode text,
  unit_of_measure text not null default 'pcs',
  safety_stock integer not null default 0 check (safety_stock >= 0),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index components_name_idx on public.components(lower(name));
create unique index components_barcode_uniq on public.components(barcode) where barcode is not null;
grant select, insert, update on public.components to authenticated;
grant all on public.components to service_role;
alter table public.components enable row level security;
create policy "comp read" on public.components for select to authenticated using (true);
create policy "comp write insert" on public.components for insert to authenticated
  with check (public.has_any_role(auth.uid(), array['admin','warehouse']::public.app_role[]));
create policy "comp write update" on public.components for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','warehouse']::public.app_role[]));
create trigger components_touch before update on public.components for each row execute function public.touch_updated_at();
create trigger components_audit after insert or update or delete on public.components for each row execute function public.audit_trigger();

-- Stock cache per component/warehouse. Only mutated by SECURITY DEFINER inventory functions.
create table public.component_stock (
  component_id uuid not null references public.components(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  physical_qty integer not null default 0 check (physical_qty >= 0),
  reserved_qty integer not null default 0 check (reserved_qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (component_id, warehouse_id),
  check (reserved_qty <= physical_qty)
);
create index component_stock_wh_idx on public.component_stock(warehouse_id);
grant select on public.component_stock to authenticated;
grant all on public.component_stock to service_role;
alter table public.component_stock enable row level security;
create policy "stock read" on public.component_stock for select to authenticated using (true);

-- ============ PRODUCTS / BOM ============
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  ean text unique check (ean is null or ean ~ '^[0-9]{8,14}$'),
  product_type public.product_type not null default 'BUNDLE',
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_name_idx on public.products(lower(name));
grant select, insert, update on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "prod read" on public.products for select to authenticated using (true);
create policy "prod admin insert" on public.products for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "prod admin update" on public.products for update to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger products_audit after insert or update or delete on public.products for each row execute function public.audit_trigger();

create table public.bom_lines (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  component_id uuid not null references public.components(id) on delete restrict,
  quantity_required integer not null check (quantity_required > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, component_id)
);
create index bom_component_idx on public.bom_lines(component_id);
grant select, insert, update, delete on public.bom_lines to authenticated;
grant all on public.bom_lines to service_role;
alter table public.bom_lines enable row level security;
create policy "bom read" on public.bom_lines for select to authenticated using (true);
create policy "bom admin insert" on public.bom_lines for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "bom admin update" on public.bom_lines for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "bom admin delete" on public.bom_lines for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger bom_touch before update on public.bom_lines for each row execute function public.touch_updated_at();
create trigger bom_audit after insert or update or delete on public.bom_lines for each row execute function public.audit_trigger();

-- SIMPLE products must have exactly one BOM line with qty 1
create or replace function public.validate_bom()
returns trigger language plpgsql as $$
declare _t public.product_type; _n int;
begin
  select product_type into _t from public.products where id = NEW.product_id;
  if _t = 'SIMPLE' then
    select count(*) into _n from public.bom_lines where product_id = NEW.product_id and id <> NEW.id;
    if _n > 0 or NEW.quantity_required <> 1 then
      raise exception 'SIMPLE products must map to exactly one component with quantity 1';
    end if;
  end if;
  return NEW;
end $$;
create trigger bom_validate before insert or update on public.bom_lines for each row execute function public.validate_bom();

-- Prevent hard-deleting components (archive instead) and deactivating components used by active BOMs
create or replace function public.guard_component()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Components cannot be deleted; archive/deactivate instead';
  end if;
  if OLD.active and not NEW.active and exists (
    select 1 from public.bom_lines b join public.products p on p.id = b.product_id
    where b.component_id = NEW.id and p.active) then
    raise exception 'Component % is used by active products; deactivate those products first', NEW.sku;
  end if;
  return NEW;
end $$;
create trigger components_guard before update or delete on public.components for each row execute function public.guard_component();

-- ============ CHANNELS ============
create table public.sales_channels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  provider text not null default 'manual' check (provider in ('manual','bol')),
  status text not null default 'not_connected' check (status in ('not_connected','connected','error','paused')),
  config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_sync_message text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.sales_channels to authenticated;
grant all on public.sales_channels to service_role;
alter table public.sales_channels enable row level security;
create policy "ch read" on public.sales_channels for select to authenticated using (true);
create policy "ch admin insert" on public.sales_channels for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "ch admin update" on public.sales_channels for update to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger ch_touch before update on public.sales_channels for each row execute function public.touch_updated_at();
create trigger ch_audit after insert or update on public.sales_channels for each row execute function public.audit_trigger();

-- Per-channel listing mapping (future: bol.com offer IDs)
create table public.channel_listings (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channels(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  external_offer_id text,
  last_pushed_qty integer,
  last_pushed_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (channel_id, product_id)
);
grant select, insert, update, delete on public.channel_listings to authenticated;
grant all on public.channel_listings to service_role;
alter table public.channel_listings enable row level security;
create policy "cl read" on public.channel_listings for select to authenticated using (true);
create policy "cl admin all" on public.channel_listings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ ORDERS ============
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  channel_id uuid references public.sales_channels(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  status public.order_status not null default 'placed',
  external_ref text,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  cancelled_at timestamptz
);
create unique index orders_channel_ext_uniq on public.orders(channel_id, external_ref) where external_ref is not null;
create index orders_status_idx on public.orders(status, created_at desc);
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders read" on public.orders for select to authenticated using (true);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger orders_audit after insert or update on public.orders for each row execute function public.audit_trigger();

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);
create index order_lines_order_idx on public.order_lines(order_id);
grant select on public.order_lines to authenticated;
grant all on public.order_lines to service_role;
alter table public.order_lines enable row level security;
create policy "ol read" on public.order_lines for select to authenticated using (true);

-- Snapshot of component reservations per order (BOM at time of placement)
create table public.order_reservations (
  order_id uuid not null references public.orders(id) on delete cascade,
  component_id uuid not null references public.components(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  primary key (order_id, component_id, warehouse_id)
);
grant select on public.order_reservations to authenticated;
grant all on public.order_reservations to service_role;
alter table public.order_reservations enable row level security;
create policy "or read" on public.order_reservations for select to authenticated using (true);

-- ============ STOCK LEDGER (immutable) ============
create table public.stock_movements (
  id bigint generated always as identity primary key,
  component_id uuid not null references public.components(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  movement_type public.movement_type not null,
  physical_delta integer not null default 0,
  reserved_delta integer not null default 0,
  physical_after integer not null,
  reserved_after integer not null,
  reason text,
  reference text,
  order_id uuid references public.orders(id) on delete restrict,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index sm_component_idx on public.stock_movements(component_id, created_at desc);
create index sm_created_idx on public.stock_movements(created_at desc);
create index sm_order_idx on public.stock_movements(order_id);
grant select on public.stock_movements to authenticated;
grant all on public.stock_movements to service_role;
alter table public.stock_movements enable row level security;
create policy "sm read" on public.stock_movements for select to authenticated using (true);

create or replace function public.block_mutation()
returns trigger language plpgsql as $$
begin raise exception '% is immutable', TG_TABLE_NAME; end $$;
create trigger sm_immutable before update or delete on public.stock_movements for each row execute function public.block_mutation();
create trigger audit_immutable before update or delete on public.audit_log for each row execute function public.block_mutation();

-- ============ DERIVED VIEWS ============
create view public.v_component_availability with (security_invoker = true) as
select c.id, c.sku, c.name, c.barcode, c.unit_of_measure, c.safety_stock, c.low_stock_threshold,
       c.active, c.archived_at, c.created_at, c.updated_at,
       coalesce(sum(s.physical_qty),0)::int as physical_qty,
       coalesce(sum(s.reserved_qty),0)::int as reserved_qty,
       greatest(coalesce(sum(s.physical_qty),0) - coalesce(sum(s.reserved_qty),0) - c.safety_stock, 0)::int as available_qty,
       (greatest(coalesce(sum(s.physical_qty),0) - coalesce(sum(s.reserved_qty),0) - c.safety_stock, 0) <= c.low_stock_threshold) as is_low
from public.components c
left join public.component_stock s on s.component_id = c.id
group by c.id;

create view public.v_product_availability with (security_invoker = true) as
select p.id, p.sku, p.name, p.ean, p.product_type, p.active, p.archived_at, p.created_at, p.updated_at,
       count(b.id)::int as bom_line_count,
       case when count(b.id) = 0 or bool_or(not ca.active) then 0
            else min(floor(ca.available_qty::numeric / b.quantity_required))::int end as available_qty,
       (array_agg(ca.sku order by floor(ca.available_qty::numeric / b.quantity_required), ca.sku)
          filter (where b.id is not null))[1] as bottleneck_sku
from public.products p
left join public.bom_lines b on b.product_id = p.id
left join public.v_component_availability ca on ca.id = b.component_id
group by p.id;

-- Ledger reconciliation: cache vs sum of movements
create view public.v_stock_reconciliation with (security_invoker = true) as
select s.component_id, s.warehouse_id, s.physical_qty, s.reserved_qty,
       coalesce(sum(m.physical_delta),0)::int as ledger_physical,
       coalesce(sum(m.reserved_delta),0)::int as ledger_reserved,
       (s.physical_qty = coalesce(sum(m.physical_delta),0) and s.reserved_qty = coalesce(sum(m.reserved_delta),0)) as in_sync
from public.component_stock s
left join public.stock_movements m on m.component_id = s.component_id and m.warehouse_id = s.warehouse_id
group by s.component_id, s.warehouse_id, s.physical_qty, s.reserved_qty;

grant select on public.v_component_availability, public.v_product_availability, public.v_stock_reconciliation to authenticated;

-- ============ INVENTORY ENGINE ============
create or replace function public.default_warehouse_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.warehouses where is_default limit 1
$$;

-- Internal: apply a delta to one stock row (row must be locked by caller or is locked here)
create or replace function public._apply_stock(
  _component uuid, _warehouse uuid, _type public.movement_type,
  _pdelta int, _rdelta int, _reason text, _reference text, _order uuid, _user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _p int; _r int;
begin
  insert into public.component_stock(component_id, warehouse_id) values (_component, _warehouse)
    on conflict do nothing;
  select physical_qty, reserved_qty into _p, _r from public.component_stock
    where component_id = _component and warehouse_id = _warehouse for update;
  _p := _p + _pdelta; _r := _r + _rdelta;
  if _p < 0 then raise exception 'Physical stock cannot go negative'; end if;
  if _r < 0 then raise exception 'Reserved stock cannot go negative'; end if;
  if _r > _p then raise exception 'Physical stock cannot drop below reserved stock (% reserved)', _r; end if;
  update public.component_stock set physical_qty = _p, reserved_qty = _r, updated_at = now()
    where component_id = _component and warehouse_id = _warehouse;
  insert into public.stock_movements(component_id, warehouse_id, movement_type, physical_delta, reserved_delta,
    physical_after, reserved_after, reason, reference, order_id, user_id)
  values (_component, _warehouse, _type, _pdelta, _rdelta, _p, _r, _reason, _reference, _order, _user);
end $$;
revoke execute on function public._apply_stock from public, anon, authenticated;

-- Manual stock movement: receipt (+), return (+), damaged (-), adjustment (+/-)
create or replace function public.post_stock_movement(
  _component_id uuid, _movement_type public.movement_type, _quantity int,
  _reason text, _reference text default null, _warehouse_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare _wh uuid := coalesce(_warehouse_id, public.default_warehouse_id()); _delta int;
begin
  if not public.has_any_role(auth.uid(), array['admin','warehouse']::public.app_role[]) then
    raise exception 'Insufficient permissions'; end if;
  if _reason is null or length(trim(_reason)) = 0 then raise exception 'A reason is required'; end if;
  if _movement_type in ('receipt','return') then
    if _quantity <= 0 then raise exception 'Quantity must be positive'; end if;
    _delta := _quantity;
  elsif _movement_type = 'damaged' then
    if _quantity <= 0 then raise exception 'Quantity must be positive'; end if;
    _delta := -_quantity;
  elsif _movement_type = 'adjustment' then
    if _quantity = 0 then raise exception 'Adjustment cannot be zero'; end if;
    _delta := _quantity;
  else
    raise exception 'Use order actions for % movements', _movement_type;
  end if;
  perform public._apply_stock(_component_id, _wh, _movement_type, _delta, 0, _reason, _reference, null, auth.uid());
  insert into public.audit_log(entity, entity_id, action, new_data, user_id)
  values ('component_stock', _component_id::text, 'movement_' || _movement_type,
          jsonb_build_object('quantity', _delta, 'reason', _reason, 'reference', _reference, 'warehouse_id', _wh), auth.uid());
end $$;

-- Place an order: reserve BOM components atomically.
-- _lines: [{"product_id": uuid, "quantity": int}, ...]
create or replace function public.place_order(
  _lines jsonb, _channel_id uuid default null, _external_ref text default null,
  _note text default null, _warehouse_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _wh uuid := coalesce(_warehouse_id, public.default_warehouse_id());
  _order uuid; _rec record; _avail int;
begin
  if not public.has_any_role(auth.uid(), array['admin','warehouse']::public.app_role[]) then
    raise exception 'Insufficient permissions'; end if;
  if _wh is null then raise exception 'No warehouse configured'; end if;
  if jsonb_typeof(_lines) <> 'array' or jsonb_array_length(_lines) = 0 then
    raise exception 'Order needs at least one line'; end if;

  create temp table _ol on commit drop as
    select (l->>'product_id')::uuid as product_id, sum((l->>'quantity')::int)::int as quantity
    from jsonb_array_elements(_lines) l group by 1;
  if exists (select 1 from _ol where quantity is null or quantity <= 0) then
    raise exception 'Line quantities must be positive'; end if;
  if exists (select 1 from _ol o left join public.products p on p.id = o.product_id
             where p.id is null or not p.active) then
    raise exception 'Order contains unknown or inactive products'; end if;
  if exists (select 1 from _ol o where not exists (select 1 from public.bom_lines b where b.product_id = o.product_id)) then
    raise exception 'Order contains a product without a BOM'; end if;

  create temp table _need on commit drop as
    select b.component_id, sum(b.quantity_required * o.quantity)::int as qty
    from _ol o join public.bom_lines b on b.product_id = o.product_id group by 1;

  -- ensure rows exist, then lock in deterministic order to avoid deadlocks
  insert into public.component_stock(component_id, warehouse_id)
    select component_id, _wh from _need on conflict do nothing;
  perform 1 from public.component_stock s where s.warehouse_id = _wh
    and s.component_id in (select component_id from _need) order by s.component_id for update;

  for _rec in select n.component_id, n.qty, c.sku, c.safety_stock, c.active, s.physical_qty, s.reserved_qty
      from _need n join public.components c on c.id = n.component_id
      join public.component_stock s on s.component_id = n.component_id and s.warehouse_id = _wh loop
    if not _rec.active then raise exception 'Component % is inactive', _rec.sku; end if;
    _avail := greatest(_rec.physical_qty - _rec.reserved_qty - _rec.safety_stock, 0);
    if _avail < _rec.qty then
      raise exception 'Insufficient stock for %: need %, available %', _rec.sku, _rec.qty, _avail;
    end if;
  end loop;

  insert into public.orders(channel_id, warehouse_id, external_ref, note, created_by)
    values (_channel_id, _wh, nullif(trim(_external_ref),''), _note, auth.uid()) returning id into _order;
  insert into public.order_lines(order_id, product_id, quantity) select _order, product_id, quantity from _ol;
  insert into public.order_reservations(order_id, component_id, warehouse_id, quantity)
    select _order, component_id, _wh, qty from _need;
  for _rec in select component_id, qty from _need order by component_id loop
    perform public._apply_stock(_rec.component_id, _wh, 'reservation', 0, _rec.qty,
      'Order reservation', coalesce(_external_ref, _order::text), _order, auth.uid());
  end loop;
  return _order;
end $$;

create or replace function public.fulfill_order(_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _o record; _rec record;
begin
  if not public.has_any_role(auth.uid(), array['admin','warehouse']::public.app_role[]) then
    raise exception 'Insufficient permissions'; end if;
  select * into _o from public.orders where id = _order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if _o.status <> 'placed' then raise exception 'Only placed orders can be fulfilled (current: %)', _o.status; end if;
  for _rec in select * from public.order_reservations where order_id = _order_id order by component_id loop
    perform public._apply_stock(_rec.component_id, _rec.warehouse_id, 'sale', -_rec.quantity, -_rec.quantity,
      'Order fulfilled', coalesce(_o.external_ref, _o.id::text), _o.id, auth.uid());
  end loop;
  update public.orders set status = 'fulfilled', fulfilled_at = now() where id = _order_id;
end $$;

create or replace function public.cancel_order(_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _o record; _rec record;
begin
  if not public.has_any_role(auth.uid(), array['admin','warehouse']::public.app_role[]) then
    raise exception 'Insufficient permissions'; end if;
  select * into _o from public.orders where id = _order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if _o.status <> 'placed' then raise exception 'Only placed orders can be cancelled (current: %)', _o.status; end if;
  for _rec in select * from public.order_reservations where order_id = _order_id order by component_id loop
    perform public._apply_stock(_rec.component_id, _rec.warehouse_id, 'release', 0, -_rec.quantity,
      'Order cancelled', coalesce(_o.external_ref, _o.id::text), _o.id, auth.uid());
  end loop;
  update public.orders set status = 'cancelled', cancelled_at = now() where id = _order_id;
end $$;

-- Replace a product's BOM atomically. _lines: [{"component_id": uuid, "quantity_required": int}]
create or replace function public.set_product_bom(_product_id uuid, _lines jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only admins can edit BOMs'; end if;
  if exists (select 1 from jsonb_array_elements(_lines) l where coalesce((l->>'quantity_required')::int,0) <= 0) then
    raise exception 'quantity_required must be greater than 0'; end if;
  delete from public.bom_lines where product_id = _product_id
    and component_id not in (select (l->>'component_id')::uuid from jsonb_array_elements(_lines) l);
  insert into public.bom_lines(product_id, component_id, quantity_required)
    select _product_id, (l->>'component_id')::uuid, (l->>'quantity_required')::int from jsonb_array_elements(_lines) l
  on conflict (product_id, component_id) do update set quantity_required = excluded.quantity_required
    where public.bom_lines.quantity_required <> excluded.quantity_required;
end $$;

revoke execute on function public.post_stock_movement, public.place_order, public.fulfill_order,
  public.cancel_order, public.set_product_bom, public.set_user_role, public.bootstrap_user from public, anon;
grant execute on function public.post_stock_movement, public.place_order, public.fulfill_order,
  public.cancel_order, public.set_product_bom, public.set_user_role, public.bootstrap_user to authenticated;

-- ============ SEED ============
insert into public.warehouses(code, name, is_default) values ('WH-MAIN','Main Warehouse', true);

insert into public.components(sku, name, unit_of_measure, safety_stock, low_stock_threshold) values
  ('GAS-001','Gas Bottle','pcs',50,200),
  ('BURNER-001','Burner','pcs',10,50),
  ('STOVE-001','Stove','pcs',5,25);

do $$
declare _wh uuid := (select id from public.warehouses where is_default); _c record;
begin
  for _c in select id, sku from public.components loop
    perform public._apply_stock(_c.id, _wh, 'receipt',
      case _c.sku when 'GAS-001' then 3000 when 'BURNER-001' then 500 else 200 end, 0,
      'Opening balance (seed)', 'SEED', null, null);
  end loop;
end $$;

insert into public.products(sku, name, ean, product_type) values
  ('GAS-1','Gas Bottle – Single','8712345000011','SIMPLE'),
  ('GAS-4','Gas Bottle – 4 Pack','8712345000042','BUNDLE'),
  ('GAS-10','Gas Bottle – 10 Pack','8712345000103','BUNDLE'),
  ('GAS4-BURNER1','4 Gas Bottles + Burner','8712345000417','BUNDLE'),
  ('GAS6-STOVE1','6 Gas Bottles + Stove','8712345000615','BUNDLE');

insert into public.bom_lines(product_id, component_id, quantity_required)
select p.id, c.id, x.q from (values
  ('GAS-1','GAS-001',1),('GAS-4','GAS-001',4),('GAS-10','GAS-001',10),
  ('GAS4-BURNER1','GAS-001',4),('GAS4-BURNER1','BURNER-001',1),
  ('GAS6-STOVE1','GAS-001',6),('GAS6-STOVE1','STOVE-001',1)) as x(p,c,q)
join public.products p on p.sku = x.p join public.components c on c.sku = x.c;

insert into public.sales_channels(code, name, provider) values
  ('CH-1','Channel Account 1','bol'),
  ('CH-2','Channel Account 2','bol');

insert into public.channel_listings(channel_id, product_id)
select ch.id, p.id from public.sales_channels ch cross join public.products p;