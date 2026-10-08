-- Auth: profiles jadvali + RLS'ni qat'iylashtirish
-- Endi ma'lumotlarga faqat tizimga kirgan (authenticated) foydalanuvchilar kiradi.

-- ============ PROFILLAR ============
-- Har auth.users yozuviga bitta profil: rol + tenant bog'lanishi (TZ 1-bo'lim)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id text not null references tenants(id),
  full_name text not null,
  role text not null check (role in ('direktor','registratura','shifokor','hisobchi','laborant')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles
  for select to authenticated using (auth.uid() = id);

-- ============ RLS QAT'IYLASHTIRISH ============
-- Demo (anon) ruxsatlar olib tashlanadi — endi faqat authenticated.
-- Keyingi bosqich: rol/tenant asosidagi granulyar policylar (masalan,
-- laborant faqat lab_orders'ni ko'rishi) — auth.uid() -> profiles.role orqali.
do $$
declare t text;
begin
  foreach t in array array['tenants','doctors','services','patients','appointments','lab_orders','employees']
  loop
    execute format('drop policy if exists "demo full access" on %I', t);
    execute format('drop policy if exists "authenticated full access" on %I', t);
    execute format(
      'create policy "authenticated full access" on %I for all to authenticated using (true) with check (true)',
      t);
  end loop;
end $$;
