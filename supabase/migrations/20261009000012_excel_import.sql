-- Excel'dan kirim importi: mahsulotlarni avtomatik yaratish/yangilash + kirim
-- hujjati + zaxiraga qabul qilish — hammasi bitta tranzaksiyada.

-- Bir hujjatni ikki marta import qilmaslik uchun manba belgisi
alter table purchases add column if not exists source_ref text;
create unique index if not exists purchases_source_ref_uniq
  on purchases (tenant_id, source_ref) where source_ref is not null;

-- Nomni solishtirish uchun normallashtirish (katta-kichik harf, ortiqcha bo'shliqlar)
create or replace function public._norm_name(p text) returns text
language sql immutable as $$
  select lower(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g'))
$$;
create index if not exists products_norm_name_idx on products (tenant_id, _norm_name(name));

create or replace function public.import_purchase(
  p_supplier_name text,
  p_ref text,
  p_note text,
  p_items jsonb,           -- [{name, qty, cost, price, expiry, category, unit, description, sku, barcode}]
  p_update_prices boolean default true,
  p_paid boolean default false
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  v_name text;
  v_supplier text;
  v_pid text := gen_random_uuid()::text;
  v_total bigint := 0;
  v_created int := 0;
  v_updated int := 0;
  v_lines int := 0;
  it jsonb;
  v_prod_id text;
  v_qty numeric;
  v_cost bigint;
  v_price bigint;
  v_exp date;
  v_iname text;
begin
  if v_role is null or v_role not in ('direktor','omborchi') then
    raise exception 'Importga ruxsat yo''q';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Import uchun qatorlar yo''q';
  end if;
  if jsonb_array_length(p_items) > 2000 then
    raise exception 'Bir martada 2000 qatordan ko''p import qilib bo''lmaydi';
  end if;
  if coalesce(trim(p_ref), '') <> '' and exists
    (select 1 from purchases where tenant_id = v_tenant and source_ref = trim(p_ref)) then
    raise exception 'Bu hujjat allaqachon import qilingan: %', trim(p_ref);
  end if;

  select full_name into v_name from profiles where id = auth.uid();

  -- Ta'minotchi: nom bo'yicha topiladi, bo'lmasa yaratiladi
  if coalesce(trim(p_supplier_name), '') <> '' then
    select id into v_supplier from suppliers
    where tenant_id = v_tenant and _norm_name(name) = _norm_name(p_supplier_name)
    limit 1;
    if v_supplier is null then
      v_supplier := gen_random_uuid()::text;
      insert into suppliers (id, tenant_id, name) values (v_supplier, v_tenant, trim(p_supplier_name));
    end if;
  end if;

  insert into purchases (id, tenant_id, supplier_id, status, note, created_by, created_by_name, source_ref)
  values (v_pid, v_tenant, v_supplier, 'QORALAMA', coalesce(p_note, ''), auth.uid(),
          coalesce(v_name, ''), nullif(trim(coalesce(p_ref, '')), ''));

  for it in select * from jsonb_array_elements(p_items) loop
    v_iname := trim(coalesce(it->>'name', ''));
    v_qty := round(coalesce(nullif(it->>'qty', '')::numeric, 0), 3);
    v_cost := round(coalesce(nullif(it->>'cost', '')::numeric, 0));
    v_price := round(coalesce(nullif(it->>'price', '')::numeric, 0));
    v_exp := nullif(it->>'expiry', '')::date;
    if v_iname = '' then
      raise exception 'Qatorda mahsulot nomi yo''q';
    end if;
    if v_qty <= 0 then
      raise exception '«%»: miqdor noto''g''ri', v_iname;
    end if;
    if v_cost < 0 then
      raise exception '«%»: kirim narxi noto''g''ri', v_iname;
    end if;

    -- Mahsulotni topish: shtrix-kod → SKU → nom
    v_prod_id := null;
    if coalesce(it->>'barcode', '') <> '' then
      select id into v_prod_id from products
      where tenant_id = v_tenant and barcode = trim(it->>'barcode') limit 1;
    end if;
    if v_prod_id is null and coalesce(it->>'sku', '') <> '' then
      select id into v_prod_id from products
      where tenant_id = v_tenant and sku = trim(it->>'sku') limit 1;
    end if;
    if v_prod_id is null then
      select id into v_prod_id from products
      where tenant_id = v_tenant and _norm_name(name) = _norm_name(v_iname) limit 1;
    end if;

    if v_prod_id is null then
      v_prod_id := gen_random_uuid()::text;
      insert into products (id, tenant_id, name, sku, barcode, category, description,
                            sell_price, unit, expiry_date, supplier_id, min_stock, active)
      values (v_prod_id, v_tenant, v_iname,
              coalesce(trim(it->>'sku'), ''), coalesce(trim(it->>'barcode'), ''),
              coalesce(trim(it->>'category'), ''), coalesce(trim(it->>'description'), ''),
              case when v_price > 0 then v_price else v_cost end,
              coalesce(nullif(trim(it->>'unit'), ''), 'dona'),
              v_exp, v_supplier, 0, true);
      v_created := v_created + 1;
    else
      update products set
        sell_price = case when p_update_prices and v_price > 0 then v_price else sell_price end,
        -- Zaxirada eski partiya bo'lsa eng yaqin muddat saqlanadi (ogohlantirish uchun)
        expiry_date = case
          when v_exp is null then expiry_date
          when stock > 0 and expiry_date is not null then least(expiry_date, v_exp)
          else v_exp end,
        category = case when category = '' then coalesce(trim(it->>'category'), '') else category end,
        description = case when description = '' then coalesce(trim(it->>'description'), '') else description end,
        supplier_id = coalesce(supplier_id, v_supplier),
        active = true
      where id = v_prod_id;
      v_updated := v_updated + 1;
    end if;

    insert into purchase_items (tenant_id, purchase_id, product_id, qty, unit_cost, line_total)
    values (v_tenant, v_pid, v_prod_id, v_qty, v_cost, round(v_qty * v_cost));
    v_total := v_total + round(v_qty * v_cost);
    v_lines := v_lines + 1;
  end loop;

  update purchases set total = v_total,
         paid_amount = case when p_paid then v_total else 0 end
  where id = v_pid;

  -- Zaxiraga qabul qilish (o'rtacha tannarx va harakatlar tarixi bilan)
  perform receive_purchase(v_pid);
  if p_paid then
    update purchases set paid_amount = total where id = v_pid;
  end if;

  return jsonb_build_object('purchaseId', v_pid, 'lines', v_lines,
    'created', v_created, 'updated', v_updated, 'total', v_total);
end $$;
revoke execute on function public.import_purchase(text,text,text,jsonb,boolean,boolean) from public, anon;
grant execute on function public.import_purchase(text,text,text,jsonb,boolean,boolean) to authenticated;
