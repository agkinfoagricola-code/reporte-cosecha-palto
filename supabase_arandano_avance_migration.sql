-- Migración Arándano — Avance de Campo (Kg Real vs Ppto x Ha): agrega las dos tablas que
-- necesita esta vista, independientes de las de Palto.
-- Ejecutar una sola vez en Supabase > SQL Editor.

-- 1) Avance de campo (Lote-Red-Sector): mismo formato que hectareas_data, pero solo Arándano.
create table if not exists hectareas_arandano_data (
  id int primary key default 1,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  updated_by text,
  constraint single_row_hectareas_arandano check (id = 1)
);

insert into hectareas_arandano_data (id, data)
values (1, '[]'::jsonb)
on conflict (id) do nothing;

alter table hectareas_arandano_data enable row level security;

drop policy if exists "usuarios logueados leen hectareas arandano" on hectareas_arandano_data;
create policy "usuarios logueados leen hectareas arandano"
on hectareas_arandano_data for select
using (auth.role() = 'authenticated');

drop policy if exists "solo admin actualiza hectareas arandano" on hectareas_arandano_data;
create policy "solo admin actualiza hectareas arandano"
on hectareas_arandano_data for update
using (exists (
  select 1 from profiles
  where id = auth.uid() and role = 'admin'
));

-- 2) Presupuesto de Has/Kg por Lote-Red-Variedad (no existe data base fija como ESTIMACION
--    de Palto, así que se carga por Excel y vive en su propia tabla).
create table if not exists estimacion_arandano_lotered_data (
  id int primary key default 1,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  updated_by text,
  constraint single_row_estimacion_arandano_lotered check (id = 1)
);

insert into estimacion_arandano_lotered_data (id, data)
values (1, '[]'::jsonb)
on conflict (id) do nothing;

alter table estimacion_arandano_lotered_data enable row level security;

drop policy if exists "usuarios logueados leen estimacion arandano lotered" on estimacion_arandano_lotered_data;
create policy "usuarios logueados leen estimacion arandano lotered"
on estimacion_arandano_lotered_data for select
using (auth.role() = 'authenticated');

drop policy if exists "solo admin actualiza estimacion arandano lotered" on estimacion_arandano_lotered_data;
create policy "solo admin actualiza estimacion arandano lotered"
on estimacion_arandano_lotered_data for update
using (exists (
  select 1 from profiles
  where id = auth.uid() and role = 'admin'
));
