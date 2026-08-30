/* ============ PAGE 4: AVANCE HA ============ */
let lastAvanceData = null; // {rows:[...], totals:{...}} — usado también para exportar a Excel

function renderAvance(){
  // Filtro de Lote específico de esta tabla.
  const selLote4 = document.getElementById('f4-lote');
  const lotesAvance = uniq(ESTIMACION.map(e=>e.lote)).sort((a,b)=>Number(a)-Number(b));
  const prevLote4 = selLote4.value;
  selLote4.innerHTML = '<option value="">Todos los lotes</option>' + lotesAvance.map(l=>`<option value="${l}">Lote ${l}</option>`).join('');
  if(lotesAvance.map(String).includes(prevLote4)) selLote4.value = prevLote4;

  let thead = `<tr><th>Lote</th><th>Red</th><th class="num">Has Ppto</th>
    <th class="num">Ha Selectivo</th><th class="num">Ha Barrido/DS</th><th class="num">Av. Ha</th>
    <th class="num">Kg Total Ppto</th><th class="num">Kg Total Real</th><th>% Cumpl. Kg Total</th>
    <th class="num">Kg/Ha Ppto</th><th class="num">Kg/Ha Real</th><th class="num">Var. Kg/Ha</th><th>Kg/Ha Ppto vs Kg/Ha Real</th></tr>`;
  const { selectivo: selectivoMap, barrido: barridoMap } = computeHaAvancePorLoteRed();
  const cerradoFlagMap = computeCerradoFlagPorLoteRed();
  const fLote4 = document.getElementById('f4-lote').value;
  const estimacionFiltrada = ESTIMACION.filter(e => !fLote4 || String(e.lote)===String(fLote4));
  let totHas=0, totKgP=0, totAvHa=0, totKgR=0, totBarrido=0, totSelectivo=0;
  const dataRows = [];
  const rowsHtml = estimacionFiltrada.map(e=>{
    const balRows = balanza.filter(b=> b.lote==e.lote && b.red==e.red && matchVariedad(b.variedad));
    const kgReal = balRows.reduce((s,r)=>s+r.kg,0);
    const kgxhaPpto = kgxhaPptoFor(e, activeVariedades);
    const kgTotalPpto = kgxhaPpto * e.has;

    const key = e.lote+'-'+e.red;
    const haSelectivo = selectivoMap.get(key) || 0;
    const haBarrido = barridoMap.get(key) || 0;
    // Av. Ha (usada para Kg/Ha Real) es directamente lo barrido — ya viene bien acotado por sector.
    const avHa = haBarrido;
    const kgxhaReal = avHa>0 ? kgReal/avHa : 0;
    const ratio = kgxhaPpto>0 ? kgxhaReal/kgxhaPpto : 0;
    const ratioKg = kgTotalPpto>0 ? kgReal/kgTotalPpto : 0;
    // Lote-Red "cerrado": ya se barrió el 100% (o más) de las Has Ppto, O el archivo de
    // hectáreas trae marcado Cerrado=Sí en el último evento de cada sector físico (esta segunda
    // señal detecta el cierre incluso cuando el acumulado de Ha todavía no alcanza el umbral,
    // p.ej. por descuadres menores entre Has Ppto y la superficie física real de los sectores).
    const key2 = e.lote+'-'+e.red;
    const cerradoPorFlag = cerradoFlagMap.get(key2) === true;
    // OJO: la bandera de cierre no respeta el filtro de Variedad (es un hecho físico del terreno),
    // y un mismo Lote-Red puede tener variedades distintas ya cerradas (p.ej. Zutano/Ettinger
    // barridos al 100% en mayo) mientras la variedad activa (p.ej. Hass) recién va empezando su
    // propio selectivo. Por eso la bandera solo se acepta como respaldo cuando el avance de la
    // variedad activa YA está cerca del Has Ppto (≥90%) — para casos de descuadre menor por
    // redondeo de superficie, no para dar por cerrada una variedad que apenas comenzó.
    const cerrado = (e.has>0 && avHa >= e.has - 0.05) || (cerradoPorFlag && e.has>0 && avHa >= e.has*0.9);

    totHas+=e.has; totKgP+=kgTotalPpto; totAvHa+=avHa; totKgR+=kgReal;
    totBarrido+=haBarrido; totSelectivo+=haSelectivo;

    dataRows.push({
      lote: e.lote, red: e.red, hasPpto: e.has, haSelectivo, haBarrido, avHa,
      kgxhaPpto, kgTotalPpto, kgReal, kgxhaReal, varKgHa: kgxhaReal - kgxhaPpto,
      estadoPct: ratio, cumplKgPct: ratioKg, cerrado
    });

    return `<tr${cerrado ? ' style="background:#E3F1E6;"' : ''}><td>${e.lote}</td><td>${e.red}</td><td class="num">${fmt1(e.has)}</td>
      <td class="num">${fmt1(haSelectivo)}</td><td class="num">${fmt1(haBarrido)}</td><td class="num">${fmt1(avHa)}${cerrado ? ' ✅' : ''}</td>
      <td class="num">${fmt(kgTotalPpto)}</td><td class="num">${fmt(kgReal)}</td><td>${estadoPillKg(ratioKg)}</td>
      <td class="num">${fmt(kgxhaPpto)}</td><td class="num">${fmt(kgxhaReal)}</td><td class="num">${fmt(kgxhaReal - kgxhaPpto)}</td><td>${estadoPill(ratio)}</td></tr>`;
  }).join('');
  const totKgxHaPpto = totHas>0 ? totKgP/totHas : 0;
  const totKgxHaReal = totAvHa>0 ? totKgR/totAvHa : 0;
  const totRatio = totKgxHaPpto>0 ? totKgxHaReal/totKgxHaPpto : 0;
  const totRatioKg = totKgP>0 ? totKgR/totKgP : 0;
  const totRow = `<tr style="background:#EEF3EE; position:sticky; top:29px; z-index:1;"><td><b>Total / Prom.</b></td><td></td><td class="num"><b>${fmt1(totHas)}</b></td>
    <td class="num"><b>${fmt1(totSelectivo)}</b></td><td class="num"><b>${fmt1(totBarrido)}</b></td>
    <td class="num"><b>${fmt1(totAvHa)}</b></td>
    <td class="num"><b>${fmt(totKgP)}</b></td><td class="num"><b>${fmt(totKgR)}</b></td><td><b>${estadoPillKg(totRatioKg)}</b></td>
    <td class="num"><b>${fmt(totKgxHaPpto)}</b></td><td class="num"><b>${fmt(totKgxHaReal)}</b></td><td class="num"><b>${fmt(totKgxHaReal-totKgxHaPpto)}</b></td>
    <td><b>${estadoPill(totRatio)}</b></td></tr>`;
  document.getElementById('tableAvance').innerHTML = thead + totRow + rowsHtml;

  lastAvanceData = {
    rows: dataRows,
    totals: {
      hasPpto: totHas, haSelectivo: totSelectivo, haBarrido: totBarrido, avHa: totAvHa,
      kgxhaPpto: totKgxHaPpto, kgTotalPpto: totKgP, kgReal: totKgR,
      kgxhaReal: totKgxHaReal, varKgHa: totKgxHaReal - totKgxHaPpto, estadoPct: totRatio,
      cumplKgPct: totRatioKg
    }
  };
}

