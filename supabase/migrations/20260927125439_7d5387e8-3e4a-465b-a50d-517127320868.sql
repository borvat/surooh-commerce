alter table public.products add column master_reference text;
alter table public.channel_listings add column variant_label text, add column variant_color text, add column variant_pack integer check (variant_pack is null or variant_pack > 0);

create or replace function public.set_product_master(_product_id uuid, _name text, _master_reference text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare _org uuid;
begin
  select organization_id into _org from public.products where id = _product_id;
  if _org is null then raise exception 'Product not found'; end if;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can change products'; end if;
  update public.products set
    name = coalesce(nullif(btrim(_name), ''), name),
    master_reference = nullif(btrim(coalesce(_master_reference, '')), '')
  where id = _product_id;
end $$;

create or replace function public.set_listing_variant(_listing_id uuid, _label text, _color text, _pack integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare _org uuid;
begin
  select organization_id into _org from public.channel_listings where id = _listing_id;
  if _org is null then raise exception 'Offer not found'; end if;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can change offers'; end if;
  update public.channel_listings set variant_label = nullif(btrim(coalesce(_label,'')), ''), variant_color = nullif(btrim(coalesce(_color,'')), ''), variant_pack = _pack where id = _listing_id;
end $$;
revoke execute on function public.set_product_master(uuid, text, text) from anon, public;
revoke execute on function public.set_listing_variant(uuid, text, text, integer) from anon, public;
grant execute on function public.set_product_master(uuid, text, text) to authenticated;
grant execute on function public.set_listing_variant(uuid, text, text, integer) to authenticated;

-- owner chose: every offer of a merged card shows the same full quantity (no main-offer split)
do $$ begin
  execute replace(pg_get_functiondef('public.plan_stock_sync'::regproc),
    '    _q := case when exists (select 1 from public.products p where p.id = _rec.product_id and p.primary_listing_id is not null and p.primary_listing_id <> _rec.id) then 0 else _rec.computed_desired_qty end;
    _rec.computed_desired_qty := _q;
', '');
end $$;