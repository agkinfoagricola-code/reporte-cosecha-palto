/* ============ ACTUALIZAR DATOS (parsers + handlers) ============ */
document.getElementById('resetBtn').addEventListener('click', async ()=>{
  if(currentRole !== 'admin') return;
  if(!confirm('Esto restablece los datos de balanza y hectáreas a la base (30-jun-2026) para TODOS los usuarios. ¿Continuar?')) return;
  balanzaPalto = DEFAULT_BALANZA; balanza = cultivoActivo === 'arandano' ? balanzaArandano : balanzaPalto; hectareas = DEFAULT_HECTAREAS; tareo = DEFAULT_TAREO; calibres = DEFAULT_CALIBRES; bines = DEFAULT_BINES;
  try{
    await sb.from('balanza_data').update({ data: DEFAULT_BALANZA, updated_by: currentUser.email }).eq('id', 1);
    await sb.from('hectareas_data').update({ data: DEFAULT_HECTAREAS, updated_by: currentUser.email }).eq('id', 1);
    await sb.from('tareo_data').update({ data: DEFAULT_TAREO, updated_by: currentUser.email }).eq('id', 1);
    await sb.from('calibres_data').update({ data: DEFAULT_CALIBRES, updated_by: currentUser.email }).eq('id', 1);
    await sb.from('bines_data').update({ data: DEFAULT_BINES, updated_by: currentUser.email }).eq('id', 1);
  }catch(e){}
  document.getElementById('updatedChip').textContent = 'Datos actualizados: ' + new Date().toLocaleString('es-PE', {dateStyle:'short', timeStyle:'short'});
  renderAll();
});

function findKey(obj, candidates){
  const keys = Object.keys(obj);
  for(const c of candidates){
    const hit = keys.find(k=>k.toLowerCase().trim()===c.toLowerCase());
    if(hit) return hit;
  }
  return null;
}

