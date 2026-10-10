do $$ begin
  execute replace(pg_get_functiondef('public.upsert_bol_offers'::regproc),
    'select id into _pid from public.products where organization_id = _org and ean = _ean limit 1;',
    '_pid := public._product_for_ean(_org, _ean);');
end $$;