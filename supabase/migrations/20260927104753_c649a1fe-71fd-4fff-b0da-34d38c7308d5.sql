create table public.channel_credentials (
  channel_id uuid primary key references public.sales_channels(id),
  client_id text not null,
  client_secret text not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
grant all on public.channel_credentials to service_role;
alter table public.channel_credentials enable row level security;
-- no policies: app users can never read or write directly; only the functions below.

create or replace function public.save_channel_credentials(_channel_id uuid, _client_id text, _client_secret text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only admins can store channel credentials'; end if;
  if coalesce(trim(_client_id),'') = '' or coalesce(trim(_client_secret),'') = '' then
    raise exception 'Client ID and secret are required'; end if;
  insert into public.channel_credentials(channel_id, client_id, client_secret, updated_by)
    values (_channel_id, trim(_client_id), trim(_client_secret), auth.uid())
  on conflict (channel_id) do update set client_id = excluded.client_id, client_secret = excluded.client_secret,
    updated_by = excluded.updated_by, updated_at = now();
  -- status stays not_connected: no live bol.com connectivity exists yet
  update public.sales_channels set status = 'not_connected',
    last_sync_message = 'Credentials stored. Live bol.com connection not implemented yet.' where id = _channel_id;
  insert into public.audit_log(entity, entity_id, action, new_data, user_id)
    values ('sales_channel', _channel_id::text, 'credentials_saved', '{}'::jsonb, auth.uid());
end $$;

create or replace function public.channel_credential_status()
returns table(channel_id uuid, has_credentials boolean, client_id_hint text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.channel_id, true, '••••' || right(c.client_id, 4), c.updated_at
  from public.channel_credentials c
  where public.has_any_role(auth.uid(), array['admin','warehouse','viewer']::public.app_role[])
$$;

update public.sales_channels set name = 'bol.com Account 1' where code = 'CH-1' and name = 'Channel Account 1';
update public.sales_channels set name = 'bol.com Account 2' where code = 'CH-2' and name = 'Channel Account 2';