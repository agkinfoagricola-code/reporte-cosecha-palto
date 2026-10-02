/* ============ KG / COSECHADOR ============ */
let cosechadorDiaPage = 0; // página actual de "Detalle diario"

function quincenaLabelFor(dateStr){
  const d = new Date(dateStr+'T00:00:00');
  const day = d.getDate();
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  if(day >= 26){
    // pertenece a la Q1 del mes SIGUIENTE
    const next = new Date(d.getFullYear(), d.getMonth()+1, 1);
    return 'Q1 ' + monthNames[next.getMonth()];
  } else if(day <= 10){
    return 'Q1 ' + monthNames[d.getMonth()];
  } else {
    return 'Q2 ' + monthNames[d.getMonth()];
  }
}
function mesLabelFor(dateStr){
  const d = new Date(dateStr+'T00:00:00');
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const day = d.getDate();
  // días 26+ cuentan para el mes de cierre de su quincena (el mes siguiente),
  // igual que en quincenaLabelFor, para que mes y quincena sean consistentes.
  if(day >= 26){
    const next = new Date(d.getFullYear(), d.getMonth()+1, 1);
    return monthNames[next.getMonth()];
  }
  return monthNames[d.getMonth()];
}

function codlabAllowedByVariedadFilter(codlab){
  if(activeVariedades.length === 0) return true;
  if(activeVariedades.includes('HASS') && TAREO_HASS_CODES.has(codlab)) return true;
  if((activeVariedades.includes('ETTINGER') || activeVariedades.includes('ZUTANO')) && TAREO_POLINIZANTE_CODES.has(codlab)) return true;
  return false;
}

function cosechadoresPorDia(){
  // trabajadores únicos por fecha, solo labores de cosecha (TAREO_COSECHADOR_CODES),
  // respetando el filtro global de Variedad (arriba en el header).
  const porFecha = {};
  for(const r of tareo){
    if(!TAREO_COSECHADOR_CODES.has(r.codlab)) continue;
    if(!codlabAllowedByVariedadFilter(r.codlab)) continue;
    if(!porFecha[r.fecha]) porFecha[r.fecha] = new Set();
    porFecha[r.fecha].add(r.codigo);
  }
  const out = {};
  for(const f in porFecha) out[f] = porFecha[f].size;
  return out;
}

// Jornales = horas trabajadas / 8 (un jornal = una jornada completa de 8h). A diferencia del
// conteo de cosechadores (que cuenta personas), esto suma fracciones de jornada — alguien que
// trabajó medio día aporta 0.5 jornal, no 1 cosechador completo.
function jornalesPorDia(){
  const horasPorFecha = {};
  for(const r of tareo){
    if(!TAREO_COSECHADOR_CODES.has(r.codlab)) continue;
    if(!codlabAllowedByVariedadFilter(r.codlab)) continue;
    const h = r.horasFormato === 'decimal' ? r.horas : horasDecimalesTareo(r.horas);
    horasPorFecha[r.fecha] = (horasPorFecha[r.fecha]||0) + h;
  }
  const out = {};
  for(const f in horasPorFecha) out[f] = horasPorFecha[f] / 8;
  return out;
}

function kgPorDia(){
  const out = {};
  for(const r of balanza){
    if(!matchVariedadKgJornal(r.variedad)) continue;
    out[r.fecha] = (out[r.fecha]||0) + r.kg;
  }
  return out;
}

