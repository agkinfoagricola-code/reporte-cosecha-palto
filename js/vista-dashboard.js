/* ============ INICIO + KPIs ============ */
let binsDiaPage = 0; // página actual de "Detalle diario de peso promedio por bin"

function renderInicio(){
  const rows = balanza.filter(r=>matchVariedad(r.variedad));
  const kgReal = rows.reduce((s,r)=>s+r.kg,0);
  const kgPpto = ESTIMACION.reduce((s,r)=>s+kgPptoVariedad(r, activeVariedades),0);
  const cump = kgPpto>0 ? kgReal/kgPpto : 0;
  const fechas = balanza.map(r=>r.fecha).sort();
  const ultima = fechas.length ? fechas[fechas.length-1] : '—';
  document.getElementById('inicioResumen').innerHTML = `
    <p style="margin:0 0 10px 0; font-size:13.5px; color:#555; line-height:1.6;">
      Avance de campaña: <b style="color:${cump>=1?'var(--verde-ok)':'var(--rojo)'}">${pct(cump)}</b>
      del presupuesto (${fmt(kgReal)} kg reales de ${fmt(kgPpto)} kg ppto). Última recepción registrada: <b>${ultima}</b>.
    </p>
    <p style="margin:0; font-size:13px; color:#8a8f83;">
      Usa el menú <b>Reportes</b> de la izquierda para el detalle por día, por semana, por bins y por sector.
    </p>`;
}

function renderKPIs(){
  const rows = balanza.filter(r=>matchVariedad(r.variedad));
  if(cultivoActivo === 'arandano'){
    const kgReal = rows.reduce((s,r)=>s+r.kg,0);
    const kgPpto = kgPptoArandano(activeVariedades);
    const dif = kgReal - kgPpto;
    const cump = kgPpto>0 ? kgReal/kgPpto : 0;
    const envases = rows.reduce((s,r)=>s+(r.envases||0),0);
    const promEnvase = envases>0 ? kgReal/envases : 0;
    const cards = [
      {label:'Kg Real Cos.', value: fmt(kgReal)},
      {label:'Kg Ppto Cos.', value: fmt(kgPpto)},
      {label:'Diferencia', value: fmt(dif), neg:dif<0},
      {label:'Total Jabas', value: fmt(envases)},
      {label:'Prom. Kg / Jaba', value: fmt1(promEnvase)},
    ];
    let html = cards.map(c => `
      <div class="kpi"><div class="label">${c.label}</div><div class="value ${c.neg?'negative':''}">${c.value}</div></div>`).join('');
    html += `
      <div class="kpi">
        <div class="label">% Cumplimiento</div>
        <div class="value ${cump<1?'negative':''}">${pct(cump)}</div>
        <div class="sub">vs. ppto de campaña</div>
      </div>`;
    document.getElementById('kpiStrip').innerHTML = html;
    return;
  }
  const kgReal = rows.reduce((s,r)=>s+r.kg,0);
  const kgPpto = ESTIMACION.reduce((s,r)=>s+kgPptoVariedad(r, activeVariedades),0);
  const bins = rows.reduce((s,r)=>s+(r.bines||0),0);
  const dif = kgReal - kgPpto;
  const promBin = bins>0 ? kgReal/bins : 0;
  const cump = kgPpto>0 ? kgReal/kgPpto : 0;

  // Peso promedio acumulado (Calibres y Peso Fruto): ponderado por cajas, respeta el
  // filtro de Lote/Red de esa página (f6-lote/f6-red) además del de Variedad global.
  const calRows = calibresFiltered();
  let totalCajasK = 0, sumaPesoK = 0;
  calRows.forEach(r=>{ totalCajasK += r.cajas; sumaPesoK += r.peso * r.cajas; });
  const pesoPromAcumulado = totalCajasK>0 ? sumaPesoK/totalCajasK : 0;

  // Kg/Jornal acumulado (Kg. / Cosechador): mismo cálculo que "Resumen" de esa página —
  // solo cuenta días donde hay tareo Y balanza a la vez, respeta el filtro de Variedad.
  const jornalesObj = jornalesPorDia();
  const kgObjDia = kgPorDia();
  let totalJornalesK = 0, totalKgJornalK = 0;
  Object.keys(jornalesObj).forEach(f=>{
    if(kgObjDia[f] != null){ totalJornalesK += jornalesObj[f]; totalKgJornalK += kgObjDia[f]; }
  });
  const kgJornalAcumulado = totalJornalesK>0 ? totalKgJornalK/totalJornalesK : 0;

  const cards = [
    {label:'Kg Real Cos.', value: fmt(kgReal)},
    {label:'Kg Ppto Cos.', value: fmt(kgPpto)},
    {label:'Diferencia', value: fmt(dif), neg: dif<0},
    {label:'Total Bins', value: fmt(bins)},
    {label:'Prom. Kg / Bin', value: fmt1(promBin)},
    {label:'Peso Prom. Acumulado', value: fmt(pesoPromAcumulado*1000)+' g'},
    {label:'Kg/Jornal Acumulado', value: fmt1(kgJornalAcumulado)},
  ];
  let html = cards.map(c => `
    <div class="kpi">
      <div class="label">${c.label}</div>
      <div class="value ${c.neg?'negative':''}">${c.value}</div>
    </div>`).join('');

  html += `
    <div class="kpi">
      <div class="label">% Cumplimiento</div>
      <div class="value ${cump<1?'negative':''}">${pct(cump)}</div>
      <div class="sub">vs. ppto de campaña</div>
    </div>`;
  document.getElementById('kpiStrip').innerHTML = html;
}


