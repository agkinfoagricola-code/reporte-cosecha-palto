/* Días de ciclo: última pasada conocida a la fecha de consulta.
   La referencia del 01/10/2026 complementa el historial de avances cargado.
   Pasada es el número reportado, no el conteo de fechas disponibles. */

function fechaConsultaCiclo(){
  return document.getElementById('f8-fecha').value || new Date().toISOString().slice(0,10);
}
function computeCiclosPorSector(fechaConsulta = fechaConsultaCiclo()){
  const grupos = new Map();
  avancesArandanoConReferencia().forEach(h=>{
    if(!h.lote || !h.red || !h.sector || !h.fecha || h.fecha > fechaConsulta) return;
    const key = [h.lote,h.red,h.sector,h.variedad].join('|');
    if(!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(h);
  });
  return [...grupos.values()].map(registros=>{
    registros.sort((a,b)=>a.fecha.localeCompare(b.fecha) || Number(!!a.referencia)-Number(!!b.referencia));
    const ultimo = registros[registros.length-1];
    const fechas = [...new Set(registros.map(h=>h.fecha))].sort();
    const ciclos = fechas.slice(1).map((f,i)=>daysBetween(fechas[i],f)).filter(d=>d>0);
    const cicloProm = ciclos.length ? ciclos.reduce((a,b)=>a+b,0)/ciclos.length : null;
    const diasDesdeUltimo = daysBetween(ultimo.fecha, fechaConsulta);
    return {...ultimo, fechas, ciclos, nCosechas:fechas.length,
      ultimaFecha:ultimo.fecha, fechaInicio:ultimo.fechaInicio || ultimo.fecha,
      pasada:ultimo.pasada ?? null, haAvan:ultimo.haAvan ?? null,
      cicloProm, diasDesdeUltimo,
      atrasado:cicloProm != null && diasDesdeUltimo > cicloProm};
  });
}
function encabezadosCiclo(){
  const fecha = new Date(fechaConsultaCiclo()+'T12:00:00Z');
  const dia = new Intl.DateTimeFormat('es-PE', {weekday:'short', timeZone:'UTC'}).format(fecha).replace('.', '');
  return ['Lote','Red A','Sector','Variedad','Tunel','Ha Sector','Pasada','F. Inicio','F. Fin','Ha Avan',
    dia+' '+fechaConsultaCiclo().slice(8,10)+'/'+fechaConsultaCiclo().slice(5,7)];
}
function valoresCiclo(r){
  return [r.lote, r.red.replace(/^R0*/, '') || r.red, r.sector, r.variedad, r.tunel || '',
    r.superficie, r.pasada ?? '', r.fechaInicio, r.ultimaFecha, r.haAvan ?? '', r.diasDesdeUltimo];
}
function escaparCiclo(value){
  return String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function populateCicloFilters(){
  const todos = computeCiclosPorSector();
  const selLote = document.getElementById('f8-lote');
  const lotes = uniq(todos.map(d=>d.lote)).sort((a,b)=>a-b);
  const prevLote = selLote.value;
  selLote.innerHTML = '<option value="">Todos los lotes</option>' + lotes.map(l=>`<option value="${l}">Lote ${l}</option>`).join('');
  if(lotes.map(String).includes(prevLote)) selLote.value = prevLote;

  const loteSel = selLote.value;
  const rowsForLote = loteSel ? todos.filter(d=>String(d.lote)===loteSel) : todos;
  const reds = uniq(rowsForLote.map(d=>d.red));
  const selRed = document.getElementById('f8-red');
  const prevRed = selRed.value;
  selRed.innerHTML = '<option value="">Todas las redes</option>' + reds.map(r=>`<option value="${r}">${r}</option>`).join('');
  if(reds.includes(prevRed)) selRed.value = prevRed;
}

let lastCicloRows = [];
let cicloPage = 0;
const CICLO_PAGE_SIZE = 50;

function renderCiclo(){
  if(cultivoActivo !== 'arandano') return; // esta vista no aplica a Palto

  const fLote = document.getElementById('f8-lote').value;
  const fRed = document.getElementById('f8-red').value;
  const sectorSearchRaw = (document.getElementById('f8-sectorSearch').value || '').trim();
  const wanted = sectorSearchRaw ? sectorSearchRaw.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean) : [];

  let rows = computeCiclosPorSector().filter(r=>{
    if(fLote && String(r.lote)!==fLote) return false;
    if(fRed && r.red!==fRed) return false;
    if(wanted.length && !wanted.some(w=>r.sector.toUpperCase().includes(w))) return false;
    return true;
  });

  rows.sort((a,b)=> a.lote-b.lote || a.red.localeCompare(b.red, undefined, {numeric:true}) || a.sector.localeCompare(b.sector, undefined, {numeric:true}) || a.variedad.localeCompare(b.variedad));
  lastCicloRows = rows;

  const totalPages = Math.max(1, Math.ceil(rows.length / CICLO_PAGE_SIZE));
  cicloPage = Math.max(0, Math.min(cicloPage, totalPages - 1));
  const visibleRows = rows.slice(cicloPage * CICLO_PAGE_SIZE, (cicloPage + 1) * CICLO_PAGE_SIZE);
  const numericColumns = [0,1,2,5,6,9,10];
  // Túnel se conserva en la exportación, pero no ocupa una columna en pantalla.
  const thead = '<tr>'+encabezadosCiclo().map((h,i)=>i === 4 ? '' :
    `<th${numericColumns.includes(i) ? ' class="num"' : ''}>${escaparCiclo(h)}</th>`).join('')+'</tr>';

  const tbody = visibleRows.map(r=>'<tr>'+valoresCiclo(r).map((v,i)=>i === 4 ? '' :
    `<td${[0,1,2,5,6,9,10].includes(i) ? ' class="num"' : ''}>${escaparCiclo(v === '' && i !== 4 ? '—' : v)}</td>`
  ).join('')+'</tr>').join('');

  document.getElementById('tableCiclo').innerHTML = rows.length ? (thead + tbody) : (thead +
    `<tr><td colspan="10" style="text-align:center; color:#8a8f83; padding:24px;">
      No hay datos de avance de campo de Arándano todavía. Súbelos desde "Carga de Datos".
    </td></tr>`);

  const pager = document.getElementById('cicloPager');
  pager.innerHTML = rows.length ? `
    <button class="btn btn-ghost" id="cicloPrev" ${cicloPage === 0 ? 'disabled' : ''}>‹ Anterior</button>
    <span aria-live="polite">Página ${cicloPage + 1} de ${totalPages} (${rows.length} filas)</span>
    <button class="btn btn-ghost" id="cicloNext" ${cicloPage === totalPages - 1 ? 'disabled' : ''}>Siguiente ›</button>` : '';
  if(rows.length){
    document.getElementById('cicloPrev').addEventListener('click', ()=>{ cicloPage--; renderCiclo(); });
    document.getElementById('cicloNext').addEventListener('click', ()=>{ cicloPage++; renderCiclo(); });
  }
}

function exportCicloToExcel(){
  if(!lastCicloRows.length){
    alert('No hay datos para exportar todavía.');
    return;
  }
  const headers = encabezadosCiclo();
  const aoa = [headers, ...lastCicloRows.map(valoresCiclo)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map(h => ({wch: Math.max(h.length+2, 12)}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Días de Ciclo');
  const stamp = fechaConsultaCiclo();
  XLSX.writeFile(wb, `Dias_de_Ciclo_${stamp}.xlsx`);
}

document.getElementById('f8-lote').addEventListener('change', ()=>{ cicloPage = 0; populateCicloFilters(); renderCiclo(); });
document.getElementById('f8-red').addEventListener('change', ()=>{ cicloPage = 0; renderCiclo(); });
document.getElementById('f8-sectorSearch').addEventListener('input', ()=>{ cicloPage = 0; renderCiclo(); });
document.getElementById('exportCicloBtn').addEventListener('click', exportCicloToExcel);

document.getElementById('f8-fecha').addEventListener('change', ()=>{ cicloPage = 0; populateCicloFilters(); renderCiclo(); });