function renderCosechadores(){
  if(cultivoActivo === 'arandano'){ renderCosechadoresArandano(); return; }
  const trabajadores = cosechadoresPorDia();
  const jornales = jornalesPorDia();
  const kilos = kgPorDia();
  const fechas = uniq([...Object.keys(trabajadores), ...Object.keys(kilos)]);

  // --- detalle diario ---
  let filas = fechas.map(f=>{
    const trab = trabajadores[f] || null;
    const jorn = jornales[f] || null;
    const kg = kilos[f] || null;
    const ratio = (trab && kg) ? kg/trab : null;
    const ratioJornal = (jorn && kg) ? kg/jorn : null;
    return { fecha: f, trab, jorn, kg, ratio, ratioJornal };
  }).sort((a,b)=> b.fecha.localeCompare(a.fecha)); // más reciente primero

  // Filtro de fecha exacta.
  const fFechaCosech = document.getElementById('f7-fecha').value;
  const filasFiltradas = fFechaCosech ? filas.filter(r=>r.fecha===fFechaCosech) : filas;

  // Paginación.
  const pageSizeSel7 = document.getElementById('f7-pageSize');
  const pageSize7 = pageSizeSel7.value === 'todas' ? filasFiltradas.length || 1 : parseInt(pageSizeSel7.value);
  const totalPaginas7 = Math.max(1, Math.ceil(filasFiltradas.length / pageSize7));
  if(cosechadorDiaPage >= totalPaginas7) cosechadorDiaPage = totalPaginas7 - 1;
  if(cosechadorDiaPage < 0) cosechadorDiaPage = 0;
  const filasPagina7 = filasFiltradas.slice(cosechadorDiaPage*pageSize7, cosechadorDiaPage*pageSize7 + pageSize7);

  let dailyHtml = '<tr><th style="white-space:nowrap;">Fecha</th><th>Cosechadores</th><th>Jornales</th><th>Kg</th><th>Kg / Cosechador</th><th>Kg / Jornal</th></tr>';
  for(const r of filasPagina7){
    dailyHtml += `<tr>
      <td style="white-space:nowrap;">${r.fecha}</td>
      <td>${r.trab ?? '—'}</td>
      <td>${r.jorn!=null ? fmt1(r.jorn) : '—'}</td>
      <td>${r.kg!=null ? fmt(r.kg) : '—'}</td>
      <td>${r.ratio!=null ? fmt1(r.ratio) : '—'}</td>
      <td>${r.ratioJornal!=null ? fmt1(r.ratioJornal) : '—'}</td>
    </tr>`;
  }
  document.getElementById('tableCosechadorDia').innerHTML = dailyHtml;

  const pagerEl7 = document.getElementById('cosechadorDiaPager');
  if(totalPaginas7 <= 1){
    pagerEl7.innerHTML = '';
  } else {
    pagerEl7.innerHTML = `
      <button class="btn btn-ghost" id="cosechadorDiaPrev" style="padding:6px 12px;" ${cosechadorDiaPage===0?'disabled':''}>‹ Anterior</button>
      <span>Página ${cosechadorDiaPage+1} de ${totalPaginas7} <span style="color:#8a8f83;">(${filasFiltradas.length} filas)</span></span>
      <button class="btn btn-ghost" id="cosechadorDiaNext" style="padding:6px 12px;" ${cosechadorDiaPage>=totalPaginas7-1?'disabled':''}>Siguiente ›</button>`;
    document.getElementById('cosechadorDiaPrev').addEventListener('click', ()=>{ cosechadorDiaPage--; renderCosechadores(); });
    document.getElementById('cosechadorDiaNext').addEventListener('click', ()=>{ cosechadorDiaPage++; renderCosechadores(); });
  }

  // --- chart: ratio diario (solo días con ambos datos), en orden cronológico ---
  const conRatio = [...filas].filter(r=>r.ratio!=null).sort((a,b)=> a.fecha.localeCompare(b.fecha));
  drawBar('chartCosechadorDia', conRatio.map(r=>r.fecha), conRatio.map(r=>r.ratio), 'Kg / Cosechador', '#3F9E64', true);

  // --- agregados por quincena y por mes ---
  const quincenas = {}; // label -> {persondays, jornales, kg, dias}
  const meses = {};
  for(const r of filas){
    if(r.trab==null || r.kg==null) continue;
    const ql = quincenaLabelFor(r.fecha);
    const ml = mesLabelFor(r.fecha);
    if(!quincenas[ql]) quincenas[ql] = {persondays:0, jornales:0, kg:0, dias:0};
    quincenas[ql].persondays += r.trab; quincenas[ql].jornales += (r.jorn||0); quincenas[ql].kg += r.kg; quincenas[ql].dias++;
    if(!meses[ml]) meses[ml] = {persondays:0, jornales:0, kg:0, dias:0};
    meses[ml].persondays += r.trab; meses[ml].jornales += (r.jorn||0); meses[ml].kg += r.kg; meses[ml].dias++;
  }

  const qOrder = Object.keys(quincenas).sort((a,b)=>{
    // ordena por fecha real usando la primera fecha de cada quincena, de la más reciente
    // a la más antigua (quincena actual primero, quincena inicial de campaña al final).
    const fa = filas.find(r=>quincenaLabelFor(r.fecha)===a)?.fecha || '';
    const fb = filas.find(r=>quincenaLabelFor(r.fecha)===b)?.fecha || '';
    return fb.localeCompare(fa);
  });
  let qHtml = '<tr><th>Quincena</th><th>Días</th><th>Persona-días</th><th>Jornales</th><th>Kg totales</th><th>Kg/persona-día</th><th>Kg/jornal</th></tr>';
  let qTotDias=0, qTotPersonDays=0, qTotJornales=0, qTotKg=0;
  for(const q of qOrder){
    const d = quincenas[q];
    qTotDias+=d.dias; qTotPersonDays+=d.persondays; qTotJornales+=d.jornales; qTotKg+=d.kg;
    qHtml += `<tr><td>${q}</td><td>${d.dias}</td><td>${fmt(d.persondays)}</td><td>${fmt1(d.jornales)}</td><td>${fmt(d.kg)}</td><td>${fmt1(d.kg/d.persondays)}</td><td>${d.jornales>0?fmt1(d.kg/d.jornales):'—'}</td></tr>`;
  }
  qHtml += `<tr style="background:#EEF3EE; font-weight:600;"><td>Total</td><td>${qTotDias}</td><td>${fmt(qTotPersonDays)}</td><td>${fmt1(qTotJornales)}</td><td>${fmt(qTotKg)}</td>
    <td>${qTotPersonDays>0?fmt1(qTotKg/qTotPersonDays):'—'}</td><td>${qTotJornales>0?fmt1(qTotKg/qTotJornales):'—'}</td></tr>`;
  document.getElementById('tableCosechadorQuincena').innerHTML = qHtml;

  const monthOrderRef = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mOrder = Object.keys(meses).sort((a,b)=>monthOrderRef.indexOf(b)-monthOrderRef.indexOf(a));
  let mHtml = '<tr><th>Mes</th><th>Días</th><th>Persona-días</th><th>Jornales</th><th>Kg totales</th><th>Kg/persona-día</th><th>Kg/jornal</th></tr>';
  let mTotDias=0, mTotPersonDays=0, mTotJornales=0, mTotKg=0;
  for(const m of mOrder){
    const d = meses[m];
    mTotDias+=d.dias; mTotPersonDays+=d.persondays; mTotJornales+=d.jornales; mTotKg+=d.kg;
    mHtml += `<tr><td>${m}</td><td>${d.dias}</td><td>${fmt(d.persondays)}</td><td>${fmt1(d.jornales)}</td><td>${fmt(d.kg)}</td><td>${fmt1(d.kg/d.persondays)}</td><td>${d.jornales>0?fmt1(d.kg/d.jornales):'—'}</td></tr>`;
  }
  mHtml += `<tr style="background:#EEF3EE; font-weight:600;"><td>Total</td><td>${mTotDias}</td><td>${fmt(mTotPersonDays)}</td><td>${fmt1(mTotJornales)}</td><td>${fmt(mTotKg)}</td>
    <td>${mTotPersonDays>0?fmt1(mTotKg/mTotPersonDays):'—'}</td><td>${mTotJornales>0?fmt1(mTotKg/mTotJornales):'—'}</td></tr>`;
  document.getElementById('tableCosechadorMes').innerHTML = mHtml;

  // --- KPIs ---
  const totalPersonDays = filas.reduce((s,r)=> s + (r.trab && r.kg ? r.trab : 0), 0);
  const totalJornales = filas.reduce((s,r)=> s + ((r.jorn && r.kg) ? r.jorn : 0), 0);
  const totalKg = filas.reduce((s,r)=> s + (r.trab && r.kg ? r.kg : 0), 0);
  const diasConAmbos = conRatio.length;
  const cards = [
    {label:'Total de Días', value: diasConAmbos},
    {label:'Cosechadores', value: fmt(totalPersonDays)},
    {label:'Jornales totales', value: fmt1(totalJornales)},
    {label:'Kg / Cosechador', value: totalPersonDays>0 ? fmt1(totalKg/totalPersonDays) : '—'},
  ];
  document.getElementById('kpiCosechadores').innerHTML = cards.map(c=>`
    <div class="kpi">
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
    </div>`).join('');
}

