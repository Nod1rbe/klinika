-- Himoya: direktor superadmin hisobini ko'rmaydi va unga tegolmaydi

drop policy if exists "direktor xodimlarni ko'radi" on profiles;
create policy "direktor xodimlarni ko'radi" on profiles for select to authenticated
  using (
    auth_role() = 'direktor'
    and tenant_id = auth_tenant_id()
    and role <> 'superadmin'
  );

create or replace function public.admin_reset_password(p_profile_id uuid, p_password text)
returns void
language plpgsql volatile security definer set search_path = public, auth, extensions
as $$
declare
  v_caller text := auth_role();
  v_tenant text := auth_tenant_id();
  v_target_tenant text;
  v_target_role text;
begin
  select tenant_id, role into v_target_tenant, v_target_role
  from profiles where id = p_profile_id;
  if v_target_tenant is null then
    raise exception 'Xodim topilmadi';
  end if;
  if v_target_role = 'superadmin' and v_caller <> 'superadmin' then
    raise exception 'Ruxsat yo''q';
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

create or replace function public.admin_set_disabled(p_profile_id uuid, p_disabled boolean)
returns void
language plpgsql volatile security definer set search_path = public, auth
as $$
declare
  v_caller text := auth_role();
  v_tenant text := auth_tenant_id();
  v_target_tenant text;
  v_target_role text;
begin
  select tenant_id, role into v_target_tenant, v_target_role
  from profiles where id = p_profile_id;
  if v_target_tenant is null then
    raise exception 'Xodim topilmadi';
  end if;
  if v_target_role = 'superadmin' and v_caller <> 'superadmin' then
    raise exception 'Ruxsat yo''q';
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
