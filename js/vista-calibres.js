/* ============ PAGE 5c: CALIBRES Y PESO DE FRUTO ============ */
const CAL_KEYS = ['8','10','12','14','16','18','20','22','24','26','28','30','32s','34s'];

function calLoteOf(loteRed){ return (loteRed||'').split('-')[0]; }
function calRedOf(loteRed){ const p=(loteRed||'').split('-'); return p[p.length-1]; }

function populateCalibresFilters(){
  if(cultivoActivo === 'arandano'){ populateCalibresFiltersArandano(); return; }
  const selLote = document.getElementById('f6-lote');
  const lotes = uniq(calibres.map(d=>calLoteOf(d.loteRed))).sort((a,b)=>Number(a)-Number(b));
  const prevLote = selLote.value;
  selLote.innerHTML = '<option value="">Todos los lotes</option>' + lotes.map(l=>`<option value="${l}">Lote ${l}</option>`).join('');
  if(lotes.includes(prevLote)) selLote.value = prevLote;

  const loteSel = selLote.value;
  const rowsForLote = loteSel ? calibres.filter(d=>calLoteOf(d.loteRed)===loteSel) : calibres;
  const reds = uniq(rowsForLote.map(d=>calRedOf(d.loteRed)));
  const selRed = document.getElementById('f6-red');
  const prevRed = selRed.value;
  selRed.innerHTML = '<option value="">Todas las redes</option>' + reds.map(r=>`<option value="${r}">${r}</option>`).join('');
  if(reds.includes(prevRed)) selRed.value = prevRed;
}

let lastCalibresRows = [];
let calibresPage = 0; // página actual de "Detalle de calibres y peso promedio"

// Combina Categoría I + II fila a fila (mismo fecha+loteRed+variedad): suma cajas, y
// recalcula el % de cada calibre y el peso promedio ponderados por la cantidad de cajas
// de cada categoría — no es un simple promedio 50/50 entre ambas.
function combinarCategorias(rows){
  const groups = new Map();
  rows.forEach(r=>{
    const key = r.fecha+'|'+r.loteRed+'|'+r.variedad;
    if(!groups.has(key)) groups.set(key, { fecha:r.fecha, loteRed:r.loteRed, variedad:r.variedad, cajas:0, pesoSum:0, calSum:{} });
    const g = groups.get(key);
    g.cajas += r.cajas;
    g.pesoSum += r.peso * r.cajas;
    CAL_KEYS.forEach(k=>{ g.calSum[k] = (g.calSum[k]||0) + (r.cal[k]||0) * r.cajas; });
  });
  return [...groups.values()].map(g=>{
    const cal = {};
    CAL_KEYS.forEach(k=>{ cal[k] = g.cajas>0 ? g.calSum[k]/g.cajas : 0; });
    return { fecha:g.fecha, loteRed:g.loteRed, variedad:g.variedad, categoria:'total', cajas:g.cajas, peso: g.cajas>0 ? g.pesoSum/g.cajas : 0, cal };
  });
}

function calibresFiltered(){
  const fLote = document.getElementById('f6-lote').value;
  const fRed = document.getElementById('f6-red').value;
  const fCategoria = document.getElementById('f6-categoria').value; // 'I' | 'II' | 'total'
  const fFecha = document.getElementById('f6-fecha').value;
  let rows = calibres.filter(d=>{
    if(fLote && calLoteOf(d.loteRed)!==fLote) return false;
    if(fRed && calRedOf(d.loteRed)!==fRed) return false;
    if(activeVariedades.length && !matchVariedad(d.variedad)) return false;
    if(fCategoria !== 'total' && (d.categoria||'I') !== fCategoria) return false;
    if(fFecha && d.fecha !== fFecha) return false;
    return true;
  });
  if(fCategoria === 'total') rows = combinarCategorias(rows);
  return rows.sort((a,b)=> a.fecha===b.fecha ? a.loteRed.localeCompare(b.loteRed) : (a.fecha < b.fecha ? 1 : -1));
}