function formatDateCell(v){
  if(v instanceof Date){
    const y = v.getFullYear(), m = String(v.getMonth()+1).padStart(2,'0'), d = String(v.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0,10);
}

// Lee un archivo Excel (.xlsx/.xls) en el navegador y devuelve un array de objetos
// (una fila = un objeto, usando la primera fila como encabezados) usando SheetJS.
// Lee un archivo Excel de TAREO, tolerando:
// - Una fila de título antes de los encabezados reales (el reporte trae "PERSONAL DE COSECHA
//   PALTO..." en la fila 1 y recién en la fila 2 vienen FECHA/CODIGO/etc.), probando distintos
//   offsets de encabezado hasta encontrar uno con columnas FECHA + CODIGO reconocibles.
// - Varias hojas de día en un mismo archivo (consolidados), tomando todas menos FALTAS/PLAN-LAB/
//   LEYENDA/ARANDANO.
function readTareoWorkbook(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      try{
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array', cellDates:true});
        let allRows = [];
        for(const sheetName of wb.SheetNames){
          const upper = sheetName.trim().toUpperCase();
          if(['FALTAS','PLAN-LAB','LEYENDA','ARANDANO'].includes(upper)) continue;
          const ws = wb.Sheets[sheetName];
          let rows = null;
          for(const range of [0,1,2]){
            const candidate = XLSX.utils.sheet_to_json(ws, {defval:'', range});
            if(candidate.length && findKey(candidate[0], ['FECHA','Fecha']) && findKey(candidate[0], ['CODIGO','Codigo','CodOperario'])){
              rows = candidate;
              break;
            }
          }
          if(rows) allRows = allRows.concat(rows);
        }
        if(!allRows.length){
          reject(new Error('No se encontraron filas de tareo reconocibles (revisa que el archivo tenga columnas FECHA, CODIGO, COD-LAB).'));
        } else {
          resolve(allRows);
        }
      }catch(err){ reject(new Error('No se pudo leer el archivo Excel: ' + err.message)); }
    };
    reader.onerror = ()=> reject(new Error('No se pudo leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

function readExcelFile(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      try{
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array', cellDates:true});
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
        resolve(rows);
      }catch(err){ reject(new Error('No se pudo leer el archivo Excel: ' + err.message)); }
    };
    reader.onerror = ()=> reject(new Error('No se pudo leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

function parseBalanzaRows(rows){
  if(!rows.length) return [];
  const sample = rows[0];
  const kFecha = findKey(sample, ['fechaCosecha','Fecha']);
  const kLote = findKey(sample, ['Lote']);
  const kRed = findKey(sample, ['Red']);
  const kVar = findKey(sample, ['VARIEDAD','Variedad']);
  const kKg = findKey(sample, ['Peso Neto','KgReal','kg']);
  const kBin = findKey(sample, ['cntBines','bines','CantBines']);
  if(!kFecha || !kLote || !kRed || !kVar || !kKg) throw new Error('Faltan columnas esperadas en el archivo de balanza.');
  return rows.filter(r=>r[kLote]).map(r=>({
    fecha: formatDateCell(r[kFecha]),
    lote: parseInt(String(r[kLote]).replace(/[^0-9]/g,'')),
    red: String(r[kRed]).trim(),
    variedad: String(r[kVar]).trim().toUpperCase(),
    kg: parseFloat(r[kKg]) || 0,
    bines: parseInt(r[kBin]) || 0,
  }));
}

function parseBalanzaArandanoRows(rows){
  if(!rows.length) return [];
  const sample = rows[0];
  const kFecha = findKey(sample, ['FechaCosecha','Fecha Cosecha','Fecha']);
  const kLote = findKey(sample, ['Lote']);
  const kRef = findKey(sample, ['Referencia']);
  const kVar = findKey(sample, ['Nombre Familia','VARIEDAD','Variedad']);
  const kKg = findKey(sample, ['Peso Neto','KgReal','kg']);
  const kEnv = findKey(sample, ['Total Envases','Envases','Jabas']);
  if(!kFecha || !kLote || !kRef || !kVar || !kKg) throw new Error('Faltan columnas esperadas en la balanza de arándano (FechaCosecha, Lote, Referencia, Nombre Familia, Peso Neto).');
  return rows.filter(r=>r[kLote] && r[kKg] !== '').map(r=>{
    const ref = String(r[kRef]||'').trim();
    const partes = ref.split('-').filter(Boolean);
    const redNum = partes.length >= 2 ? String(partes[1]).replace(/[^0-9]/g,'') : '';
    const red = redNum ? 'R' + redNum.padStart(2,'0') : (partes[1] || 'R00');
    return {
      fecha: formatDateCell(r[kFecha]),
      lote: parseInt(String(r[kLote]).replace(/[^0-9]/g,'')),
      red,
      referencia: ref,
      variedad: String(r[kVar]).trim().toUpperCase(),
      kg: parseFloat(r[kKg]) || 0,
      envases: kEnv ? (parseInt(r[kEnv]) || 0) : 0,
    };
  }).filter(r=>r.lote && r.fecha && r.variedad);
}

// Lee el Excel de estimación de Arándano tolerando filas de título/versión antes del
// encabezado real (el archivo de FLM trae "Sociedad Agrícola...", "Versión...", el título del
// reporte, etc. antes de la fila LOTE/RED/VARIEDAD/AREA/KG TOTAL) — igual que readTareoWorkbook,
// prueba varios offsets de encabezado en cada hoja hasta encontrar uno reconocible.
function readEstimacionArandanoWorkbook(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      try{
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array', cellDates:true});
        for(const sheetName of wb.SheetNames){
          const ws = wb.Sheets[sheetName];
          for(let range=0; range<=10; range++){
            const candidate = XLSX.utils.sheet_to_json(ws, {defval:'', range});
            if(candidate.length && findKey(candidate[0], ['LOTE','Lote']) && findKey(candidate[0], ['RED','Red']) && findKey(candidate[0], ['VARIEDAD','Variedad'])){
              resolve(candidate);
              return;
            }
          }
        }
        reject(new Error('No se encontraron filas de estimación de Arándano reconocibles (revisa que el archivo tenga columnas LOTE, RED, VARIEDAD, AREA, KG TOTAL).'));
      }catch(err){ reject(new Error('No se pudo leer el archivo Excel: ' + err.message)); }
    };
    reader.onerror = ()=> reject(new Error('No se pudo leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

// Parsea el presupuesto de Has/Kg por Lote-Red-Variedad de Arándano a partir del archivo real
// "Estimación de Producción por Lote-Red-Variedad" (hoja 4-Prod_Lote): columnas LOTE, RED,
// VARIEDAD, AREA (Has) y KG TOTAL (Kg Ppto). No existe una data base fija como ESTIMACION de
// Palto, así que esto se carga por Excel. Es un reemplazo completo (igual que el Excel de
// Hectáreas de Palto), no un merge por fecha.
//
// Dos particularidades de este archivo que hay que resolver acá:
// 1) RED puede venir con sub-parcela decimal (ej. Lote 7: Red 2, 2.1, 2.2) — para la balanza,
//    que arma el Red desde el código de referencia de campo, esas tres son el MISMO Red físico
//    entero (Red 2). Se redondea hacia abajo (Math.floor) y se agrupan.
// 2) Puede haber más de una fila para el mismo Lote-Red-Variedad (bloques de siembra distintos,
//    ej. Lote 15 Red 1 Magica aparece dos veces) — se suman, no se sobrescriben.
// También descarta la fila "SUB TOTAL" y cualquier fila sin Lote/Red numérico.
function parseEstimacionArandanoLoteRedRows(rows){
  if(!rows.length) return [];
  const sample = rows[0];
  const kLote = findKey(sample, ['LOTE','Lote']);
  const kRed = findKey(sample, ['RED','Red']);
  const kVar = findKey(sample, ['VARIEDAD','Variedad']);
  const kHas = findKey(sample, ['AREA','Area','Has Ppto','HasPpto','Has']);
  const kKg = findKey(sample, ['KG TOTAL','Kg Total','KgTotal','Kg Ppto','KgPpto','Kg']);
  if(!kLote || !kRed || !kVar || !kHas || !kKg) throw new Error('Faltan columnas esperadas en el presupuesto de Arándano (LOTE, RED, VARIEDAD, AREA, KG TOTAL).');

  const groups = new Map(); // "lote|red|variedad" -> {lote, red, variedad, has, kgPpto}
  rows.forEach(r=>{
    const lote = parseInt(String(r[kLote] ?? '').replace(/[^0-9]/g,''));
    if(!lote) return; // descarta 'SUB TOTAL', filas vacías, encabezados repetidos, etc.
    const redNum = parseFloat(r[kRed]);
    if(isNaN(redNum)) return;
    const red = 'R' + String(Math.floor(redNum)).padStart(2,'0');
    const variedad = String(r[kVar] ?? '').trim().toUpperCase();
    if(!variedad) return;
    const key = lote+'|'+red+'|'+variedad;
    if(!groups.has(key)) groups.set(key, { lote, red, variedad, has: 0, kgPpto: 0 });
    const g = groups.get(key);
    g.has += parseFloat(r[kHas]) || 0;
    g.kgPpto += parseFloat(r[kKg]) || 0;
  });
  return [...groups.values()];
}

// Parsea el archivo real de avance de campo de Arándano que reporta el líder (columnas
// fecRegistro, Ubicacion "L07 R02 S30", VARIEDAD, Hectarea, Cerrado — entre otras que no se
// usan aquí como Corte12/CorteFinal/Total/falto_Cosechar). A diferencia de Palto, en Arándano
// el mismo sector se vuelve a cosechar varias veces por campaña (ronda tras ronda, porque el
// fruto sigue madurando), así que NO hay "avance acumulado" ni tipos de pase (Selectivo/Barrer):
// una vez que el líder reporta un sector, ese sector queda con su Hectarea completa activa en
// cosecha — no hay que sumar hectáreas entre fechas ni entre rondas.
function parseHectareasArandanoRows(rows){
  if(!rows.length) return [];
  const sample = rows[0];
  const kFecha = findKey(sample, ['fecRegistro','Fecha']);
  const kUbic = findKey(sample, ['Ubicacion','Ubicación']);
  const kVar = findKey(sample, ['VARIEDAD','Variedad']);
  const kHa = findKey(sample, ['Hectarea','Hectárea','Ha']);
  const kCerrado = findKey(sample, ['Cerrado']);
  if(!kFecha || !kUbic || !kVar || !kHa) throw new Error('Faltan columnas esperadas en el archivo de avance de campo de Arándano (fecRegistro, Ubicacion, VARIEDAD, Hectarea).');
  return rows.filter(r=>r[kUbic]).map(r=>{
    const parts = String(r[kUbic]).trim().split(/\s+/);
    const cerradoRaw = kCerrado ? String(r[kCerrado] ?? '').trim().toLowerCase() : '';
    return {
      fecha: formatDateCell(r[kFecha]),
      lote: parseInt((parts[0]||'').replace(/[^0-9]/g,'')),
      red: parts[1]||'',
      sector: parts.slice(2).join(' '),
      variedad: String(r[kVar]).trim().toUpperCase(),
      superficie: parseFloat(r[kHa]) || 0,
      cerrado: cerradoRaw === 'si' || cerradoRaw === 'sí',
    };
  }).filter(r=>r.lote && r.red && r.sector);
}

// Parsea el reporte de calibres de Arándano a nivel pallet/caja (columnas F. Cosecha,
// Lote - Red "07-2-AV", Variedad, Cajas Equi., CAL, CAT) — mismo formato que el de Palto,
// pero el calibre es por milímetro (11mm+ al 19mm+) en vez de N° de fruto/caja, así que NO
// se puede calcular un "peso teórico" como en Palto (4kg ÷ N° calibre no aplica a mm). Por eso
// esta fila NO trae campo `peso`; el reporte de Arándano solo muestra % de distribución por
// calibre. CAT trae 'I' (exportable) y 'S/C' (sin categoría / mercado nacional) — ambas se
// conservan como categorías propias del reporte, a diferencia de Palto que solo usa I/II.
const CAL_KEYS_ARANDANO = ['11 MM+','12 MM+','14 MM+','16 MM+','18 MM+','19 MM+'];
const CATEGORIAS_VALIDAS_ARANDANO = new Set(['I','II','S/C']);

function parseCalibresArandanoRawRows(rows){
  if(!rows.length) return [];
  const sample = rows[0];
  const kFecha = findKey(sample, ['F. Cosecha','F Cosecha','Fecha Cosecha']);
  const kLoteRed = findKey(sample, ['Lote - Red','Lote-Red','LoteRed']);
  const kVar = findKey(sample, ['Variedad']);
  const kCajas = findKey(sample, ['Cajas Equi.','Cajas Equi','CajasEqui']);
  const kCal = findKey(sample, ['CAL']);
  const kCat = findKey(sample, ['CAT']);
  if(!kFecha || !kLoteRed || !kVar || !kCajas || !kCal || !kCat) throw new Error('Faltan columnas esperadas en el archivo de calibres de Arándano (F. Cosecha, Lote - Red, Variedad, Cajas Equi., CAL, CAT).');

  const groups = new Map(); // "fecha|lote-red|variedad|categoria" -> {cajasPorCal, total}
  rows.forEach(r=>{
    if(!r[kLoteRed]) return;
    const cat = String(r[kCat] ?? '').trim().toUpperCase();
    if(!CATEGORIAS_VALIDAS_ARANDANO.has(cat)) return;
    const calRaw = String(r[kCal] ?? '').trim().toUpperCase();
    if(!CAL_KEYS_ARANDANO.includes(calRaw)) return; // descarta DESCARTE, VA, MCDO NACIONAL

    // "07-2-AV" -> Lote 7, Red R02 (mismo criterio que la balanza de Arándano); se arma un
    // Lote-Red "limpio" (ej. "7-R02") en vez de guardar el string crudo, porque el crudo trae
    // el código de variedad pegado al final (AV, AE, AA...) y rompería el filtro de Lote/Red.
    const partes = String(r[kLoteRed]).trim().split('-');
    const lote = parseInt(partes[0], 10);
    const redNum = partes[1] ? parseInt(partes[1].replace(/[^0-9]/g,''), 10) : NaN;
    if(!lote || isNaN(redNum)) return;
    const loteRed = lote + '-R' + String(redNum).padStart(2,'0');

    const cajas = parseFloat(r[kCajas]) || 0;
    const variedad = String(r[kVar] ?? '').replace(/^ARANDANO\s+/i,'').trim().toUpperCase();
    const key = formatDateCell(r[kFecha]) + '|' + loteRed + '|' + variedad + '|' + cat;
    if(!groups.has(key)) groups.set(key, { cajasPorCal: {}, total: 0 });
    const g = groups.get(key);
    g.cajasPorCal[calRaw] = (g.cajasPorCal[calRaw] || 0) + cajas;
    g.total += cajas;
  });

  const out = [];
  groups.forEach((g, key)=>{
    const [fecha, loteRed, variedad, categoria] = key.split('|');
    const cal = {};
    CAL_KEYS_ARANDANO.forEach(k=>{ cal[k] = g.total > 0 ? (g.cajasPorCal[k] || 0) / g.total : 0; });
    out.push({ fecha, loteRed, variedad, categoria, cajas: g.total, cal });
  });
  return out;
}

// Reemplaza en `calibresArandano` solo las combinaciones (fecha, Lote-Red, Variedad, Categoría)
// presentes en `newRows`, igual que con el de Palto.
function mergeCalibresArandanoByKey(existingRows, newRows){
  const keyOf = r => r.fecha+'|'+r.loteRed+'|'+r.variedad+'|'+(r.categoria||'I');
  const newKeys = new Set(newRows.map(keyOf));
  const kept = existingRows.filter(r=>!newKeys.has(keyOf(r)));
  return kept.concat(newRows);
}

function parseHectareasRows(rows){
  if(!rows.length) return [];
  const sample = rows[0];
  const kFecha = findKey(sample, ['Fecha']);
  const kUbic = findKey(sample, ['Ubicacion','Ubicación']);
  const kVar = findKey(sample, ['Variedad']);
  const kTipo = findKey(sample, ['TipoCosecha']);
  const kHa = findKey(sample, ['Ha']);
  const kSup = findKey(sample, ['Superficie_Ha','Superficie']);
  const kCerrado = findKey(sample, ['Cerrado']);
  if(!kFecha || !kUbic || !kVar || !kTipo || !kHa) throw new Error('Faltan columnas esperadas en el archivo de hectáreas.');
  return rows.filter(r=>r[kUbic]).map(r=>{
    const parts = String(r[kUbic]).trim().split(' ');
    const haVal = parseFloat(r[kHa]) || 0;
    const cerradoRaw = kCerrado ? String(r[kCerrado] ?? '').trim().toLowerCase() : '';
    return {
      fecha: formatDateCell(r[kFecha]),
      lote: parseInt((parts[0]||'').replace(/[^0-9]/g,'')),
      red: parts[1]||'',
      sector: parts.slice(2).join(' '),
      variedad: String(r[kVar]).trim().toUpperCase(),
      tipo: String(r[kTipo]).trim().toUpperCase(),
      ha: haVal,
      superficie: kSup ? (parseFloat(r[kSup]) || haVal) : haVal,
      cerrado: cerradoRaw === 'si' || cerradoRaw === 'sí',
    };
  });
}

// Parsea el reporte de tareo de Arándano — mismo formato que el de Palto (FECHA, CODIGO,
// NOMBRE TRABAJADOR, COD-LAB, HRS.TRAB.), pero solo conserva el código de cosecha de Arándano
// (ver TAREO_COSECHADOR_CODES_ARANDANO = 5129 ARA-COSECHADOR), que es uno solo — a diferencia
// de Palto no hay split Hass/Poli por variedad.
// El tareo moderno expresa tramos de labor; no repetir totHoras por cada tramo.
function minutosHoraTareo(v){
  if(v instanceof Date) return v.getHours()*60 + v.getMinutes() + v.getSeconds()/60;
  if(typeof v === 'number' && v >= 0 && v < 1) return v*1440;
  const m = String(v ?? '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if(!m || +m[1]>23 || +m[2]>59 || +(m[3]||0)>59) return null;
  return +m[1]*60 + +m[2] + +(m[3]||0)/60;
}
function parseTareoArandanoRows(rows){
  if(!rows.length) return [];
  const sample = rows[0];
  const kFecha = findKey(sample, ['FECHA','Fecha']);
  const kCodigo = findKey(sample, ['CODIGO','Codigo','CodOperario']);
  const kCodLab = findKey(sample, ['COD-LAB','COD LAB','CodLab','CodLabor']);
  const kHoras = findKey(sample, ['HRS.TRAB.','HRS TRAB','HRS.TRAB','Horas']);
  const kInicio = findKey(sample, ['HORA_INI_LAB']);
  const kFin = findKey(sample, ['HORA_FIN_LAB']);
  const moderno = !!findKey(sample, ['CodOperario']);
  if(!kFecha || !kCodigo || !kCodLab) throw new Error('Faltan fecha, código de trabajador o código de labor en el tareo.');
  if(moderno && (!kInicio || !kFin)) throw new Error('El tareo individual requiere HORA_INI_LAB y HORA_FIN_LAB.');
  const out = [], seen = new Set();
  rows.forEach((r,index)=>{
    if(r[kCodigo] === '' || r[kCodigo] == null || !r[kFecha]) return;
    const codlab = Number(r[kCodLab]);
    if(![5129,5014,5132,5137].includes(codlab)) return;
    const codigo = Number(r[kCodigo]);
    if(!codigo) return;
    const fecha = formatDateCell(r[kFecha]);
    let horas;
    const record = {fecha,codigo,codlab};
    if(moderno){
      const inicio = minutosHoraTareo(r[kInicio]), fin = minutosHoraTareo(r[kFin]);
      if(inicio == null || fin == null || fin < inicio) throw new Error(`Horario inválido en tareo, fila de datos ${index+1}. Revisa inicio y fin de labor.`);
      horas = (fin-inicio)/60;
      Object.assign(record,{horasFormato:'decimal',inicioMin:inicio,finMin:fin,
        grupo:String(r[findKey(sample,['CodGrupo'])] || ''),
        ubicacion:String(r[findKey(sample,['SubLote'])] || ''),
        variedad:String(r[findKey(sample,['VARIEDAD'])] || '').trim().toUpperCase()});
      const key = JSON.stringify([fecha,codigo,codlab,inicio,fin,record.grupo,record.ubicacion]);
      if(seen.has(key)) return;
      seen.add(key);
    } else {
      horas = kHoras ? parseFloat(r[kHoras]) : 8;
      if(!Number.isFinite(horas) || horas<0) throw new Error(`Horas inválidas en tareo, fila de datos ${index+1}.`);
    }
    out.push({...record,horas});
  });
  return out;
}

// Parsea el reporte de tareo (uno o varios días) al formato interno {fecha, codigo, codlab}.
// Solo conserva filas cuya labor sea jornal de cosecha o tachero (ver TAREO_COSECHADOR_CODES);
// el resto de labores (líder, almacén, supervisor, etc.) no aportan al ratio kg/cosechador.
function parseTareoRows(rows){
  if(!rows.length) return [];
  const sample = rows[0];
  const kFecha = findKey(sample, ['FECHA','Fecha']);
  const kCodigo = findKey(sample, ['CODIGO','Codigo']);
  const kCodLab = findKey(sample, ['COD-LAB','COD LAB','CodLab']);
  const kHoras = findKey(sample, ['HRS.TRAB.','HRS TRAB','HRS.TRAB','Horas']);
  // Lote/ubicación del trabajador (código numérico de la plancha de RR.HH., ej. 3268, 3403) y
  // cuadrilla (columna TACHERO, ej. "C029"). Se guardan para el indicador Kg / Jornal por
  // lote (CECO). Son opcionales: si el archivo no las trae, la fila se guarda igual que antes.
  const kCodLote = findKey(sample, ['COD-LT/UBI','COD LT/UBI','COD-LOTE/UBI','Cod-Lote/Ubi','COD-LT','CODLOTE']);
  const kCuadrilla = findKey(sample, ['TACHERO','GRUPO','GPO']);
  if(!kFecha || !kCodigo || !kCodLab) throw new Error('Faltan columnas esperadas en el archivo de tareo (FECHA, CODIGO, COD-LAB).');
  const out = [];
  for(const r of rows){
    if(r[kCodigo] === '' || r[kCodigo] == null) continue;
    const codlab = parseInt(String(r[kCodLab]).replace(/[^0-9]/g,''));
    if(!TAREO_COSECHADOR_CODES.has(codlab)) continue;
    const codigo = parseInt(String(r[kCodigo]).replace(/[^0-9]/g,''));
    if(!codigo) continue;
    let horas = kHoras ? parseFloat(r[kHoras]) : NaN;
    if(isNaN(horas)) horas = 8;
    const fila = { fecha: formatDateCell(r[kFecha]), codigo, codlab, horas };
    if(kCodLote){
      const codlote = parseInt(String(r[kCodLote]).replace(/[^0-9]/g,''));
      if(codlote) fila.codlote = codlote;
    }
    if(kCuadrilla){
      const cuadrilla = String(r[kCuadrilla] ?? '').trim();
      if(cuadrilla) fila.cuadrilla = cuadrilla;
    }
    out.push(fila);
  }
  return out;
}

// Reemplaza en `tareo` solo las fechas presentes en `newRows`, conservando el resto de días
// ya guardados. Así se puede subir un solo día suelto sin borrar el histórico.
function mergeTareoByDate(existingRows, newRows){
  const newDates = new Set(newRows.map(r=>r.fecha));
  const kept = existingRows.filter(r=>!newDates.has(r.fecha));
  return kept.concat(newRows);
}

// Parsea el reporte de calibres a nivel pallet/caja (columnas F. Cosecha, Lote - Red, Variedad,
// Cajas Equi., CAL, CAT) y lo agrega al mismo formato que usa el reporte "Calibres y Peso Fruto":
// una fila por (fecha, Lote-Red, Variedad, Categoría) con el % de cada calibre europeo (8 al 34S)
// y el peso promedio ponderado (peso teórico = 4 kg ÷ N° de calibre). Se consideran cajas de
// Categoría I y Categoría II por separado.
const CAL_VALID_SET = new Set(['8','10','12','14','16','18','20','22','24','26','28','30','32S','34S']);

function parseCalibresRawRows(rows){
  if(!rows.length) return [];
  const sample = rows[0];
  const kFecha = findKey(sample, ['F. Cosecha','F Cosecha','Fecha Cosecha']);
  const kLoteRed = findKey(sample, ['Lote - Red','Lote-Red','LoteRed']);
  const kVar = findKey(sample, ['Variedad']);
  const kCajas = findKey(sample, ['Cajas Equi.','Cajas Equi','CajasEqui']);
  const kCal = findKey(sample, ['CAL']);
  const kCat = findKey(sample, ['CAT']);
  if(!kFecha || !kLoteRed || !kVar || !kCajas || !kCal || !kCat) throw new Error('Faltan columnas esperadas en el archivo de calibres (F. Cosecha, Lote - Red, Variedad, Cajas Equi., CAL, CAT).');

  // Categoría I y II, cada una agrupada por separado (fecha|loteRed|variedad|categoria) —
  // así el reporte puede mostrar cualquiera de las dos, o la suma de ambas, sin perder detalle.
  const CATEGORIAS_VALIDAS = new Set(['I','II']);
  const groups = new Map();
  rows.forEach(r=>{
    if(!r[kLoteRed]) return;
    const cat = String(r[kCat] ?? '').trim().toUpperCase();
    if(!CATEGORIAS_VALIDAS.has(cat)) return; // ignora otras categorías (III, descarte, etc.)
    const calRaw = String(r[kCal] ?? '').trim().toUpperCase();
    if(!CAL_VALID_SET.has(calRaw)) return; // descarta calibres fuera de 8–34S (36,48,MS,VA,DESCARTE, etc.)
    const cajas = parseFloat(r[kCajas]) || 0;
    const key = formatDateCell(r[kFecha]) + '|' + String(r[kLoteRed]).trim() + '|' + String(r[kVar]).trim().toUpperCase() + '|' + cat;
    if(!groups.has(key)) groups.set(key, { cajasPorCal: {}, total: 0 });
    const g = groups.get(key);
    g.cajasPorCal[calRaw] = (g.cajasPorCal[calRaw] || 0) + cajas;
    g.total += cajas;
  });

  const out = [];
  groups.forEach((g, key)=>{
    const [fecha, loteRed, variedad, categoria] = key.split('|');
    const cal = {};
    let peso = 0;
    CAL_KEYS.forEach(k=>{
      const kUp = k.toUpperCase();
      const pct = g.total > 0 ? (g.cajasPorCal[kUp] || 0) / g.total : 0;
      cal[k] = pct;
      const n = parseInt(k, 10); // '32s' -> 32, '34s' -> 34
      if(n) peso += pct * (4 / n);
    });
    out.push({ fecha, loteRed, variedad, categoria, cajas: g.total, peso, cal });
  });
  return out;
}

// Reemplaza en `calibres` solo las combinaciones (fecha, Lote-Red, Variedad, Categoría)
// presentes en `newRows`, conservando el resto del histórico ya guardado — igual que con
// el tareo, así se puede subir un solo día suelto sin perder los días anteriores.
function mergeCalibresByKey(existingRows, newRows){
  const keyOf = r => r.fecha+'|'+r.loteRed+'|'+r.variedad+'|'+(r.categoria||'I');
  const newKeys = new Set(newRows.map(keyOf));
  const kept = existingRows.filter(r=>!newKeys.has(keyOf(r)));
  return kept.concat(newRows);
}

// Parsea el comparativo de bines Lote-Red-Sector (columnas FECHA, grupoGen_LRS, GRUPO,
// UBICACION, REFERENCIA, VARIEDAD, CNT. BIN IND., CNT. BIN GRU., DIFERENCIA, CNT. BIN BAL.)
// al formato interno que usa calculos-bines.js.
function parseBinesRows(rows){
  if(!rows.length) return [];
  const sample = rows[0];
  const kFecha = findKey(sample, ['FECHA','Fecha']);
  const kGrupo = findKey(sample, ['grupoGen_LRS']);
  const kUbic = findKey(sample, ['UBICACION','Ubicación']);
  const kRef = findKey(sample, ['REFERENCIA']);
  const kVar = findKey(sample, ['VARIEDAD','Variedad']);
  const kInd = findKey(sample, ['CNT. BIN IND.','CNT BIN IND']);
  const kGru = findKey(sample, ['CNT. BIN GRU.','CNT BIN GRU']);
  const kBal = findKey(sample, ['CNT. BIN BAL.','CNT BIN BAL']);
  if(!kFecha || !kUbic || !kInd) throw new Error('Faltan columnas esperadas en el comparativo de bines (FECHA, UBICACION, CNT. BIN IND.).');
  return rows.filter(r=>r[kUbic]).map(r=>{
    const { lote, red, sector } = parseUbicacion(r[kUbic]);
    return {
      fecha: formatDateCell(r[kFecha]),
      grupoGenLRS: kGrupo ? String(r[kGrupo]||'').trim() : '',
      ubicacion: String(r[kUbic]).trim(),
      lote, red, sector,
      referencia: kRef ? String(r[kRef]||'').trim() : '',
      variedad: kVar ? String(r[kVar]||'').trim().toUpperCase() : '',
      cntBinInd: parseInt(r[kInd]) || 0,
      cntBinGru: kGru ? (parseInt(r[kGru]) || 0) : 0,
      cntBinBal: kBal ? (parseInt(r[kBal]) || 0) : 0,
    };
  });
}

// Reemplaza en `bines` solo las fechas presentes en `newRows`, igual que con tareo — así
// se puede subir un solo día suelto sin perder el histórico ya guardado.
function mergeBinesByDate(existingRows, newRows){
  const newDates = new Set(newRows.map(r=>r.fecha));
  const kept = existingRows.filter(r=>!newDates.has(r.fecha));
  return kept.concat(newRows);
}


/* ============ COLA DE ARCHIVOS DE TAREO (Palto) ============
   El input de archivo reemplaza la selección cada vez que se abre, así que los archivos se
   acumulan en esta lista: se pueden elegir en varias tandas (de distintas carpetas) o
   arrastrarlos al recuadro. Se ignoran repetidos (mismo nombre, tamaño y fecha). */
let tareoCola = [];
let tareoOmitidos = []; // archivos de la última carga que no se pudieron leer

function agregarATareoCola(files){
  const clave = f => f.name + '|' + f.size + '|' + f.lastModified;
  const existentes = new Set(tareoCola.map(clave));
  for(const f of files){
    if(!/\.xlsx?$/i.test(f.name)) continue;
    if(existentes.has(clave(f))) continue;
    tareoCola.push(f); existentes.add(clave(f));
  }
  tareoCola.sort((a,b)=> a.name.localeCompare(b.name, 'es', {numeric:true}));
  renderTareoCola();
}

function renderTareoCola(){
  const el = document.getElementById('tareoQueue');
  if(!el) return;
  if(!tareoCola.length){ el.innerHTML = '<span style="color:#8a8f83;">Ningún archivo en la lista.</span>'; return; }
  el.innerHTML = `<div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
      <b>${tareoCola.length} archivo${tareoCola.length>1?'s':''} para cargar</b>
      <button type="button" class="btn btn-ghost" id="tareoColaLimpiar" style="font-size:12px; padding:4px 10px;">Quitar todos</button>
    </div>
    <div style="max-height:180px; overflow:auto;">` +
    tareoCola.map((f,i)=>`<div style="display:flex; justify-content:space-between; gap:8px; padding:2px 0; border-bottom:1px solid var(--linea);">
      <span>${f.name}</span>
      <button type="button" data-quitar="${i}" title="Quitar de la lista" style="border:none; background:none; color:var(--rojo); cursor:pointer;">✕</button>
    </div>`).join('') + '</div>';
  document.getElementById('tareoColaLimpiar').addEventListener('click', ()=>{ tareoCola = []; renderTareoCola(); });
  el.querySelectorAll('button[data-quitar]').forEach(b=> b.addEventListener('click', ()=>{
    tareoCola.splice(parseInt(b.dataset.quitar,10), 1); renderTareoCola();
  }));
}

(function initTareoCola(){
  const input = document.getElementById('fileTareo');
  const zona = document.getElementById('tareoDropzone');
  if(!input || !zona) return;
  input.addEventListener('change', ()=>{ agregarATareoCola([...input.files]); input.value = ''; });
  zona.addEventListener('dragover', e=>{ e.preventDefault(); zona.style.borderColor = 'var(--pulpa)'; });
  zona.addEventListener('dragleave', ()=>{ zona.style.borderColor = 'var(--linea)'; });
  zona.addEventListener('drop', e=>{
    e.preventDefault(); zona.style.borderColor = 'var(--linea)';
    agregarATareoCola([...e.dataTransfer.files]);
  });
  renderTareoCola();
})();

document.getElementById('applyUpdate').addEventListener('click', async ()=>{
  const statusEl = document.getElementById('statusMsg');
  statusEl.className = 'status-msg';
  statusEl.textContent = '';
  if(currentRole !== 'admin'){
    statusEl.className='status-msg err'; statusEl.textContent='Solo un admin puede actualizar los datos.'; return;
  }
  const fileBal = document.getElementById('fileBalanza').files[0];
  const fileBalAra = document.getElementById('fileBalanzaArandano').files[0];
  const fileEstAra = document.getElementById('fileEstimacionArandano').files[0];
  const fileHaAra = document.getElementById('fileHectareasArandano').files[0];
  const fileCalAra = document.getElementById('fileCalibresArandano').files[0];
  const fileTareoAraList = [...document.getElementById('fileTareoArandano').files];
  const fileHa = document.getElementById('fileHectareas').files[0];
  const fileTareoList = [...tareoCola];
  const fileCal = document.getElementById('fileCalibres').files[0];
  const fileBines = document.getElementById('fileBines').files[0];
  if(!fileBal && !fileBalAra && !fileEstAra && !fileHaAra && !fileCalAra && !fileTareoAraList.length && !fileHa && !fileTareoList.length && !fileCal && !fileBines){
    statusEl.className='status-msg err'; statusEl.textContent='Selecciona al menos un archivo Excel para actualizar.'; return;
  }
  statusEl.className='status-msg'; statusEl.textContent='Leyendo archivo(s)…';
  try{
    if(fileBal){
      const rows = await readExcelFile(fileBal);
      const parsed = parseBalanzaRows(rows);
      if(!parsed.length) throw new Error('El Excel de balanza no tiene filas válidas.');
      const { error } = await sb.from('balanza_data').update({ data: parsed, updated_by: currentUser.email }).eq('id', 1);
      if(error) throw new Error(error.message);
      balanzaPalto = parsed;
      if(cultivoActivo === 'palto') balanza = balanzaPalto;
    }
    if(fileBalAra){
      const rows = await readExcelFile(fileBalAra);
      const parsed = parseBalanzaArandanoRows(rows);
      if(!parsed.length) throw new Error('El Excel de balanza de arándano no tiene filas válidas.');
      const { error } = await sb.from('balanza_arandano_data').update({ data: parsed, updated_by: currentUser.email }).eq('id', 1);
      if(error) throw new Error(error.message);
      balanzaArandano = parsed;
      if(cultivoActivo === 'arandano') balanza = balanzaArandano;
    }
    if(fileEstAra){
      const rows = await readEstimacionArandanoWorkbook(fileEstAra);
      const parsed = parseEstimacionArandanoLoteRedRows(rows);
      if(!parsed.length) throw new Error('El Excel de presupuesto de Arándano no tiene filas válidas.');
      const { error } = await sb.from('estimacion_arandano_lotered_data').update({ data: parsed, updated_by: currentUser.email }).eq('id', 1);
      if(error) throw new Error(error.message);
      estimacionArandanoLoteRed = parsed;
    }
    if(fileHaAra){
      const rows = await readExcelFile(fileHaAra);
      const parsed = parseHectareasArandanoRows(rows);
      if(!parsed.length) throw new Error('El Excel de avance de campo de Arándano no tiene filas válidas.');
      const { error } = await sb.from('hectareas_arandano_data').update({ data: parsed, updated_by: currentUser.email }).eq('id', 1);
      if(error) throw new Error(error.message);
      hectareasArandano = parsed;
    }
    if(fileCalAra){
      const rows = await readExcelFile(fileCalAra);
      const parsed = parseCalibresArandanoRawRows(rows);
      if(!parsed.length) throw new Error('El Excel de calibres de Arándano no tiene filas válidas.');
      const merged = mergeCalibresArandanoByKey(calibresArandano, parsed);
      const { error } = await sb.from('calibres_arandano_data').update({ data: merged, updated_by: currentUser.email }).eq('id', 1);
      if(error) throw new Error(error.message);
      calibresArandano = merged;
    }
    if(fileTareoAraList.length){
      let rows = [];
      for(let i=0; i<fileTareoAraList.length; i++){
        statusEl.textContent = `Leyendo tareo Arándano (${i+1} de ${fileTareoAraList.length})…`;
        rows = rows.concat(await readTareoWorkbook(fileTareoAraList[i]));
      }
      const parsed = parseTareoArandanoRows(rows);
      if(!parsed.length) throw new Error('El/los Excel de tareo de Arándano no tienen filas válidas de cosechadores, líderes o supervisores.');
      const merged = mergeTareoByDate(tareoArandano, parsed);
      const { error } = await sb.from('tareo_arandano_data').update({ data: merged, updated_by: currentUser.email }).eq('id', 1);
      if(error) throw new Error(error.message);
      tareoArandano = merged;
    }
    if(fileHa){
      const rows = await readExcelFile(fileHa);
      const parsed = parseHectareasRows(rows);
      if(!parsed.length) throw new Error('El Excel de hectáreas no tiene filas válidas.');
      const { error } = await sb.from('hectareas_data').update({ data: parsed, updated_by: currentUser.email }).eq('id', 1);
      if(error) throw new Error(error.message);
      hectareas = parsed;
    }
    if(fileTareoList.length){
      // Los reportes de cosecha de RR.HH. son acumulativos (el del 9-9 repite las hojas del
      // 26.08 al 08.09). Si se suben varios a la vez, cada fecha se toma de UN solo archivo —
      // el más reciente (el que llega a la fecha más avanzada) — para no duplicar trabajadores.
      const leidos = [];
      tareoOmitidos = [];
      for(let i=0; i<fileTareoList.length; i++){
        statusEl.textContent = `Leyendo tareo (${i+1} de ${fileTareoList.length})…`;
        try{
          const filas = parseTareoRows(await readTareoWorkbook(fileTareoList[i]));
          const maxFecha = filas.reduce((m,r)=> r.fecha > m ? r.fecha : m, '');
          leidos.push({ nombre: fileTareoList[i].name, maxFecha, filas });
        }catch(err){
          // Un archivo con formato distinto no debe frenar la carga del resto.
          tareoOmitidos.push(fileTareoList[i].name + ': ' + err.message);
        }
      }
      leidos.sort((a,b)=> a.maxFecha.localeCompare(b.maxFecha) || a.nombre.localeCompare(b.nombre, 'es', {numeric:true}));
      const porFecha = new Map(); // fecha -> filas del archivo más reciente que la trae
      for(const archivo of leidos){
        const grupos = new Map();
        archivo.filas.forEach(r=>{ if(!grupos.has(r.fecha)) grupos.set(r.fecha, []); grupos.get(r.fecha).push(r); });
        grupos.forEach((filas, fecha)=> porFecha.set(fecha, filas));
      }
      const parsed = [...porFecha.values()].flat();
      if(!parsed.length) throw new Error('El/los Excel de tareo no tienen filas válidas de jornales/tacheros.');
      const merged = mergeTareoByDate(tareo, parsed);
      const { error } = await sb.from('tareo_data').update({ data: merged, updated_by: currentUser.email }).eq('id', 1);
      if(error) throw new Error(error.message);
      tareo = merged;
    }
    if(fileCal){
      const rows = await readExcelFile(fileCal);
      const parsed = parseCalibresRawRows(rows);
      if(!parsed.length) throw new Error('El Excel de calibres no tiene filas válidas de Categoría I o II.');
      const merged = mergeCalibresByKey(calibres, parsed);
      const { error } = await sb.from('calibres_data').update({ data: merged, updated_by: currentUser.email }).eq('id', 1);
      if(error) throw new Error(error.message);
      calibres = merged;
    }
    if(fileBines){
      const rows = await readExcelFile(fileBines);
      const parsed = parseBinesRows(rows);
      if(!parsed.length) throw new Error('El Excel de comparativo de bines no tiene filas válidas.');
      const merged = mergeBinesByDate(bines, parsed);
      const { error } = await sb.from('bines_data').update({ data: merged, updated_by: currentUser.email }).eq('id', 1);
      if(error) throw new Error(error.message);
      bines = merged;
    }
    const stamp = new Date().toLocaleString('es-PE', {dateStyle:'short', timeStyle:'short'});
    document.getElementById('updatedChip').textContent = 'Datos actualizados: ' + stamp;
    statusEl.className='status-msg ok'; statusEl.textContent='Datos guardados y aplicados para todos los usuarios.';
    if(fileTareoList.length && tareoOmitidos.length){
      statusEl.textContent += ` Se omitieron ${tareoOmitidos.length} archivo(s) de tareo: ` + tareoOmitidos.join(' | ');
    }
    document.getElementById('fileBalanza').value = '';
    document.getElementById('fileBalanzaArandano').value = '';
    document.getElementById('fileEstimacionArandano').value = '';
    document.getElementById('fileHectareasArandano').value = '';
    document.getElementById('fileCalibresArandano').value = '';
    document.getElementById('fileTareoArandano').value = '';
    document.getElementById('fileHectareas').value = '';
    document.getElementById('fileTareo').value = '';
    tareoCola = []; renderTareoCola();
    document.getElementById('fileCalibres').value = '';
    document.getElementById('fileBines').value = '';
    renderAll();
  }catch(err){
    statusEl.className='status-msg err'; statusEl.textContent='Error: ' + err.message;
  }
});
