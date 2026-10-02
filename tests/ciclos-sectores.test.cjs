const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function app(){
  const elements = new Map();
  const context = vm.createContext({console, document:{getElementById(id){
    if(!elements.has(id)) elements.set(id,{value:'',innerHTML:'',addEventListener(){}});
    return elements.get(id);
  }}});
  vm.runInContext(`let hectareasArandano=[], estimacionArandanoLoteRed=[], balanza=[], activeVariedades=[];
    let cultivoActivo='arandano';
    const matchVariedad=v=>!activeVariedades.length||activeVariedades.includes(v);
`,context);
  for(const f of ['utils','ciclos-referencia','calculos-avance-ha','vista-ciclo','vista-sectores'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',f+'.js'),'utf8'),context);
  context.document.getElementById('f8-fecha').value='2026-10-01';
  context.document.getElementById('f8-orden').value='lote';
  for(const id of ['f8-pageSize','f5-pageSize']) context.document.getElementById(id).value='todas';
  return {run:s=>vm.runInContext(s,context),elements};
}
test('ciclos conserva los valores de la referencia y cambia con la fecha',()=>{
  const {run}=app();
  assert.equal(run('computeCiclosPorSector().length'),run('CICLOS_REFERENCIA.length'));
  assert.equal(run('computeCiclosPorSector().every(r=>r.diasDesdeUltimo === daysBetween(r.fecha,"2026-10-01"))'),true);
  assert.equal(run('computeCiclosPorSector().find(r=>r.lote===15 && r.sector==="13").diasDesdeUltimo'),47);
  assert.equal(run('computeCiclosPorSector("2026-10-02").find(r=>r.lote===15 && r.sector==="13").diasDesdeUltimo'),48);
  assert.equal(run('computeCiclosPorSector("2026-08-14").some(r=>r.lote===15 && r.sector==="13")'),false);
  assert.equal(run('computeCiclosPorSector().find(r=>r.lote===5 && r.sector==="1").pasada'),64);
});
test('avances nuevos actualizan la última fecha sin inventar pasada ni Ha Avan',()=>{
  const {run}=app();
  run(`hectareasArandano=[{lote:15,red:'R02',sector:'S17',variedad:'MAGICA',superficie:1.97,fecha:'2026-10-02'}]`);
  assert.equal(run('computeCiclosPorSector("2026-10-03").find(r=>r.lote===15 && r.sector==="17").diasDesdeUltimo'),1);
  assert.equal(run('computeCiclosPorSector("2026-10-03").find(r=>r.lote===15 && r.sector==="17").pasada'),null);
});
test('sectores mantiene variedades y muestra red 2 sin presupuesto',()=>{
  const {run,elements}=app();
  assert.equal(run('computeSectorDetailsArandano().filter(r=>r.lote===15).length'),16);
  assert.equal(run('computeSectorDetailsArandano().filter(r=>r.lote===15 && r.red==="R02").length'),7);
  assert.equal(run('computeSectorDetailsArandano().filter(r=>r.lote===7 && r.sector==="9").length'),2);
  run(`document.getElementById('f5-lote').value='15'; renderSectoresArandano()`);
  assert.match(elements.get('tableSectores').innerHTML,/L15 R02 17/);
  assert.match(elements.get('tableSectores').innerHTML,/Sin presupuesto/);
});
test('tabla y Excel comparten el orden solicitado; normaliza datos antiguos sin duplicarlos',()=>{
  const {run,elements}=app();
  run(`hectareasArandano=[{lote:15,red:'R01',sector:'S11',variedad:'MAGICA',superficie:0.5,fecha:'2026-09-01'}]; renderCiclo()`);
  assert.equal(run('computeSectorDetailsArandano().filter(r=>r.lote===15 && r.sector==="11").length'),1);
  assert.equal(run('computeSectorDetailsArandano().find(r=>r.lote===15 && r.sector==="11").red'),'R02');
  assert.deepEqual(JSON.parse(run('JSON.stringify(encabezadosCiclo())')),['Lote','Red A','Sector','Variedad','Tunel','Ha Sector','Pasada','F. Inicio','F. Fin','Ha Avan','jue 01/10']);
  assert.match(elements.get('tableCiclo').innerHTML,/<th[^>]*>Ha Avan<\/th><th[^>]*>jue 01\/10<\/th>/);
});

test('pantalla paginada sin Túnel y exportación completa con Túnel',()=>{
  const {run,elements}=app();
  run('renderCiclo()');
  assert.equal((elements.get('tableCiclo').innerHTML.match(/<tr>/g)||[]).length,51);
  assert.doesNotMatch(elements.get('tableCiclo').innerHTML,/Tunel/);
  const first=elements.get('tableCiclo').innerHTML;
  run('cicloPage=1; renderCiclo()');
  assert.notEqual(elements.get('tableCiclo').innerHTML,first);
  run(`globalThis.exported=null; globalThis.XLSX={utils:{aoa_to_sheet:a=>{exported=a; return {};},book_new:()=>({}),book_append_sheet(){}},writeFile(){}}; exportCicloToExcel()`);
  assert.equal(run('exported.length'),run('computeCiclosPorSector().length+1'));
  assert.equal(run('exported[0][4]'),'Tunel');
  assert.equal(run('exported.every(r=>r.length===11)'),true);
});

test('sectores muestra hectáreas pequeñas y no calcula rendimiento sin área',()=>{
  const {run,elements}=app();
  run(`computeSectorDetailsArandano=()=>[
    {lote:8,red:'R01',sector:'19',variedad:'FALCON',superficie:0.028},
    {lote:8,red:'R01',sector:'20',variedad:'SIN AREA',superficie:0}
  ];
  balanza=[{lote:8,red:'R01',variedad:'FALCON',kg:5},
    {lote:8,red:'R01',variedad:'SIN AREA',kg:10}];
  renderSectoresArandano();`);
  const html=elements.get('tableSectores').innerHTML;
  assert.match(html,/0\.028/);
  assert.match(html,/179/);
  assert.match(html,/Sin hectáreas/);
});
