/* Reportes de producción: filtros compartidos, mercados y presentación de Arándano. */
let productionFilterReady = false;
let marketJabas = null;
let marketJabasLoading = false;
let marketJabasError = false;
let productionDetailPage = 0;
const PRODUCTION_PAGE_SIZE = 30;
const PRODUCTION_PALETTE = ['#7046b5','#087f8c','#d08a21','#c05586','#4667b5','#50884a','#86596c','#5d6d7e'];
function prodEscape(value){
  return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function prodDate(value){
  const parts = String(value).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}
function productionKey(r){ return [r.fecha,r.lote,r.red,String(r.variedad).trim().toUpperCase()].join('|'); }
function productionPageActive(){
  return cultivoActivo === 'arandano' && ['page-cosecha','page-bins'].some(id=>document.getElementById(id).classList.contains('active'));
}
function initProductionFilters(){
  const dates = balanza.map(r=>r.fecha).filter(Boolean).sort();
  if(!dates.length) return;
  const end = dates[dates.length-1];
  if(!productionFilterReady){
    const start = new Date(end+'T12:00:00Z'); start.setUTCDate(start.getUTCDate()-29);
    document.getElementById('prod-desde').value = start.toISOString().slice(0,10);
    document.getElementById('prod-hasta').value = end;
    productionFilterReady = true;
  }
  const sel = document.getElementById('prod-lote'), previous = sel.value;
  const lotes = [...new Set(balanza.map(r=>r.lote))].sort((a,b)=>Number(a)-Number(b));
  sel.innerHTML = '<option value="">Todos los lotes</option>'+lotes.map(l=>`<option value="${prodEscape(l)}">Lote ${prodEscape(l)}</option>`).join('');
  if(lotes.map(String).includes(previous)) sel.value = previous;
}
function productionFilter(){
  initProductionFilters();
  return {
    desde:document.getElementById('prod-desde').value,
    hasta:document.getElementById('prod-hasta').value,
    mercado:document.getElementById('prod-mercado').value,
    lote:document.getElementById('prod-lote').value,
  };
}
function productionRows(){
  const filter = productionFilter();
  const invalid = !!(filter.desde && filter.hasta && filter.desde>filter.hasta);
  document.getElementById('prod-desde').setCustomValidity(invalid ? 'La fecha inicial debe ser anterior a la final.' : '');
  const missing = [];
  const rows = invalid ? [] : balanza.filter(r=>matchVariedad(r.variedad) &&
    (!filter.desde || r.fecha>=filter.desde) && (!filter.hasta || r.fecha<=filter.hasta) &&
    (!filter.lote || String(r.lote)===filter.lote)).flatMap(r=>{
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
  const message = invalid ? 'Revisa el rango: Desde no puede ser posterior a Hasta.' :
    `${prodDate(filter.desde) || 'Inicio'} — ${prodDate(filter.hasta) || 'Última fecha'} · ${filter.mercado==='EXP' ? 'Exportable' : filter.mercado==='NAC' ? 'Mercado nacional' : 'Todos los mercados'} · ${rows.length} registros`;
  info.textContent = message + (missing.length ? ` · ${missing.length} registros sin desglose de mercado excluidos.` : '') +
    (filter.mercado && marketJabasLoading ? ' · Cargando jabas por mercado…' : '') +
    (filter.mercado && marketJabasError ? ' · No se pudieron consultar las jabas por mercado. Recarga para reintentar.' : '');
  info.classList.toggle('is-error',invalid || missing.length>0 || marketJabasError);
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
function renderProductionKPIs(){
  const rows = productionRows();
  const total = rows.reduce((s,r)=>s+r.kg,0);
  const weight = comparableWeight(rows);
  const days = new Set(rows.map(r=>r.fecha)).size;
  const cards = [
    {label:'Kilos del período',value:fmt(total),sub:'Según fechas, lote, variedad y mercado',tone:'purple'},
    {label:'Jabas registradas',value:weight.jabas ? fmt(weight.jabas) : '—',sub:weight.missing ? 'Cobertura parcial de lecturas' : 'Del mercado seleccionado',tone:'teal'},
    {label:'Peso promedio',value:weight.jabas ? fmt1(weight.kg/weight.jabas)+' kg' : '—',sub:'Por jaba · solo registros con lecturas',tone:'amber'},
    {label:'Promedio diario',value:days ? fmt(total/days)+' kg' : '—',sub:days+' días con registro',tone:'blue'},
    {label:'Variedades',value:String(new Set(rows.filter(r=>r.kg>0).map(r=>r.variedad)).size),sub:'Con producción en este período',tone:'pink'},
  ];
  document.getElementById('kpiStrip').innerHTML = cards.map(c=>`<div class="kpi production-kpi tone-${c.tone}"><div class="label">${c.label}</div><div class="value">${c.value}</div><div class="sub">${c.sub}</div></div>`).join('');
}
function productionChart(id,labels,values,{horizontal=false,dates=false}={}){
  if(charts[id]) charts[id].destroy();
  const colors = horizontal ? values.map((_,i)=>PRODUCTION_PALETTE[i%PRODUCTION_PALETTE.length]) : '#7951bc';
  const datasets = [{type:'bar',label:'Kg cosechados',data:values,backgroundColor:colors,borderRadius:3,borderSkipped:false,maxBarThickness:horizontal?25:28,order:2}];
  if(dates){
    const trend = values.map((_,i)=>{
      const window = values.slice(Math.max(0,i-6),i+1);
      return window.reduce((sum,kg)=>sum+kg,0)/window.length;
    });
    datasets.push({type:'line',label:'Tendencia · promedio de 7 jornadas',data:trend,
      borderColor:'#147d92',backgroundColor:'#147d92',borderWidth:2.5,
      pointRadius:0,pointHoverRadius:4,tension:0.25,fill:false,order:1});
  }
  charts[id] = new Chart(document.getElementById(id).getContext('2d'),{
    type:'bar', data:{labels,datasets},
    options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},layout:{padding:{top:12,right:12}},indexAxis:horizontal?'y':'x',
      plugins:{legend:{display:dates,position:'top',labels:{boxWidth:12,boxHeight:12,padding:16,font:{size:11}}},tooltip:{backgroundColor:'#302444',padding:12,cornerRadius:8,displayColors:false,callbacks:{label:ctx=>ctx.dataset.label+': '+fmt(horizontal?ctx.parsed.x:ctx.parsed.y)+' kg',title:items=>dates ? prodDate(items[0].label) : items[0].label}}},
      scales:{x:horizontal?{beginAtZero:true,border:{display:false},grid:{color:'#edf0f5'},ticks:{maxTicksLimit:6,callback:v=>fmt(v)}}:
        {border:{display:false},grid:{display:false},ticks:{autoSkip:true,maxTicksLimit:Math.max(3,Math.min(12,Math.floor(document.getElementById(id).parentElement.clientWidth/65))),minRotation:dates?45:0,maxRotation:dates?45:0,padding:8,font:{size:11},callback:function(v){const d=this.getLabelForValue(v);return dates?prodDate(d):d;}}},
        y:horizontal?{border:{display:false},grid:{display:false},ticks:{autoSkip:false}}:{beginAtZero:true,border:{display:false},grid:{color:'#edf0f5'},ticks:{maxTicksLimit:6,callback:v=>fmt(v)}}}}
  });
}
function renderVarietyRanking(rows){
  const byVar = sumBy(rows,r=>r.variedad,r=>r.kg);
  const sorted = [...byVar].filter(([,kg])=>kg>0).sort((a,b)=>b[1]-a[1]);
  const total = sorted.reduce((s,[,kg])=>s+kg,0);
  const max = sorted.length ? sorted[0][1] : 1;
  document.getElementById('variedadRanking').innerHTML = sorted.length ? sorted.map(([v,kg],i)=>{
    const share = 100*kg/total;
    return `<div class="variety-row"><span class="variety-name"><i style="background:${PRODUCTION_PALETTE[i%PRODUCTION_PALETTE.length]}"></i>${prodEscape(v)}</span><span class="variety-amount">${fmt(kg)} <small>kg</small></span><span class="variety-share">${share<0.1 ? '<0,1%' : pct(share/100)}</span><div class="variety-track"><span style="width:${100*kg/max}%;background:${PRODUCTION_PALETTE[i%PRODUCTION_PALETTE.length]}"></span></div></div>`;
  }).join('') : '<p class="report-empty">No hay producción con estos filtros.</p>';
}
function prodPager(id,page,total,callback){
  const pages = Math.max(1,Math.ceil(total/PRODUCTION_PAGE_SIZE));
  const node = document.getElementById(id);
  node.innerHTML = total ? `<button class="btn btn-ghost" data-direction="-1" ${page===0?'disabled':''}>‹ Anterior</button><span>Página ${page+1} de ${pages} · ${total} filas</span><button class="btn btn-ghost" data-direction="1" ${page===pages-1?'disabled':''}>Siguiente ›</button>` : '';
  node.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>callback(Number(b.dataset.direction))));
}
function renderCosechaArandano(){
  // Chart.js writes inline display styles: dispose of the previous crop's chart.
  if(charts.chartVariedad){ charts.chartVariedad.destroy(); delete charts.chartVariedad; }
  document.getElementById('chartVariedad').hidden = true;
  document.getElementById('variedadRanking').hidden = false;
  const rows = productionRows();
  const byDate = sumBy(rows,r=>r.fecha,r=>r.kg);
  const dates = [...byDate.keys()].sort();
  productionChart('chartDia',dates,dates.map(d=>byDate.get(d)),{dates:true});
  renderVarietyRanking(rows);
  const lotesRed = [...new Set(rows.map(r=>loteRed(r.lote,r.red)))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const lrDates = [...dates].reverse();
  const matrix = new Map();
  rows.forEach(r=>{const key=r.fecha+'|'+loteRed(r.lote,r.red);matrix.set(key,(matrix.get(key)||0)+r.kg);});
  const totalesPorLoteRed = lotesRed.map(lr=>lrDates.reduce((s,d)=>s+(matrix.get(d+'|'+lr)||0),0));
  const totalGeneral = totalesPorLoteRed.reduce((s,v)=>s+v,0);
  lastCosechaLoteRedData = {lotesRed,lrDates,matrix,totalesPorLoteRed,totalGeneral};
  productionDetailPage = Math.min(productionDetailPage,Math.max(0,Math.ceil(lrDates.length/PRODUCTION_PAGE_SIZE)-1));
  const pageDates = lrDates.slice(productionDetailPage*PRODUCTION_PAGE_SIZE,(productionDetailPage+1)*PRODUCTION_PAGE_SIZE);
  const header = `<thead><tr><th>Fecha</th><th class="num">Total kg</th>${lotesRed.map(lr=>`<th class="num">${prodEscape(lr)}</th>`).join('')}</tr></thead>`;
  const totalRow = `<tr class="production-total"><td>Total del período</td><td class="num">${fmt(totalGeneral)}</td>${totalesPorLoteRed.map(v=>`<td class="num">${fmt(v)}</td>`).join('')}</tr>`;
  const body = pageDates.map(d=>{
    const values = lotesRed.map(lr=>matrix.get(d+'|'+lr)||0);
    const max = Math.max(1,...values);
    return `<tr><td>${prodDate(d)}</td><td class="num"><strong>${fmt(byDate.get(d))}</strong></td>${values.map(v=>`<td class="num" style="background:rgba(112,70,181,${v ? (0.04+0.16*v/max).toFixed(3):0})">${v?fmt(v):'—'}</td>`).join('')}</tr>`;
  }).join('');
  document.getElementById('tableLoteRedDia').innerHTML = header+'<tbody>'+(rows.length ? totalRow+body : `<tr><td colspan="${lotesRed.length+2}" class="report-empty">No hay datos para el rango seleccionado.</td></tr>` )+'</tbody>';
  prodPager('cosechaPager',productionDetailPage,lrDates.length,step=>{productionDetailPage+=step;renderCosechaArandano();});
}
function renderJabasProduccion(){
  const rows = productionRows();
  document.getElementById('exportBinsDiaBtn').disabled = marketJabasLoading;
  const byLote = sumBy(rows,r=>'Lote '+r.lote,r=>r.kg);
  const lotes = [...byLote.keys()].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  productionChart('chartBinsLote',lotes,lotes.map(l=>byLote.get(l)),{horizontal:true});
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
  const allRows = [...daily.values()].sort((a,b)=>b.fecha.localeCompare(a.fecha)||a.lote-b.lote||a.red.localeCompare(b.red));
  lastBinsDiaData = allRows.map(r=>({...r,envases:r.missing?null:r.envases}));
  binsDiaPage = Math.min(binsDiaPage,Math.max(0,Math.ceil(allRows.length/PRODUCTION_PAGE_SIZE)-1));
  document.getElementById('tableBinsDia').innerHTML = '<thead><tr><th>Fecha</th><th>Lote</th><th>Red</th><th>Variedad</th><th class="num">Jabas</th><th class="num">Kg</th><th class="num">Kg/Jaba</th></tr></thead><tbody>'+allRows.slice(binsDiaPage*PRODUCTION_PAGE_SIZE,(binsDiaPage+1)*PRODUCTION_PAGE_SIZE).map(r=>
    `<tr><td>${prodDate(r.fecha)}</td><td>${r.lote}</td><td>${prodEscape(r.red)}</td><td>${prodEscape(r.variedad)}</td><td class="num">${r.missing?'—':fmt(r.envases)}</td><td class="num"><strong>${fmt(r.kg)}</strong></td><td class="num"><span class="ratio-value">${!r.missing && r.envases>0 ? fmt1(r.kg/r.envases):'—'}</span></td></tr>`
  ).join('')+(allRows.length?'':'<tr><td colspan="7" class="report-empty">No hay datos con estos filtros.</td></tr>')+'</tbody>';
  prodPager('binsDiaPager',binsDiaPage,allRows.length,step=>{binsDiaPage+=step;renderJabasProduccion();});
  const missing=comparableWeight(rows).missing;
  document.getElementById('jabasCoverage').textContent = missing ? `${missing} registros con kilos no tienen jabas comparables. El promedio usa solo filas con lecturas del mercado seleccionado.` : 'Promedios ponderados: kilos / jabas del mismo período y mercado.';
}
function refreshProductionReports(){
  if(cultivoActivo!=='arandano')return;
  renderCosechaArandano(); renderJabasProduccion();
  if(productionPageActive())renderProductionKPIs();
}
['prod-desde','prod-hasta','prod-lote','prod-mercado'].forEach(id=>{
  document.getElementById(id).addEventListener('change',()=>{
    productionDetailPage=0;binsDiaPage=0;
    ensureMarketJabas();refreshProductionReports();
  });
});
document.getElementById('prod-30dias').addEventListener('click',()=>{
  productionFilterReady=false;productionDetailPage=0;binsDiaPage=0;refreshProductionReports();
});
