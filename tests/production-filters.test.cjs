const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const js=f=>fs.readFileSync(path.join(__dirname,'../js',f),'utf8');

// state.js + la parte de parsers de carga-datos.js (sin los handlers del DOM).
function core(){
  const c=vm.createContext({DEFAULT_BALANZA:[],DEFAULT_HECTAREAS:[],DEFAULT_CALIBRES:[],DEFAULT_TAREO:[],DEFAULT_BINES:[],Map,Set,Math,Number,String,parseInt,parseFloat,Date});
  vm.runInContext(js('state.js'),c);
  const carga=js('carga-datos.js');
  const ini=carga.indexOf('function findKey'), fin=carga.indexOf('// Lee el Excel de estimación de Arándano');
  vm.runInContext(carga.slice(ini,fin),c);
  return s=>{const v=vm.runInContext(s,c);return v&&typeof v==='object'?JSON.parse(JSON.stringify(v)):v;};
}
const exp={fecha:'2026-10-01',lote:7,red:'R02',referencia:'07-2-AV',variedad:'VENTURA',kg:1000,envases:400};
const nacFila={'ID':1,'LOTE RED VAR':'07-2-AV','FECHA COSECHA':new Date(2026,9,1),'CNT':10,'KILOS':25};

test('parser: referencia a Lote-Red, código de variedad y dedupe por ID',()=>{
  const run=core();
  run('globalThis.r='+JSON.stringify([nacFila,{...nacFila,KILOS:30},{...nacFila,ID:2,'LOTE RED VAR':'15-1-AM'},{ID:'','LOTE RED VAR':'',KILOS:999}]).replace(/"FECHA COSECHA":"[^"]+"/g,'"FECHA COSECHA":"2026-10-01"'));
  const p=run('parseNacionalArandanoRows(r)');
  assert.equal(p.length,2);
  assert.deepEqual([p[0].lote,p[0].red,p[0].codVar,p[0].kg,p[0].fecha],[7,'R02','AV',30,'2026-10-01']);
  assert.equal(p[1].red,'R01');
});
test('parser: jabas imposibles quedan sin conteo pero los kg se mantienen',()=>{
  const run=core();
  run(`globalThis.r=[{ID:1,'LOTE RED VAR':'08-1-AAL','FECHA COSECHA':'2026-07-22',CNT:3,KILOS:707},{ID:2,'LOTE RED VAR':'07-2-AV','FECHA COSECHA':'2026-05-07',CNT:0,KILOS:152.4},{ID:3,'LOTE RED VAR':'07-2-AV','FECHA COSECHA':'2026-05-08',CNT:5,KILOS:15}]`);
  const p=run('parseNacionalArandanoRows(r)');
  assert.deepEqual(p.map(x=>x.envases),[null,null,5]);
  assert.deepEqual(p.map(x=>x.kg),[707,152.4,15]);
});
test('unión con balanza: variedad desde el código y filtro de mercado',()=>{
  const run=core();
  run(`cultivoActivo='arandano'; balanzaArandano=[${JSON.stringify(exp)}]; nacionalArandano=parseNacionalArandanoRows([{ID:1,'LOTE RED VAR':'07-2-AV','FECHA COSECHA':'2026-10-01',CNT:10,KILOS:25},{ID:2,'LOTE RED VAR':'05-1-AX','FECHA COSECHA':'2026-10-01',CNT:1,KILOS:3}])`);
  const todos=run('balanzaActiva()');
  assert.equal(todos.length,3);
  assert.equal(todos.reduce((s,r)=>s+r.kg,0),1028);
  assert.equal(todos[1].variedad,'VENTURA');
  assert.equal(todos[2].variedad,'AX'); // código sin equivalencia en balanza: se muestra tal cual
  run("mercadoActivo='EXP'"); assert.equal(run('balanzaActiva().length'),1);
  run("mercadoActivo='NAC'"); assert.deepEqual(run('balanzaActiva().map(r=>r.mercado)'),['NAC','NAC']);
  run("cultivoActivo='palto'"); assert.equal(run('balanzaActiva()===balanzaPalto'),true);
});

function vistaJabas(rows){
  const elements=new Map();
  const document={getElementById(id){if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',classList:{toggle(){},contains(){return false}},addEventListener(){}});return elements.get(id)}};
  const c=vm.createContext({document,balanza:rows,mercadoActivo:'',cultivoActivo:'arandano',matchVariedad:()=>true,Map,Set,Number,String});
  vm.runInContext(js('reportes-produccion.js'),c);
  return {run:s=>vm.runInContext(s,c),el:id=>document.getElementById(id)};
}
test('Kg/Jaba solo con filas con jabas confiables; los kg nacionales siempre suman',()=>{
  const a=vistaJabas([{...exp,mercado:'EXP',kg:100,envases:40},{...exp,mercado:'NAC',kg:707,envases:null}]);
  assert.equal(a.run('productionRows().reduce((s,r)=>s+r.kg,0)'),807);
  const w=a.run('comparableWeight(productionRows())');
  assert.equal(w.kg/w.jabas,2.5);
  assert.match(a.el('prod-status').textContent,/1 registros nacionales sin conteo/);
});
