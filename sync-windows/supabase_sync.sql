-- Ejecutar UNA VEZ en el SQL Editor del mismo proyecto Supabase que usa la web.
-- Requiere las tablas existentes de balanza, hectáreas y tareo de Arándano.
begin;
create table if not exists public.lecturaind_arandano_data (
 id integer primary key default 1 check (id=1),
 data jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now(),
 updated_by text
);
insert into public.lecturaind_arandano_data(id) values(1) on conflict do nothing;
alter table public.lecturaind_arandano_data enable row level security;
drop policy if exists "lecturaind lectura autenticada" on public.lecturaind_arandano_data;
create policy "lecturaind lectura autenticada" on public.lecturaind_arandano_data
 for select to authenticated using (true);
drop policy if exists "lecturaind escritura admin" on public.lecturaind_arandano_data;
create policy "lecturaind escritura admin" on public.lecturaind_arandano_data
 for update to authenticated
 using (exists(select 1 from public.profiles where id=auth.uid() and role='admin'))
 with check (exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
grant select, update on public.lecturaind_arandano_data to authenticated;

-- Un lote de cambios se guarda por completo o no se guarda nada.
-- Comparar también data protege frente a cargas manuales que no actualizan updated_at.
create or replace function public.sync_produccion_snapshot()
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare t text; r jsonb; result jsonb := '{}'::jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
  raise exception 'Solo administradores' using errcode='42501';
 end if;
 foreach t in array array['balanza_arandano_data','hectareas_arandano_data','tareo_arandano_data','lecturaind_arandano_data'] loop
  execute format('select jsonb_build_object(''data'',data,''version'',md5(data::text),''updated_at'',updated_at) from public.%I where id=1',t) into r;
  if r is null then raise exception 'Falta fila id=1 en %',t; end if;
  result := result || jsonb_build_object(t,r);
 end loop;
 return result;
end $$;

create or replace function public.sync_produccion_apply(changes jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare t text; item jsonb; old_hash text; new_hash text; result jsonb := '{}'::jsonb; n integer;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
  raise exception 'Solo administradores' using errcode='42501';
 end if;
 if jsonb_typeof(changes) <> 'object' or changes = '{}'::jsonb then raise exception 'Cambios inválidos'; end if;
 for t in select jsonb_object_keys(changes) order by 1 loop
  if t not in ('balanza_arandano_data','hectareas_arandano_data','tareo_arandano_data','lecturaind_arandano_data') then
   raise exception 'Tabla no permitida';
  end if;
  item := changes->t;
  if jsonb_typeof(item->'data') is distinct from 'array' or jsonb_array_length(item->'data')=0 or item->>'version' is null then
   raise exception 'Datos vacíos o inválidos';
  end if;
  execute format('select md5(data::text) from public.%I where id=1 for update',t) into old_hash;
  if old_hash is distinct from item->>'version' then
   raise exception 'CONFLICTO: datos cambiaron en %; vuelva a revisar',t using errcode='40001';
  end if;
  execute format('update public.%I set data=$1,updated_at=now(),updated_by=$2 where id=1 returning md5(data::text)',t)
   into new_hash using item->'data',auth.jwt()->>'email';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se actualizó %',t; end if;
  result := result || jsonb_build_object(t,new_hash);
 end loop;
 return result;
end $$;
revoke all on function public.sync_produccion_snapshot() from public,anon;
revoke all on function public.sync_produccion_apply(jsonb) from public,anon;
grant execute on function public.sync_produccion_snapshot() to authenticated;
grant execute on function public.sync_produccion_apply(jsonb) to authenticated;
commit;
