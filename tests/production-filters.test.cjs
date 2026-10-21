const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function app(rows){
 const elements=new Map();
 const document={getElementById(id){if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',classList:{toggle(){},contains(){return false}},setCustomValidity(v){this.validity=v},addEventListener(){}});return elements.get(id)}};
 const c=vm.createContext({document,balanza:rows,cultivoActivo:'arandano',matchVariedad:()=>true,Date,Map,Set});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/reportes-produccion.js'),'utf8'),c);
 return {run:s=>vm.runInContext(s,c),el:id=>document.getElementById(id)};
}
const base={fecha:'2026-10-01',lote:7,red:'R01',variedad:'VENTURA',kg:110,kgExportable:100,kgNacional:10,envases:50};
test('rango predeterminado limita la campaña a los últimos 30 días',()=>{
 const a=app([base,{...base,fecha:'2026-05-01'}]);
 assert.equal(a.run('productionRows().length'),1);assert.equal(a.el('prod-desde').value,'2026-09-02');
});
test('mercados suman el total y respetan el lote y las fechas',()=>{
 const a=app([base,{...base,lote:8,kg:220,kgExportable:200,kgNacional:20}]);
 a.run('initProductionFilters()');a.el('prod-lote').value='7';
 a.el('prod-mercado').value='NAC';assert.equal(a.run('productionRows()[0].kg'),10);
 a.el('prod-mercado').value='EXP';assert.equal(a.run('productionRows()[0].kg'),100);
 a.el('prod-mercado').value='';assert.equal(a.run('productionRows()[0].kg'),110);
 a.el('prod-hasta').value='2026-09-30';assert.equal(a.run('productionRows().length'),0);
});
test('no inventa desglose de mercado ni divide por jabas totales',()=>{
 const a=app([base,{...base,kgExportable:undefined,kgNacional:undefined}]);
 a.el('prod-mercado').value='NAC';assert.equal(a.run('productionRows().length'),1);
 assert.equal(a.run('productionRows()[0].envases'),null);
 assert.match(a.el('prod-status').textContent,/sin desglose/);
 a.run("marketJabas=new Map([[productionKey(balanza[0]),{EXP:45,NAC:5}]])");
 assert.equal(a.run('productionRows()[0].envases'),5);
 assert.equal(a.run('comparableWeight(productionRows()).kg/comparableWeight(productionRows()).jabas'),2);
});
test('promedio usa solo kilos con jabas comparables; rango invertido queda vacío',()=>{
 const a=app([base,{...base,kg:1000,envases:null}]);
 assert.equal(a.run('comparableWeight(productionRows()).kg'),110);
 a.el('prod-desde').value='2026-10-02';
 assert.equal(a.run('productionRows().length'),0);assert.match(a.el('prod-status').textContent,/Revisa el rango/);
});
