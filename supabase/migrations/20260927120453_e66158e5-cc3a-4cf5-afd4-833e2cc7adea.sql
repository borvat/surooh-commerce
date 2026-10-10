alter table public.sales_channels add column if not exists company jsonb not null default '{}'::jsonb;

create or replace function public.set_channel_company(_channel_id uuid, _company jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare _org uuid;
begin
  select organization_id into _org from sales_channels where id = _channel_id;
  if _org is null or not has_org_role(_org, array['admin']::app_role[]) then
    raise exception 'غير مسموح';
  end if;
  if length(coalesce(_company->>'logo','')) > 400000 then raise exception 'الشعار كبير جداً'; end if;
  update sales_channels set company = coalesce(_company, '{}'::jsonb), updated_at = now() where id = _channel_id;
end $$;
revoke execute on function public.set_channel_company(uuid, jsonb) from public, anon;
grant execute on function public.set_channel_company(uuid, jsonb) to authenticated;