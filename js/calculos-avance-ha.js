/* ============ CÁLCULOS: AVANCE DE HECTÁREAS (Lote-Red y Lote-Red-Sector) ============
   Compartido por vista-avance.js y vista-sectores.js. Punto de extensión para el futuro
   prorrateo por bines: ver comentario dentro de vista-sectores.js. */
function estadoPill(ratio){
  // ratio = Kg/Ha Real ÷ Kg/Ha Ppto
  const cls = ratio >= 1 ? 'ok' : 'warn';
  return `<span class="pill ${cls}">${pct(ratio)}</span>`;
}

function estadoPillKg(ratio){
  // ratio = Kg Total Real ÷ Kg Total Ppto (% de cumplimiento en kilos)
  const cls = ratio >= 1 ? 'ok' : 'warn';
  return `<span class="pill ${cls}">${pct(ratio)}</span>`;
}

function kgxhaPptoFor(e, sel){
  const arr = Array.isArray(sel) ? sel : (sel ? [sel] : []);
  if(arr.length === 1 && arr[0] === 'ETTINGER') return e.has>0 ? e.kgEtt/e.has : 0;
  if(arr.length === 1 && arr[0] === 'ZUTANO') return e.has>0 ? e.kgZut/e.has : 0;
  if(arr.includes('ETTINGER') && arr.includes('ZUTANO') && !arr.includes('HASS')) return e.has>0 ? (e.kgEtt+e.kgZut)/e.has : 0;
  if(arr.length === 0) return e.has>0 ? e.kgTotal/e.has : 0; // "Todas": Hass+Ettinger+Zutano juntos, no solo Hass
  return e.kgxha; // ['HASS'] o combinaciones que incluyen HASS sin ser "Todas": tasa de Hass ya calculada en Res_Lote_Red
}

// Deduplica el avance de hectáreas por SECTOR (no por lote-red), para no
// duplicar terreno que pasó por selectivo y luego por barrer sobre la misma área,
// y para no perder el avance de sectores que aún solo tuvieron selectivo.
function baseSectorCode(sector){
  const m = /^(.*?)-R\d+$/.exec(sector);
  return m ? m[1] : sector;
}

// Señal de cierre basada en la columna "Cerrado" del archivo de hectáreas (marcada por el
// usuario en campo evento a evento), independiente del filtro de Variedad activo — el cierre
// de un sector es un hecho físico, no depende de qué variedad se esté mirando en el dashboard.
// Un Lote-Red se considera "cerrado por bandera" cuando, para CADA sector físico (base, sin el
// sufijo de renovación) que tiene registros de barrido, el evento más reciente vino marcado
// Cerrado = Sí.
function computeSectorDetails(){
  const bySector = new Map();
  hectareas.forEach(h=>{
    const k = h.lote+'|'+h.red+'|'+h.sector;
    if(!bySector.has(k)) bySector.set(k, {superficieSum:0, superficieN:0, barrido:false, barridoHa:0, selectivaHa:0, lote:h.lote, red:h.red, sector:h.sector});
    const o = bySector.get(k);
    o.superficieSum += (h.superficie ?? h.ha) || 0;
    o.superficieN += 1;
    // OJO: antes esto solo marcaba una bandera "barrido=true/false" y, si había cualquier pase de
    // Barrer/DS, se asignaba el 100% de la superficie como área avanzada — eso ignoraba que un
    // sector puede estar barrido solo parcialmente. Ahora se suman las Ha reales de cada pase de
    // Barrer/DS (igual que en Avance), y esa suma se capa a la superficie del sector más abajo.
    if(h.tipo==='BARRER' || h.tipo==='BARRER DS'){ o.barrido = true; o.barridoHa += (h.ha||0); }
    if(h.tipo==='SELECTIVA' || h.tipo==='SELECTIVO 300 A MAS [CAL 14]') o.selectivaHa += (h.ha||0);
  });
  return [...bySector.values()].map(o=>{
    const superficie = o.superficieN>0 ? o.superficieSum/o.superficieN : 0;
    const areaSector = o.barrido ? Math.min(o.barridoHa, superficie) : Math.min(o.selectivaHa, superficie);
    return { lote:o.lote, red:o.red, sector:o.sector, superficie, areaSector, barrido:o.barrido };
  });
}