function renderCalibres(){
  if(cultivoActivo === 'arandano'){ renderCalibresArandano(); return; }
  const rows = calibresFiltered();
  lastCalibresRows = rows;
  const fCategoriaLabel = { I: '(Cat. I)', II: '(Cat. II)', total: '(Cat. I + II)' }[document.getElementById('f6-categoria').value];
  document.getElementById('calDistCatLabel').textContent = fCategoriaLabel;
  const tbl = document.getElementById('tableCalibres');
  if(!rows.length){ tbl.innerHTML = '<tr><td>Sin datos para el filtro seleccionado.</td></tr>'; charts['chartCalibresPeso'] && charts['chartCalibresPeso'].destroy(); charts['chartCalibresDist'] && charts['chartCalibresDist'].destroy(); return; }

  const headCals = CAL_KEYS.map(c=>`<th>Cal. ${c}</th>`).join('');
  let html = `<tr><th style="white-space:nowrap;">Fecha</th><th>Lote-Red</th><th>Variedad</th><th>Cajas Eq.</th><th>Peso Prom. (g)</th>${headCals}</tr>`;

  // Paginación: la tabla puede tener miles de filas (fecha x lote-red x variedad).
  const pageSizeSelC = document.getElementById('f6-pageSize');
  const pageSizeC = pageSizeSelC.value === 'todas' ? rows.length || 1 : parseInt(pageSizeSelC.value);
  const totalPaginasC = Math.max(1, Math.ceil(rows.length / pageSizeC));
  if(calibresPage >= totalPaginasC) calibresPage = totalPaginasC - 1;
  if(calibresPage < 0) calibresPage = 0;
  const rowsPagina = rows.slice(calibresPage*pageSizeC, calibresPage*pageSizeC + pageSizeC);

  rowsPagina.forEach(r=>{
    // Mapa de calor por fila: qué calibre concentró más % de esa cosecha ese día/lote-red,
    // en tonos verdes (más intenso = mayor %).
    const maxCalFila = Math.max(0, ...CAL_KEYS.map(c=> r.cal[c]||0));
    const cals = CAL_KEYS.map(c=>{
      const v = r.cal[c] || 0;
      const bg = heatShade(v, maxCalFila, '27,107,60');
      const color = maxCalFila>0 && v/maxCalFila > 0.55 ? '#fff' : 'inherit';
      return `<td style="background:${bg}; color:${color};">${v ? (v*100).toFixed(1)+'%' : '-'}</td>`;
    }).join('');
    html += `<tr><td style="white-space:nowrap;">${r.fecha}</td><td>${r.loteRed}</td><td>${r.variedad}</td><td>${fmt(r.cajas)}</td><td>${fmt(r.peso*1000)}</td>${cals}</tr>`;
  });
  tbl.innerHTML = html;

  const pagerElC = document.getElementById('calibresPager');
  if(totalPaginasC <= 1){
    pagerElC.innerHTML = '';
  } else {
    pagerElC.innerHTML = `
      <button class="btn btn-ghost" id="calibresPrev" style="padding:6px 12px;" ${calibresPage===0?'disabled':''}>‹ Anterior</button>
      <span>Página ${calibresPage+1} de ${totalPaginasC} <span style="color:#8a8f83;">(${rows.length} filas)</span></span>
      <button class="btn btn-ghost" id="calibresNext" style="padding:6px 12px;" ${calibresPage>=totalPaginasC-1?'disabled':''}>Siguiente ›</button>`;
    document.getElementById('calibresPrev').addEventListener('click', ()=>{ calibresPage--; renderCalibres(); });
    document.getElementById('calibresNext').addEventListener('click', ()=>{ calibresPage++; renderCalibres(); });
  }

  // Chart 1: peso promedio a lo largo del tiempo (todas las fechas, orden cronológico)
  const byDate = new Map();
  rows.forEach(r=>{
    if(!byDate.has(r.fecha)) byDate.set(r.fecha, {sum:0,wsum:0});
    const o = byDate.get(r.fecha);
    o.sum += r.peso * r.cajas;
    o.wsum += r.cajas;
  });
  const fechas = [...byDate.keys()].sort();
  const pesos = fechas.map(f=>{ const o=byDate.get(f); return o.wsum ? +(o.sum/o.wsum).toFixed(4) : 0; });
  drawBar('chartCalibresPeso', fechas, pesos, 'Peso Prom. (kg)', '#8B5E3C', true, false, false, 2);

  // Chart 2: distribución ponderada de calibres (Cat I) para el filtro actual
  let totalCajas = 0;
  const calSums = {}; CAL_KEYS.forEach(c=>calSums[c]=0);
  rows.forEach(r=>{
    totalCajas += r.cajas;
    CAL_KEYS.forEach(c=>{ calSums[c] += (r.cal[c]||0) * r.cajas; });
  });
  const distData = CAL_KEYS.map(c=> totalCajas ? +((calSums[c]/totalCajas)*100).toFixed(2) : 0);
  if(charts['chartCalibresDist']) charts['chartCalibresDist'].destroy();
  const ctx2 = document.getElementById('chartCalibresDist').getContext('2d');

  // Plugin liviano: dibuja el % de cada barra justo encima (los valores ya son %, no
  // hace falta dividir contra un total como en percentLabelsPlugin de charts.js).
  const distLabelsPlugin = {
    id: 'distLabels',
    afterDatasetsDraw(chart){
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = "600 11px 'Inter', sans-serif";
      ctx.fillStyle = '#1B6B3C';
      ctx.textAlign = 'center';
      meta.data.forEach((bar, i)=>{
        if(!distData[i]) return;
        ctx.fillText(distData[i].toFixed(1)+'%', bar.x, bar.y - 6);
      });
      ctx.restore();
    }
  };

  charts['chartCalibresDist'] = new Chart(ctx2, {
    type:'bar',
    data:{ labels: CAL_KEYS.map(c=>'Cal. '+c), datasets:[{ label:'% del total', data:distData, backgroundColor:'#3F9E64', borderRadius:4, maxBarThickness:36 }]},
    plugins:[distLabelsPlugin],
    options:{
      responsive:true, maintainAspectRatio:false,
      layout:{ padding:{ top: 20 } },
      plugins:{ legend:{display:false} },
      scales:{ y:{ ticks:{ callback:v=>v+'%' }, grid:{color:'#EFEBDD'} }, x:{ grid:{display:false} } }
    }
  });
}