/* ============ PAGE 1: COSECHA ============ */

/* ============ PAGE 1: COSECHA ============ */
function renderCosecha(){
  const fLote = document.getElementById('f1-lote').value;
  const rows = balanza.filter(r => matchVariedad(r.variedad) && (!fLote || String(r.lote)===String(fLote)));

  const byDate = sumBy(rows, r=>r.fecha, r=>r.kg);
  const dates = [...byDate.keys()].sort();
  drawBar('chartDia', dates, dates.map(d=>byDate.get(d)), 'Kg cosechados', getThemeColor('--pulpa', '#3F9E64'), true);

  const byVar = sumBy(rows, r=>r.variedad, r=>r.kg);
  drawBar('chartVariedad', [...byVar.keys()], [...byVar.values()], 'Kg', getThemeColor('--aguacate', '#1B6B3C'), false, true);

  const lrDates = uniq(rows.map(r=>r.fecha)).sort().reverse();
  // Orden de columnas: el mismo orden de Lote-Red de la estimación de campaña (Lote
  // numérico ascendente, luego Red), no el orden alfabético de texto (que pondría
  // "11-R01" antes que "2-R01"). Los Lote-Red que aparecen en balanza pero no están
  // en la estimación (caso raro) se agregan al final, ordenados igual que antes.
  const presentes = new Set(rows.map(r=>loteRed(r.lote,r.red)));
  let lotesRed;
  if(cultivoActivo === 'arandano'){
    lotesRed = [...presentes].sort((a,b)=>{
      const [la,ra=''] = a.split('-'); const [lb,rb=''] = b.split('-');
      return Number(la)-Number(lb) || ra.localeCompare(rb, undefined, {numeric:true});
    });
  } else {
    const lotesRedEstimacion = ESTIMACION.map(e=>loteRed(e.lote,e.red)).filter(lr=>presentes.has(lr));
    const sinEstimacion = uniq(rows.map(r=>loteRed(r.lote,r.red))).filter(lr=>!lotesRedEstimacion.includes(lr));
    lotesRed = [...lotesRedEstimacion, ...sinEstimacion];
  }
  const matrix = new Map();
  rows.forEach(r=>{
    const key = r.fecha+'|'+loteRed(r.lote,r.red);
    matrix.set(key, (matrix.get(key)||0)+r.kg);
  });
  let thead = '<tr><th style="white-space:nowrap;">Fecha</th><th class="num">Total</th>' + lotesRed.map(lr=>`<th class="num">${lr}</th>`).join('') + '</tr>';
  // Mapa de calor en tonos verdes: la intensidad de cada celda se calcula contra el
  // máximo de kg de ESA fila (ese día) — así resalta, día a día, qué Lote-Red concentró
  // más cosecha, en vez de compararlo contra el histórico completo de la tabla.
  const heatColor = (v, max) => {
    if(!v || max<=0) return 'transparent';
    const t = Math.min(1, v/max); // 0 (tenue) a 1 (más intenso)
    const alpha = 0.08 + t*0.55;
    const rgb = cultivoActivo === 'arandano' ? '91,42,134' : '27,107,60';
    return `rgba(${rgb},${alpha.toFixed(2)})`;
  };
  let tbody = lrDates.map(d=>{
    const valores = lotesRed.map(lr => matrix.get(d+'|'+lr) || 0);
    const maxDia = Math.max(0, ...valores);
    const total = valores.reduce((s,v)=>s+v, 0);
    const cells = lotesRed.map((lr, i)=>{
      const v = valores[i];
      const bg = heatColor(v, maxDia);
      const textColor = v/maxDia > 0.55 ? '#fff' : 'inherit';
      return `<td class="num" style="background:${bg}; color:${textColor};">${v? fmt(v):'—'}</td>`;
    }).join('');
    return `<tr><td style="white-space:nowrap;">${d}</td><td class="num"><b>${fmt(total)}</b></td>${cells}</tr>`;
  }).join('');

  // Fila de Total general (suma de todas las fechas visibles), fija arriba del todo —
  // pegada justo debajo del encabezado — para no tener que bajar hasta el final de la
  // tabla a buscarla.
  const totalesPorLoteRed = lotesRed.map(lr => lrDates.reduce((s,d)=> s + (matrix.get(d+'|'+lr) || 0), 0));
  const totalGeneral = totalesPorLoteRed.reduce((s,v)=>s+v, 0);
  const filaTotal = `<tr class="fila-total-tema" style="font-weight:600; position:sticky; top:29px; z-index:1;">
    <td style="white-space:nowrap;">Total</td><td class="num">${fmt(totalGeneral)}</td>
    ${totalesPorLoteRed.map(v=>`<td class="num">${v? fmt(v):'—'}</td>`).join('')}
  </tr>`;

  document.getElementById('tableLoteRedDia').innerHTML = thead + filaTotal + tbody;

  lastCosechaLoteRedData = { lotesRed, lrDates, matrix, totalesPorLoteRed, totalGeneral };
}

