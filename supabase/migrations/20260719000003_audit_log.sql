-- Audit log (TZ 2.9): kim, qachon, nimani ko'rgani/o'zgartirgani.
-- O'zgarishlar (insert/update/delete) — DB triggerlari orqali AVTOMATIK,
-- frontend chetlab o'tilsa ham yoziladi. Ko'rish (view) — log_view() RPC orqali.
-- Jurnal o'zgarmas (immutable): hech kimda update/delete policy yo'q.

create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  tenant_id text not null default 't1',
  user_id uuid,
  user_name text,
  user_role text,
  action text not null check (action in ('view','insert','update','delete')),
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on audit_logs (tenant_id, created_at desc);
create index if not exists audit_logs_entity_idx on audit_logs (entity, entity_id);

alter table audit_logs enable row level security;
-- Faqat direktor o'qiydi; yozish faqat security definer funksiyalar orqali
drop policy if exists "direktor o'qiydi" on audit_logs;
create policy "direktor o'qiydi" on audit_logs for select to authenticated
  using (auth_role() = 'direktor');

-- ============ O'ZGARISHLAR TRIGGERI ============
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text;
  urole text;
begin
  select full_name, role into uname, urole from profiles where id = uid;
  insert into audit_logs (tenant_id, user_id, user_name, user_role, action, entity, entity_id, details)
  values (
    coalesce(
      case when tg_op = 'DELETE' then (to_jsonb(old) ->> 'tenant_id')
           else (to_jsonb(new) ->> 'tenant_id') end,
      't1'),
    uid, uname, urole,
    lower(tg_op),
    tg_table_name,
    case when tg_op = 'DELETE' then (to_jsonb(old) ->> 'id')
         else (to_jsonb(new) ->> 'id') end,
    case tg_op
      when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      when 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else jsonb_build_object('old', to_jsonb(old))
    end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['patients','appointments','lab_orders','services']
  loop
    execute format('drop trigger if exists audit_change on %I', t);
    execute format(
      'create trigger audit_change after insert or update or delete on %I
       for each row execute function audit_row_change()', t);
  end loop;
end $$;

-- ============ KO'RISHNI QAYD QILISH (RPC) ============
create or replace function public.log_view(p_entity text, p_entity_id text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text;
  urole text;
  tid text;
begin
  if uid is null then
    return; -- anonim ko'rishlar yozilmaydi (RLS baribir ma'lumot bermaydi)
  end if;
  select full_name, role, tenant_id into uname, urole, tid from profiles where id = uid;
  insert into audit_logs (tenant_id, user_id, user_name, user_role, action, entity, entity_id)
  values (coalesce(tid, 't1'), uid, uname, urole, 'view', p_entity, p_entity_id);
end $$;

grant execute on function public.log_view(text, text) to authenticated;
