alter table public.channel_listings add column bol_colour text, add column bol_pack integer, add column bol_contents text, add column attrs_synced_at timestamptz;

create or replace function public.apply_bol_attributes(_channel_id uuid, _rows jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare _org uuid; _r jsonb; _n int := 0;
begin
  select organization_id into _org from public.sales_channels where id = _channel_id;
  if _org is null then raise exception 'Account not found'; end if;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins can import'; end if;
  for _r in select * from jsonb_array_elements(_rows) loop
    update public.channel_listings set
      bol_colour = nullif(_r->>'colour',''),
      bol_pack = case when (_r->>'pack') ~ '^\d{1,5}$' and (_r->>'pack')::int > 0 then (_r->>'pack')::int end,
      bol_contents = nullif(left(_r->>'contents', 300),''),
      attrs_synced_at = now()
    where channel_id = _channel_id and external_ean = _r->>'ean';
    _n := _n + 1;
  end loop;
  return _n;
end $$;
revoke execute on function public.apply_bol_attributes(uuid, jsonb) from anon, public;
grant execute on function public.apply_bol_attributes(uuid, jsonb) to authenticated;