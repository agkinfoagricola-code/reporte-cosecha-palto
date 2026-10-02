-- Corrección del transporte: envíos pequeños, confirmación única y reintentos idempotentes.
-- Ejecutar una vez DESPUÉS de supabase_sync.sql. No modifica los datos de producción.
begin;
create table if not exists public.produccion_sync_uploads (
 request_id uuid primary key,
 owner_id uuid not null default auth.uid(),
 total_parts integer not null check(total_parts between 1 and 2000),
 payload_hash text not null check(payload_hash ~ '^[0-9a-f]{32}$'),
 result jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.produccion_sync_parts (
 request_id uuid not null references public.produccion_sync_uploads(request_id) on delete cascade,
 part_index integer not null check(part_index>=0),
 part_text text not null check(length(part_text)<=128000),
 primary key(request_id,part_index)
);
alter table public.produccion_sync_uploads enable row level security;
alter table public.produccion_sync_parts enable row level security;
drop policy if exists "sync uploads owner" on public.produccion_sync_uploads;
create policy "sync uploads owner" on public.produccion_sync_uploads to authenticated
 using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists "sync parts owner" on public.produccion_sync_parts;
create policy "sync parts owner" on public.produccion_sync_parts to authenticated
 using(exists(select 1 from public.produccion_sync_uploads u where u.request_id=produccion_sync_parts.request_id and u.owner_id=auth.uid()))
 with check(exists(select 1 from public.produccion_sync_uploads u where u.request_id=produccion_sync_parts.request_id and u.owner_id=auth.uid()));
grant select,insert,update,delete on public.produccion_sync_uploads,public.produccion_sync_parts to authenticated;

create or replace function public.sync_produccion_stage(p_id uuid,p_index integer,p_count integer,p_hash text,p_text text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare u public.produccion_sync_uploads; old_text text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
  raise exception 'Solo administradores' using errcode='42501';
 end if;
 if p_index is null or p_count is null or p_index<0 or p_index>=p_count or p_text is null then
  raise exception 'Bloque inválido';
 end if;
 -- Retención limitada de lotes de este usuario; no toca los datos de producción.
 delete from public.produccion_sync_uploads where owner_id=auth.uid() and created_at<now()-interval '7 days';
 insert into public.produccion_sync_uploads(request_id,total_parts,payload_hash)
 values(p_id,p_count,p_hash) on conflict(request_id) do nothing;
 select * into u from public.produccion_sync_uploads where request_id=p_id for update;
 if not found or u.owner_id<>auth.uid() or u.total_parts<>p_count or u.payload_hash<>p_hash then
  raise exception 'Identidad del lote inválida';
 end if;
 if u.result is not null then return jsonb_build_object('committed',true,'versions',u.result); end if;
 select part_text into old_text from public.produccion_sync_parts where request_id=p_id and part_index=p_index;
 if found then
  if old_text<>p_text then raise exception 'Un bloque repetido tiene contenido distinto'; end if;
 else
  insert into public.produccion_sync_parts values(p_id,p_index,p_text);
 end if;
 return jsonb_build_object('received',p_index);
end $$;

create or replace function public.sync_produccion_commit(p_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare u public.produccion_sync_uploads; payload text; n integer; versions jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
  raise exception 'Solo administradores' using errcode='42501';
 end if;
 select * into u from public.produccion_sync_uploads where request_id=p_id for update;
 if not found then raise exception 'Lote no encontrado'; end if;
 if u.result is not null then return u.result; end if;
 select count(*),string_agg(part_text,'' order by part_index) into n,payload
 from public.produccion_sync_parts where request_id=p_id;
 if n<>u.total_parts or md5(payload)<>u.payload_hash then raise exception 'Envío incompleto o alterado'; end if;
 -- Reutiliza control de versiones y aplica TODAS las tablas en una única transacción.
 versions := public.sync_produccion_apply(payload::jsonb);
 update public.produccion_sync_uploads set result=versions where request_id=p_id;
 delete from public.produccion_sync_parts where request_id=p_id;
 return versions;
end $$;
revoke all on function public.sync_produccion_stage(uuid,integer,integer,text,text) from public,anon;
revoke all on function public.sync_produccion_commit(uuid) from public,anon;
grant execute on function public.sync_produccion_stage(uuid,integer,integer,text,text) to authenticated;
grant execute on function public.sync_produccion_commit(uuid) to authenticated;
commit;
