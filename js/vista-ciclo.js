/* ============ ARÁNDANO: DÍAS DE CICLO ============
   El arándano no se cosecha una sola vez por sector como la palta — el mismo Lote-Red-Sector-
   Variedad se vuelve a cosechar varias veces durante la campaña, ronda tras ronda, porque el
   fruto sigue madurando (ver hectareasArandano, el avance de campo reportado por el líder).
   Esta vista mide cuántos días pasan entre una cosecha y la siguiente para cada sector: por
   ejemplo, un sector cosechado el día 1, el día 6 y el día 10 tuvo un ciclo de 5 días y luego
   uno de 4 días. Sirve para detectar sectores que ya deberían haber vuelto a cosecharse según
   su propio ritmo histórico. */

function computeCiclosPorSector(){
  const bySector = new Map(); // "lote|red|sector|variedad" -> Set(fechas)
  hectareasArandano.forEach(h=>{
    if(!h.lote || !h.red || !h.sector) return;
    const key = h.lote+'|'+h.red+'|'+h.sector+'|'+h.variedad;
    if(!bySector.has(key)) bySector.set(key, new Set());
    bySector.get(key).add(h.fecha);
  });

  const hoy = new Date().toISOString().slice(0,10);
  const out = [];
  bySector.forEach((fechasSet, key)=>{
    const [lote, red, sector, variedad] = key.split('|');
    const fechas = [...fechasSet].sort();
    const ciclos = [];
    for(let i=1; i<fechas.length; i++){
      const d = daysBetween(fechas[i-1], fechas[i]);
      if(d != null && d > 0) ciclos.push(d);
    }
    const ultimaFecha = fechas[fechas.length-1];
    const cicloProm = ciclos.length ? ciclos.reduce((a,b)=>a+b,0)/ciclos.length : null;
    const cicloMin = ciclos.length ? Math.min(...ciclos) : null;
    const cicloMax = ciclos.length ? Math.max(...ciclos) : null;
    const diasDesdeUltimo = daysBetween(ultimaFecha, hoy);
    out.push({
      lote: parseInt(lote, 10), red, sector, variedad,
      fechas, ciclos, nCosechas: fechas.length,
      ultimaFecha, cicloProm, cicloMin, cicloMax, diasDesdeUltimo,
      atrasado: cicloProm != null && diasDesdeUltimo != null && diasDesdeUltimo > cicloProm,
    });
  });
  return out;
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

function renderCiclo(){
  if(cultivoActivo !== 'arandano') return; // esta vista no aplica a Palto

  const fLote = document.getElementById('f8-lote').value;
  const fRed = document.getElementById('f8-red').value;
  const fOrden = document.getElementById('f8-orden').value;
  const sectorSearchRaw = (document.getElementById('f8-sectorSearch').value || '').trim();
  const wanted = sectorSearchRaw ? sectorSearchRaw.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean) : [];

  let rows = computeCiclosPorSector().filter(r=>{
    if(fLote && String(r.lote)!==fLote) return false;
    if(fRed && r.red!==fRed) return false;
    if(activeVariedades.length && !matchVariedad(r.variedad)) return false;
    if(wanted.length && !wanted.some(w=>r.sector.toUpperCase().includes(w))) return false;
    return true;
  });

  if(fOrden === 'lote'){
    rows.sort((a,b)=> a.lote-b.lote || a.red.localeCompare(b.red) || a.sector.localeCompare(b.sector));
  } else if(fOrden === 'reciente'){
    rows.sort((a,b)=> b.ultimaFecha.localeCompare(a.ultimaFecha));
  } else { // 'alerta': más atrasados primero (los sin ciclo histórico van al final)
    rows.sort((a,b)=>{
      const va = (a.cicloProm!=null && a.diasDesdeUltimo!=null) ? a.diasDesdeUltimo - a.cicloProm : -Infinity;
      const vb = (b.cicloProm!=null && b.diasDesdeUltimo!=null) ? b.diasDesdeUltimo - b.cicloProm : -Infinity;
      return vb - va;
    });
  }

  lastCicloRows = rows;

  // --- KPIs ---
  const conCiclo = rows.filter(r=>r.cicloProm!=null);
  const cicloPromGeneral = conCiclo.length ? conCiclo.reduce((s,r)=>s+r.cicloProm,0)/conCiclo.length : null;
  const atrasados = rows.filter(r=>r.atrasado).length;
  const cards = [
    {label:'Sectores Monitoreados', value: fmt(rows.length)},
    {label:'Ciclo Promedio de Campaña', value: cicloPromGeneral!=null ? fmt1(cicloPromGeneral)+' días' : '—'},
    {label:'Sectores Atrasados', value: fmt(atrasados)},
    {label:'% Atrasados', value: rows.length ? pct(atrasados/rows.length) : '—'},
  ];
  document.getElementById('kpiCiclo').innerHTML = cards.map(c=>`
    <div class="kpi">
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
    </div>`).join('');

  // --- tabla ---
  let thead = `<tr><th>LR Sector</th><th>Variedad</th><th class="num">N° Cosechas</th>
    <th style="white-space:nowrap;">Última Fecha</th><th class="num">Ciclo Prom. (d)</th>
    <th class="num">Ciclo Mín.</th><th class="num">Ciclo Máx.</th>
    <th class="num">Días desde último corte</th><th>Historial de ciclos (días)</th><th>Estado</th></tr>`;

  const pageSizeSel = document.getElementById('f8-pageSize');
  const pageSize = pageSizeSel.value === 'todas' ? rows.length || 1 : parseInt(pageSizeSel.value);
  const totalPaginas = Math.max(1, Math.ceil(rows.length / pageSize));
  if(cicloPage >= totalPaginas) cicloPage = totalPaginas - 1;
  if(cicloPage < 0) cicloPage = 0;
  const rowsPagina = rows.slice(cicloPage*pageSize, cicloPage*pageSize + pageSize);

  const estadoPillCiclo = (r) => {
    if(r.cicloProm == null) return '<span class="pill" style="background:#EEE; color:#888;">1ª cosecha</span>';
    if(r.atrasado) return '<span class="pill" style="background:#FBDCE0; color:#B3273D;">Atrasado</span>';
    return '<span class="pill" style="background:#DCEFE1; color:#1B6B3C;">A tiempo</span>';
  };

  const tbody = rowsPagina.map(r=>{
    const diasColor = r.atrasado ? '#B3273D' : 'inherit';
    const diasWeight = r.atrasado ? '700' : 'inherit';
    return `<tr><td>L${String(r.lote).padStart(2,'0')} ${r.red} ${r.sector}</td><td>${r.variedad}</td>
      <td class="num">${r.nCosechas}</td>
      <td style="white-space:nowrap;">${r.ultimaFecha}</td>
      <td class="num">${r.cicloProm!=null ? fmt1(r.cicloProm) : '—'}</td>
      <td class="num">${r.cicloMin ?? '—'}</td>
      <td class="num">${r.cicloMax ?? '—'}</td>
      <td class="num" style="color:${diasColor}; font-weight:${diasWeight};">${r.diasDesdeUltimo ?? '—'}</td>
      <td style="font-family:var(--font-mono); font-size:12px; color:#8a8f83;">${r.ciclos.join(', ') || '—'}</td>
      <td>${estadoPillCiclo(r)}</td></tr>`;
  }).join('');

  document.getElementById('tableCiclo').innerHTML = rows.length ? (thead + tbody) : (thead +
    `<tr><td colspan="10" style="text-align:center; color:#8a8f83; padding:24px;">
      No hay datos de avance de campo de Arándano todavía. Súbelos desde "Carga de Datos".
    </td></tr>`);

  const pagerEl = document.getElementById('cicloPager');
  if(totalPaginas <= 1 || !rows.length){
    pagerEl.innerHTML = '';
  } else {
    pagerEl.innerHTML = `
      <button class="btn btn-ghost" id="cicloPrev" style="padding:6px 12px;" ${cicloPage===0?'disabled':''}>‹ Anterior</button>
      <span>Página ${cicloPage+1} de ${totalPaginas} <span style="color:#8a8f83;">(${rows.length} filas)</span></span>
      <button class="btn btn-ghost" id="cicloNext" style="padding:6px 12px;" ${cicloPage>=totalPaginas-1?'disabled':''}>Siguiente ›</button>`;
    document.getElementById('cicloPrev').addEventListener('click', ()=>{ cicloPage--; renderCiclo(); });
    document.getElementById('cicloNext').addEventListener('click', ()=>{ cicloPage++; renderCiclo(); });
  }
}

