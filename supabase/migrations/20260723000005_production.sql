-- Production tayyorgarligi:
-- 1) Bemor ID endi DB'da atomar beriladi (ikki registrator to'qnashmaydi)
-- 2) create_visit RPC — qabul + xizmatlar + navbat raqami bitta tranzaksiyada

-- ============ BEMOR ID (P-<yil>-000001) ============
create sequence if not exists patient_id_seq;
select setval(
  'patient_id_seq',
  greatest(
    coalesce((select max((regexp_match(id, '^P-\d{4}-(\d+)$'))[1]::bigint) from patients), 0) + 1,
    1),
  false);

create or replace function public.next_patient_id() returns text
language sql volatile security definer set search_path = public
as $$
  select 'P-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('patient_id_seq')::text, 6, '0')
$$;

alter table patients alter column id set default next_patient_id();

-- ============ QABUL YARATISH RPC ============
-- Navbat raqami advisory lock ostida — parallel so'rovlarda ham takrorlanmaydi.
-- Chek faqat shu funksiya muvaffaqiyatli qaytgandan keyin chiqariladi.
create or replace function public.create_visit(
  p_patient_id text,
  p_doctor_id text,
  p_service_ids text[],
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
begin
  if v_role is null or v_role not in ('direktor', 'registratura') then
    raise exception 'Qabul yaratishga ruxsat yo''q';
  end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
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

  insert into appointment_services (tenant_id, appointment_id, service_id, price)
  select 't1', v_appt_id, s.id, s.price
  from services s where s.id = any(p_service_ids);

  select jsonb_agg(jsonb_build_object('serviceId', service_id, 'price', price))
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

revoke execute on function public.create_visit(text, text, text[], boolean, text) from public, anon;
grant execute on function public.create_visit(text, text, text[], boolean, text) to authenticated;

create index if not exists appointments_queue_idx on appointments (date, queue_no);
