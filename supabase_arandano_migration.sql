-- Migración Arándano: habilita almacenamiento independiente de balanza
-- Ejecutar una sola vez en Supabase > SQL Editor.

create table if not exists balanza_arandano_data (
  id int primary key default 1,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  updated_by text,
  constraint single_row_balanza_arandano check (id = 1)
);

insert into balanza_arandano_data (id, data)
values (1, '[]'::jsonb)
on conflict (id) do nothing;

alter table balanza_arandano_data enable row level security;

drop policy if exists "usuarios logueados leen balanza arandano" on balanza_arandano_data;
create policy "usuarios logueados leen balanza arandano"
on balanza_arandano_data for select
using (auth.role() = 'authenticated');

drop policy if exists "solo admin actualiza balanza arandano" on balanza_arandano_data;
create policy "solo admin actualiza balanza arandano"
on balanza_arandano_data for update
using (exists (
  select 1 from profiles
  where id = auth.uid() and role = 'admin'
));
