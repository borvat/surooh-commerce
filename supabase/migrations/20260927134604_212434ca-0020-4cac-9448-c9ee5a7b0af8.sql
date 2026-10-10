create or replace function public.apply_bol_enrichment(_channel_id uuid, _rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare _org uuid; _r jsonb; _n int := 0; _pid uuid; _title text; _img text;
begin
  select organization_id into _org from public.sales_channels where id = _channel_id;
  if _org is null then raise exception 'Account not found'; end if;
  if not public.has_org_role(_org, array['admin']::public.app_role[]) then raise exception 'Only admins'; end if;
  for _r in select * from jsonb_array_elements(coalesce(_rows,'[]'::jsonb)) loop
    _title := nullif(btrim(coalesce(_r->>'title','')), '');
    _img := nullif(_r->>'imageUrl','');
    update public.channel_listings set
      title = coalesce(_title, title),
      unit_price = coalesce(nullif(_r->>'unitPrice','')::numeric, unit_price),
      condition = coalesce(nullif(_r->>'condition',''), condition),
      bol_stock = coalesce(nullif(_r->>'stock','')::int, bol_stock),
      bol_corrected_stock = coalesce(nullif(_r->>'correctedStock','')::int, bol_corrected_stock),
      for_sale = coalesce(case when _r ? 'forSale' then (_r->>'forSale')::boolean end, for_sale),
      countries = coalesce(case when jsonb_typeof(_r->'countries') = 'array'
        then array(select jsonb_array_elements_text(_r->'countries')) end, countries),
      bol_product_id = coalesce(case when (_r->>'bolProductId') ~ '^\d+$' then _r->>'bolProductId' end, bol_product_id),
      enriched_at = now()
    where channel_id = _channel_id and external_offer_id = _r->>'offerId'
    returning product_id into _pid;
    if _pid is not null then
      update public.products set
        name = case when not name_overridden and _title is not null and (name like 'EAN %' or name = sku or _r->>'force' = 'true') then _title else name end,
        image_url = coalesce(_img, image_url)
      where id = _pid and organization_id = _org;
    end if;
    _n := _n + 1;
  end loop;
  return _n;
end $$;