/* Reportes de producción: filtro de Mercado y presentación de "Kg. Jabas" (Arándano). */
let marketJabas = null;
let marketJabasLoading = false;
let marketJabasError = false;
const PRODUCTION_PAGE_SIZE = 30;
function prodEscape(value){
  return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function prodDate(value){
  const parts = String(value).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}
function productionKey(r){ return [r.fecha,r.lote,r.red,String(r.variedad).trim().toUpperCase()].join('|'); }
// "Kg. Cosechados" y "Kg. Jabas" usan el mismo modelo que Palto (ver renderCosecha() y
// renderKPIs() en vista-dashboard.js): mismas tarjetas KPI con presupuesto en todas las
// páginas, sin un set aparte para "Kg. Jabas" — la única diferencia de cultivo es el
// filtro de Mercado, que es exclusivo de Arándano.
// Vista de toda la campaña, igual que "Kg. Bins" de Palto — ya no hay rango de fechas
// ni Lote a nivel de página (el Lote se filtra solo en "Detalle diario", ver más abajo,
// igual que f3-lote/f3-fecha en renderBins() de Palto). Mercado sigue siendo un filtro
// propio de Arándano.
function productionFilter(){
  return { mercado: document.getElementById('prod-mercado').value };
}
function productionRows(){
  const filter = productionFilter();
  const missing = [];
  const rows = balanza.filter(r=>matchVariedad(r.variedad)).flatMap(r=>{
    const field = filter.mercado==='EXP' ? 'kgExportable' : 'kgNacional';
    if(filter.mercado && (r[field]==null || !Number.isFinite(Number(r[field])))){
      missing.push(r); return [];
    }
    const kg = filter.mercado ? Number(r[field]) : Number(r.kg)||0;
    let envases = r.envases == null ? null : Number(r.envases);
    if(filter.mercado){
      const direct = filter.mercado==='EXP' ? r.envasesExportable : r.envasesNacional;
      const counts = marketJabas && marketJabas.get(productionKey(r));
      envases = direct != null ? Number(direct) : counts ? counts[filter.mercado] : null;
    }
    return [{...r,kg,envases}];
  });
  const info = document.getElementById('prod-status');
  const message = `Toda la campaña · ${filter.mercado==='EXP' ? 'Exportable' : filter.mercado==='NAC' ? 'Mercado nacional' : 'Todos los mercados'} · ${rows.length} registros`;
  info.textContent = message + (missing.length ? ` · ${missing.length} registros sin desglose de mercado excluidos.` : '') +
    (filter.mercado && marketJabasLoading ? ' · Cargando jabas por mercado…' : '') +
    (filter.mercado && marketJabasError ? ' · No se pudieron consultar las jabas por mercado. Recarga para reintentar.' : '');
  info.classList.toggle('is-error', missing.length>0 || marketJabasError);
  return rows;
}
async function ensureMarketJabas(){
  if(cultivoActivo!=='arandano' || !document.getElementById('prod-mercado').value || marketJabas || marketJabasLoading || marketJabasError) return;
  marketJabasLoading = true;
  try{
    const {data,error} = await sb.from('lecturaind_arandano_data').select('data').eq('id',1).single();
    if(error || !data || !Array.isArray(data.data)) throw new Error('Lecturas no disponibles');
    const counts = new Map();
    data.data.forEach(r=>{
      const key = productionKey(r);
      if(!counts.has(key)) counts.set(key,{EXP:0,NAC:0});
      if(r.destino==='EXP' || r.destino==='NAC') counts.get(key)[r.destino] += Number(r.cantidad)||0;
    });
    marketJabas = counts;
  }catch(e){ marketJabasError = true; }
  finally{
    marketJabasLoading = false;
    refreshProductionReports();
  }
}
function comparableWeight(rows){
  const comparable = rows.filter(r=>r.envases>0);
  const jabas = comparable.reduce((s,r)=>s+r.envases,0);
  return {jabas, kg:comparable.reduce((s,r)=>s+r.kg,0), missing:rows.filter(r=>r.kg>0 && !(r.envases>0)).length};
}
function prodPager(id,page,total,callback){
  const pages = Math.max(1,Math.ceil(total/PRODUCTION_PAGE_SIZE));
  const node = document.getElementById(id);
  node.innerHTML = total ? `<button class="btn btn-ghost" data-direction="-1" ${page===0?'disabled':''}>‹ Anterior</button><span>Página ${page+1} de ${pages} · ${total} filas</span><button class="btn btn-ghost" data-direction="1" ${page===pages-1?'disabled':''}>Siguiente ›</button>` : '';
  node.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>callback(Number(b.dataset.direction))));
}
// "Kg. Cosechados" de Arándano ya no usa este camino — ver renderCosecha() en
// vista-dashboard.js, que ahora es el modelo único para ambos cultivos. Lo que sigue
// (renderJabasProduccion y el filtro de Mercado) queda solo para "Kg. Jabas".
function renderJabasProduccion(){
  const rows = productionRows();
  document.getElementById('exportBinsDiaBtn').disabled = marketJabasLoading;
  const byLote = sumBy(rows,r=>'Lote '+r.lote,r=>r.kg);
  const lotes = [...byLote.keys()].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  // Mismo helper drawBar() (barras verticales, un solo color del tema, valor en kg
  // arriba de cada barra) que ya usa Palto en su página de Bins, en vez de la paleta
  // arcoíris anterior — así ambos cultivos se ven consistentes.
  drawBar('chartBinsLote', lotes, lotes.map(l=>byLote.get(l)), 'Kg', getThemeColor('--aguacate', '#5B2A86'), false, false, true);
  const groups = new Map();
  rows.forEach(r=>{
    const week=isoWeekStart(r.fecha),key=week+'|'+r.variedad;
    if(!groups.has(key)) groups.set(key,{week,variedad:r.variedad,rows:[]});
    groups.get(key).rows.push(r);
  });
  const weekly = [...groups.values()].sort((a,b)=>b.week.localeCompare(a.week)||a.variedad.localeCompare(b.variedad));
  document.getElementById('tableBinsSemana').innerHTML = '<thead><tr><th>Semana / inicio</th><th>Variedad</th><th class="num">Jabas</th><th class="num">Kg/Jaba</th></tr></thead><tbody>'+weekly.map(g=>{
    const w=comparableWeight(g.rows);
    return `<tr><td><strong>${prodEscape(weekLabel(g.week))}</strong><small class="table-subdate">${prodDate(g.week)}</small></td><td>${prodEscape(g.variedad)}</td><td class="num">${w.jabas?fmt(w.jabas):'—'}</td><td class="num"><span class="ratio-value">${w.jabas?fmt1(w.kg/w.jabas):'—'}</span></td></tr>`;
  }).join('')+(weekly.length?'':'<tr><td colspan="4" class="report-empty">No hay datos con estos filtros.</td></tr>')+'</tbody>';
  const daily = new Map();
  rows.forEach(r=>{
    const key=productionKey(r);
    if(!daily.has(key))daily.set(key,{fecha:r.fecha,lote:r.lote,red:r.red,variedad:r.variedad,kg:0,envases:0,missing:false});
    const g=daily.get(key);g.kg+=r.kg;g.envases+=r.envases||0;g.missing ||= r.kg>0 && !(r.envases>0);
  });
  let allRows = [...daily.values()].sort((a,b)=>b.fecha.localeCompare(a.fecha)||a.lote-b.lote||a.red.localeCompare(b.red));

  // Filtro de Lote y Fecha exacta, propio de esta tabla — igual que f3-lote/f3-fecha en
  // "Kg. Bins" de Palto (renderBins()). Ya no hay un filtro de Lote a nivel de página.
  const selLote3 = document.getElementById('f3-lote');
  const lotesDia = uniq(allRows.map(r=>r.lote)).sort((a,b)=>Number(a)-Number(b));
  const prevLote3 = selLote3.value;
  selLote3.innerHTML = '<option value="">Todos los lotes</option>' + lotesDia.map(l=>`<option value="${l}">Lote ${l}</option>`).join('');
  if(lotesDia.map(String).includes(prevLote3)) selLote3.value = prevLote3;
  const fLote3 = selLote3.value;
  const fFecha3 = document.getElementById('f3-fecha').value;
  allRows = allRows.filter(o => (!fLote3 || String(o.lote)===String(fLote3)) && (!fFecha3 || o.fecha===fFecha3));

  lastBinsDiaData = allRows.map(r=>({...r,envases:r.missing?null:r.envases}));
  binsDiaPage = Math.min(binsDiaPage,Math.max(0,Math.ceil(allRows.length/PRODUCTION_PAGE_SIZE)-1));
  document.getElementById('tableBinsDia').innerHTML = '<thead><tr><th>Fecha</th><th>Lote</th><th>Red</th><th>Variedad</th><th class="num">Jabas</th><th class="num">Kg</th><th class="num">Kg/Jaba</th></tr></thead><tbody>'+allRows.slice(binsDiaPage*PRODUCTION_PAGE_SIZE,(binsDiaPage+1)*PRODUCTION_PAGE_SIZE).map(r=>
    `<tr><td>${prodDate(r.fecha)}</td><td>${r.lote}</td><td>${prodEscape(r.red)}</td><td>${prodEscape(r.variedad)}</td><td class="num">${r.missing?'—':fmt(r.envases)}</td><td class="num"><strong>${fmt(r.kg)}</strong></td><td class="num"><span class="ratio-value">${!r.missing && r.envases>0 ? fmt1(r.kg/r.envases):'—'}</span></td></tr>`
  ).join('')+(allRows.length?'':'<tr><td colspan="7" class="report-empty">No hay datos con estos filtros.</td></tr>')+'</tbody>';
  prodPager('binsDiaPager',binsDiaPage,allRows.length,step=>{binsDiaPage+=step;renderJabasProduccion();});
}
function refreshProductionReports(){
  if(cultivoActivo!=='arandano')return;
  renderJabasProduccion();
}
document.getElementById('prod-mercado').addEventListener('change',()=>{
  binsDiaPage=0;
  ensureMarketJabas();refreshProductionReports();
});