// Exporta "Detalle diario por Lote-Red" a Excel, con la misma fila de Total arriba
// y el mismo orden de columnas que la tabla en pantalla, respetando los filtros
// activos (Lote y Variedad) al momento de la descarga.
let lastCosechaLoteRedData = null;
function exportCosechaLoteRedToExcel(){
  if(!lastCosechaLoteRedData || !lastCosechaLoteRedData.lrDates.length){
    alert('No hay datos para exportar todavía.');
    return;
  }
  const { lotesRed, lrDates, matrix, totalesPorLoteRed, totalGeneral } = lastCosechaLoteRedData;
  const headers = ['Fecha', 'Total', ...lotesRed];
  const aoa = [headers];
  aoa.push(['Total', Math.round(totalGeneral), ...totalesPorLoteRed.map(v=>Math.round(v))]);
  lrDates.forEach(d=>{
    const valores = lotesRed.map(lr => matrix.get(d+'|'+lr) || 0);
    const total = valores.reduce((s,v)=>s+v, 0);
    aoa.push([d, Math.round(total), ...valores.map(v=>Math.round(v))]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h,i)=> i===0 ? {wch:12} : {wch: Math.max(h.length+2, 10)});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Detalle diario Lote-Red');
  const varSuffix = activeVariedades.length ? '_' + activeVariedades.join('-') : '_Todas';
  const stamp = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `Detalle_diario_LoteRed${varSuffix}_${stamp}.xlsx`);
}
document.getElementById('exportLoteRedBtn').addEventListener('click', exportCosechaLoteRedToExcel);

