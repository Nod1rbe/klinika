-- KlinikaHMS — boshlang'ich sxema (Supabase / PostgreSQL)
-- TZ 4-5-bo'limlar: asosiy obyektlar + multi-tenant (har jadvalda tenant_id)
-- Supabase Dashboard > SQL Editor'da to'liq ishga tushiring.

-- ============ TENANT ============
create table if not exists tenants (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

-- ============ SHIFOKORLAR ============
create table if not exists doctors (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  name text not null,
  specialty text not null,
  room text not null default ''
);

-- ============ XIZMATLAR / NARXNOMA ============
create table if not exists services (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  name text not null,
  department text not null,
  price bigint not null check (price >= 0)
);

-- ============ BEMORLAR ============
-- id — ichki biznes ID (P-2026-000342 formatida), pasport/JSHSHIR — qidiruv maydonlari
create table if not exists patients (
  id text primary key,
  tenant_id text not null references tenants(id),
  full_name text not null,
  birth_date date not null,
  gender text not null check (gender in ('Erkak', 'Ayol')),
  phone text not null default '',
  address text not null default '',
  passport text,
  pinfl text,
  allergies text[] not null default '{}',
  chronic text[] not null default '{}',
  created_at date not null default current_date
);
create index if not exists patients_pinfl_idx on patients (pinfl);
create index if not exists patients_phone_idx on patients (phone);
create index if not exists patients_tenant_idx on patients (tenant_id);

-- ============ QABULLAR ============
-- TZ 3-bo'lim: holat zanjiri. Shifokor faqat TOLANDI+ holatdagilarni ko'radi.
create table if not exists appointments (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  patient_id text not null references patients(id),
  doctor_id text not null references doctors(id),
  service_id text not null references services(id),
  date date not null,
  time text not null,
  status text not null default 'ROYXATDA' check (status in
    ('ROYXATDA','TOLOV_KUTILMOQDA','TOLANDI','NAVBATDA','QABULDA','YAKUNLANDI','BEKOR')),
  payment_method text check (payment_method in ('Naqd','Click','Payme','Uzum','Karta (POS)')),
  paid_at text,
  complaint text,
  diagnosis text,
  recommendation text,
  created_at timestamptz not null default now()
);
create index if not exists appointments_date_idx on appointments (tenant_id, date);
create index if not exists appointments_patient_idx on appointments (patient_id);

-- ============ LABORATORIYA ============
create table if not exists lab_orders (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  patient_id text not null references patients(id),
  doctor_id text not null references doctors(id),
  test text not null,
  unit text not null,
  norm_min numeric not null,
  norm_max numeric not null,
  result numeric,
  status text not null default 'KUTILMOQDA' check (status in ('KUTILMOQDA','TAYYOR')),
  ordered_at date not null default current_date
);

-- ============ XODIMLAR (HR) ============
create table if not exists employees (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  name text not null,
  position text not null,
  branch text not null default '',
  salary_base bigint not null default 0,
  kpi_percent int not null default 0,
  license_until date,
  today_in text,
  today_out text
);

-- ============ RLS ============
-- DEMO REJIM: anon kalitga to'liq ruxsat. Auth qo'shilganda bu policylar
-- auth.jwt() ichidagi tenant_id bo'yicha qat'iy policylarga almashtiriladi (TZ 5-bo'lim).
do $$
declare t text;
begin
  foreach t in array array['tenants','doctors','services','patients','appointments','lab_orders','employees']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "demo full access" on %I', t);
    execute format('create policy "demo full access" on %I for all using (true) with check (true)', t);
  end loop;
end $$;

-- ============ SEED — pilot klinika ma'lumotlari ============
insert into tenants (id, name) values ('t1', 'Pilot klinika (Markaziy filial)')
on conflict (id) do nothing;

insert into doctors (id, tenant_id, name, specialty, room) values
  ('d1','t1','Dr. Aziza Karimova','Kardiolog','101'),
  ('d2','t1','Dr. Jasur Toshpo''latov','Nevrolog','104'),
  ('d3','t1','Dr. Nilufar Rahimova','Endokrinolog','203'),
  ('d4','t1','Dr. Sardor Yusupov','Terapevt','105'),
  ('d5','t1','Dr. Malika Abdullayeva','Ginekolog','207')
on conflict (id) do nothing;

insert into services (id, tenant_id, name, department, price) values
  ('s1','t1','Kardiolog konsultatsiyasi','Kardiologiya',150000),
  ('s2','t1','EKG','Kardiologiya',80000),
  ('s3','t1','Nevrolog konsultatsiyasi','Nevrologiya',140000),
  ('s4','t1','Endokrinolog konsultatsiyasi','Endokrinologiya',150000),
  ('s5','t1','Terapevt qabuli','Terapiya',100000),
  ('s6','t1','Ginekolog konsultatsiyasi','Ginekologiya',160000),
  ('s7','t1','UZI (qorin bo''shlig''i)','Diagnostika',120000),
  ('s8','t1','Umumiy qon tahlili','Laboratoriya',60000),
  ('s9','t1','Qonda qand miqdori','Laboratoriya',45000)
on conflict (id) do nothing;

insert into patients (id, tenant_id, full_name, birth_date, gender, phone, address, passport, pinfl, allergies, chronic, created_at) values
  ('P-2026-000341','t1','Karimov Bekzod Anvarovich','1985-03-12','Erkak','+998 90 123 45 67','Toshkent sh., Chilonzor tumani, 12-kvartal','AB 1234567','31203851234567','{Penitsillin}','{Gipertoniya}','2026-02-14'),
  ('P-2026-000342','t1','Salimova Dilnoza Rustamovna','1992-07-25','Ayol','+998 93 555 12 34','Toshkent sh., Yunusobod tumani, 19-kvartal','AC 7654321','42507921234567','{}','{"Qandli diabet 2-tur"}','2026-03-02'),
  ('P-2026-000343','t1','Tursunov Otabek Sherzodovich','1978-11-04','Erkak','+998 97 200 88 11','Toshkent vil., Zangiota tumani','AA 9988776','30411781234567','{}','{}','2026-04-18'),
  ('P-2026-000344','t1','Yo''ldosheva Madina Ilhomovna','2001-01-30','Ayol','+998 88 411 22 33','Toshkent sh., Mirzo Ulug''bek tumani','AD 4455667','43001011234567','{Aspirin,"Yong''oq"}','{}','2026-05-09'),
  ('P-2026-000345','t1','Rahmatullayev Shohruh Baxtiyorovich','1965-09-17','Erkak','+998 91 777 66 55','Toshkent sh., Sergeli tumani','AB 3322110','31709651234567','{}','{"Yurak ishemik kasalligi",Gipertoniya}','2026-06-21'),
  ('P-2026-000346','t1','Nazarova Gulbahor Akmalovna','1988-12-08','Ayol','+998 95 303 40 50','Toshkent sh., Olmazor tumani','AC 1112223','40812881234567','{}','{}','2026-07-19')
on conflict (id) do nothing;

insert into appointments (id, tenant_id, patient_id, doctor_id, service_id, date, time, status, payment_method, paid_at, complaint, diagnosis, recommendation) values
  ('a1','t1','P-2026-000341','d1','s1','2026-07-19','09:00','YAKUNLANDI','Naqd','08:52','Ko''krak qafasida og''riq, hansirash','I20.9 — Stenokardiya, aniqlanmagan','EKG nazorati, 2 haftadan so''ng qayta ko''rik'),
  ('a2','t1','P-2026-000342','d3','s4','2026-07-19','09:30','QABULDA','Payme','09:12','Holsizlik, chanqash',null,null),
  ('a3','t1','P-2026-000345','d1','s2','2026-07-19','10:00','NAVBATDA','Click','09:41',null,null,null),
  ('a4','t1','P-2026-000344','d5','s6','2026-07-19','10:30','TOLOV_KUTILMOQDA',null,null,null,null,null),
  ('a5','t1','P-2026-000343','d2','s3','2026-07-19','11:00','TOLOV_KUTILMOQDA',null,null,null,null,null),
  ('a6','t1','P-2026-000346','d4','s5','2026-07-19','11:30','ROYXATDA',null,null,null,null,null),
  ('a7','t1','P-2026-000342','d3','s9','2026-07-15','10:00','YAKUNLANDI','Naqd','09:50','Rejali tekshiruv','E11.9 — Qandli diabet 2-tur, asoratsiz','Parhez, metformin davomi, qand nazorati'),
  ('a8','t1','P-2026-000341','d4','s5','2026-07-10','14:00','YAKUNLANDI','Karta (POS)','13:45','Bosh og''rig''i, bosim ko''tarilishi','I10 — Essensial gipertoniya','Amlodipin 5mg, bosim kundaligi')
on conflict (id) do nothing;

insert into lab_orders (id, tenant_id, patient_id, doctor_id, test, unit, norm_min, norm_max, result, status, ordered_at) values
  ('l1','t1','P-2026-000342','d3','Qonda qand miqdori (och qoringa)','mmol/L',3.9,5.5,7.8,'TAYYOR','2026-07-15'),
  ('l2','t1','P-2026-000341','d1','Umumiy xolesterin','mmol/L',3.0,5.2,6.1,'TAYYOR','2026-07-10'),
  ('l3','t1','P-2026-000345','d1','Gemoglobin','g/L',130,160,null,'KUTILMOQDA','2026-07-19'),
  ('l4','t1','P-2026-000342','d3','HbA1c (glikirlangan gemoglobin)','%',4.0,6.0,null,'KUTILMOQDA','2026-07-19')
on conflict (id) do nothing;

insert into employees (id, tenant_id, name, position, branch, salary_base, kpi_percent, license_until, today_in) values
  ('e1','t1','Dr. Aziza Karimova','Kardiolog','Markaziy filial',8000000,30,'2026-09-15','08:45'),
  ('e2','t1','Dr. Jasur Toshpo''latov','Nevrolog','Markaziy filial',7500000,30,'2027-03-20','08:58'),
  ('e3','t1','Dr. Nilufar Rahimova','Endokrinolog','Markaziy filial',7800000,30,'2026-08-02','09:05'),
  ('e4','t1','Zulfiya Ergasheva','Registratura xodimi','Markaziy filial',4000000,0,null,'08:30'),
  ('e5','t1','Bobur Nazarov','Laborant','Markaziy filial',4500000,0,null,'08:40'),
  ('e6','t1','Kamola Yusupova','Hisobchi','Markaziy filial',6000000,0,null,'09:00')
on conflict (id) do nothing;