/* ============ ARÁNDANO: Calibres (por milímetro, sin peso teórico) ============
   Mismo diseño que Palto (tabla + heat map + distribución), pero:
   - El calibre es por milímetro (11mm+ al 19mm+), no N° de fruto/caja, así que NO hay una
     fórmula de "peso teórico" como en Palto (4kg ÷ N° calibre) — esta vista no muestra peso.
   - Las categorías son 'I' y 'S/C' (sin categoría / mercado nacional), no 'I'/'II'. */

function populateCalibresFiltersArandano(){
  const selLote = document.getElementById('f6-lote');
  const lotes = uniq(calibresArandano.map(d=>calLoteOf(d.loteRed))).sort((a,b)=>Number(a)-Number(b));
  const prevLote = selLote.value;
  selLote.innerHTML = '<option value="">Todos los lotes</option>' + lotes.map(l=>`<option value="${l}">Lote ${l}</option>`).join('');
  if(lotes.includes(prevLote)) selLote.value = prevLote;

  const loteSel = selLote.value;
  const rowsForLote = loteSel ? calibresArandano.filter(d=>calLoteOf(d.loteRed)===loteSel) : calibresArandano;
  const reds = uniq(rowsForLote.map(d=>calRedOf(d.loteRed)));
  const selRed = document.getElementById('f6-red');
  const prevRed = selRed.value;
  selRed.innerHTML = '<option value="">Todas las redes</option>' + reds.map(r=>`<option value="${r}">${r}</option>`).join('');
  if(reds.includes(prevRed)) selRed.value = prevRed;

  // Categorías propias de Arándano: I (exportable) y S/C (sin categoría / mercado nacional).
  const selCat = document.getElementById('f6-categoria');
  const prevCat = selCat.value;
  selCat.innerHTML = `<option value="I">Categoría I</option>
    <option value="S/C">Sin categoría (Merc. Nacional)</option>
    <option value="total">Total (I + S/C)</option>`;
  selCat.value = ['I','S/C','total'].includes(prevCat) ? prevCat : 'I';
}

