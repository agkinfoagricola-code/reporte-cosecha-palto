-- Solo lectura: ejecutar en SQL Editor. No modifica permisos ni datos.
select tablename, policyname, cmd, qual, with_check
from pg_policies where schemaname='public' and tablename='profiles';

select table_name, column_name, data_type
from information_schema.columns
where table_schema='public' and table_name in
 ('profiles','balanza_arandano_data','hectareas_arandano_data','tareo_arandano_data','lecturaind_arandano_data')
order by table_name,ordinal_position;

select routine_name from information_schema.routines
where routine_schema='public' and routine_name in ('sync_produccion_snapshot','sync_produccion_apply');