/* ============ PAGE 2: PLAN VS REAL ============ */

/* ============ PAGE 2: PLAN VS REAL ============ */
function renderPlan(){
  const rows = balanza.filter(r => matchVariedad(r.variedad));
  const planBase = cultivoActivo === 'arandano' ? PLAN_SEMANAL_ARANDANO : PLAN_SEMANAL;
  const plan = planBase.filter(p => matchVariedad(p.variedad));

  const realByWeek = new Map();
  rows.forEach(r=>{
    const w = isoWeekStart(r.fecha);
    if(!w) return;
    realByWeek.set(w, (realByWeek.get(w)||0)+r.kg);
  });
  const planByWeek = new Map();
  plan.forEach(p=>{
    planByWeek.set(p.semana, (planByWeek.get(p.semana)||0)+p.kg);
  });
  const weeks = uniq([...realByWeek.keys(), ...planByWeek.keys()]);

  drawComboBar('chartPlanSemana', weeks.map(weekLabel), weeks.map(w=>planByWeek.get(w)||0), weeks.map(w=>realByWeek.get(w)||0));

  // Mapa de calor: Kg Ppto en tonos AZULES, Kg Cos en tonos VERDES — más intenso mientras
  // más kilos, comparado contra el máximo de esa misma columna en toda la tabla.
  const heatShade = (v, max, rgb) => {
    if(!v || max<=0) return 'transparent';
    const t = Math.min(1, v/max);
    return `rgba(${rgb},${(0.08 + t*0.55).toFixed(2)})`;
  };
  const maxP = Math.max(0, ...weeks.map(w=>planByWeek.get(w)||0));
  const maxR = Math.max(0, ...weeks.map(w=>realByWeek.get(w)||0));

  let thead = '<tr><th>Semana</th><th class="num">Kg Ppto.</th><th class="num">Kg Cos.</th><th class="num">Dif.</th><th class="num">%Cump</th></tr>';
  let totP=0, totR=0;
  // Orden de la tabla: de la semana más reciente a la más antigua (al revés del gráfico,
  // que va cronológico de izquierda a derecha).
  let tbody = [...weeks].reverse().map(w=>{
    const p = planByWeek.get(w)||0, r = realByWeek.get(w)||0;
    const c = p>0 ? r/p : (r>0?1:0);
    const bgP = heatShade(p, maxP, '45,110,142');
    const bgR = heatShade(r, maxR, cultivoActivo==='arandano' ? '110,63,139' : '27,107,60');
    const colorP = p/maxP > 0.55 ? '#fff' : 'inherit';
    const colorR = r/maxR > 0.55 ? '#fff' : 'inherit';
    return `<tr><td>${weekLabel(w)} <span style="color:#8a8f83; font-size:11px;">(${w})</span></td>
      <td class="num" style="background:${bgP}; color:${colorP};">${fmt(p)}</td>
      <td class="num" style="background:${bgR}; color:${colorR};">${fmt(r)}</td>
      <td class="num">${fmt(r-p)}</td>
      <td class="num"><span class="pill ${c>=0.8?'ok':'warn'}">${pct(c)}</span></td></tr>`;
  }).join('');
  weeks.forEach(w=>{ totP += planByWeek.get(w)||0; totR += realByWeek.get(w)||0; });
  const filaTotalSemana = `<tr style="background:#EEF3EE; font-weight:600; position:sticky; top:29px; z-index:1;">
    <td><b>Total</b></td><td class="num"><b>${fmt(totP)}</b></td><td class="num"><b>${fmt(totR)}</b></td>
    <td class="num"><b>${fmt(totR-totP)}</b></td><td class="num"><b>${totP>0?pct(totR/totP):'—'}</b></td></tr>`;
  document.getElementById('tablePlanSemana').innerHTML = thead + filaTotalSemana + tbody;

  lastPlanSemanaData = { weeks: [...weeks].reverse(), planByWeek, realByWeek, totP, totR };

  const variedades = uniq([...rows.map(r=>r.variedad), ...plan.map(p=>p.variedad)]);
  let thead2 = '<tr><th>Variedad</th><th class="num">Kg Ppto.</th><th class="num">Kg Cos.</th><th class="num">%Cump</th></tr>';
  const porVariedad = variedades.map(v=>({
    v,
    p: plan.filter(x=>x.variedad===v).reduce((s,x)=>s+x.kg,0),
    r: rows.filter(x=>x.variedad===v).reduce((s,x)=>s+x.kg,0),
  }));
  const maxPvar = Math.max(0, ...porVariedad.map(o=>o.p));
  const maxRvar = Math.max(0, ...porVariedad.map(o=>o.r));
  let tbody2 = porVariedad.map(({v,p,r})=>{
    const c = p>0? r/p : 0;
    const bgP = heatShade(p, maxPvar, '45,110,142');
    const bgR = heatShade(r, maxRvar, cultivoActivo==='arandano' ? '110,63,139' : '27,107,60');
    const colorP = p/maxPvar > 0.55 ? '#fff' : 'inherit';
    const colorR = r/maxRvar > 0.55 ? '#fff' : 'inherit';
    return `<tr><td>${v}</td>
      <td class="num" style="background:${bgP}; color:${colorP};">${fmt(p)}</td>
      <td class="num" style="background:${bgR}; color:${colorR};">${fmt(r)}</td>
      <td class="num"><span class="pill ${c>=0.8?'ok':'warn'}">${pct(c)}</span></td></tr>`;
  }).join('');
  document.getElementById('tablePlanVariedad').innerHTML = thead2 + tbody2;
}

