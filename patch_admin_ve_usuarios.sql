-- ============================================================
-- PARCHE: permite que el admin vea la lista completa de usuarios
-- (antes cada usuario solo podía ver su propio perfil).
--
-- Corre esto en: Supabase → SQL Editor → New query → Run
-- Es seguro correrlo aunque ya hayas corrido supabase_setup.sql antes.
-- ============================================================

drop policy if exists "admin ve todos los perfiles" on profiles;

create policy "admin ve todos los perfiles"
  on profiles for select
  using (exists (select 1 from profiles p2 where p2.id = auth.uid() and p2.role = 'admin'));