// Suma directa de hectáreas por Lote-Red según el tipo de pase de cosecha:
// - "Selectivo": ha marcadas SELECTIVA / SELECTIVO 300 A MAS.
// - "Barrido": ha marcadas BARRER / BARRER DS. Este es el pase que sí extrae los kilos,
//   por eso "Av. Ha" (usado para Kg/Ha Real) solo considera esta columna.
//   OJO 1: un mismo sector puede aparecer trabajado (selectivo o barrido) en varias fechas
//   (repasos / reingresos) y además la data trae algunas filas duplicadas exactas. Por eso se
//   capa por sector (código exacto, con su sufijo de renovación) a su propia superficie antes de
//   sumar.
//   OJO 2: el sufijo "-R##" en el nombre del sector es un CÓDIGO DE RENOVACIÓN, no una subdivisión
//   física nueva — si el mismo sector base aparece bajo dos códigos de renovación distintos (ej.
//   "S46-R20" y "S46-R22"), es la MISMA área física repasada bajo otro código, así que entre esas
//   variantes se toma el MÁXIMO (no se suman) para no duplicar la hectárea.
function computeCerradoFlagPorLoteRed(){
  const bySector = new Map(); // lote|red|baseSector -> {fecha, cerrado}
  hectareas.forEach(h=>{
    if(!(h.tipo==='BARRER' || h.tipo==='BARRER DS')) return;
    const key = h.lote+'|'+h.red+'|'+baseSectorCode(h.sector);
    const prev = bySector.get(key);
    if(!prev || h.fecha >= prev.fecha) bySector.set(key, {fecha:h.fecha, cerrado: !!h.cerrado});
  });
  const out = new Map(); // lote-red -> boolean
  bySector.forEach((v, key)=>{
    const [lote, red] = key.split('|');
    const keyLR = lote+'-'+red;
    if(!out.has(keyLR)) out.set(keyLR, true);
    if(!v.cerrado) out.set(keyLR, false);
  });
  return out;
}

function computeHaAvancePorLoteRed(){
  const sectorSelectivo = new Map(); // key: lote|red|sector(exacto) -> {haSum, supSum, supN, lote, red, sector}
  const sectorBarrido = new Map();

  hectareas.forEach(h=>{
    if(!matchVariedad(h.variedad)) return;
    const ha = h.ha || 0;
    const keySec = h.lote+'|'+h.red+'|'+h.sector;
    if(h.tipo==='SELECTIVA' || h.tipo==='SELECTIVO 300 A MAS [CAL 14]'){
      if(!sectorSelectivo.has(keySec)) sectorSelectivo.set(keySec, {haSum:0, supSum:0, supN:0, lote:h.lote, red:h.red, sector:h.sector});
      const o = sectorSelectivo.get(keySec);
      o.haSum += ha;
      o.supSum += (h.superficie ?? h.ha) || 0;
      o.supN += 1;
    } else if(h.tipo==='BARRER' || h.tipo==='BARRER DS'){
      if(!sectorBarrido.has(keySec)) sectorBarrido.set(keySec, {haSum:0, supSum:0, supN:0, lote:h.lote, red:h.red, sector:h.sector});
      const o = sectorBarrido.get(keySec);
      o.haSum += ha;
      o.supSum += (h.superficie ?? h.ha) || 0;
      o.supN += 1;
    }
  });

  const aggregateCapped = (sectorMap) => {
    // Paso 1: capar cada sector EXACTO (con su código de renovación) a su propia superficie.
    const cappedByBase = new Map(); // key: lote|red|baseSector -> [valores capados de cada variante]
    sectorMap.forEach(o=>{
      const superficie = o.supN>0 ? o.supSum/o.supN : 0;
      const cappedHa = Math.min(o.haSum, superficie);
      const baseKey = o.lote+'|'+o.red+'|'+baseSectorCode(o.sector);
      if(!cappedByBase.has(baseKey)) cappedByBase.set(baseKey, []);
      cappedByBase.get(baseKey).push(cappedHa);
    });
    // Paso 2: entre variantes del mismo sector base (mismo sector, distinto código de renovación),
    // tomar el MÁXIMO — no sumar, para no duplicar la misma área física.
    const out = new Map();
    cappedByBase.forEach((valores, baseKey)=>{
      const [lote, red] = baseKey.split('|');
      const keyLR = lote+'-'+red;
      out.set(keyLR, (out.get(keyLR)||0) + Math.max(...valores));
    });
    return out;
  };

  return { selectivo: aggregateCapped(sectorSelectivo), barrido: aggregateCapped(sectorBarrido) };
}

