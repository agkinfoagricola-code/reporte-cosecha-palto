-- Migración Arándano: almacenamiento del Mercado Nacional (fruta retirada en campo,
-- fuera de la balanza de exportación). Ejecutar una sola vez en Supabase > SQL Editor.

create table if not exists nacional_arandano_data (
  id int primary key default 1,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  updated_by text,
  constraint single_row_nacional_arandano check (id = 1)
);

insert into nacional_arandano_data (id, data)
values (1, '[]'::jsonb)
on conflict (id) do nothing;

alter table nacional_arandano_data enable row level security;

drop policy if exists "usuarios logueados leen nacional arandano" on nacional_arandano_data;
create policy "usuarios logueados leen nacional arandano"
on nacional_arandano_data for select
using (auth.role() = 'authenticated');

drop policy if exists "solo admin actualiza nacional arandano" on nacional_arandano_data;
create policy "solo admin actualiza nacional arandano"
on nacional_arandano_data for update
using (exists (
  select 1 from profiles
  where id = auth.uid() and role = 'admin'
));
