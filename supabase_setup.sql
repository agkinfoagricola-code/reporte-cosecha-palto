-- ============================================================
-- Reporte Cosecha Palto 2026 — esquema de Supabase
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) Tabla de perfiles (guarda el rol de cada usuario: admin / viewer)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nombres text,
  apellidos text,
  role text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz default now()
);

-- Crea automáticamente un perfil "viewer" cada vez que se crea un usuario nuevo.
-- Si el usuario se creó pasando user_metadata: {nombres, apellidos} (ver api/PENDIENTE.md),
-- los toma de ahí; si no vienen, quedan en NULL y se pueden completar después a mano.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, nombres, apellidos)
  values (
    new.id, new.email, 'viewer',
    new.raw_user_meta_data ->> 'nombres',
    new.raw_user_meta_data ->> 'apellidos'
  );
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

-- Un admin puede ver TODOS los perfiles (para la página "Usuarios" del panel)
create policy "admin ve todos los perfiles"
on profiles for select
using (exists (select 1 from profiles p2 where p2.id = auth.uid() and p2.role = 'admin'));

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
-- NOTA: tu proyecto real ya tiene además las tablas tareo_data y calibres_data
-- (usadas por js/data-store.js y js/carga-datos.js) — replica el mismo patrón de
-- balanza_data/hectareas_data de arriba para esas dos si tu supabase_setup.sql
-- original no está exactamente igual a este. Este archivo es una referencia
-- reconstruida del README del repo, no una copia extraída de tu proyecto real.
-- ============================================================

-- 4) NUEVA: comparativo de bines Lote-Red-Sector (módulo de prorrateo por bines)create table if not exists bines_data (
  id int primary key default 1,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  updated_by text,
  constraint single_row_bines check (id = 1)
);
insert into bines_data (id, data) values (1, '[]'::jsonb) on conflict (id) do nothing;

alter table bines_data enable row level security;

create policy "usuarios logueados leen bines"
on bines_data for select
using (auth.role() = 'authenticated');

create policy "solo admin actualiza bines"
on bines_data for update
using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
-- ============================================================

-- 5) NUEVO: nombre completo en profiles (Nombres / Apellidos), para mostrar
-- "Hola, Javier Guevara" en vez de "Hola, jguevara". Como tu tabla `profiles` YA
-- EXISTE en producción, corre esto (no el create table de la sección 1, que no
-- hace nada si la tabla ya existe):
alter table profiles add column if not exists nombres text;
alter table profiles add column if not exists apellidos text;

-- Pon el nombre de los usuarios que ya existen (edita el email y el nombre real de cada uno):
update profiles set nombres = 'Javier', apellidos = 'Guevara' where email = 'jguevara@agrokasa.com.pe';
-- update profiles set nombres = 'Carla', apellidos = 'Valverde' where email = 'cvalverde@agrokasa.com.pe';


-- 6) Balanza de Arándano (dataset independiente de Palto)
create table if not exists balanza_arandano_data (
  id int primary key default 1,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  updated_by text,
  constraint single_row_balanza_arandano check (id = 1)
);
insert into balanza_arandano_data (id, data) values (1, '[]'::jsonb) on conflict (id) do nothing;

alter table balanza_arandano_data enable row level security;

drop policy if exists "usuarios logueados leen balanza arandano" on balanza_arandano_data;
create policy "usuarios logueados leen balanza arandano"
on balanza_arandano_data for select
using (auth.role() = 'authenticated');

drop policy if exists "solo admin actualiza balanza arandano" on balanza_arandano_data;
create policy "solo admin actualiza balanza arandano"
on balanza_arandano_data for update
using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
