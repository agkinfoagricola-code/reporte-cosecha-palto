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
            if(candidate.length && findKey(candidate[0], ['FECHA','Fecha']) && findKey(candidate[0], ['CODIGO','Codigo'])){
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
    out.push({ fecha: formatDateCell(r[kFecha]), codigo, codlab, horas });
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

document.getElementById('applyUpdate').addEventListener('click', async ()=>{
  const statusEl = document.getElementById('statusMsg');
  statusEl.className = 'status-msg';
  statusEl.textContent = '';
  if(currentRole !== 'admin'){
    statusEl.className='status-msg err'; statusEl.textContent='Solo un admin puede actualizar los datos.'; return;
  }
  const fileBal = document.getElementById('fileBalanza').files[0];
  const fileBalAra = document.getElementById('fileBalanzaArandano').files[0];
  const fileHa = document.getElementById('fileHectareas').files[0];
  const fileTareo = document.getElementById('fileTareo').files[0];
  const fileCal = document.getElementById('fileCalibres').files[0];
  const fileBines = document.getElementById('fileBines').files[0];
  if(!fileBal && !fileBalAra && !fileHa && !fileTareo && !fileCal && !fileBines){
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
    if(fileHa){
      const rows = await readExcelFile(fileHa);
      const parsed = parseHectareasRows(rows);
      if(!parsed.length) throw new Error('El Excel de hectáreas no tiene filas válidas.');
      const { error } = await sb.from('hectareas_data').update({ data: parsed, updated_by: currentUser.email }).eq('id', 1);
      if(error) throw new Error(error.message);
      hectareas = parsed;
    }
    if(fileTareo){
      const rows = await readTareoWorkbook(fileTareo);
      const parsed = parseTareoRows(rows);
      if(!parsed.length) throw new Error('El Excel de tareo no tiene filas válidas de jornales/tacheros.');
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
    document.getElementById('fileBalanza').value = '';
    document.getElementById('fileBalanzaArandano').value = '';
    document.getElementById('fileHectareas').value = '';
    document.getElementById('fileTareo').value = '';
    document.getElementById('fileCalibres').value = '';
    document.getElementById('fileBines').value = '';
    renderAll();
  }catch(err){
    statusEl.className='status-msg err'; statusEl.textContent='Error: ' + err.message;
  }
});