// Combina Categoría I + S/C fila a fila (mismo fecha+loteRed+variedad): suma cajas y
// recalcula el % de cada calibre ponderado por la cantidad de cajas de cada categoría.
function combinarCategoriasArandano(rows){
  const groups = new Map();
  rows.forEach(r=>{
    const key = r.fecha+'|'+r.loteRed+'|'+r.variedad;
    if(!groups.has(key)) groups.set(key, { fecha:r.fecha, loteRed:r.loteRed, variedad:r.variedad, cajas:0, calSum:{} });
    const g = groups.get(key);
    g.cajas += r.cajas;
    CAL_KEYS_ARANDANO.forEach(k=>{ g.calSum[k] = (g.calSum[k]||0) + (r.cal[k]||0) * r.cajas; });
  });
  return [...groups.values()].map(g=>{
    const cal = {};
    CAL_KEYS_ARANDANO.forEach(k=>{ cal[k] = g.cajas>0 ? g.calSum[k]/g.cajas : 0; });
    return { fecha:g.fecha, loteRed:g.loteRed, variedad:g.variedad, categoria:'total', cajas:g.cajas, cal };
  });
}

function calibresArandanoFiltered(){
  const fLote = document.getElementById('f6-lote').value;
  const fRed = document.getElementById('f6-red').value;
  const fCategoria = document.getElementById('f6-categoria').value || 'I'; // 'I' | 'S/C' | 'total'
  const fFecha = document.getElementById('f6-fecha').value;
  let rows = calibresArandano.filter(d=>{
    if(fLote && calLoteOf(d.loteRed)!==fLote) return false;
    if(fRed && calRedOf(d.loteRed)!==fRed) return false;
    if(activeVariedades.length && !matchVariedad(d.variedad)) return false;
    if(fCategoria !== 'total' && (d.categoria||'I') !== fCategoria) return false;
    if(fFecha && d.fecha !== fFecha) return false;
    return true;
  });
  if(fCategoria === 'total') rows = combinarCategoriasArandano(rows);
  return rows.sort((a,b)=> a.fecha===b.fecha ? a.loteRed.localeCompare(b.loteRed) : (a.fecha < b.fecha ? 1 : -1));
}

let lastCalibresArandanoRows = [];
let calibresArandanoPage = 0;

