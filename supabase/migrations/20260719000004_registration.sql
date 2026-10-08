-- Registratsiya moduli: haqiqiy narxnoma (LOR CLINICS), ko'p xizmatli qabul,
-- kunlik navbat raqami.

-- ============ SERVICES: kategoriya va faollik ============
alter table services add column if not exists category text not null default '';
alter table services add column if not exists active boolean not null default true;

-- Eski namunaviy narxnoma o'chirilmaydi (tarixiy qabullar bog'langan), faqat faolsizlantiriladi
update services set active = false
where id in ('s1','s2','s3','s4','s5','s6','s7','s8','s9');

-- Haqiqiy narxnoma (LOR CLINICS pricelist, 2026-iyul)
insert into services (id, tenant_id, name, department, category, price, active) values
  -- Ko'rik va konsultatsiya
  ('v01','t1','LOR vrach ko''rigi','Ko''rik va konsultatsiya','Ko''rik va konsultatsiya',50000,true),
  ('v02','t1','LOR vrach qayta ko''rik','Ko''rik va konsultatsiya','Ko''rik va konsultatsiya',40000,true),
  ('v03','t1','Kardiolog ko''ruvi','Ko''rik va konsultatsiya','Ko''rik va konsultatsiya',50000,true),
  ('v04','t1','EKG','Ko''rik va konsultatsiya','Ko''rik va konsultatsiya',50000,true),
  -- Klinik tahlil
  ('v05','t1','Umumiy qon tahlili','Laboratoriya','Klinik tahlil',45000,true),
  ('v06','t1','Umumiy siydik tahlili','Laboratoriya','Klinik tahlil',30000,true),
  ('v07','t1','Qon guruhi va rezus-faktor','Laboratoriya','Klinik tahlil',40000,true),
  ('v08','t1','Dyuke bo''yicha qon ivish vaqti','Laboratoriya','Klinik tahlil',20000,true),
  -- Ekspress-test
  ('v09','t1','Gepatit B (ekspress)','Laboratoriya','Ekspress-test',30000,true),
  ('v10','t1','Gepatit C (ekspress)','Laboratoriya','Ekspress-test',30000,true),
  -- SPID-markaz
  ('v11','t1','RW (Vassarman reaksiyasi)','Laboratoriya','SPID-markaz',100000,true),
  ('v12','t1','OIV IFA usulida','Laboratoriya','SPID-markaz',100000,true),
  ('v13','t1','OIV IXLA usulida (ekspress)','Laboratoriya','SPID-markaz',150000,true),
  -- Koagulogramma
  ('v14','t1','PTI','Laboratoriya','Koagulogramma',35000,true),
  ('v15','t1','Fibrinogen','Laboratoriya','Koagulogramma',35000,true),
  ('v16','t1','AChTV/APPT','Laboratoriya','Koagulogramma',35000,true),
  ('v17','t1','MNO','Laboratoriya','Koagulogramma',30000,true),
  ('v18','t1','Protrombin vaqti','Laboratoriya','Koagulogramma',30000,true),
  -- Bioximik tahlil
  ('v19','t1','Glyukoza','Laboratoriya','Bioximik tahlil',30000,true),
  ('v20','t1','Umumiy oqsil','Laboratoriya','Bioximik tahlil',25000,true),
  ('v21','t1','Albumin','Laboratoriya','Bioximik tahlil',30000,true),
  ('v22','t1','Glyukozaga tolerantlik testi','Laboratoriya','Bioximik tahlil',25000,true),
  ('v23','t1','ALT','Laboratoriya','Bioximik tahlil',35000,true),
  ('v24','t1','ASAT','Laboratoriya','Bioximik tahlil',35000,true),
  ('v25','t1','Kreatinfosfokinaza','Laboratoriya','Bioximik tahlil',40000,true),
  ('v26','t1','Mochevina (siydikchil)','Laboratoriya','Bioximik tahlil',35000,true),
  ('v27','t1','Kreatinin','Laboratoriya','Bioximik tahlil',35000,true),
  ('v28','t1','Siydik kislotasi','Laboratoriya','Bioximik tahlil',35000,true),
  ('v29','t1','Alfa-amilaza (diastaza)','Laboratoriya','Bioximik tahlil',35000,true),
  ('v30','t1','Ishqoriy fosfataza','Laboratoriya','Bioximik tahlil',40000,true),
  ('v31','t1','Qoldiq azot','Laboratoriya','Bioximik tahlil',40000,true),
  ('v32','t1','Kislotali fosfataza','Laboratoriya','Bioximik tahlil',40000,true),
  ('v33','t1','Timol sinamasi','Laboratoriya','Bioximik tahlil',40000,true),
  ('v34','t1','LDG (laktatdegidrogenaza)','Laboratoriya','Bioximik tahlil',45000,true),
  ('v35','t1','GGT (gamma-glutamiltransferaza)','Laboratoriya','Bioximik tahlil',35000,true),
  ('v36','t1','Kreatinkinaza','Laboratoriya','Bioximik tahlil',40000,true),
  ('v37','t1','Prostatik fosfataza','Laboratoriya','Bioximik tahlil',45000,true),
  ('v38','t1','Umumiy bilirubin','Laboratoriya','Bioximik tahlil',30000,true),
  ('v39','t1','Bog''langan bilirubin','Laboratoriya','Bioximik tahlil',30000,true),
  ('v40','t1','Erkin bilirubin','Laboratoriya','Bioximik tahlil',30000,true),
  ('v41','t1','Glikirlangan gemoglobin (HbA1c)','Laboratoriya','Bioximik tahlil',65000,true),
  -- Revmoproba
  ('v42','t1','RF','Laboratoriya','Revmoproba',35000,true),
  ('v43','t1','CRP','Laboratoriya','Revmoproba',35000,true),
  ('v44','t1','ASLO','Laboratoriya','Revmoproba',35000,true),
  -- Muolajalar
  ('v45','t1','In''eksiya (m/o)','Muolajalar','Muolajalar',10000,true),
  ('v46','t1','In''eksiya (v/i)','Muolajalar','Muolajalar',15000,true),
  ('v47','t1','In''eksiya (sistema)','Muolajalar','Muolajalar',20000,true),
  ('v48','t1','Klizma','Muolajalar','Muolajalar',50000,true),
  ('v49','t1','Angiokard qo''yish','Muolajalar','Muolajalar',25000,true),
  -- LOR amaliyotlari
  ('v50','t1','Gaymor bo''shlig''i punksiyasi (bir tomonlama)','LOR amaliyotlari','LOR amaliyotlari',200000,true),
  ('v51','t1','Gaymor bo''shlig''i punksiyasi (ikki tomonlama)','LOR amaliyotlari','LOR amaliyotlari',300000,true),
  ('v52','t1','Paratonzillyar abssess ochish','LOR amaliyotlari','LOR amaliyotlari',200000,true),
  ('v53','t1','Burun suyagi repozitsiyasi','LOR amaliyotlari','LOR amaliyotlari',1000000,true),
  -- Statsionar
  ('v54','t1','Palata (bir kunlik)','Statsionar','Statsionar',150000,true),
  ('v55','t1','Lyuks palata (bir kunlik)','Statsionar','Statsionar',220000,true)
