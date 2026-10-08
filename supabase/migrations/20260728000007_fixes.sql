-- Xodimlar fikri bo'yicha tuzatishlar:
-- 1) VAQT: server UTC yozayotgan edi (Toshkentdan 5 soat orqada) — endi Asia/Tashkent
-- 2) Nevrolog ko'rigi 80 000 narxnomaga
-- 3) To'lov vaqti ham serverda belgilanadi (pay_visit RPC)

-- ============ NEVROLOG KO'RIGI ============
insert into services (id, tenant_id, name, department, category, price, active) values
  ('v57','t1','Nevrolog ko''rigi','Ko''rik va konsultatsiya','Ko''rik va konsultatsiya',80000,true)
on conflict (id) do update set price = excluded.price, active = true;

-- ============ BEMOR ID — Toshkent yili ============
create or replace function public.next_patient_id() returns text
language sql volatile security definer set search_path = public
as $$
  select 'P-' || to_char(now() at time zone 'Asia/Tashkent', 'YYYY')
         || '-' || lpad(nextval('patient_id_seq')::text, 6, '0')
$$;

-- ============ CREATE_VISIT — Toshkent vaqti ============
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

-- ============ PAY_VISIT — to'lov vaqti serverda (Toshkent) ============
create or replace function public.pay_visit(p_appt_id text, p_method text)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_role text := auth_role();
  v_time text := to_char(now() at time zone 'Asia/Tashkent', 'HH24:MI');
  v_status text;
begin
  if v_role is null or v_role not in ('direktor', 'registratura', 'hisobchi') then
    raise exception 'To''lov qabul qilishga ruxsat yo''q';
  end if;
  if p_method is null then
    raise exception 'To''lov usuli ko''rsatilmagan';
  end if;

  select status into v_status from appointments where id = p_appt_id;
  if v_status is null then
    raise exception 'Qabul topilmadi';
  end if;
  if v_status <> 'TOLOV_KUTILMOQDA' then
    raise exception 'Bu qabul to''lov kutish holatida emas (%)', v_status;
  end if;

  update appointments
  set status = 'TOLANDI', payment_method = p_method, paid_at = v_time
  where id = p_appt_id;

  return jsonb_build_object('paidAt', v_time);
end $$;

revoke execute on function public.pay_visit(text, text) from public, anon;
grant execute on function public.pay_visit(text, text) to authenticated;

-- ============ LOG_VIEW vaqti ham Toshkent bo'yicha (created_at UTC qoladi,
-- ko'rsatishda frontend lokal formatlaydi — o'zgartirish shart emas) ============
