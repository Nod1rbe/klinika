-- Smena ochilmagan bo'lsa naqd to'lov qabul qilinmaydi.
-- Trigger darajasida: naqd to'lov qaysi yo'l bilan yozilmasin (qabulda darhol
-- to'lash, kassada to'lash, POS sotuv) — tekshiruv bitta joyda. Xato butun
-- tranzaksiyani bekor qiladi, ya'ni yarim yozilgan sotuv qolmaydi.
-- Karta/onlayn to'lovlar smenasiz ham qabul qilinadi.

create or replace function public._require_cash_shift(p_tenant text) returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from cash_sessions where tenant_id = p_tenant and status = 'OCHIQ'
  ) then
    raise exception 'Kassa smenasi ochilmagan — naqd to''lov qabul qilish uchun avval smenani oching';
  end if;
end $$;

-- Qabul (xizmat) to'lovlari: naqd to'lov yangi qayd etilayotgandagina tekshiriladi.
-- Allaqachon to'langan qabulni bekor qilish yoki tashxis yozish bunga tushmaydi.
create or replace function public._guard_cash_appointment() returns trigger
language plpgsql as $$
begin
  if new.payment_method = 'Naqd' and new.paid_at is not null
     and (tg_op = 'INSERT' or old.paid_at is null
          or old.payment_method is distinct from 'Naqd') then
    perform _require_cash_shift(new.tenant_id);
  end if;
  return new;
end $$;

drop trigger if exists guard_cash on appointments;
create trigger guard_cash before insert or update on appointments
  for each row execute function _guard_cash_appointment();

-- POS sotuv to'lovlari
create or replace function public._guard_cash_sale_payment() returns trigger
language plpgsql as $$
begin
  if new.method = 'Naqd' then
    perform _require_cash_shift(new.tenant_id);
  end if;
  return new;
end $$;

drop trigger if exists guard_cash on sale_payments;
create trigger guard_cash before insert on sale_payments
  for each row execute function _guard_cash_sale_payment();