on conflict (id) do update
  set name = excluded.name,
      department = excluded.department,
      category = excluded.category,
      price = excluded.price,
      active = excluded.active;

-- LOR shifokori
insert into doctors (id, tenant_id, name, specialty, room) values
  ('d6','t1','Dr. Nodirbek Ahmedov','Otorinolaringolog (LOR)','102')
on conflict (id) do nothing;

-- ============ APPOINTMENTS: ko'p xizmat + navbat raqami ============
alter table appointments alter column service_id drop not null;
alter table appointments add column if not exists queue_no int;

-- Qabul tarkibi (har xizmat narx snapshoti bilan — narxnoma keyin o'zgarsa ham chek to'g'ri qoladi)
create table if not exists appointment_services (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id),
  appointment_id text not null references appointments(id) on delete cascade,
  service_id text not null references services(id),
  price bigint not null
);
create index if not exists appt_services_appt_idx on appointment_services (appointment_id);

alter table appointment_services enable row level security;
drop policy if exists "xodimlar o'qiydi" on appointment_services;
create policy "xodimlar o'qiydi" on appointment_services for select to authenticated
  using (auth_role() in ('direktor','registratura','hisobchi','shifokor'));
drop policy if exists "registratura yozadi" on appointment_services;
create policy "registratura yozadi" on appointment_services for insert to authenticated
  with check (auth_role() in ('direktor','registratura'));
drop policy if exists "direktor to'liq" on appointment_services;
create policy "direktor to'liq" on appointment_services for all to authenticated
  using (auth_role() = 'direktor') with check (auth_role() = 'direktor');

-- Audit trigger
drop trigger if exists audit_change on appointment_services;
create trigger audit_change after insert or update or delete on appointment_services
  for each row execute function audit_row_change();

-- Eski bir-xizmatli qabullarni yangi jadvalga ko'chirish
insert into appointment_services (tenant_id, appointment_id, service_id, price)
select a.tenant_id, a.id, a.service_id, s.price
from appointments a
join services s on s.id = a.service_id
where a.service_id is not null
  and not exists (select 1 from appointment_services x where x.appointment_id = a.id);

-- Bugungi qabullarga navbat raqami (vaqt tartibida)
with q as (
  select id, row_number() over (order by time) as rn
  from appointments where date = '2026-07-19'
)
update appointments a set queue_no = q.rn
from q where a.id = q.id and a.queue_no is null;