function exportCicloToExcel(){
  if(!lastCicloRows.length){
    alert('No hay datos para exportar todavía.');
    return;
  }
  const headers = ['Lote-Red-Sector','Variedad','N° Cosechas','Última Fecha','Ciclo Prom. (días)','Ciclo Mín.','Ciclo Máx.','Días desde último corte','Historial de ciclos (días)','Estado'];
  const aoa = [headers];
  lastCicloRows.forEach(r=>{
    const estado = r.cicloProm==null ? '1ª cosecha' : (r.atrasado ? 'Atrasado' : 'A tiempo');
    aoa.push([
      `L${String(r.lote).padStart(2,'0')} ${r.red} ${r.sector}`, r.variedad, r.nCosechas, r.ultimaFecha,
      r.cicloProm!=null ? round1(r.cicloProm) : '', r.cicloMin ?? '', r.cicloMax ?? '',
      r.diasDesdeUltimo ?? '', r.ciclos.join(', '), estado
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map(h => ({wch: Math.max(h.length+2, 12)}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Días de Ciclo');
  const stamp = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `Dias_de_Ciclo_${stamp}.xlsx`);
}

document.getElementById('f8-lote').addEventListener('change', ()=>{ cicloPage = 0; populateCicloFilters(); renderCiclo(); });
document.getElementById('f8-red').addEventListener('change', ()=>{ cicloPage = 0; renderCiclo(); });
document.getElementById('f8-sectorSearch').addEventListener('input', ()=>{ cicloPage = 0; renderCiclo(); });
document.getElementById('f8-orden').addEventListener('change', ()=>{ cicloPage = 0; renderCiclo(); });
document.getElementById('f8-pageSize').addEventListener('change', ()=>{ cicloPage = 0; renderCiclo(); });
document.getElementById('exportCicloBtn').addEventListener('click', exportCicloToExcel);
