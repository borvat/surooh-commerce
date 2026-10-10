alter function public._is_int(text) set search_path = public;
alter function public._err(integer, text) set search_path = public;
alter function public._chk(text, text, integer, integer) set search_path = public;
revoke execute on function public._is_int(text), public._err(integer, text), public._chk(text, text, integer, integer) from public, anon;