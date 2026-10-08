-- Granulyar RLS: rol-asosidagi ruxsatlar (TZ 1-bo'lim: rol — huquqlar to'plami)
-- + shifokor hisobini doctors yozuviga bog'lash (profiles.doctor_id)
--
-- Asosiy qoidalar DB darajasida:
--   * Shifokor faqat O'ZIga yozilgan va TO'LANGAN (status >= TOLANDI) qabullarni ko'radi
--   * Laborant qabullar/tashxis tarixini umuman ko'rmaydi — faqat tahlil buyurtmalari
--   * Yozish huquqlari: bemor/qabul — registratura; to'lov — registratura/hisobchi;
--     tahlil natijasi — laborant; ma'lumotnomalar (narxnoma, shifokorlar) — faqat direktor

-- ============ PROFIL -> SHIFOKOR BOG'LANISHI ============
alter table profiles add column if not exists doctor_id text references doctors(id);

-- Demo shifokor hisobi Dr. Aziza Karimova (d1) kabinetiga biriktiriladi
update profiles set doctor_id = 'd1'
where doctor_id is null
  and id in (select id from auth.users where email = 'shifokor@klinika.uz');

-- ============ YORDAMCHI FUNKSIYALAR ============
-- security definer — profiles'ning o'z RLS'idan mustaqil ishlaydi (rekursiya bo'lmaydi)
create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create or replace function public.auth_doctor_id() returns text
language sql stable security definer set search_path = public
as $$ select doctor_id from profiles where id = auth.uid() $$;

-- ============ ESKI UMUMIY POLICYLARNI OLIB TASHLASH ============
do $$
declare t text;
begin
  foreach t in array array['tenants','doctors','services','patients','appointments','lab_orders','employees']
  loop
    execute format('drop policy if exists "authenticated full access" on %I', t);
  end loop;
end $$;

-- ============ TENANTS / DOCTORS / SERVICES (ma'lumotnomalar) ============
-- Hamma xodim o'qiydi, faqat direktor o'zgartiradi
do $$
declare t text;
begin
  foreach t in array array['tenants','doctors','services']
  loop
    execute format('drop policy if exists "hamma o''qiydi" on %I', t);
    execute format('drop policy if exists "direktor boshqaradi" on %I', t);
    execute format('create policy "hamma o''qiydi" on %I for select to authenticated using (true)', t);
    execute format(
      'create policy "direktor boshqaradi" on %I for all to authenticated using (auth_role() = ''direktor'') with check (auth_role() = ''direktor'')', t);
  end loop;
end $$;

-- ============ PATIENTS ============
drop policy if exists "xodimlar o'qiydi" on patients;
create policy "xodimlar o'qiydi" on patients for select to authenticated
  using (auth_role() in ('direktor','registratura','shifokor','hisobchi','laborant'));

drop policy if exists "registratura yozadi" on patients;
create policy "registratura yozadi" on patients for insert to authenticated
  with check (auth_role() in ('direktor','registratura'));

drop policy if exists "registratura tahrirlaydi" on patients;
create policy "registratura tahrirlaydi" on patients for update to authenticated
  using (auth_role() in ('direktor','registratura'))
  with check (auth_role() in ('direktor','registratura'));

-- ============ APPOINTMENTS ============
-- Laborant qabullarni ko'rmaydi (tashxis tarixi yashirin — TZ 1-bo'lim)
drop policy if exists "boshqaruv o'qiydi" on appointments;
create policy "boshqaruv o'qiydi" on appointments for select to authenticated
  using (auth_role() in ('direktor','registratura','hisobchi'));

-- ASOSIY BIZNES-QOIDA endi DB darajasida (TZ 3-bo'lim):
-- shifokor faqat o'z qabullarini va faqat to'lovdan keyin ko'radi
drop policy if exists "shifokor o'z to'langanini o'qiydi" on appointments;
create policy "shifokor o'z to'langanini o'qiydi" on appointments for select to authenticated
  using (
    auth_role() = 'shifokor'
    and doctor_id = auth_doctor_id()
    and status in ('TOLANDI','NAVBATDA','QABULDA','YAKUNLANDI')
  );

drop policy if exists "registratura yaratadi" on appointments;
create policy "registratura yaratadi" on appointments for insert to authenticated
  with check (auth_role() in ('direktor','registratura'));

drop policy if exists "boshqaruv yangilaydi" on appointments;
create policy "boshqaruv yangilaydi" on appointments for update to authenticated
  using (auth_role() in ('direktor','registratura','hisobchi'))
  with check (auth_role() in ('direktor','registratura','hisobchi'));

drop policy if exists "shifokor o'zinikini yangilaydi" on appointments;
create policy "shifokor o'zinikini yangilaydi" on appointments for update to authenticated
  using (auth_role() = 'shifokor' and doctor_id = auth_doctor_id())
  with check (auth_role() = 'shifokor' and doctor_id = auth_doctor_id());

-- ============ LAB_ORDERS ============
drop policy if exists "lab o'qiydi" on lab_orders;
create policy "lab o'qiydi" on lab_orders for select to authenticated
  using (auth_role() in ('direktor','laborant','shifokor'));

drop policy if exists "shifokor yo'llaydi" on lab_orders;
create policy "shifokor yo'llaydi" on lab_orders for insert to authenticated
  with check (auth_role() in ('direktor','shifokor'));

drop policy if exists "laborant natija kiritadi" on lab_orders;
create policy "laborant natija kiritadi" on lab_orders for update to authenticated
  using (auth_role() in ('direktor','laborant'))
  with check (auth_role() in ('direktor','laborant'));

-- ============ DIREKTOR — to'liq huquq (delete ham) ============
do $$
declare t text;
begin
  foreach t in array array['patients','appointments','lab_orders']
  loop
    execute format('drop policy if exists "direktor to''liq" on %I', t);
    execute format(
      'create policy "direktor to''liq" on %I for all to authenticated using (auth_role() = ''direktor'') with check (auth_role() = ''direktor'')', t);
  end loop;
end $$;

-- ============ EMPLOYEES ============
drop policy if exists "boshqaruv o'qiydi" on employees;
create policy "boshqaruv o'qiydi" on employees for select to authenticated
  using (auth_role() in ('direktor','hisobchi'));

drop policy if exists "direktor boshqaradi" on employees;
create policy "direktor boshqaradi" on employees for all to authenticated
  using (auth_role() = 'direktor')
  with check (auth_role() = 'direktor');