/* ============ ARÁNDANO: Kg / Cosechador ============
   Mismo diseño que Palto, pero usando tareoArandano y un único código de cosecha (5129
   ARA-COSECHADOR) — no hay split Hass/Poli por variedad, así que el conteo de cosechadores
   NO se puede filtrar por variedad (solo el Kg, que sí viene de la balanza filtrada). */
function cosechadoresPorDiaArandano(){
  const porFecha = {};
  for(const r of tareoArandano){
    if(!TAREO_COSECHADOR_CODES_ARANDANO.has(r.codlab)) continue;
    if(!porFecha[r.fecha]) porFecha[r.fecha] = new Set();
    porFecha[r.fecha].add(r.codigo);
  }
  const out = {};
  for(const f in porFecha) out[f] = porFecha[f].size;
  return out;
}

function jornalesPorDiaArandano(){
  const horasPorFecha = {};
  for(const r of tareoArandano){
    if(!TAREO_COSECHADOR_CODES_ARANDANO.has(r.codlab)) continue;
    const h = r.horasFormato === 'decimal' ? r.horas : horasDecimalesTareo(r.horas);
    horasPorFecha[r.fecha] = (horasPorFecha[r.fecha]||0) + h;
  }
  const out = {};
  for(const f in horasPorFecha) out[f] = horasPorFecha[f] / 8;
  return out;
}

