/* ============ PAGE 5c: CALIBRES Y PESO DE FRUTO ============ */
const CAL_KEYS = ['8','10','12','14','16','18','20','22','24','26','28','30','32s','34s'];

function calLoteOf(loteRed){ return (loteRed||'').split('-')[0]; }
function calRedOf(loteRed){ const p=(loteRed||'').split('-'); return p[p.length-1]; }

function populateCalibresFilters(){
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

function exportCalibresToExcel(){
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

document.getElementById('f6-lote').addEventListener('change', ()=>{ calibresPage = 0; populateCalibresFilters(); renderCalibres(); });
document.getElementById('f6-red').addEventListener('change', ()=>{ calibresPage = 0; renderCalibres(); });
document.getElementById('f6-categoria').addEventListener('change', ()=>{ calibresPage = 0; renderCalibres(); });
document.getElementById('f6-fecha').addEventListener('change', ()=>{ calibresPage = 0; renderCalibres(); });
document.getElementById('f6-pageSize').addEventListener('change', ()=>{ calibresPage = 0; renderCalibres(); });
document.getElementById('f6-fechaClear').addEventListener('click', ()=>{
  document.getElementById('f6-fecha').value = '';
  calibresPage = 0;
  renderCalibres();
});
document.getElementById('exportCalibresBtn').addEventListener('click', exportCalibresToExcel);

