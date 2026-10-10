alter table public.products add column primary_listing_id uuid references public.channel_listings(id) on delete set null;

create or replace function public.set_primary_listing(_listing_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare _l public.channel_listings;
begin
  select * into _l from public.channel_listings where id = _listing_id;
  if _l.id is null or _l.product_id is null then raise exception 'Offer not found'; end if;
  if not public.has_org_role(_l.organization_id, array['admin']::public.app_role[]) then raise exception 'Only admins can change products'; end if;
  if _l.fulfillment_method = 'FBB' then raise exception 'عروض FBB تديرها bol ولا تأخذ من مستودعنا'; end if;
  update public.products set primary_listing_id = _l.id where id = _l.product_id;
end $$;
revoke execute on function public.set_primary_listing(uuid) from anon, public;
grant execute on function public.set_primary_listing(uuid) to authenticated;

-- products with several offers: pick an FBR offer as main by default
update public.products p set primary_listing_id = (
  select l.id from public.channel_listings l where l.product_id = p.id and l.active and l.fulfillment_method = 'FBR'
  order by coalesce(l.bol_stock,0) desc, l.created_at limit 1)
where p.primary_listing_id is null and (select count(*) from public.channel_listings l where l.product_id = p.id and l.active) > 1;

-- after a merge, set a main offer if the card has none
create or replace function public._ensure_primary(_pid uuid) returns void language sql security definer set search_path to 'public' as $$
  update public.products p set primary_listing_id = (
    select l.id from public.channel_listings l where l.product_id = p.id and l.active and l.fulfillment_method = 'FBR'
    order by coalesce(l.bol_stock,0) desc, l.created_at limit 1)
  where p.id = _pid and (p.primary_listing_id is null or not exists (select 1 from public.channel_listings l where l.id = p.primary_listing_id and l.product_id = p.id));
$$;
revoke execute on function public._ensure_primary(uuid) from anon, public, authenticated;

do $$ begin
  execute replace(pg_get_functiondef('public.merge_products'::regproc),
    '    update public.products set image_url = coalesce(image_url, _s.image_url) where id = _target;
  end loop;',
    '    update public.products set image_url = coalesce(image_url, _s.image_url) where id = _target;
  end loop;
  perform public._ensure_primary(_target);');
  execute replace(pg_get_functiondef('public.unmerge_listing'::regproc),
    '  return _pid;',
    '  perform public._ensure_primary(_p.id);
  return _pid;');
  -- stock sync: only the main offer publishes stock; other offers of the same card publish 0
  execute replace(replace(pg_get_functiondef('public.plan_stock_sync'::regproc),
    'declare _org uuid;', 'declare _q int; _org uuid;'),
    '    update public.channel_listings set desired_publish_qty = _rec.computed_desired_qty where id = _rec.id;',
    '    _q := case when exists (select 1 from public.products p where p.id = _rec.product_id and p.primary_listing_id is not null and p.primary_listing_id <> _rec.id) then 0 else _rec.computed_desired_qty end;
    _rec.computed_desired_qty := _q;
    update public.channel_listings set desired_publish_qty = _rec.computed_desired_qty where id = _rec.id;');
end $$;