function renderCalibresArandano(){
  const rows = calibresArandanoFiltered();
  lastCalibresArandanoRows = rows;
  const fCategoriaLabel = { 'I': '(Cat. I)', 'S/C': '(Sin categoría)', total: '(Cat. I + S/C)' }[document.getElementById('f6-categoria').value || 'I'];
  document.getElementById('calDistCatLabel').textContent = fCategoriaLabel;
  const chartPesoTitle = document.getElementById('chartCalibresPesoTitle');
  if(chartPesoTitle) chartPesoTitle.innerHTML = 'Cajas Equivalentes por Lote-Red <span class="tag">todas las fechas</span>';
  const detailTitle = document.getElementById('calibresDetailTitle');
  if(detailTitle) detailTitle.textContent = 'Detalle de calibres por Lote-Red y fecha';

  const tbl = document.getElementById('tableCalibres');
  if(!rows.length){
    tbl.innerHTML = '<tr><td>Sin datos para el filtro seleccionado.</td></tr>';
    charts['chartCalibresPeso'] && charts['chartCalibresPeso'].destroy();
    charts['chartCalibresDist'] && charts['chartCalibresDist'].destroy();
    document.getElementById('calibresPager').innerHTML = '';
    return;
  }

  const headCals = CAL_KEYS_ARANDANO.map(c=>`<th>${c}</th>`).join('');
  let html = `<tr><th style="white-space:nowrap;">Fecha</th><th>Lote-Red</th><th>Variedad</th><th>Cajas Eq.</th>${headCals}</tr>`;

  const pageSizeSelC = document.getElementById('f6-pageSize');
  const pageSizeC = pageSizeSelC.value === 'todas' ? rows.length || 1 : parseInt(pageSizeSelC.value);
  const totalPaginasC = Math.max(1, Math.ceil(rows.length / pageSizeC));
  if(calibresArandanoPage >= totalPaginasC) calibresArandanoPage = totalPaginasC - 1;
  if(calibresArandanoPage < 0) calibresArandanoPage = 0;
  const rowsPagina = rows.slice(calibresArandanoPage*pageSizeC, calibresArandanoPage*pageSizeC + pageSizeC);

  rowsPagina.forEach(r=>{
    const maxCalFila = Math.max(0, ...CAL_KEYS_ARANDANO.map(c=> r.cal[c]||0));
    const cals = CAL_KEYS_ARANDANO.map(c=>{
      const v = r.cal[c] || 0;
      const bg = heatShade(v, maxCalFila, '110,63,139');
      const color = maxCalFila>0 && v/maxCalFila > 0.55 ? '#fff' : 'inherit';
      return `<td style="background:${bg}; color:${color};">${v ? (v*100).toFixed(1)+'%' : '-'}</td>`;
    }).join('');
    html += `<tr><td style="white-space:nowrap;">${r.fecha}</td><td>${r.loteRed}</td><td>${r.variedad}</td><td>${fmt(r.cajas)}</td>${cals}</tr>`;
  });
  tbl.innerHTML = html;

  const pagerElC = document.getElementById('calibresPager');
  if(totalPaginasC <= 1){
    pagerElC.innerHTML = '';
  } else {
    pagerElC.innerHTML = `
      <button class="btn btn-ghost" id="calibresPrev" style="padding:6px 12px;" ${calibresArandanoPage===0?'disabled':''}>‹ Anterior</button>
      <span>Página ${calibresArandanoPage+1} de ${totalPaginasC} <span style="color:#8a8f83;">(${rows.length} filas)</span></span>
      <button class="btn btn-ghost" id="calibresNext" style="padding:6px 12px;" ${calibresArandanoPage>=totalPaginasC-1?'disabled':''}>Siguiente ›</button>`;
    document.getElementById('calibresPrev').addEventListener('click', ()=>{ calibresArandanoPage--; renderCalibresArandano(); });
    document.getElementById('calibresNext').addEventListener('click', ()=>{ calibresArandanoPage++; renderCalibresArandano(); });
  }

  // Chart 1: Cajas Equivalentes por fecha (reemplaza el de "Peso Prom." de Palto, que no aplica).
  const byDate = new Map();
  rows.forEach(r=>{ byDate.set(r.fecha, (byDate.get(r.fecha)||0) + r.cajas); });
  const fechas = [...byDate.keys()].sort();
  const cajasPorFecha = fechas.map(f=>+byDate.get(f).toFixed(1));
  drawBar('chartCalibresPeso', fechas, cajasPorFecha, 'Cajas Eq.', getThemeColor('--aguacate', '#6E3F8B'), false, false, false, 2);

  // Chart 2: distribución ponderada de calibres para el filtro actual.
  let totalCajas = 0;
  const calSums = {}; CAL_KEYS_ARANDANO.forEach(c=>calSums[c]=0);
  rows.forEach(r=>{
    totalCajas += r.cajas;
    CAL_KEYS_ARANDANO.forEach(c=>{ calSums[c] += (r.cal[c]||0) * r.cajas; });
  });
  const distData = CAL_KEYS_ARANDANO.map(c=> totalCajas ? +((calSums[c]/totalCajas)*100).toFixed(2) : 0);
  if(charts['chartCalibresDist']) charts['chartCalibresDist'].destroy();
  const ctx2 = document.getElementById('chartCalibresDist').getContext('2d');

  const distLabelsPlugin = {
    id: 'distLabelsArandano',
    afterDatasetsDraw(chart){
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = "600 11px 'Inter', sans-serif";
      ctx.fillStyle = '#5B2A86';
      ctx.textAlign = 'center';
      meta.data.forEach((bar, i)=>{
        if(!distData[i]) return;
        ctx.fillText(distData[i].toFixed(1)+'%', bar.x, bar.y - 6);
      });
      ctx.restore();
    }
  };

  charts['chartCalibresDist'] = new Chart(ctx2, {
    type:'bar',
    data:{ labels: CAL_KEYS_ARANDANO, datasets:[{ label:'% del total', data:distData, backgroundColor:'#8A5BB4', borderRadius:4, maxBarThickness:36 }]},
    plugins:[distLabelsPlugin],
    options:{
      responsive:true, maintainAspectRatio:false,
      layout:{ padding:{ top: 20 } },
      plugins:{ legend:{display:false} },
      scales:{ y:{ ticks:{ callback:v=>v+'%' }, grid:{color:'#EFEBDD'} }, x:{ grid:{display:false} } }
    }
  });
}

