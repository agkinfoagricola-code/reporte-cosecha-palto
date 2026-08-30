/* ============ CÁLCULOS: PRORRATEO POR BINES (Lote-Red-Sector) ============
   Complementa calculos-avance-ha.js: en vez de repartir el Kg de un Lote-Red entre
   sus sectores según superficie (Ha Ppto), lo reparte según la cantidad de bines que
   cada sector reportó en campo — más preciso porque sigue el ritmo real de cosecha
   día a día, no un supuesto fijo de área.

   Fuente: `bines` (cargado en state.js, poblado desde la tabla Supabase `bines_data`),
   con una fila por (fecha, grupo de acopio, sector) — ver parseBinesRows() en carga-datos.js.
   Columnas relevantes de tu comparativo original:
     - UBICACION      → "L01 R01 S01" (Lote-Red-Sector)
     - CNT. BIN IND.   → bines contados por el reporte individual del picker/sector
     - CNT. BIN GRU.    → bines contados por el reporte grupal (grupo de acopio)
     - CNT. BIN BAL.     → conteo confirmado por la balanza, a nivel LOTE-RED (no sector) —
                            se usa solo como referencia/validación, no para el prorrateo. */

// Descompone "L01 R01 S01" en {lote:1, red:'R01', sector:'S01'}.
function parseUbicacion(ubicacion){
  const parts = String(ubicacion||'').trim().split(/\s+/);
  const loteStr = parts[0] || '';
  return {
    lote: parseInt(loteStr.replace(/[^0-9]/g,'')) || null,
    red: parts[1] || '',
    sector: parts.slice(2).join(' '),
  };
}

// Suma bines por Lote-Red-Sector, a lo largo de TODA la campaña (igual que hoy hace
// Ha Ppto: computeSectorDetails() tampoco filtra por fecha). Usa CNT. BIN IND. como
// fuente principal (el reporte del sector en campo); si una fila no trae ese dato,
// cae a CNT. BIN GRU.
function computeBinesPorSector(){
  const bySector = new Map(); // key: lote|red|sector -> {binesInd, binesGru, lote, red, sector}
  bines.forEach(b=>{
    const { lote, red, sector } = b.lote != null ? b : parseUbicacion(b.ubicacion);
    if(lote == null || !red || !sector) return;
    const key = lote+'|'+red+'|'+sector;
    if(!bySector.has(key)) bySector.set(key, { binesInd:0, binesGru:0, lote, red, sector });
    const o = bySector.get(key);
    o.binesInd += (b.cntBinInd || 0);
    o.binesGru += (b.cntBinGru || 0);
  });
  return [...bySector.values()];
}

// % de bines que le corresponde a cada sector dentro de su Lote-Red — el reemplazo de
// `share` (basado en Ha Ppto) en vista-sectores.js. Devuelve un Map sector -> fracción
// (0 a 1). Si el Lote-Red no tiene ningún bin reportado todavía, devuelve un Map vacío
// (vista-sectores.js debe caer de vuelta a Ha Ppto en ese caso — campaña recién empezando
// en esa zona, o comparativo de bines aún no cargado para esas fechas).
function shareBinesPorLoteRed(lote, red){
  const sectores = computeBinesPorSector().filter(s => String(s.lote)===String(lote) && s.red===red);
  const total = sectores.reduce((sum,s)=> sum + (s.binesInd || s.binesGru || 0), 0);
  const out = new Map();
  if(total <= 0) return out;
  sectores.forEach(s=>{
    const bines = s.binesInd || s.binesGru || 0;
    out.set(s.sector, bines / total);
  });
  return out;
}

// Total de bines confirmados por balanza para un Lote-Red (suma de CNT. BIN BAL. de todas
// sus filas) — solo para mostrar como referencia/validación en la UI, comparado contra la
// suma de CNT. BIN IND. reportada en campo (para detectar descuadres grandes).
function totalBinesBalanzaPorLoteRed(lote, red){
  return bines
    .filter(b => (b.lote != null ? b.lote : parseUbicacion(b.ubicacion).lote) == lote
              && (b.red || parseUbicacion(b.ubicacion).red) === red)
    .reduce((sum,b)=> sum + (b.cntBinBal || 0), 0);
}
