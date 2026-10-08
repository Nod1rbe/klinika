-- Haqiqiy shtat: LOR CLINICS shifokorlari, EEG xizmati,
-- statsionar kunlar (qty), demo ma'lumotlarni tozalash.

-- ============ SHIFOKORLAR ============
alter table doctors add column if not exists active boolean not null default true;

insert into doctors (id, tenant_id, name, specialty, room, active) values
  ('dr01','t1','Ergashev Shodiyorbek','Otorinolaringolog (LOR)','',true),
  ('dr02','t1','Mirabdullaev Islombek','Otorinolaringolog (LOR)','',true),
  ('dr03','t1','Qirg''izov Muhammadjon','Otorinolaringolog (LOR)','',true),
  ('dr04','t1','Oxunov Odilbek','Otorinolaringolog (LOR)','',true),
  ('dr05','t1','Qambarov Islomjon','Otorinolaringolog (LOR)','',true),
  ('dr06','t1','G''affarov Ulug''bek','Nevrolog','',true)
on conflict (id) do update
  set name = excluded.name, specialty = excluded.specialty, active = true;

-- Demo shifokor hisobini birinchi haqiqiy shifokorga bog'laymiz
update profiles set doctor_id = 'dr01', full_name = 'Ergashev Shodiyorbek'
where id in (select id from auth.users where email = 'shifokor@klinika.uz');

-- ============ XIZMATLAR ============
-- EEG — EKG tagida (Ko'rik va konsultatsiya kategoriyasida id tartibi bo'yicha)
insert into services (id, tenant_id, name, department, category, price, active) values
  ('v56','t1','EEG','Ko''rik va konsultatsiya','Ko''rik va konsultatsiya',200000,true)
on conflict (id) do update set price = excluded.price, active = true;

-- Statsionar: nom "kunlik" — kun soni endi alohida tanlanadi
update services set name = 'Palata (kunlik)' where id = 'v54';
update services set name = 'Lyuks palata (kunlik)' where id = 'v55';

-- ============ MIQDOR (kun soni) ============
alter table appointment_services add column if not exists qty int not null default 1
  check (qty >= 1 and qty <= 30);

-- create_visit yangi imzo: xizmatlar miqdor bilan jsonb ko'rinishida
drop function if exists public.create_visit(text, text, text[], boolean, text);

create or replace function public.create_visit(
  p_patient_id text,
  p_doctor_id text,
  p_items jsonb, -- [{"id":"v01","qty":1}, {"id":"v54","qty":5}, ...]
  p_pay_now boolean,
  p_method text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_date date := current_date;
  v_time text := to_char(now(), 'HH24:MI');
  v_queue int;
  v_appt_id text := gen_random_uuid()::text;
  v_items jsonb;
  v_count int;
begin
  if v_role is null or v_role not in ('direktor', 'registratura') then
    raise exception 'Qabul yaratishga ruxsat yo''q';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Kamida bitta xizmat tanlanishi kerak';
  end if;
  if p_pay_now and p_method is null then
    raise exception 'To''lov usuli ko''rsatilmagan';
  end if;

  perform pg_advisory_xact_lock(hashtext('klinika_queue_' || v_date::text));
  select coalesce(max(queue_no), 0) + 1 into v_queue
  from appointments where date = v_date;

  insert into appointments
    (id, tenant_id, patient_id, doctor_id, date, time, status, payment_method, paid_at, queue_no)
  values
    (v_appt_id, 't1', p_patient_id, p_doctor_id, v_date, v_time,
     case when p_pay_now then 'TOLANDI' else 'TOLOV_KUTILMOQDA' end,
     case when p_pay_now then p_method end,
     case when p_pay_now then v_time end,
     v_queue);

  insert into appointment_services (tenant_id, appointment_id, service_id, price, qty)
  select 't1', v_appt_id, s.id, s.price,
         greatest(1, least(coalesce(nullif(it->>'qty', '')::int, 1), 30))
  from jsonb_array_elements(p_items) it
  join services s on s.id = it->>'id' and s.active;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Tanlangan xizmatlar topilmadi';
  end if;

  select jsonb_agg(jsonb_build_object('serviceId', service_id, 'price', price, 'qty', qty))
    into v_items
  from appointment_services where appointment_id = v_appt_id;

  return jsonb_build_object(
    'id', v_appt_id,
    'queueNo', v_queue,
    'date', v_date,
    'time', v_time,
    'status', case when p_pay_now then 'TOLANDI' else 'TOLOV_KUTILMOQDA' end,
    'paymentMethod', case when p_pay_now then p_method end,
    'paidAt', case when p_pay_now then v_time end,
    'items', coalesce(v_items, '[]'::jsonb));
end $$;

revoke execute on function public.create_visit(text, text, jsonb, boolean, text) from public, anon;
grant execute on function public.create_visit(text, text, jsonb, boolean, text) to authenticated;

-- ============ DEMO MA'LUMOTLARNI TOZALASH ============
-- Namunaviy bemorlar/qabullar/tahlillar production bazasidan olib tashlanadi.
-- Haqiqiy yozuvlar (masalan P-2026-000347) tegilmaydi.
delete from lab_orders where id in ('l1','l2','l3','l4');
delete from appointments where patient_id in
  ('P-2026-000341','P-2026-000342','P-2026-000343',
   'P-2026-000344','P-2026-000345','P-2026-000346');
delete from patients where id in
  ('P-2026-000341','P-2026-000342','P-2026-000343',
   'P-2026-000344','P-2026-000345','P-2026-000346');
delete from employees where id in ('e1','e2','e3','e4','e5','e6');

-- Haqiqiy shifokorlar HR ro'yxatiga (oklad/KPI keyin kiritiladi)
insert into employees (id, tenant_id, name, position, branch, salary_base, kpi_percent) values
  ('emp01','t1','Ergashev Shodiyorbek','LOR shifokori','LOR CLINICS',0,0),
  ('emp02','t1','Mirabdullaev Islombek','LOR shifokori','LOR CLINICS',0,0),
  ('emp03','t1','Qirg''izov Muhammadjon','LOR shifokori','LOR CLINICS',0,0),
  ('emp04','t1','Oxunov Odilbek','LOR shifokori','LOR CLINICS',0,0),
  ('emp05','t1','Qambarov Islomjon','LOR shifokori','LOR CLINICS',0,0),
  ('emp06','t1','G''affarov Ulug''bek','Nevrolog','LOR CLINICS',0,0)
on conflict (id) do nothing;

-- Demo shifokorlar: bog'liq yozuvi qolmaganlari o'chiriladi, qolganlari faolsizlantiriladi
update doctors set active = false
where id in ('d1','d2','d3','d4','d5','d6');

delete from doctors d
where d.id in ('d1','d2','d3','d4','d5','d6')
  and not exists (select 1 from appointments a where a.doctor_id = d.id)
  and not exists (select 1 from lab_orders l where l.doctor_id = d.id)
  and not exists (select 1 from profiles p where p.doctor_id = d.id);