// Exporta "Detalle semanal" (Kg Ppto vs Kg Cos por semana) a Excel, mismo orden y
// fila de Total que la tabla en pantalla, respetando el filtro de Variedad activo.
let lastPlanSemanaData = null;
function exportPlanSemanaToExcel(){
  if(!lastPlanSemanaData || !lastPlanSemanaData.weeks.length){
    alert('No hay datos para exportar todavía.');
    return;
  }
  const { weeks, planByWeek, realByWeek, totP, totR } = lastPlanSemanaData;
  const headers = ['Semana', 'Fecha inicio', 'Kg Ppto.', 'Kg Cos.', 'Dif.', '%Cump'];
  const aoa = [headers];
  aoa.push(['Total', '', Math.round(totP), Math.round(totR), Math.round(totR-totP), totP>0? round1((totR/totP)*100) : 0]);
  weeks.forEach(w=>{
    const p = planByWeek.get(w)||0, r = realByWeek.get(w)||0;
    const c = p>0 ? (r/p)*100 : (r>0?100:0);
    aoa.push([weekLabel(w), w, Math.round(p), Math.round(r), Math.round(r-p), round1(c)]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h,i)=> i===0 ? {wch:12} : {wch: Math.max(h.length+2, 10)});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Detalle semanal');
  const varSuffix = activeVariedades.length ? '_' + activeVariedades.join('-') : '_Todas';
  const stamp = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `Detalle_semanal${varSuffix}_${stamp}.xlsx`);
}
document.getElementById('exportPlanSemanaBtn').addEventListener('click', exportPlanSemanaToExcel);

/* ============ PAGE 3: BINS ============ */

