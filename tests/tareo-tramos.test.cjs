const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../js/carga-datos.js'),'utf8');
const ctx=vm.createContext({});
vm.runInContext(src.slice(src.indexOf('function findKey'),src.indexOf('// Lee un archivo Excel'))+src.slice(src.indexOf('function minutosHoraTareo'),src.indexOf('// Parsea el reporte de tareo (uno')),ctx);
const row=(inicio,fin,codlab=5129)=>({Fecha:'2026-09-28',CodOperario:123,CodLabor:codlab,HORA_INI_LAB:inicio,HORA_FIN_LAB:fin,totHoras:32});
test('usa horas de labor, no totHoras; conserva tramos distintos',()=>{
 const r=ctx.parseTareoArandanoRows([row('06:30','09:20'),row('09:20','12:00')]);
 assert.equal(r.length,2);assert.ok(Math.abs(r[0].horas-17/6)<1e-9);assert.ok(Math.abs(r[1].horas-8/3)<1e-9);
 assert.equal(r[0].horasFormato,'decimal');assert.equal(ctx.parseTareoArandanoRows([row('07:30','09:30')])[0].horas,2);
});
test('conserva labores separadas y elimina el mismo tramo repetido',()=>{
 const r=ctx.parseTareoArandanoRows([row('07:30','09:30'),row('07:30','09:30'),row('07:30','09:30',5137),row('07:30','09:30',5132),row('07:30','09:30',5014)]);
 assert.equal(r.length,4);
});
test('rechaza horarios inválidos en lugar de asignar jornada completa',()=>{
 assert.throws(()=>ctx.parseTareoArandanoRows([row('','09:30')]));
 assert.throws(()=>ctx.parseTareoArandanoRows([row('12:00','09:30')]));
});
test('mantiene el formato anterior',()=>{
 const r=ctx.parseTareoArandanoRows([{FECHA:'2026-09-28',CODIGO:123,'COD-LAB':5129,'HRS.TRAB.':7.3}]);
 assert.equal(r[0].horas,7.3);assert.equal(r[0].horasFormato,undefined);
});