function exportCalibresArandanoToExcel(){
  if(!lastCalibresArandanoRows.length){
    alert('No hay datos para exportar todavía.');
    return;
  }
  const headers = ['Fecha','Lote-Red','Variedad','Categoría','Cajas Eq.', ...CAL_KEYS_ARANDANO.map(c=>'% '+c)];
  const aoa = [headers];
  lastCalibresArandanoRows.forEach(r=>{
    const catLabel = r.categoria==='total' ? 'I + S/C' : (r.categoria || 'I');
    aoa.push([r.fecha, r.loteRed, r.variedad, catLabel, round1(r.cajas), ...CAL_KEYS_ARANDANO.map(c=> r.cal[c] ? round1(r.cal[c]*100) : 0)]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h,i)=> i===1 ? {wch:12} : {wch: Math.max(h.length+2, 10)});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Calibres Arándano');
  const stamp = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `Calibres_Arandano_${stamp}.xlsx`);
}

function exportCalibresToExcel(){
  if(cultivoActivo === 'arandano'){ exportCalibresArandanoToExcel(); return; }
  if(!lastCalibresRows.length){
    alert('No hay datos para exportar todavía.');
    return;
  }
  const headers = ['Fecha','Lote-Red','Variedad','Categoría','Cajas Eq.','Peso Prom. (g)', ...CAL_KEYS.map(c=>'% Cal. '+c)];
  const aoa = [headers];
  lastCalibresRows.forEach(r=>{
    const catLabel = r.categoria==='total' ? 'I + II' : (r.categoria || 'I');
    aoa.push([r.fecha, r.loteRed, r.variedad, catLabel, round1(r.cajas), round1(r.peso*1000), ...CAL_KEYS.map(c=> r.cal[c] ? round1(r.cal[c]*100) : 0)]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h,i)=> i===1 ? {wch:12} : {wch: Math.max(h.length+2, 10)});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Calibres y Peso');
  const stamp = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `Calibres_y_Peso_Fruto_${stamp}.xlsx`);
}

document.getElementById('f6-lote').addEventListener('change', ()=>{ calibresPage = 0; calibresArandanoPage = 0; populateCalibresFilters(); renderCalibres(); });
document.getElementById('f6-red').addEventListener('change', ()=>{ calibresPage = 0; calibresArandanoPage = 0; renderCalibres(); });
document.getElementById('f6-categoria').addEventListener('change', ()=>{ calibresPage = 0; calibresArandanoPage = 0; renderCalibres(); });
document.getElementById('f6-fecha').addEventListener('change', ()=>{ calibresPage = 0; calibresArandanoPage = 0; renderCalibres(); });
document.getElementById('f6-pageSize').addEventListener('change', ()=>{ calibresPage = 0; calibresArandanoPage = 0; renderCalibres(); });
document.getElementById('f6-fechaClear').addEventListener('click', ()=>{
  document.getElementById('f6-fecha').value = '';
  calibresPage = 0;
  calibresArandanoPage = 0;
  renderCalibres();
});
document.getElementById('exportCalibresBtn').addEventListener('click', exportCalibresToExcel);