// Exporta la tabla "Kg/ha real vs ppto por Lote-Red" a un archivo .xlsx, respetando
// el filtro global de Variedad activo en el momento de la descarga.
function exportAvanceToExcel(){
  if(!lastAvanceData || !lastAvanceData.rows.length){
    alert('No hay datos para exportar todavía.');
    return;
  }
  const headers = ['Lote','Red','Has Ppto','Ha Selectivo','Ha Barrido/DS','Av. Ha',
    'Kg Total Ppto','Kg Total Real','% Cumpl. Kg Total','Kg/Ha Ppto','Kg/Ha Real','Var. Kg/Ha','Kg/Ha Ppto vs Kg/Ha Real','Cerrado'];
  const aoa = [headers];
  lastAvanceData.rows.forEach(r=>{
    aoa.push([
      r.lote, r.red,
      round1(r.hasPpto), round1(r.haSelectivo), round1(r.haBarrido), round1(r.avHa),
      Math.round(r.kgTotalPpto), Math.round(r.kgReal), round1(r.cumplKgPct*100),
      Math.round(r.kgxhaPpto), Math.round(r.kgxhaReal), Math.round(r.varKgHa), round1(r.estadoPct*100),
      r.cerrado ? 'Sí' : 'No'
    ]);
  });
  const t = lastAvanceData.totals;
  aoa.push([
    'Total / Prom.', '',
    round1(t.hasPpto), round1(t.haSelectivo), round1(t.haBarrido), round1(t.avHa),
    Math.round(t.kgTotalPpto), Math.round(t.kgReal), round1(t.cumplKgPct*100),
    Math.round(t.kgxhaPpto), Math.round(t.kgxhaReal), Math.round(t.varKgHa), round1(t.estadoPct*100), ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h,i)=> i===0 ? {wch:8} : {wch: Math.max(h.length+2, 11)});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kg Real vs Ppto');

  const varSuffix = activeVariedades.length ? '_' + activeVariedades.join('-') : '_Todas';
  const stamp = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `Kg_Real_vs_Ppto${varSuffix}_${stamp}.xlsx`);
}

function round1(n){ return Math.round((n||0) * 10) / 10; }

document.getElementById('exportAvanceBtn').addEventListener('click', exportAvanceToExcel);

/* ============ PAGE 5: DETALLE SECTORES ============ */
