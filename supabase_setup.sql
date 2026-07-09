-- ============================================================
-- Reporte Cosecha Palto 2026 — esquema de Supabase
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) Tabla de perfiles (guarda el rol de cada usuario: admin / viewer)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz default now()
);

-- Crea automáticamente un perfil "viewer" cada vez que se crea un usuario nuevo
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2) Tablas de datos compartidos (una sola fila cada una, el admin la reemplaza completa)
create table if not exists balanza_data (
  id int primary key default 1,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  updated_by text,
  constraint single_row check (id = 1)
);

create table if not exists hectareas_data (
  id int primary key default 1,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  updated_by text,
  constraint single_row check (id = 1)
);

insert into balanza_data (id, data) values (1, '[]'::jsonb) on conflict (id) do nothing;
insert into hectareas_data (id, data) values (1, '[]'::jsonb) on conflict (id) do nothing;

-- 3) Seguridad a nivel de fila (RLS)
alter table profiles enable row level security;
alter table balanza_data enable row level security;
alter table hectareas_data enable row level security;

-- Cualquier usuario logueado puede ver su propio perfil (para saber si es admin)
create policy "usuarios ven su propio perfil"
  on profiles for select
  using (auth.uid() = id);

-- Cualquier usuario logueado puede LEER los datos de cosecha
create policy "usuarios logueados leen balanza"
  on balanza_data for select
  using (auth.role() = 'authenticated');

create policy "usuarios logueados leen hectareas"
  on hectareas_data for select
  using (auth.role() = 'authenticated');

-- Solo los usuarios con role = 'admin' en su perfil pueden ACTUALIZAR los datos
create policy "solo admin actualiza balanza"
  on balanza_data for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "solo admin actualiza hectareas"
  on hectareas_data for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- DESPUÉS DE CORRER ESTE SCRIPT:
--
-- 1. Ve a Authentication → Providers → Email y APAGA "Confirm email"
--    (si no, los usuarios nuevos no podrán ingresar hasta confirmar un correo
--    que no existe, porque usamos direcciones falsas tipo usuario@agrokasa.com.pe).
--
-- 2. Crea el primer usuario (el admin) a mano en Authentication → Users → Add user:
--      Email:      jguevara@agrokasa.com.pe
--      Password:   jguevara28
--
-- 3. Vuélvelo admin corriendo (en SQL Editor):
--
--    update profiles set role = 'admin' where email = 'jguevara@agrokasa.com.pe';
--
-- 4. Ya con esto, jguevara puede entrar a la web (usuario: jguevara, contraseña:
--    jguevara28) y crear el resto de usuarios (ej. cvalverde) directo desde la
--    página "Usuarios" del panel — no hace falta volver a Supabase para eso.
-- ============================================================