function renderCosechadoresArandano(){
  const trabajadores = cosechadoresPorDiaArandano();
  const jornales = jornalesPorDiaArandano();
  const kilos = kgPorDia(); // genérico: usa `balanza` (ya apunta a balanzaArandano) + matchVariedad
  const fechas = uniq([...Object.keys(trabajadores), ...Object.keys(kilos)]);

  let filas = fechas.map(f=>{
    const trab = trabajadores[f] || null;
    const jorn = jornales[f] || null;
    const kg = kilos[f] || null;
    const ratio = (trab && kg) ? kg/trab : null;
    const ratioJornal = (jorn && kg) ? kg/jorn : null;
    return { fecha: f, trab, jorn, kg, ratio, ratioJornal };
  }).sort((a,b)=> b.fecha.localeCompare(a.fecha));

  const fFechaCosech = document.getElementById('f7-fecha').value;
  const filasFiltradas = fFechaCosech ? filas.filter(r=>r.fecha===fFechaCosech) : filas;

  const pageSizeSel7 = document.getElementById('f7-pageSize');
  const pageSize7 = pageSizeSel7.value === 'todas' ? filasFiltradas.length || 1 : parseInt(pageSizeSel7.value);
  const totalPaginas7 = Math.max(1, Math.ceil(filasFiltradas.length / pageSize7));
  if(cosechadorDiaPage >= totalPaginas7) cosechadorDiaPage = totalPaginas7 - 1;
  if(cosechadorDiaPage < 0) cosechadorDiaPage = 0;
  const filasPagina7 = filasFiltradas.slice(cosechadorDiaPage*pageSize7, cosechadorDiaPage*pageSize7 + pageSize7);

  let dailyHtml = '<tr><th style="white-space:nowrap;">Fecha</th><th>Cosechadores</th><th>Jornales</th><th>Kg</th><th>Kg / Cosechador</th><th>Kg / Jornal</th></tr>';
  for(const r of filasPagina7){
    dailyHtml += `<tr>
      <td style="white-space:nowrap;">${r.fecha}</td>
      <td>${r.trab ?? '—'}</td>
      <td>${r.jorn!=null ? fmt1(r.jorn) : '—'}</td>
      <td>${r.kg!=null ? fmt(r.kg) : '—'}</td>
      <td>${r.ratio!=null ? fmt1(r.ratio) : '—'}</td>
      <td>${r.ratioJornal!=null ? fmt1(r.ratioJornal) : '—'}</td>
    </tr>`;
  }
  document.getElementById('tableCosechadorDia').innerHTML = dailyHtml;

  const pagerEl7 = document.getElementById('cosechadorDiaPager');
  if(totalPaginas7 <= 1){
    pagerEl7.innerHTML = '';
  } else {
    pagerEl7.innerHTML = `
      <button class="btn btn-ghost" id="cosechadorDiaPrev" style="padding:6px 12px;" ${cosechadorDiaPage===0?'disabled':''}>‹ Anterior</button>
      <span>Página ${cosechadorDiaPage+1} de ${totalPaginas7} <span style="color:#8a8f83;">(${filasFiltradas.length} filas)</span></span>
      <button class="btn btn-ghost" id="cosechadorDiaNext" style="padding:6px 12px;" ${cosechadorDiaPage>=totalPaginas7-1?'disabled':''}>Siguiente ›</button>`;
    document.getElementById('cosechadorDiaPrev').addEventListener('click', ()=>{ cosechadorDiaPage--; renderCosechadoresArandano(); });
    document.getElementById('cosechadorDiaNext').addEventListener('click', ()=>{ cosechadorDiaPage++; renderCosechadoresArandano(); });
  }

  const conRatio = [...filas].filter(r=>r.ratio!=null).sort((a,b)=> a.fecha.localeCompare(b.fecha));
  drawBar('chartCosechadorDia', conRatio.map(r=>r.fecha), conRatio.map(r=>r.ratio), 'Kg / Cosechador', getThemeColor('--aguacate', '#6E3F8B'), true);

  const quincenas = {};
  const meses = {};
  for(const r of filas){
    if(r.trab==null || r.kg==null) continue;
    const ql = quincenaLabelFor(r.fecha);
    const ml = mesLabelFor(r.fecha);
    if(!quincenas[ql]) quincenas[ql] = {persondays:0, jornales:0, kg:0, dias:0};
    quincenas[ql].persondays += r.trab; quincenas[ql].jornales += (r.jorn||0); quincenas[ql].kg += r.kg; quincenas[ql].dias++;
    if(!meses[ml]) meses[ml] = {persondays:0, jornales:0, kg:0, dias:0};
    meses[ml].persondays += r.trab; meses[ml].jornales += (r.jorn||0); meses[ml].kg += r.kg; meses[ml].dias++;
  }

  const qOrder = Object.keys(quincenas).sort((a,b)=>{
    const fa = filas.find(r=>quincenaLabelFor(r.fecha)===a)?.fecha || '';
    const fb = filas.find(r=>quincenaLabelFor(r.fecha)===b)?.fecha || '';
    return fb.localeCompare(fa);
  });
  let qHtml = '<tr><th>Quincena</th><th>Días</th><th>Persona-días</th><th>Jornales</th><th>Kg totales</th><th>Kg/persona-día</th><th>Kg/jornal</th></tr>';
  let qTotDias=0, qTotPersonDays=0, qTotJornales=0, qTotKg=0;
  for(const q of qOrder){
    const d = quincenas[q];
    qTotDias+=d.dias; qTotPersonDays+=d.persondays; qTotJornales+=d.jornales; qTotKg+=d.kg;
    qHtml += `<tr><td>${q}</td><td>${d.dias}</td><td>${fmt(d.persondays)}</td><td>${fmt1(d.jornales)}</td><td>${fmt(d.kg)}</td><td>${fmt1(d.kg/d.persondays)}</td><td>${d.jornales>0?fmt1(d.kg/d.jornales):'—'}</td></tr>`;
  }
  qHtml += `<tr style="background:#F1EAF5; font-weight:600;"><td>Total</td><td>${qTotDias}</td><td>${fmt(qTotPersonDays)}</td><td>${fmt1(qTotJornales)}</td><td>${fmt(qTotKg)}</td>
    <td>${qTotPersonDays>0?fmt1(qTotKg/qTotPersonDays):'—'}</td><td>${qTotJornales>0?fmt1(qTotKg/qTotJornales):'—'}</td></tr>`;
  document.getElementById('tableCosechadorQuincena').innerHTML = qHtml;

  const monthOrderRef = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mOrder = Object.keys(meses).sort((a,b)=>monthOrderRef.indexOf(b)-monthOrderRef.indexOf(a));
  let mHtml = '<tr><th>Mes</th><th>Días</th><th>Persona-días</th><th>Jornales</th><th>Kg totales</th><th>Kg/persona-día</th><th>Kg/jornal</th></tr>';
  let mTotDias=0, mTotPersonDays=0, mTotJornales=0, mTotKg=0;
  for(const m of mOrder){
    const d = meses[m];
    mTotDias+=d.dias; mTotPersonDays+=d.persondays; mTotJornales+=d.jornales; mTotKg+=d.kg;
    mHtml += `<tr><td>${m}</td><td>${d.dias}</td><td>${fmt(d.persondays)}</td><td>${fmt1(d.jornales)}</td><td>${fmt(d.kg)}</td><td>${fmt1(d.kg/d.persondays)}</td><td>${d.jornales>0?fmt1(d.kg/d.jornales):'—'}</td></tr>`;
  }
  mHtml += `<tr style="background:#F1EAF5; font-weight:600;"><td>Total</td><td>${mTotDias}</td><td>${fmt(mTotPersonDays)}</td><td>${fmt1(mTotJornales)}</td><td>${fmt(mTotKg)}</td>
    <td>${mTotPersonDays>0?fmt1(mTotKg/mTotPersonDays):'—'}</td><td>${mTotJornales>0?fmt1(mTotKg/mTotJornales):'—'}</td></tr>`;
  document.getElementById('tableCosechadorMes').innerHTML = mHtml;

  const totalPersonDays = filas.reduce((s,r)=> s + (r.trab && r.kg ? r.trab : 0), 0);
  const totalJornales = filas.reduce((s,r)=> s + ((r.jorn && r.kg) ? r.jorn : 0), 0);
  const totalKg = filas.reduce((s,r)=> s + (r.trab && r.kg ? r.kg : 0), 0);
  const diasConAmbos = conRatio.length;
  const cards = [
    {label:'Total de Días', value: diasConAmbos},
    {label:'Cosechadores', value: fmt(totalPersonDays)},
    {label:'Jornales totales', value: fmt1(totalJornales)},
    {label:'Kg / Cosechador', value: totalPersonDays>0 ? fmt1(totalKg/totalPersonDays) : '—'},
  ];
  document.getElementById('kpiCosechadores').innerHTML = cards.map(c=>`
    <div class="kpi">
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
    </div>`).join('');
}

document.getElementById('f7-fecha').addEventListener('change', ()=>{ cosechadorDiaPage = 0; renderCosechadores(); });
document.getElementById('f7-fechaClear').addEventListener('click', ()=>{
  document.getElementById('f7-fecha').value = '';
  cosechadorDiaPage = 0;
  renderCosechadores();
});
document.getElementById('f7-pageSize').addEventListener('change', ()=>{ cosechadorDiaPage = 0; renderCosechadores(); });
