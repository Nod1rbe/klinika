-- 2-bosqich: Kassa smenalari (Modul G), ta'minotchi qarzi,
-- tannarxni DB darajasida yashirish.

-- ============ BEKOR VAQTINI SAQLASH (naqd qaytarishni smenaga bog'lash uchun) ============
alter table appointments add column if not exists cancelled_at timestamptz;

create or replace function public._set_cancelled_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'BEKOR' and old.status is distinct from 'BEKOR' then
    new.cancelled_at := now();
  end if;
  return new;
end $$;
drop trigger if exists set_cancelled on appointments;
create trigger set_cancelled before update on appointments
  for each row execute function _set_cancelled_at();

-- ============ TA'MINOTCHI QARZI ============
alter table purchases add column if not exists paid_amount bigint not null default 0
  check (paid_amount >= 0);
-- Mavjud qabul qilingan kirimlar to'langan deb belgilanadi (qarz tarixda yo'q edi)
update purchases set paid_amount = total where status = 'QABUL_QILINDI' and paid_amount = 0;

create or replace function public.pay_supplier(p_purchase_id text, p_amount bigint)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  v_rec record;
begin
  if v_role is null or v_role not in ('direktor','hisobchi') then
    raise exception 'Ta''minotchiga to''lovga ruxsat yo''q';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Summa noto''g''ri';
  end if;
  select * into v_rec from purchases
  where id = p_purchase_id and tenant_id = v_tenant for update;
  if v_rec.id is null then
    raise exception 'Kirim topilmadi';
  end if;
  if v_rec.status <> 'QABUL_QILINDI' then
    raise exception 'Faqat qabul qilingan kirim uchun to''lov qilinadi';
  end if;
  if v_rec.paid_amount + p_amount > v_rec.total then
    raise exception 'To''lov qarzdan ortiq (qarz: %)', v_rec.total - v_rec.paid_amount;
  end if;
  update purchases set paid_amount = paid_amount + p_amount where id = p_purchase_id;
  return jsonb_build_object('paid', v_rec.paid_amount + p_amount,
                            'debt', v_rec.total - v_rec.paid_amount - p_amount);
end $$;
revoke execute on function public.pay_supplier(text, bigint) from public, anon;
grant execute on function public.pay_supplier(text, bigint) to authenticated;

-- ============ TANNARXNI DB DARAJASIDA YASHIRISH ============
-- Frontend endi products_v dan o'qiydi: ruxsatsiz rollarga tannarx NULL qaytadi
create or replace view public.products_v with (security_invoker = true) as
select
  id, tenant_id, name, sku, barcode, category, description,
  case when auth_role() in ('direktor','omborchi','hisobchi','superadmin')
       then purchase_price end as purchase_price,
  case when auth_role() in ('direktor','omborchi','hisobchi','superadmin')
       then avg_cost end as avg_cost,
  sell_price, stock, min_stock, unit, expiry_date, supplier_id, active,
  created_at, updated_at
from products;
grant select on public.products_v to authenticated;

-- ============ KASSA SMENALARI ============
create table if not exists cash_sessions (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  status text not null default 'OCHIQ' check (status in ('OCHIQ','YOPIQ')),
  opening_cash bigint not null default 0 check (opening_cash >= 0),
  opened_by uuid,
  opened_by_name text not null default '',
  opened_at timestamptz not null default now(),
  closed_by uuid,
  closed_by_name text not null default '',
  closed_at timestamptz,
  expected_cash bigint,
  actual_cash bigint,
  difference bigint,
  summary jsonb,        -- yopilish paytidagi to'liq hisob (audit uchun)
  note text not null default ''
);
-- Har klinikada bir vaqtda faqat bitta ochiq smena
create unique index if not exists cash_sessions_open_uniq
  on cash_sessions (tenant_id) where status = 'OCHIQ';
create index if not exists cash_sessions_tenant_idx on cash_sessions (tenant_id, opened_at desc);