/* ============ PAGE 3: BINS ============ */
function renderBins(){
  const rows = balanza.filter(r => matchVariedad(r.variedad));

  const byLote = sumBy(rows, r=>'Lote '+r.lote, r=>r.kg);
  const lotesSorted = [...byLote.keys()].sort((a,b)=> parseInt(a.replace('Lote ',''))-parseInt(b.replace('Lote ','')));
  drawBar('chartBinsLote', lotesSorted, lotesSorted.map(l=>byLote.get(l)), 'Kg', '#1B6B3C', false, false, true);

  const variedades = uniq(rows.map(r=>r.variedad));
  const byWeekVar = new Map();
  rows.forEach(r=>{
    const w = isoWeekStart(r.fecha);
    if(!w) return;
    const k = w+'|'+r.variedad;
    if(!byWeekVar.has(k)) byWeekVar.set(k, {kg:0, bines:0});
    const o = byWeekVar.get(k); o.kg+=r.kg; o.bines+=(r.bines||0);
  });
  const weeks = uniq(rows.map(r=>isoWeekStart(r.fecha)).filter(Boolean)).sort().reverse();

  const maxPorVariedad = {};
  variedades.forEach(v=>{
    maxPorVariedad[v] = Math.max(0, ...weeks.map(w=>{
      const o = byWeekVar.get(w+'|'+v);
      return o && o.bines>0 ? o.kg/o.bines : 0;
    }));
  });
  // Texto en verde más oscuro/saturado mientras más alto el valor (fondo blanco siempre),
  // en vez de rellenar la celda de color.
  const textShade = (v, max) => {
    if(!v || max<=0) return 'inherit';
    const t = Math.min(1, v/max);
    return `rgba(27,107,60,${(0.45 + t*0.55).toFixed(2)})`;
  };

  let thead = '<tr><th>Semana</th>' + variedades.map(v=>`<th class="num">${v}</th>`).join('') + '</tr>';
  let tbody = weeks.map(w=>{
    const cells = variedades.map(v=>{
      const o = byWeekVar.get(w+'|'+v);
      const avg = o && o.bines>0 ? o.kg/o.bines : null;
      const color = avg ? textShade(avg, maxPorVariedad[v]) : 'inherit';
      return `<td class="num" style="color:${color}; font-weight:600;">${avg? fmt1(avg):'—'}</td>`;
    }).join('');
    return `<tr><td>${weekLabel(w)} <span style="color:#8a8f83; font-size:11px;">(${w})</span></td>${cells}</tr>`;
  }).join('');
  document.getElementById('tableBinsSemana').innerHTML = thead + tbody;

  const byDayLR = new Map();
  rows.forEach(r=>{
    const k = r.fecha+'|'+r.lote+'|'+r.red+'|'+r.variedad;
    if(!byDayLR.has(k)) byDayLR.set(k, {kg:0, bines:0, fecha:r.fecha, lote:r.lote, red:r.red, variedad:r.variedad});
    const o = byDayLR.get(k); o.kg+=r.kg; o.bines+=(r.bines||0);
  });
  let allDayRows = [...byDayLR.values()].sort((a,b)=> b.fecha.localeCompare(a.fecha));

  // Filtro de Lote (select) y Fecha (fecha exacta), específicos de esta tabla.
  const selLote3 = document.getElementById('f3-lote');
  const lotesBins = uniq(allDayRows.map(r=>r.lote)).sort((a,b)=>Number(a)-Number(b));
  const prevLote3 = selLote3.value;
  selLote3.innerHTML = '<option value="">Todos los lotes</option>' + lotesBins.map(l=>`<option value="${l}">Lote ${l}</option>`).join('');
  if(lotesBins.map(String).includes(prevLote3)) selLote3.value = prevLote3;
  const fLote3 = selLote3.value;
  const fFecha3 = document.getElementById('f3-fecha').value;

  const dayRowsFiltradas = allDayRows.filter(o =>
    (!fLote3 || String(o.lote)===String(fLote3)) && (!fFecha3 || o.fecha===fFecha3)
  );

  // Mapas de calor: Bins y Kg con fondo (contra el máximo de la tabla filtrada, no solo
  // la página visible, para que la intensidad no cambie al pasar de página); Kg/Bin en
  // texto verde, igual que en "Prom. Kg/Bin semanal".
  const maxBins = Math.max(0, ...dayRowsFiltradas.map(o=>o.bines));
  const maxKg = Math.max(0, ...dayRowsFiltradas.map(o=>o.kg));
  const maxKgBin = Math.max(0, ...dayRowsFiltradas.map(o=> o.bines>0 ? o.kg/o.bines : 0));
  const textShadeVerde = (v, max) => {
    if(!v || max<=0) return 'inherit';
    return `rgba(27,107,60,${(0.45 + Math.min(1,v/max)*0.55).toFixed(2)})`;
  };

  // Paginación: 30 filas por página.
  const PAGE_SIZE = 30;
  const totalPaginas = Math.max(1, Math.ceil(dayRowsFiltradas.length / PAGE_SIZE));
  if(binsDiaPage >= totalPaginas) binsDiaPage = totalPaginas - 1;
  if(binsDiaPage < 0) binsDiaPage = 0;
  const pageRows = dayRowsFiltradas.slice(binsDiaPage*PAGE_SIZE, binsDiaPage*PAGE_SIZE + PAGE_SIZE);

  let thead2 = '<tr><th>Fecha</th><th>Lote</th><th>Red</th><th>Variedad</th><th class="num">Bins</th><th class="num">Kg</th><th class="num">Kg/Bin</th></tr>';
  let tbody2 = pageRows.map(o=>{
    const kgBin = o.bines>0 ? o.kg/o.bines : null;
    const bgBins = heatShade(o.bines, maxBins, '45,110,142');
    const bgKg = heatShade(o.kg, maxKg, '27,107,60');
    const colorBins = o.bines/maxBins > 0.55 ? '#fff' : 'inherit';
    const colorKg = o.kg/maxKg > 0.55 ? '#fff' : 'inherit';
    const colorKgBin = kgBin ? textShadeVerde(kgBin, maxKgBin) : 'inherit';
    return `<tr><td>${o.fecha}</td><td>${o.lote}</td><td>${o.red}</td><td>${o.variedad}</td>
      <td class="num" style="background:${bgBins}; color:${colorBins};">${o.bines}</td>
      <td class="num" style="background:${bgKg}; color:${colorKg};">${fmt(o.kg)}</td>
      <td class="num" style="color:${colorKgBin}; font-weight:600;">${kgBin? fmt1(kgBin):'—'}</td></tr>`;
  }).join('');
  document.getElementById('tableBinsDia').innerHTML = thead2 + tbody2;

  // Selector de páginas.
  const pagerEl = document.getElementById('binsDiaPager');
  if(totalPaginas <= 1){
    pagerEl.innerHTML = '';
  } else {
    pagerEl.innerHTML = `
      <button class="btn btn-ghost" id="binsDiaPrev" style="padding:6px 12px;" ${binsDiaPage===0?'disabled':''}>‹ Anterior</button>
      <span>Página ${binsDiaPage+1} de ${totalPaginas} <span style="color:#8a8f83;">(${dayRowsFiltradas.length} filas)</span></span>
      <button class="btn btn-ghost" id="binsDiaNext" style="padding:6px 12px;" ${binsDiaPage>=totalPaginas-1?'disabled':''}>Siguiente ›</button>`;
    document.getElementById('binsDiaPrev').addEventListener('click', ()=>{ binsDiaPage--; renderBins(); });
    document.getElementById('binsDiaNext').addEventListener('click', ()=>{ binsDiaPage++; renderBins(); });
  }

  lastBinsDiaData = dayRowsFiltradas;
}

// Exporta "Detalle diario de peso promedio por bin" a Excel — TODAS las filas que
// cumplen el filtro de Lote/Fecha activo, no solo la página que se ve en pantalla.
let lastBinsDiaData = null;
function exportBinsDiaToExcel(){
  if(!lastBinsDiaData || !lastBinsDiaData.length){
    alert('No hay datos para exportar todavía.');
    return;
  }
  const headers = ['Fecha', 'Lote', 'Red', 'Variedad', 'Bins', 'Kg', 'Kg/Bin'];
  const aoa = [headers];
  lastBinsDiaData.forEach(o=>{
    const kgBin = o.bines>0 ? o.kg/o.bines : 0;
    aoa.push([o.fecha, o.lote, o.red, o.variedad, o.bines, Math.round(o.kg), round1(kgBin)]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map(h => ({wch: Math.max(h.length+2, 10)}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Detalle diario bin');
  const varSuffix = activeVariedades.length ? '_' + activeVariedades.join('-') : '_Todas';
  const stamp = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `Detalle_diario_bin${varSuffix}_${stamp}.xlsx`);
}
document.getElementById('exportBinsDiaBtn').addEventListener('click', exportBinsDiaToExcel);

/* ============ PAGE 4: AVANCE HA ============ */
