revoke execute on function public.save_channel_credentials(uuid, text, text) from public, anon;
revoke execute on function public.channel_credential_status() from public, anon;
grant execute on function public.save_channel_credentials(uuid, text, text) to authenticated;
grant execute on function public.channel_credential_status() to authenticated;