/* ============ PAGE 5: DETALLE SECTORES ============
   Prorrateo por Lote-Red: usa el % de BINES reportado en campo (más preciso, sigue el
   ritmo real día a día) cuando ese Lote-Red ya tiene bines cargados en el comparativo;
   si todavía no hay bines para esa zona (o el admin aún no cargó el Excel), cae de
   vuelta a Ha Ppto (superficie), como se hacía antes. Cada fila de "Total" muestra con
   qué método se prorrateó, para que quede transparente cuál se está usando. */
let sectoresPage = 0; // página actual de "Detalle por Lote-Red-Sector"

function renderSectores(){
  const fLote = document.getElementById('f5-lote').value; // '' = Todos los lotes
  const fRed = document.getElementById('f5-red').value;
  const lotesAProcesar = fLote ? [String(fLote)] : uniq(ESTIMACION.map(e=>e.lote)).sort((a,b)=>Number(a)-Number(b)).map(String);

  let sectorDetails = computeSectorDetails().filter(s => lotesAProcesar.includes(String(s.lote)) && (!fRed || s.red===fRed));
  const variedades = activeVariedades.length ? activeVariedades : ['HASS','ETTINGER','ZUTANO'];

  // filtro de búsqueda por número de sector: acepta lista separada por comas, ej "43,47,48,50"
  const sectorSearchRaw = (document.getElementById('f5-sectorSearch').value || '').trim();
  if(sectorSearchRaw){
    const wanted = sectorSearchRaw.split(',').map(x=>x.trim()).filter(Boolean);
    sectorDetails = sectorDetails.filter(s => wanted.some(w => s.sector.toUpperCase().includes(w.toUpperCase())));
  }

  // suma de superficie por lote-red, para prorratear el Kg Ppto de cada sector (solo referencial a nivel sector)
  // OJO: se calcula ANTES del filtro de búsqueda, sobre todos los sectores de ese lote-red, para que el
  // prorrateo (y por tanto el Kg Ppto/Ha) no cambie según lo que el usuario esté buscando.
  const supSumByLoteRed = new Map();
  computeSectorDetails().filter(s => lotesAProcesar.includes(String(s.lote)) && (!fRed || s.red===fRed)).forEach(s=>{
    const key = s.lote+'-'+s.red;
    supSumByLoteRed.set(key, (supSumByLoteRed.get(key)||0) + s.superficie);
  });

  let thead = `<tr><th>LR Sector</th><th>Variedad</th><th class="num">Ha Ppto</th><th class="num">Ha Real</th>
    <th class="num">Diferencia Ha</th><th class="num">Kg Ppto</th><th class="num">Kg Real</th>
    <th class="num">Kg Ppto/Ha</th><th class="num">Kg Real/Ha</th><th>Kg/Ha Ppto vs Kg/Ha Real</th><th class="num">% del Lote-Red</th><th>Cerrado</th></tr>`;

  const barCell = (frac) => {
    const w = Math.max(0, Math.min(100, frac*100));
    const color = frac>=1 ? 'var(--verde-ok)' : 'var(--pulpa)';
    return `<div style="display:flex; align-items:center; gap:8px;">
      <div style="flex:1; background:#EEF1EE; border-radius:4px; height:8px; overflow:hidden; min-width:50px;">
        <div style="width:${w}%; background:${color}; height:100%;"></div>
      </div>
      <span style="font-family:var(--font-mono); font-size:11px; white-space:nowrap;">${pct(frac)}</span>
    </div>`;
  };

  // Arma TODAS las filas (Total primero, luego sus sectores) en un solo array — así se
  // puede paginar el conjunto completo sin importar a qué Lote-Red-Variedad pertenece cada fila.
  const filas = [];

  lotesAProcesar.forEach(lote=>{
    const sectorDetailsDeLote = sectorDetails.filter(s=>String(s.lote)===lote);
    const reds = uniq(sectorDetailsDeLote.map(s=>s.red));
    reds.forEach(red=>{
      const sectoresDeRed = sectorDetailsDeLote.filter(s=>s.red===red).sort((a,b)=> a.sector.localeCompare(b.sector));
      const e = ESTIMACION.find(x=> String(x.lote)===lote && x.red===red);
      if(!e) return;
      const supSum = supSumByLoteRed.get(lote+'-'+red) || 0;

      // Prorrateo por bines si ese Lote-Red ya tiene comparativo cargado; si no, Ha Ppto.
      const shareBines = shareBinesPorLoteRed(lote, red);
      const usaBines = shareBines.size > 0;

      variedades.forEach(v=>{
        const kgRealTotal = balanza.filter(b=> String(b.lote)===lote && b.red===red && b.variedad===v).reduce((s,r)=>s+r.kg,0);

        const haPptoTotal = sectoresDeRed.reduce((s,x)=>s+x.superficie,0);
        const haRealTotal = sectoresDeRed.reduce((s,x)=>s+x.areaSector,0);
        const kgPptoTotal = kgPptoVariedad(e, v);
        const kgHaPpto = haPptoTotal>0 ? kgPptoTotal/haPptoTotal : 0;
        const kgHaReal = haRealTotal>0 ? kgRealTotal/haRealTotal : 0;
        const cump = kgHaPpto>0 ? kgHaReal/kgHaPpto : 0;

        // Fila de TOTAL, al inicio del grupo.
        filas.push(`<tr style="background:#EEF3EE; font-weight:600;">
          <td colspan="2">Total Lote ${lote} - ${red} - ${v}</td>
          <td class="num">${fmt1(haPptoTotal)}</td><td class="num">${fmt1(haRealTotal)}</td>
          <td class="num">${fmt1(haPptoTotal-haRealTotal)}</td>
          <td class="num">${fmt(kgPptoTotal)}</td>
          <td class="num">${fmt(kgRealTotal)}</td>
          <td class="num">${fmt(kgHaPpto)}</td>
          <td class="num">${fmt(kgHaReal)}</td>
          <td>${estadoPill(cump)}</td>
          <td class="num">100%</td>
          <td>${barCell(cump)}</td></tr>`);

        // Filas de detalle por sector.
        sectoresDeRed.forEach(s=>{
          const share = usaBines ? (shareBines.get(s.sector) || 0) : (supSum>0 ? s.superficie/supSum : 0);
          const kgPptoSector = kgPptoVariedad(e, v) * share;
          const kgHaPptoSector = s.superficie>0 ? kgPptoSector/s.superficie : 0;
          const kgRealSector = kgRealTotal * share;
          const kgHaRealSector = s.areaSector>0 ? kgRealSector/s.areaSector : 0;
          const diff = s.superficie - s.areaSector;
          // % vs la meta del Lote-Red completo (kgHaPpto, un único número — ej. 16,416 — no el
          // Kg Ppto/Ha prorrateado de ESTE sector, que se cancela matemáticamente contra el Kg
          // Real/Ha prorrateado y siempre daría el mismo % en todos los sectores).
          const ratioSector = kgHaPpto>0 ? kgHaRealSector/kgHaPpto : 0;

          filas.push(`<tr${s.barrido ? ' style="background:#E3F1E6;"' : ''}><td>L${String(s.lote).padStart(2,'0')} ${s.red} ${s.sector}</td><td>${v}</td>
            <td class="num">${fmt1(s.superficie)}</td><td class="num">${fmt1(s.areaSector)}</td>
            <td class="num">${fmt1(diff)}</td><td class="num">${fmt(kgPptoSector)}</td>
            <td class="num">${fmt(kgRealSector)}</td>
            <td class="num">${fmt(kgHaPptoSector)}</td>
            <td class="num">${fmt(kgHaRealSector)}</td>
            <td>${estadoPill(ratioSector)}</td>
            <td class="num">${pct(share)}</td>
            <td style="text-align:center;">${s.barrido? '✅':'—'}</td></tr>`);
        });
      });

      // Fila de validación (descuadre bines vs balanza), al final del grupo Lote-Red.
      if(usaBines){
        const binesCampo = computeBinesPorSector()
          .filter(s=> String(s.lote)===lote && s.red===red)
          .reduce((sum,s)=> sum + (s.binesInd || s.binesGru || 0), 0);
        const binesBalanza = totalBinesBalanzaPorLoteRed(lote, red);
        if(binesBalanza > 0){
          const descuadre = Math.abs(binesCampo - binesBalanza) / binesBalanza;
          if(descuadre > 0.10){
            filas.push(`<tr><td colspan="12" style="font-family:var(--font-mono); font-size:11px; color:var(--rojo); padding-top:4px;">
              ⚠️ Bines reportados en campo (${fmt(binesCampo)}) vs. confirmados por balanza (${fmt(binesBalanza)}) difieren en ${pct(descuadre)} para Lote ${lote} - ${red}.
            </td></tr>`);
          }
        }
      }
    });
  });

  // Paginación: tamaño de página elegible (select), con Prev/Next.
  const pageSizeSel = document.getElementById('f5-pageSize');
  const pageSize = pageSizeSel.value === 'todas' ? filas.length || 1 : parseInt(pageSizeSel.value);
  const totalPaginasS = Math.max(1, Math.ceil(filas.length / pageSize));
  if(sectoresPage >= totalPaginasS) sectoresPage = totalPaginasS - 1;
  if(sectoresPage < 0) sectoresPage = 0;
  const filasPagina = filas.slice(sectoresPage*pageSize, sectoresPage*pageSize + pageSize);

  document.getElementById('tableSectores').innerHTML = thead + filasPagina.join('');

  const pagerEl = document.getElementById('sectoresPager');
  if(totalPaginasS <= 1){
    pagerEl.innerHTML = '';
  } else {
    pagerEl.innerHTML = `
      <button class="btn btn-ghost" id="sectoresPrev" style="padding:6px 12px;" ${sectoresPage===0?'disabled':''}>‹ Anterior</button>
      <span>Página ${sectoresPage+1} de ${totalPaginasS} <span style="color:#8a8f83;">(${filas.length} filas)</span></span>
      <button class="btn btn-ghost" id="sectoresNext" style="padding:6px 12px;" ${sectoresPage>=totalPaginasS-1?'disabled':''}>Siguiente ›</button>`;
    document.getElementById('sectoresPrev').addEventListener('click', ()=>{ sectoresPage--; renderSectores(); });
    document.getElementById('sectoresNext').addEventListener('click', ()=>{ sectoresPage++; renderSectores(); });
  }
}

/* ============ CHARTS ============ */
/* ============ KG / COSECHADOR ============ */
// Quincenas del fundo: Q1 = del 26 del mes anterior al 10 del mes actual; Q2 = 11 al 25.
/* ============ PAGE 5c: CALIBRES Y PESO DE FRUTO ============ */
