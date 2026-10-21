-- Ejecutar una vez si la confirmación falla con código 57014.
-- No cambia los bloques pendientes ni los datos de producción.
alter function public.sync_produccion_commit(uuid) set statement_timeout = '60s';
notify pgrst, 'reload schema';

-- Debe mostrar statement_timeout=60s.
select proconfig from pg_proc
where oid = 'public.sync_produccion_commit(uuid)'::regprocedure;
