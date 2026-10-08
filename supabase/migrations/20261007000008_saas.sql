-- SaaS: ko'p klinikali (multi-tenant) rejim.
-- * Har klinika faqat o'z ma'lumotini ko'radi (RLS tenant bo'yicha)
-- * superadmin (platforma egasi) — yangi klinika ochadi
-- * direktor — o'z kabinetidan xodim/xizmat/shifokor/rekvizitlarni boshqaradi

-- ============ PROFILES: superadmin roli, email, disabled ============
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('superadmin','direktor','registratura','shifokor','hisobchi','laborant'));
alter table profiles add column if not exists email text;
alter table profiles add column if not exists disabled boolean not null default false;
update profiles p set email = u.email
from auth.users u where u.id = p.id and p.email is null;

-- ============ TENANTS: klinika rekvizitlari ============
alter table tenants add column if not exists address text not null default '';
alter table tenants add column if not exists phone text not null default '';
alter table tenants add column if not exists maps_url text not null default '';
alter table tenants add column if not exists active boolean not null default true;
update tenants set
  name = 'LOR CLINICS',
  address = case when address = '' then 'Namangan shahri' else address end,
  phone = case when phone = '' then '+998 69 000 00 00' else phone end,
  maps_url = case when maps_url = '' then 'https://maps.google.com/?q=LOR+CLINICS+Namangan' else maps_url end
where id = 't1';

-- ============ YORDAMCHI ============
create or replace function public.auth_tenant_id() returns text
language sql stable security definer set search_path = public
as $$ select tenant_id from profiles where id = auth.uid() $$;

-- ============ BARCHA ESKI POLICYLARNI TOZALASH ============
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('tenants','doctors','services','patients','appointments',
                        'appointment_services','lab_orders','employees','audit_logs','profiles')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ============ YANGI TENANT-ASOSIDAGI POLICYLAR ============
