// Prueba de desarrollo: requiere @electric-sql/pglite 0.3.14 (no se usa en Windows).
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select '{"email":"test@example.com"}'::jsonb$$;
 grant usage on schema auth to authenticated;
 create table profiles(id uuid primary key,role text);
 insert into profiles values('00000000-0000-0000-0000-000000000001','admin');
 grant select on profiles to authenticated;`);
 for(const t of ['balanza_arandano_data','hectareas_arandano_data','tareo_arandano_data'])await db.exec(`create table ${t}(id integer primary key,data jsonb not null default '[]',updated_at timestamptz default now(),updated_by text);insert into ${t}(id) values(1);grant select,update on ${t} to authenticated;`);
 const base=__dirname+'/';
 await db.exec(fs.readFileSync(base+'supabase_sync.sql','utf8'));
 await db.exec(fs.readFileSync(base+'ACTUALIZAR_ENVIO.sql','utf8'));
 await db.exec(fs.readFileSync(base+'ACTUALIZAR_ENVIO.sql','utf8'));
 await db.exec(`set role authenticated;set test.uid='00000000-0000-0000-0000-000000000001';`);
 const query=async(s,p)=>(await db.query(s,p)).rows[0].r;
 const snapshot=await query('select sync_produccion_snapshot() as r');
 const changes={};for(const [t,r] of Object.entries(snapshot))changes[t]={version:r.version,data:[{fecha:'2026-09-28',cantidad:100,detalle:'áé雪'}]};
 const text=JSON.stringify(changes),hash=crypto.createHash('md5').update(text).digest('hex');
 const parts=text.match(/[\s\S]{1,90}/g),id='00000000-0000-0000-0000-000000000002';
 for(let i=0;i<parts.length;i++){
  await query('select sync_produccion_stage($1,$2,$3,$4,$5) as r',[id,i,parts.length,hash,parts[i]]);
  await query('select sync_produccion_stage($1,$2,$3,$4,$5) as r',[id,i,parts.length,hash,parts[i]]);
 }
 assert.deepEqual(await query('select sync_produccion_snapshot() as r'),snapshot);
 const result=await query('select sync_produccion_commit($1) as r',[id]);
 assert.equal(Object.keys(result).length,4);
 assert.deepEqual(await query('select sync_produccion_commit($1) as r',[id]),result);
 assert.equal((await query('select sync_produccion_snapshot() as r')).balanza_arandano_data.data[0].detalle,'áé雪');
 // A stale batch must leave ALL tables unchanged, even if an earlier table in the loop was updated.
 const before=await query('select sync_produccion_snapshot() as r');
 const conflict={};for(const [t,r] of Object.entries(before))conflict[t]={version:r.version,data:[{new:true}]};
 conflict.tareo_arandano_data.version='stale';
 const stale=JSON.stringify(conflict),sid='00000000-0000-0000-0000-000000000003';
 await query('select sync_produccion_stage($1,0,1,$2,$3) as r',[sid,crypto.createHash('md5').update(stale).digest('hex'),stale]);
 await assert.rejects(query('select sync_produccion_commit($1) as r',[sid]),/CONFLICTO/);
 assert.deepEqual(await query('select sync_produccion_snapshot() as r'),before);
 await db.exec(`set test.uid='00000000-0000-0000-0000-000000000004'`);
 await assert.rejects(query('select sync_produccion_commit($1) as r',[id]),/Solo administradores/);
 console.log('PostgreSQL: migración repetible, staging sin modificar producción, duplicados idempotentes, confirmación repetible, rollback completo y control admin: OK');
 await db.close();
})().catch(e=>{console.error(e.message);process.exitCode=1});
