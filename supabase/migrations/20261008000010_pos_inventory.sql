-- POS, Ombor va Mahsulot savdosi moduli.
-- Konvensiyalar: pul — butun so'm (bigint), vaqt — Asia/Tashkent, tenant RLS,
-- moliyaviy amallar — security definer RPC ichida bitta tranzaksiya.
-- Tannarx usuli: O'RTACHA TANNARX (weighted average); har sotuv qatorida
-- sotuv paytidagi tannarx snapshoti saqlanadi (foyda to'g'ri hisoblanadi).

-- ============ YANGI ROL: OMBORCHI ============
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('superadmin','direktor','registratura','shifokor','hisobchi','laborant','omborchi'));

-- ============ TA'MINOTCHILAR ============
create table if not exists suppliers (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  name text not null,
  contact_person text not null default '',
  phone text not null default '',
  address text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists suppliers_tenant_idx on suppliers (tenant_id);

-- ============ MAHSULOTLAR ============
create table if not exists products (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  name text not null,
  sku text not null default '',
  barcode text not null default '',
  category text not null default '',
  description text not null default '',
  purchase_price bigint not null default 0 check (purchase_price >= 0), -- oxirgi kirim narxi
  avg_cost bigint not null default 0 check (avg_cost >= 0),             -- o'rtacha tannarx
  sell_price bigint not null default 0 check (sell_price >= 0),
  stock numeric(14,3) not null default 0 check (stock >= 0),            -- manfiy zaxira taqiqlangan
  min_stock numeric(14,3) not null default 0,
  unit text not null default 'dona',
  expiry_date date,
  supplier_id text references suppliers(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_tenant_idx on products (tenant_id);
-- Bir klinika ichida SKU/shtrix-kod takrorlanmasin (bo'sh qiymatlar bundan mustasno)
create unique index if not exists products_sku_uniq on products (tenant_id, sku) where sku <> '';
create unique index if not exists products_barcode_uniq on products (tenant_id, barcode) where barcode <> '';

create or replace function public._touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists touch_updated on products;
create trigger touch_updated before update on products
  for each row execute function _touch_updated_at();

-- ============ KIRIM (XARIDLAR) ============
create table if not exists purchases (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  supplier_id text references suppliers(id),
  status text not null default 'QORALAMA' check (status in ('QORALAMA','QABUL_QILINDI','BEKOR')),
  note text not null default '',
  total bigint not null default 0,
  created_by uuid,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  received_at timestamptz
);
create index if not exists purchases_tenant_idx on purchases (tenant_id, created_at desc);

create table if not exists purchase_items (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  purchase_id text not null references purchases(id) on delete cascade,
  product_id text not null references products(id),
  qty numeric(14,3) not null check (qty > 0),
  unit_cost bigint not null check (unit_cost >= 0),
  line_total bigint not null default 0
);
create index if not exists purchase_items_pid_idx on purchase_items (purchase_id);

-- ============ OMBOR HARAKATLARI (audit — har zaxira o'zgarishi shu yerda) ============
create table if not exists inventory_movements (
  id bigint generated always as identity primary key,
  tenant_id text not null references tenants(id),
  product_id text not null references products(id),
  type text not null check (type in
    ('KIRIM','SOTUV','QAYTARISH','CHIQIM','TUZATISH','TAMINOTCHI_QAYTARISH')),
  qty_change numeric(14,3) not null,
  stock_before numeric(14,3) not null,
  stock_after numeric(14,3) not null,
  ref_table text not null default '',
  ref_id text not null default '',
  reason text not null default '',
  created_by uuid,
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists inv_mov_tenant_idx on inventory_movements (tenant_id, created_at desc);
create index if not exists inv_mov_product_idx on inventory_movements (product_id);

-- ============ SOTUVLAR ============
create table if not exists sales (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  sale_no text not null,
  patient_id text references patients(id),
  status text not null default 'TOLANDI'
    check (status in ('TOLANDI','QISMAN_QAYTARILGAN','QAYTARILGAN')),
  subtotal bigint not null default 0,
  discount bigint not null default 0 check (discount >= 0),
  total bigint not null default 0,
  date date not null,
  time text not null,
  created_by uuid,
  cashier_name text not null default '',
  note text not null default '',
  idempotency_key text,
  created_at timestamptz not null default now()
);
create index if not exists sales_tenant_date_idx on sales (tenant_id, date);
create unique index if not exists sales_no_uniq on sales (tenant_id, sale_no);
create unique index if not exists sales_idem_uniq on sales (tenant_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists sale_items (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  sale_id text not null references sales(id) on delete cascade,
  product_id text not null references products(id),
  name text not null,                       -- nom snapshoti
  qty numeric(14,3) not null check (qty > 0),
  unit_price bigint not null check (unit_price >= 0),
  cost_at_sale bigint not null default 0,   -- sotuv paytidagi o'rtacha tannarx
  line_total bigint not null default 0,
  refunded_qty numeric(14,3) not null default 0 check (refunded_qty >= 0)
);
create index if not exists sale_items_sid_idx on sale_items (sale_id);

create table if not exists sale_payments (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  sale_id text not null references sales(id) on delete cascade,
  method text not null check (method in ('Naqd','Click','Payme','Uzum','Karta (POS)')),
  amount bigint not null check (amount > 0)
);
create index if not exists sale_payments_sid_idx on sale_payments (sale_id);

create table if not exists refunds (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  sale_id text not null references sales(id),
  amount bigint not null check (amount >= 0),
  reason text not null default '',
  items jsonb not null default '[]',
  created_by uuid,
  created_by_name text not null default '',
  date date not null,
  time text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists refunds_tenant_idx on refunds (tenant_id, created_at desc);

-- ============ RLS ============
do $$
declare t text;
begin
  foreach t in array array['suppliers','products','purchases','purchase_items',
                           'inventory_movements','sales','sale_items','sale_payments','refunds']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "superadmin" on %I', t);
    execute format(
      'create policy "superadmin" on %I for all to authenticated
         using (auth_role() = ''superadmin'') with check (auth_role() = ''superadmin'')', t);
  end loop;
end $$;

-- suppliers: ko'rish — ombor/moliya; boshqarish — direktor + omborchi
drop policy if exists "ko'radi" on suppliers;
create policy "ko'radi" on suppliers for select to authenticated
  using (auth_role() in ('direktor','omborchi','hisobchi') and tenant_id = auth_tenant_id());
drop policy if exists "boshqaradi" on suppliers;
create policy "boshqaradi" on suppliers for all to authenticated
  using (auth_role() in ('direktor','omborchi') and tenant_id = auth_tenant_id())
  with check (auth_role() in ('direktor','omborchi') and tenant_id = auth_tenant_id());

-- products: sotadiganlar ham ko'radi (POS); boshqarish — direktor + omborchi
drop policy if exists "ko'radi" on products;
create policy "ko'radi" on products for select to authenticated
  using (auth_role() in ('direktor','omborchi','hisobchi','registratura') and tenant_id = auth_tenant_id());
drop policy if exists "boshqaradi" on products;
create policy "boshqaradi" on products for insert to authenticated
  with check (auth_role() in ('direktor','omborchi') and tenant_id = auth_tenant_id());
drop policy if exists "tahrirlaydi" on products;
create policy "tahrirlaydi" on products for update to authenticated
  using (auth_role() in ('direktor','omborchi') and tenant_id = auth_tenant_id())
  with check (auth_role() in ('direktor','omborchi') and tenant_id = auth_tenant_id());
-- MUHIM: stock ustunini qo'lda o'zgartirish RPC'larsiz mumkin emas edi — lekin
-- update policy stockga ham yo'l qo'yadi. Harakatsiz zaxira o'zgarishining oldini
-- olish uchun trigger:
create or replace function public._guard_stock_change() returns trigger
language plpgsql as $$
begin
  -- stock faqat RPC ichida (allow_stock_change flag) o'zgarishi mumkin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.allow_stock_change', true), '') <> 'on' then
    raise exception 'Zaxira faqat ombor amallari (kirim/sotuv/tuzatish) orqali o''zgaradi';
  end if;
  return new;
end $$;
drop trigger if exists guard_stock on products;
create trigger guard_stock before update on products
  for each row execute function _guard_stock_change();

-- purchases / purchase_items: ko'rish; yozish RPC orqali (definer)
drop policy if exists "ko'radi" on purchases;
create policy "ko'radi" on purchases for select to authenticated
  using (auth_role() in ('direktor','omborchi','hisobchi') and tenant_id = auth_tenant_id());
drop policy if exists "qoralama o'chadi" on purchases;
create policy "qoralama o'chadi" on purchases for delete to authenticated
  using (auth_role() in ('direktor','omborchi') and tenant_id = auth_tenant_id()
         and status = 'QORALAMA');
drop policy if exists "ko'radi" on purchase_items;
create policy "ko'radi" on purchase_items for select to authenticated
  using (auth_role() in ('direktor','omborchi','hisobchi') and tenant_id = auth_tenant_id());

-- inventory_movements: faqat o'qish (yozish — RPC)
drop policy if exists "ko'radi" on inventory_movements;
create policy "ko'radi" on inventory_movements for select to authenticated
  using (auth_role() in ('direktor','omborchi','hisobchi') and tenant_id = auth_tenant_id());

-- sales oilasi: sotadiganlar va moliya ko'radi; yozish — RPC
do $$
declare t text;
begin
  foreach t in array array['sales','sale_items','sale_payments','refunds']
  loop
    execute format('drop policy if exists "ko''radi" on %I', t);
    execute format(
      'create policy "ko''radi" on %I for select to authenticated
         using (auth_role() in (''direktor'',''registratura'',''hisobchi'') and tenant_id = auth_tenant_id())', t);
  end loop;
end $$;

-- Audit trigger (mavjud audit_row_change) — narx o'zgarishi, kirim, sotuv, qaytarish
do $$
declare t text;
begin
  foreach t in array array['products','suppliers','purchases','sales','refunds']
  loop
    execute format('drop trigger if exists audit_change on %I', t);
    execute format(
      'create trigger audit_change after insert or update or delete on %I
       for each row execute function audit_row_change()', t);
  end loop;
end $$;

-- ============ RPC: ZAXIRA TUZATISH / KIRIM-CHIQIM ============
create or replace function public._apply_stock(
  p_tenant text, p_product text, p_delta numeric, p_type text,
  p_ref_table text, p_ref_id text, p_reason text, p_actor uuid, p_actor_name text
) returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_before numeric;
  v_after numeric;
begin
  select stock into v_before from products
  where id = p_product and tenant_id = p_tenant
  for update;
  if v_before is null then
    raise exception 'Mahsulot topilmadi';
  end if;
  v_after := v_before + p_delta;
  if v_after < 0 then
    raise exception 'Zaxira yetarli emas: % (bor: %, kerak: %)',
      (select name from products where id = p_product), v_before, abs(p_delta);
  end if;
  perform set_config('app.allow_stock_change', 'on', true);
  update products set stock = v_after where id = p_product;
  perform set_config('app.allow_stock_change', '', true);
  insert into inventory_movements
    (tenant_id, product_id, type, qty_change, stock_before, stock_after,
     ref_table, ref_id, reason, created_by, created_by_name)
  values
    (p_tenant, p_product, p_type, p_delta, v_before, v_after,
     p_ref_table, p_ref_id, p_reason, p_actor, p_actor_name);
end $$;
revoke execute on function public._apply_stock(text,text,numeric,text,text,text,text,uuid,text) from public, anon, authenticated;

create or replace function public.adjust_stock(
  p_product_id text,
  p_qty_change numeric,
  p_type text,           -- KIRIM | CHIQIM | TUZATISH | TAMINOTCHI_QAYTARISH
  p_reason text
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  v_name text;
begin
  if v_role is null or v_role not in ('direktor','omborchi') then
    raise exception 'Ombor amaliga ruxsat yo''q';
  end if;
  if p_type not in ('KIRIM','CHIQIM','TUZATISH','TAMINOTCHI_QAYTARISH') then
    raise exception 'Noto''g''ri amal turi';
  end if;
  if p_qty_change = 0 then
    raise exception 'Miqdor 0 bo''lishi mumkin emas';
  end if;
  if p_type in ('CHIQIM','TAMINOTCHI_QAYTARISH') and p_qty_change > 0 then
    p_qty_change := -p_qty_change;
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Sabab ko''rsatilishi shart';
  end if;
  select full_name into v_name from profiles where id = auth.uid();
  perform _apply_stock(v_tenant, p_product_id, p_qty_change, p_type,
                       'adjust', '', p_reason, auth.uid(), coalesce(v_name,''));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.adjust_stock(text,numeric,text,text) from public, anon;
grant execute on function public.adjust_stock(text,numeric,text,text) to authenticated;

-- ============ RPC: XARID YARATISH / QABUL QILISH ============
create or replace function public.create_purchase(
  p_supplier_id text,
  p_items jsonb,         -- [{"id":product_id,"qty":n,"cost":n}]
  p_note text default '',
  p_receive_now boolean default false
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  v_name text;
  v_pid text := gen_random_uuid()::text;
  v_total bigint := 0;
  it jsonb;
  v_qty numeric; v_cost bigint;
begin
  if v_role is null or v_role not in ('direktor','omborchi') then
    raise exception 'Kirim yaratishga ruxsat yo''q';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Kamida bitta mahsulot bo''lishi kerak';
  end if;
  if p_supplier_id is not null and not exists
    (select 1 from suppliers where id = p_supplier_id and tenant_id = v_tenant) then
    raise exception 'Ta''minotchi topilmadi';
  end if;
  select full_name into v_name from profiles where id = auth.uid();

  insert into purchases (id, tenant_id, supplier_id, status, note, created_by, created_by_name)
  values (v_pid, v_tenant, p_supplier_id, 'QORALAMA', coalesce(p_note,''), auth.uid(), coalesce(v_name,''));

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::numeric;
    v_cost := (it->>'cost')::bigint;
    if v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 then
      raise exception 'Miqdor/narx noto''g''ri';
    end if;
    if not exists (select 1 from products where id = it->>'id' and tenant_id = v_tenant) then
      raise exception 'Mahsulot topilmadi: %', it->>'id';
    end if;
    insert into purchase_items (tenant_id, purchase_id, product_id, qty, unit_cost, line_total)
    values (v_tenant, v_pid, it->>'id', v_qty, v_cost, round(v_qty * v_cost));
    v_total := v_total + round(v_qty * v_cost);
  end loop;
  update purchases set total = v_total where id = v_pid;

  if p_receive_now then
    perform receive_purchase(v_pid);
  end if;
  return jsonb_build_object('id', v_pid, 'total', v_total,
    'status', case when p_receive_now then 'QABUL_QILINDI' else 'QORALAMA' end);
end $$;
revoke execute on function public.create_purchase(text,jsonb,text,boolean) from public, anon;
grant execute on function public.create_purchase(text,jsonb,text,boolean) to authenticated;

create or replace function public.receive_purchase(p_purchase_id text)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  v_name text;
  v_status text;
  r record;
  v_stock numeric; v_avg bigint; v_new_avg bigint;
begin
  if v_role is null or v_role not in ('direktor','omborchi') then
    raise exception 'Qabul qilishga ruxsat yo''q';
  end if;
  select full_name into v_name from profiles where id = auth.uid();

  -- Takror qabul qilishdan himoya: qator qulfi + holat tekshiruvi
  select status into v_status from purchases
  where id = p_purchase_id and tenant_id = v_tenant
  for update;
  if v_status is null then
    raise exception 'Kirim topilmadi';
  end if;
  if v_status <> 'QORALAMA' then
    raise exception 'Bu kirim allaqachon qabul qilingan yoki bekor qilingan (%)', v_status;
  end if;

  for r in select * from purchase_items where purchase_id = p_purchase_id loop
    -- O'rtacha tannarxni yangilash (qulf _apply_stock ichida ham bor,
    -- lekin avg hisobini bir xil qulf ostida bajarish uchun shu yerda lock)
    select stock, avg_cost into v_stock, v_avg from products
    where id = r.product_id for update;
    if v_stock + r.qty > 0 then
      v_new_avg := round((v_stock * v_avg + r.qty * r.unit_cost) / (v_stock + r.qty));
    else
      v_new_avg := r.unit_cost;
    end if;
    perform set_config('app.allow_stock_change', 'on', true);
    update products
    set avg_cost = v_new_avg, purchase_price = r.unit_cost
    where id = r.product_id;
    perform set_config('app.allow_stock_change', '', true);
    perform _apply_stock(v_tenant, r.product_id, r.qty, 'KIRIM',
      'purchases', p_purchase_id, 'Kirim qabul qilindi', auth.uid(), coalesce(v_name,''));
  end loop;

  update purchases set status = 'QABUL_QILINDI', received_at = now()
  where id = p_purchase_id;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.receive_purchase(text) from public, anon;
grant execute on function public.receive_purchase(text) to authenticated;

-- ============ RPC: SOTUV (POS) ============
create or replace function public.create_sale(
  p_items jsonb,          -- [{"id":product_id,"qty":n}]
  p_payments jsonb,       -- [{"method":"Naqd","amount":n}]
  p_discount bigint default 0,
  p_patient_id text default null,
  p_note text default '',
  p_idempotency_key text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  v_name text;
  v_now timestamp := now() at time zone 'Asia/Tashkent';
  v_sid text := gen_random_uuid()::text;
  v_no text;
  v_seq int;
  v_subtotal bigint := 0;
  v_total bigint;
  v_paysum bigint := 0;
  it jsonb;
  v_qty numeric;
  v_prod record;
  v_existing jsonb;
begin
  if v_role is null or v_role not in ('direktor','registratura','hisobchi') then
    raise exception 'Sotuvga ruxsat yo''q';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Savat bo''sh';
  end if;
  if p_payments is null or jsonb_array_length(p_payments) = 0 then
    raise exception 'To''lov ko''rsatilmagan';
  end if;
  if p_patient_id is not null and not exists
    (select 1 from patients where id = p_patient_id and tenant_id = v_tenant) then
    raise exception 'Bemor topilmadi';
  end if;

  -- Idempotentlik: takror so'rovda mavjud sotuvni qaytaramiz
  if p_idempotency_key is not null then
    select jsonb_build_object('id', id, 'saleNo', sale_no, 'total', total,
                              'date', date, 'time', time, 'duplicate', true)
      into v_existing
    from sales where tenant_id = v_tenant and idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  select full_name into v_name from profiles where id = auth.uid();

  -- Sotuv raqami: S-YYYYMMDD-NNN (har klinikada o'zinikidan)
  perform pg_advisory_xact_lock(hashtext('sale_no_' || v_tenant || '_' || v_now::date::text));
  select count(*) + 1 into v_seq from sales
  where tenant_id = v_tenant and date = v_now::date;
  v_no := 'S-' || to_char(v_now, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');

  insert into sales (id, tenant_id, sale_no, patient_id, status, subtotal, discount, total,
                     date, time, created_by, cashier_name, note, idempotency_key)
  values (v_sid, v_tenant, v_no, p_patient_id, 'TOLANDI', 0, coalesce(p_discount,0), 0,
          v_now::date, to_char(v_now, 'HH24:MI'), auth.uid(), coalesce(v_name,''),
          coalesce(p_note,''), p_idempotency_key);

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Miqdor noto''g''ri';
    end if;
    -- Narx va tannarx serverdan olinadi (klientga ishonmaymiz); qator qulfi bilan
    select id, name, sell_price, avg_cost, stock, active into v_prod
    from products where id = it->>'id' and tenant_id = v_tenant
    for update;
    if v_prod.id is null then
      raise exception 'Mahsulot topilmadi';
    end if;
    if not v_prod.active then
      raise exception 'Mahsulot faol emas: %', v_prod.name;
    end if;
    insert into sale_items (tenant_id, sale_id, product_id, name, qty, unit_price,
                            cost_at_sale, line_total)
    values (v_tenant, v_sid, v_prod.id, v_prod.name, v_qty, v_prod.sell_price,
            v_prod.avg_cost, round(v_qty * v_prod.sell_price));
    v_subtotal := v_subtotal + round(v_qty * v_prod.sell_price);
    perform _apply_stock(v_tenant, v_prod.id, -v_qty, 'SOTUV',
      'sales', v_sid, 'Sotuv ' || v_no, auth.uid(), coalesce(v_name,''));
  end loop;

  if coalesce(p_discount, 0) > v_subtotal then
    raise exception 'Chegirma jami summadan katta bo''lishi mumkin emas';
  end if;
  v_total := v_subtotal - coalesce(p_discount, 0);

  -- Split to'lov: yig'indisi aynan jami bo'lishi shart
  for it in select * from jsonb_array_elements(p_payments) loop
    if (it->>'amount')::bigint <= 0 then
      raise exception 'To''lov summasi noto''g''ri';
    end if;
    insert into sale_payments (tenant_id, sale_id, method, amount)
    values (v_tenant, v_sid, it->>'method', (it->>'amount')::bigint);
    v_paysum := v_paysum + (it->>'amount')::bigint;
  end loop;
  if v_paysum <> v_total then
    raise exception 'To''lovlar yig''indisi (%) jami summaga (%) teng emas', v_paysum, v_total;
  end if;

  update sales set subtotal = v_subtotal, total = v_total where id = v_sid;

  return jsonb_build_object('id', v_sid, 'saleNo', v_no, 'subtotal', v_subtotal,
    'discount', coalesce(p_discount,0), 'total', v_total,
    'date', v_now::date, 'time', to_char(v_now, 'HH24:MI'));
end $$;
revoke execute on function public.create_sale(jsonb,jsonb,bigint,text,text,text) from public, anon;
grant execute on function public.create_sale(jsonb,jsonb,bigint,text,text,text) to authenticated;

-- ============ RPC: QAYTARISH ============
create or replace function public.refund_sale(
  p_sale_id text,
  p_items jsonb,     -- null = to'liq; yoki [{"itemId":sale_item_id,"qty":n}]
  p_reason text
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  v_name text;
  v_now timestamp := now() at time zone 'Asia/Tashkent';
  v_sale record;
  r record;
  it jsonb;
  v_qty numeric;
  v_refund_sub bigint := 0;
  v_amount bigint;
  v_all_refunded boolean;
begin
  if v_role is null or v_role not in ('direktor','hisobchi') then
    raise exception 'Qaytarishga ruxsat yo''q';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Qaytarish sababi ko''rsatilishi shart';
  end if;
  select full_name into v_name from profiles where id = auth.uid();

  select * into v_sale from sales
  where id = p_sale_id and tenant_id = v_tenant
  for update;
  if v_sale.id is null then
    raise exception 'Sotuv topilmadi';
  end if;
  if v_sale.status = 'QAYTARILGAN' then
    raise exception 'Bu sotuv allaqachon to''liq qaytarilgan';
  end if;

  if p_items is null then
    -- To'liq qaytarish: qolgan barcha miqdorlar
    for r in select * from sale_items where sale_id = p_sale_id for update loop
      v_qty := r.qty - r.refunded_qty;
      if v_qty > 0 then
        update sale_items set refunded_qty = qty where id = r.id;
        v_refund_sub := v_refund_sub + round(v_qty * r.unit_price);
        perform _apply_stock(v_tenant, r.product_id, v_qty, 'QAYTARISH',
          'sales', p_sale_id, 'Qaytarish: ' || p_reason, auth.uid(), coalesce(v_name,''));
      end if;
    end loop;
  else
    for it in select * from jsonb_array_elements(p_items) loop
      v_qty := (it->>'qty')::numeric;
      select * into r from sale_items
      where id = it->>'itemId' and sale_id = p_sale_id
      for update;
      if r.id is null then
        raise exception 'Sotuv qatori topilmadi';
      end if;
      if v_qty is null or v_qty <= 0 or v_qty > r.qty - r.refunded_qty then
        raise exception '%: qaytarish miqdori noto''g''ri (qoldi: %)', r.name, r.qty - r.refunded_qty;
      end if;
      update sale_items set refunded_qty = refunded_qty + v_qty where id = r.id;
      v_refund_sub := v_refund_sub + round(v_qty * r.unit_price);
      perform _apply_stock(v_tenant, r.product_id, v_qty, 'QAYTARISH',
        'sales', p_sale_id, 'Qaytarish: ' || p_reason, auth.uid(), coalesce(v_name,''));
    end loop;
  end if;

  if v_refund_sub = 0 then
    raise exception 'Qaytariladigan narsa yo''q';
  end if;

  -- Chegirma proporsional hisobga olinadi
  v_amount := round(v_refund_sub * v_sale.total::numeric / nullif(v_sale.subtotal, 0));

  insert into refunds (tenant_id, sale_id, amount, reason, items, created_by,
                       created_by_name, date, time)
  values (v_tenant, p_sale_id, v_amount, p_reason, coalesce(p_items, 'null'::jsonb),
          auth.uid(), coalesce(v_name,''), v_now::date, to_char(v_now, 'HH24:MI'));

  select bool_and(refunded_qty >= qty) into v_all_refunded
  from sale_items where sale_id = p_sale_id;
  update sales set status = case when v_all_refunded then 'QAYTARILGAN'
                                 else 'QISMAN_QAYTARILGAN' end
  where id = p_sale_id;

  return jsonb_build_object('ok', true, 'amount', v_amount,
    'status', case when v_all_refunded then 'QAYTARILGAN' else 'QISMAN_QAYTARILGAN' end);
end $$;
revoke execute on function public.refund_sale(text,jsonb,text) from public, anon;
grant execute on function public.refund_sale(text,jsonb,text) to authenticated;