-- superadmin hamma narsaga to'liq kiradi
do $$
declare t text;
begin
  foreach t in array array['tenants','doctors','services','patients','appointments',
                           'appointment_services','lab_orders','employees','audit_logs','profiles']
  loop
    execute format(
      'create policy "superadmin" on %I for all to authenticated
         using (auth_role() = ''superadmin'') with check (auth_role() = ''superadmin'')', t);
  end loop;
end $$;

-- TENANTS: har kim o'z klinikasini o'qiydi, direktor rekvizitlarni tahrirlaydi
create policy "o'z klinikasi" on tenants for select to authenticated
  using (id = auth_tenant_id());
create policy "direktor tahrirlaydi" on tenants for update to authenticated
  using (auth_role() = 'direktor' and id = auth_tenant_id())
  with check (auth_role() = 'direktor' and id = auth_tenant_id());

-- DOCTORS / SERVICES: tenant ichida hamma o'qiydi, direktor boshqaradi
do $$
declare t text;
begin
  foreach t in array array['doctors','services']
  loop
    execute format(
      'create policy "tenant o''qiydi" on %I for select to authenticated
         using (tenant_id = auth_tenant_id())', t);
    execute format(
      'create policy "direktor boshqaradi" on %I for all to authenticated
         using (auth_role() = ''direktor'' and tenant_id = auth_tenant_id())
         with check (auth_role() = ''direktor'' and tenant_id = auth_tenant_id())', t);
  end loop;
end $$;

-- PATIENTS
create policy "tenant o'qiydi" on patients for select to authenticated
  using (tenant_id = auth_tenant_id());
create policy "registratura yozadi" on patients for insert to authenticated
  with check (auth_role() in ('direktor','registratura') and tenant_id = auth_tenant_id());
create policy "registratura tahrirlaydi" on patients for update to authenticated
  using (auth_role() in ('direktor','registratura') and tenant_id = auth_tenant_id())
  with check (auth_role() in ('direktor','registratura') and tenant_id = auth_tenant_id());
create policy "direktor to'liq" on patients for all to authenticated
  using (auth_role() = 'direktor' and tenant_id = auth_tenant_id())
  with check (auth_role() = 'direktor' and tenant_id = auth_tenant_id());

-- APPOINTMENTS
create policy "boshqaruv o'qiydi" on appointments for select to authenticated
  using (auth_role() in ('direktor','registratura','hisobchi') and tenant_id = auth_tenant_id());
create policy "shifokor o'z to'langanini o'qiydi" on appointments for select to authenticated
  using (
    auth_role() = 'shifokor'
    and tenant_id = auth_tenant_id()
    and doctor_id = auth_doctor_id()
    and status in ('TOLANDI','NAVBATDA','QABULDA','YAKUNLANDI')
  );
create policy "registratura yaratadi" on appointments for insert to authenticated
  with check (auth_role() in ('direktor','registratura') and tenant_id = auth_tenant_id());
create policy "boshqaruv yangilaydi" on appointments for update to authenticated
  using (auth_role() in ('direktor','registratura','hisobchi') and tenant_id = auth_tenant_id())
  with check (auth_role() in ('direktor','registratura','hisobchi') and tenant_id = auth_tenant_id());
create policy "shifokor o'zinikini yangilaydi" on appointments for update to authenticated
  using (auth_role() = 'shifokor' and tenant_id = auth_tenant_id() and doctor_id = auth_doctor_id())
  with check (auth_role() = 'shifokor' and tenant_id = auth_tenant_id() and doctor_id = auth_doctor_id());
create policy "direktor to'liq" on appointments for all to authenticated
  using (auth_role() = 'direktor' and tenant_id = auth_tenant_id())
  with check (auth_role() = 'direktor' and tenant_id = auth_tenant_id());

-- APPOINTMENT_SERVICES
create policy "xodimlar o'qiydi" on appointment_services for select to authenticated
  using (auth_role() in ('direktor','registratura','hisobchi','shifokor') and tenant_id = auth_tenant_id());
create policy "registratura yozadi" on appointment_services for insert to authenticated
  with check (auth_role() in ('direktor','registratura') and tenant_id = auth_tenant_id());
create policy "direktor to'liq" on appointment_services for all to authenticated
  using (auth_role() = 'direktor' and tenant_id = auth_tenant_id())
  with check (auth_role() = 'direktor' and tenant_id = auth_tenant_id());

-- LAB_ORDERS
create policy "lab o'qiydi" on lab_orders for select to authenticated
  using (auth_role() in ('direktor','laborant','shifokor') and tenant_id = auth_tenant_id());
create policy "shifokor yo'llaydi" on lab_orders for insert to authenticated
  with check (auth_role() in ('direktor','shifokor') and tenant_id = auth_tenant_id());
create policy "laborant natija kiritadi" on lab_orders for update to authenticated
  using (auth_role() in ('direktor','laborant') and tenant_id = auth_tenant_id())
  with check (auth_role() in ('direktor','laborant') and tenant_id = auth_tenant_id());
create policy "direktor to'liq" on lab_orders for all to authenticated
  using (auth_role() = 'direktor' and tenant_id = auth_tenant_id())
  with check (auth_role() = 'direktor' and tenant_id = auth_tenant_id());

-- EMPLOYEES
create policy "boshqaruv o'qiydi" on employees for select to authenticated
  using (auth_role() in ('direktor','hisobchi') and tenant_id = auth_tenant_id());
create policy "direktor boshqaradi" on employees for all to authenticated
  using (auth_role() = 'direktor' and tenant_id = auth_tenant_id())
  with check (auth_role() = 'direktor' and tenant_id = auth_tenant_id());

-- AUDIT_LOGS: direktor faqat o'z klinikasinikini o'qiydi; o'zgartirish yo'q
create policy "direktor o'qiydi" on audit_logs for select to authenticated
  using (auth_role() = 'direktor' and tenant_id = auth_tenant_id());

-- PROFILES: o'zini o'qiydi; direktor o'z klinikasi xodimlarini ko'radi
create policy "o'z profili" on profiles for select to authenticated
  using (id = auth.uid());
create policy "direktor xodimlarni ko'radi" on profiles for select to authenticated
  using (auth_role() = 'direktor' and tenant_id = auth_tenant_id());

-- ============ AUTH FOYDALANUVCHI YARATISH (ichki yordamchi) ============
create extension if not exists pgcrypto;

create or replace function public._create_auth_user(
  p_email text, p_password text, p_full_name text
) returns uuid
language plpgsql volatile security definer set search_path = public, auth, extensions
as $$
declare
  v_uid uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where lower(email) = lower(p_email)) then
    raise exception 'Bu email allaqachon ro''yxatdan o''tgan: %', p_email;
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Parol kamida 8 belgi bo''lishi kerak';
  end if;
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
     confirmation_token, recovery_token, email_change_token_new, email_change,
     email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values
    ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
     lower(p_email), extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('full_name', p_full_name), now(), now(),
     '', '', '', '', '', '', '', '');
  insert into auth.identities
    (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_uid, v_uid::text,
     jsonb_build_object('sub', v_uid::text, 'email', lower(p_email), 'email_verified', true),
     'email', now(), now(), now());
  return v_uid;
end $$;
revoke execute on function public._create_auth_user(text, text, text) from public, anon, authenticated;

-- ============ DIREKTOR: XODIM HISOBI YARATISH ============
create or replace function public.admin_create_staff(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_doctor_id text default null,
  p_position text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_caller text := auth_role();
  v_tenant text := auth_tenant_id();
  v_uid uuid;
begin
  if v_caller is null or v_caller not in ('direktor','superadmin') then
    raise exception 'Xodim qo''shishga ruxsat yo''q';
  end if;
  if p_role not in ('direktor','registratura','shifokor','hisobchi','laborant') then
    raise exception 'Noto''g''ri rol: %', p_role;
  end if;
  if p_doctor_id is not null and not exists
    (select 1 from doctors d where d.id = p_doctor_id and d.tenant_id = v_tenant) then
    raise exception 'Shifokor yozuvi topilmadi';
  end if;

  v_uid := _create_auth_user(p_email, p_password, p_full_name);
  insert into profiles (id, tenant_id, full_name, role, doctor_id, email)
  values (v_uid, v_tenant, p_full_name, p_role, p_doctor_id, lower(p_email));
  -- HR ro'yxatiga ham qo'shamiz (davomat/ish haqi uchun)
  insert into employees (id, tenant_id, name, position, branch, salary_base, kpi_percent)
  values (gen_random_uuid()::text, v_tenant, p_full_name,
          coalesce(p_position, initcap(p_role)), '', 0, 0);
  return jsonb_build_object('id', v_uid);
end $$;
revoke execute on function public.admin_create_staff(text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_create_staff(text,text,text,text,text,text) to authenticated;

-- ============ DIREKTOR: PAROL TIKLASH ============
create or replace function public.admin_reset_password(p_profile_id uuid, p_password text)
returns void
language plpgsql volatile security definer set search_path = public, auth, extensions
as $$
declare
  v_caller text := auth_role();
  v_tenant text := auth_tenant_id();
  v_target_tenant text;
begin
  select tenant_id into v_target_tenant from profiles where id = p_profile_id;
  if v_target_tenant is null then
    raise exception 'Xodim topilmadi';
  end if;
  if not (v_caller = 'superadmin' or (v_caller = 'direktor' and v_target_tenant = v_tenant)) then
    raise exception 'Parol tiklashga ruxsat yo''q';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Parol kamida 8 belgi bo''lishi kerak';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
  where id = p_profile_id;
end $$;
revoke execute on function public.admin_reset_password(uuid, text) from public, anon;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;

-- ============ DIREKTOR: XODIMNI BLOKLASH / OCHISH ============
create or replace function public.admin_set_disabled(p_profile_id uuid, p_disabled boolean)
returns void
language plpgsql volatile security definer set search_path = public, auth
as $$
declare
  v_caller text := auth_role();
  v_tenant text := auth_tenant_id();
  v_target_tenant text;
begin
  select tenant_id into v_target_tenant from profiles where id = p_profile_id;
  if v_target_tenant is null then
    raise exception 'Xodim topilmadi';
  end if;
  if not (v_caller = 'superadmin' or (v_caller = 'direktor' and v_target_tenant = v_tenant)) then
    raise exception 'Ruxsat yo''q';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'O''zingizni bloklab bo''lmaydi';
  end if;
  update auth.users
  set banned_until = case when p_disabled then 'infinity'::timestamptz else null end,
      updated_at = now()
  where id = p_profile_id;
  update profiles set disabled = p_disabled where id = p_profile_id;
end $$;
revoke execute on function public.admin_set_disabled(uuid, boolean) from public, anon;
grant execute on function public.admin_set_disabled(uuid, boolean) to authenticated;

-- ============ SUPERADMIN: YANGI KLINIKA OCHISH ============
create or replace function public.create_tenant(
  p_name text,
  p_address text,
  p_phone text,
  p_maps_url text,
  p_director_email text,
  p_director_password text,
  p_director_name text
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_tenant text := 'c' || replace(gen_random_uuid()::text, '-', '');
  v_uid uuid;
begin
  if coalesce(auth_role(), '') <> 'superadmin' then
    raise exception 'Faqat platforma egasi yangi klinika ochadi';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Klinika nomi bo''sh bo''lishi mumkin emas';
  end if;
  insert into tenants (id, name, address, phone, maps_url, active)
  values (v_tenant, trim(p_name), coalesce(p_address,''), coalesce(p_phone,''), coalesce(p_maps_url,''), true);
  v_uid := _create_auth_user(p_director_email, p_director_password, p_director_name);
  insert into profiles (id, tenant_id, full_name, role, email)
  values (v_uid, v_tenant, p_director_name, 'direktor', lower(p_director_email));
  return jsonb_build_object('tenantId', v_tenant, 'directorId', v_uid);
end $$;
revoke execute on function public.create_tenant(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.create_tenant(text,text,text,text,text,text,text) to authenticated;

-- ============ CREATE_VISIT / PAY_VISIT — tenant bo'yicha ============
create or replace function public.create_visit(
  p_patient_id text,
  p_doctor_id text,
  p_items jsonb,
  p_pay_now boolean,
  p_method text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  v_now timestamp := now() at time zone 'Asia/Tashkent';
  v_date date;
  v_time text;
  v_queue int;
  v_appt_id text := gen_random_uuid()::text;
  v_items jsonb;
  v_count int;
begin
  v_date := v_now::date;
  v_time := to_char(v_now, 'HH24:MI');

  if v_role is null or v_role not in ('direktor', 'registratura') then
    raise exception 'Qabul yaratishga ruxsat yo''q';
  end if;
  if v_tenant is null then
    raise exception 'Profil klinikaga bog''lanmagan';
  end if;
  if not exists (select 1 from patients p where p.id = p_patient_id and p.tenant_id = v_tenant) then
    raise exception 'Bemor topilmadi';
  end if;
  if not exists (select 1 from doctors d where d.id = p_doctor_id and d.tenant_id = v_tenant) then
    raise exception 'Shifokor topilmadi';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Kamida bitta xizmat tanlanishi kerak';
  end if;
  if p_pay_now and p_method is null then
    raise exception 'To''lov usuli ko''rsatilmagan';
  end if;

  -- Navbat raqami har klinikada o'zinikidan yuradi
  perform pg_advisory_xact_lock(hashtext('queue_' || v_tenant || '_' || v_date::text));
  select coalesce(max(queue_no), 0) + 1 into v_queue
  from appointments where date = v_date and tenant_id = v_tenant;

  insert into appointments
    (id, tenant_id, patient_id, doctor_id, date, time, status, payment_method, paid_at, queue_no)
  values
    (v_appt_id, v_tenant, p_patient_id, p_doctor_id, v_date, v_time,
     case when p_pay_now then 'TOLANDI' else 'TOLOV_KUTILMOQDA' end,
     case when p_pay_now then p_method end,
     case when p_pay_now then v_time end,
     v_queue);

  insert into appointment_services (tenant_id, appointment_id, service_id, price, qty)
  select v_tenant, v_appt_id, s.id, s.price,
         greatest(1, least(coalesce(nullif(it->>'qty', '')::int, 1), 30))
  from jsonb_array_elements(p_items) it
  join services s on s.id = it->>'id' and s.active and s.tenant_id = v_tenant;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Tanlangan xizmatlar topilmadi';
  end if;

  select jsonb_agg(jsonb_build_object('serviceId', service_id, 'price', price, 'qty', qty))
    into v_items
  from appointment_services where appointment_id = v_appt_id;

  return jsonb_build_object(
    'id', v_appt_id, 'queueNo', v_queue, 'date', v_date, 'time', v_time,
    'status', case when p_pay_now then 'TOLANDI' else 'TOLOV_KUTILMOQDA' end,
    'paymentMethod', case when p_pay_now then p_method end,
    'paidAt', case when p_pay_now then v_time end,
    'items', coalesce(v_items, '[]'::jsonb));
end $$;

create or replace function public.pay_visit(p_appt_id text, p_method text)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tenant text := auth_tenant_id();
  v_time text := to_char(now() at time zone 'Asia/Tashkent', 'HH24:MI');
  v_status text;
begin
  if v_role is null or v_role not in ('direktor', 'registratura', 'hisobchi') then
    raise exception 'To''lov qabul qilishga ruxsat yo''q';
  end if;
  if p_method is null then
    raise exception 'To''lov usuli ko''rsatilmagan';
  end if;
  select status into v_status from appointments
  where id = p_appt_id and tenant_id = v_tenant;
  if v_status is null then
    raise exception 'Qabul topilmadi';
  end if;
  if v_status <> 'TOLOV_KUTILMOQDA' then
    raise exception 'Bu qabul to''lov kutish holatida emas (%)', v_status;
  end if;
  update appointments
  set status = 'TOLANDI', payment_method = p_method, paid_at = v_time
  where id = p_appt_id and tenant_id = v_tenant;
  return jsonb_build_object('paidAt', v_time);
end $$;