create table if not exists cash_movements (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  session_id text not null references cash_sessions(id),
  type text not null check (type in ('KIRIM','CHIQIM')),
  amount bigint not null check (amount > 0),
  reason text not null,
  created_by uuid,
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists cash_movements_sid_idx on cash_movements (session_id);

do $$
declare t text;
begin
  foreach t in array array['cash_sessions','cash_movements']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "superadmin" on %I', t);
    execute format(
      'create policy "superadmin" on %I for all to authenticated
         using (auth_role() = ''superadmin'') with check (auth_role() = ''superadmin'')', t);
    execute format('drop policy if exists "ko''radi" on %I', t);
    execute format(
      'create policy "ko''radi" on %I for select to authenticated
         using (auth_role() in (''direktor'',''registratura'',''hisobchi'') and tenant_id = auth_tenant_id())', t);
  end loop;
end $$;

drop trigger if exists audit_change on cash_sessions;
create trigger audit_change after insert or update or delete on cash_sessions
  for each row execute function audit_row_change();

-- ============ RPC: SMENA OCHISH ============
create or replace function public.open_cash_session(p_opening_cash bigint)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  v_name text;
  v_id text := gen_random_uuid()::text;
begin
  if v_role is null or v_role not in ('direktor','registratura','hisobchi') then
    raise exception 'Smena ochishga ruxsat yo''q';
  end if;
  if p_opening_cash is null or p_opening_cash < 0 then
    raise exception 'Boshlang''ich naqd summa noto''g''ri';
  end if;
  perform pg_advisory_xact_lock(hashtext('cash_session_' || v_tenant));
  if exists (select 1 from cash_sessions where tenant_id = v_tenant and status = 'OCHIQ') then
    raise exception 'Ochiq smena allaqachon mavjud — avval uni yoping';
  end if;
  select full_name into v_name from profiles where id = auth.uid();
  insert into cash_sessions (id, tenant_id, opening_cash, opened_by, opened_by_name)
  values (v_id, v_tenant, p_opening_cash, auth.uid(), coalesce(v_name,''));
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function public.open_cash_session(bigint) from public, anon;
grant execute on function public.open_cash_session(bigint) to authenticated;

-- ============ RPC: NAQD KIRIM/CHIQIM ============
create or replace function public.add_cash_movement(p_type text, p_amount bigint, p_reason text)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  v_name text;
  v_sid text;
begin
  if v_role is null or v_role not in ('direktor','registratura','hisobchi') then
    raise exception 'Ruxsat yo''q';
  end if;
  if p_type not in ('KIRIM','CHIQIM') then
    raise exception 'Noto''g''ri tur';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Summa noto''g''ri';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Sabab ko''rsatilishi shart';
  end if;
  select id into v_sid from cash_sessions
  where tenant_id = v_tenant and status = 'OCHIQ' for update;
  if v_sid is null then
    raise exception 'Ochiq smena yo''q — avval smena oching';
  end if;
  select full_name into v_name from profiles where id = auth.uid();
  insert into cash_movements (tenant_id, session_id, type, amount, reason, created_by, created_by_name)
  values (v_tenant, v_sid, p_type, p_amount, trim(p_reason), auth.uid(), coalesce(v_name,''));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.add_cash_movement(text, bigint, text) from public, anon;
grant execute on function public.add_cash_movement(text, bigint, text) to authenticated;

-- ============ SMENA HISOBI (jonli va yopishda bir xil formula) ============
create or replace function public.cash_session_summary(p_session_id text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  s record;
  o_ts timestamptz;
  e_ts timestamptz;
  o_local timestamp;
  e_local timestamp;
  v_service_cash bigint; v_service_refund bigint;
  v_pos_cash bigint; v_pos_refund bigint;
  v_card bigint;
  v_in bigint; v_out bigint;
  v_tx int;
begin
  if v_role is null or v_role not in ('direktor','registratura','hisobchi','superadmin') then
    raise exception 'Ruxsat yo''q';
  end if;
  select * into s from cash_sessions where id = p_session_id
    and (tenant_id = v_tenant or v_role = 'superadmin');
  if s.id is null then
    raise exception 'Smena topilmadi';
  end if;
  o_ts := s.opened_at;
  e_ts := coalesce(s.closed_at, now());
  o_local := o_ts at time zone 'Asia/Tashkent';
  e_local := e_ts at time zone 'Asia/Tashkent';

  -- Xizmat to'lovlari (qabullar) — naqd, smena oynasida
  select coalesce(sum((select sum(price * qty) from appointment_services x
                       where x.appointment_id = a.id)), 0)
    into v_service_cash
  from appointments a
  where a.tenant_id = s.tenant_id and a.payment_method = 'Naqd'
    and a.paid_at is not null
    and (a.date + a.paid_at::time) >= o_local
    and (a.date + a.paid_at::time) <= e_local;

  -- Xizmat naqd qaytarishlari — smena ichida bekor qilingan naqd to'lovlar
  select coalesce(sum((select sum(price * qty) from appointment_services x
                       where x.appointment_id = a.id)), 0)
    into v_service_refund
  from appointments a
  where a.tenant_id = s.tenant_id and a.payment_method = 'Naqd'
    and a.paid_at is not null and a.status = 'BEKOR'
    and a.cancelled_at >= o_ts and a.cancelled_at <= e_ts;

  -- POS naqd tushum
  select coalesce(sum(sp.amount), 0), count(distinct sl.id)
    into v_pos_cash, v_tx
  from sale_payments sp
  join sales sl on sl.id = sp.sale_id
  where sl.tenant_id = s.tenant_id and sp.method = 'Naqd'
    and sl.created_at >= o_ts and sl.created_at <= e_ts;

  -- POS qaytarishlarning naqd ulushi (aralash to'lovda proporsional)
  select coalesce(sum(round(r.amount *
    least(1, coalesce((select sum(amount)::numeric from sale_payments
                       where sale_id = sl.id and method = 'Naqd'), 0)
            / nullif(sl.total, 0)))), 0)
    into v_pos_refund
  from refunds r
  join sales sl on sl.id = r.sale_id
  where r.tenant_id = s.tenant_id
    and r.created_at >= o_ts and r.created_at <= e_ts;

  -- Karta/onlayn jami (naqd kassaga KIRMAYDI — faqat ma'lumot uchun)
  select coalesce((
    select sum((select sum(price * qty) from appointment_services x where x.appointment_id = a.id))
    from appointments a
    where a.tenant_id = s.tenant_id and a.payment_method is not null
      and a.payment_method <> 'Naqd' and a.paid_at is not null and a.status <> 'BEKOR'
      and (a.date + a.paid_at::time) >= o_local and (a.date + a.paid_at::time) <= e_local
  ), 0) + coalesce((
    select sum(sp.amount) from sale_payments sp join sales sl on sl.id = sp.sale_id
    where sl.tenant_id = s.tenant_id and sp.method <> 'Naqd'
      and sl.created_at >= o_ts and sl.created_at <= e_ts
  ), 0) into v_card;

  select coalesce(sum(amount) filter (where type = 'KIRIM'), 0),
         coalesce(sum(amount) filter (where type = 'CHIQIM'), 0)
    into v_in, v_out
  from cash_movements where session_id = s.id;

  return jsonb_build_object(
    'openingCash', s.opening_cash,
    'serviceCash', v_service_cash,
    'serviceRefundCash', v_service_refund,
    'posCash', v_pos_cash,
    'posRefundCash', v_pos_refund,
    'cashIn', v_in,
    'cashOut', v_out,
    'cardTotal', v_card,
    'posTxCount', v_tx,
    'expectedCash', s.opening_cash + v_service_cash + v_pos_cash
                    - v_service_refund - v_pos_refund + v_in - v_out
  );
end $$;
revoke execute on function public.cash_session_summary(text) from public, anon;
grant execute on function public.cash_session_summary(text) to authenticated;

-- ============ RPC: SMENANI YOPISH ============
create or replace function public.close_cash_session(p_actual_cash bigint, p_note text default '')
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  v_name text;
  v_sid text;
  v_sum jsonb;
  v_expected bigint;
begin
  if v_role is null or v_role not in ('direktor','registratura','hisobchi') then
    raise exception 'Smena yopishga ruxsat yo''q';
  end if;
  if p_actual_cash is null or p_actual_cash < 0 then
    raise exception 'Sanab chiqilgan naqd summa noto''g''ri';
  end if;
  select id into v_sid from cash_sessions
  where tenant_id = v_tenant and status = 'OCHIQ' for update;
  if v_sid is null then
    raise exception 'Ochiq smena yo''q';
  end if;
  v_sum := cash_session_summary(v_sid);
  v_expected := (v_sum->>'expectedCash')::bigint;
  select full_name into v_name from profiles where id = auth.uid();
  update cash_sessions
  set status = 'YOPIQ',
      closed_by = auth.uid(),
      closed_by_name = coalesce(v_name, ''),
      closed_at = now(),
      expected_cash = v_expected,
      actual_cash = p_actual_cash,
      difference = p_actual_cash - v_expected,
      summary = v_sum,
      note = coalesce(p_note, '')
  where id = v_sid;
  return jsonb_build_object('id', v_sid, 'expected', v_expected,
    'actual', p_actual_cash, 'difference', p_actual_cash - v_expected,
    'summary', v_sum);
end $$;
revoke execute on function public.close_cash_session(bigint, text) from public, anon;
grant execute on function public.close_cash_session(bigint, text) to authenticated;
