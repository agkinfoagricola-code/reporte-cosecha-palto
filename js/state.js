/* ============ ESTADO GLOBAL DE LA APP ============ */
let balanzaPalto = DEFAULT_BALANZA;
let balanzaArandano = [];
let balanza = balanzaPalto;
let hectareas = DEFAULT_HECTAREAS;
// Avance de campo (Lote-Red-Sector) y presupuesto de Ha/Kg por Lote-Red para Arándano —
// independientes de los de Palto. Vacíos hasta que el admin cargue sus Excel (ver
// js/carga-datos.js). Formato de hectareasArandano: igual a `hectareas` (fecha, lote, red,
// sector, variedad, tipo, ha, superficie, cerrado). Formato de estimacionArandanoLoteRed:
// una fila por (lote, red, variedad) con {lote, red, variedad, has, kgPpto}.
let hectareasArandano = [];
let estimacionArandanoLoteRed = [];
let calibresArandano = [];
let calibres = DEFAULT_CALIBRES;
let tareo = DEFAULT_TAREO;
let tareoArandano = [];
// Comparativo de bines Lote-Red-Sector (individual/grupal/balanza) — ver js/calculos-bines.js
// y js/carga-datos.js → parseBinesRows(). Vacío hasta que el admin cargue el primer Excel.
let bines = DEFAULT_BINES;
// Códigos de labor considerados "cosechador" (jornales de cosecha + tacheros), separados
// por variedad para poder cruzarlos con el filtro global de Variedad:
// - TAREO_HASS_CODES: usados desde la temporada Hass (jun-2026 en adelante).
// - TAREO_POLINIZANTE_CODES: usados en temporada Ettinger/Zutano (mayo-jun-2026). El tareo
//   NO distingue Ettinger de Zutano por separado (comparten el mismo código "POLI"), así que
//   filtrar por Ettinger o por Zutano por separado da el mismo conteo de cosechadores en ambos.

/* ============ CULTIVO ACTIVO (selector Palto / Arándano) ============
   Palto y Arándano mantienen datasets de balanza independientes.
   En Arándano, por ahora se habilita únicamente el reporte de Kg. Cosechados. */
const CULTIVOS_DISPONIBLES = ['palto', 'arandano'];
let cultivoActivo = 'palto';

/* ============ CAMPAÑA ACTIVA (selector de año de campaña) ============
   Hoy solo existe la campaña 2026. Se deja como lista para que, cuando arranque
   la campaña 2027, sea solo agregar '2027' acá (y sus propias tablas/lógica de
   corte por campaña más adelante) sin tener que rehacer el selector. */
const CAMPANAS_DISPONIBLES = ['2026'];
let campanaActiva = '2026';

/* ============ GLOBAL FILTER STATE (Variedad) ============ */
let activeVariedades = [];

function matchVariedad(v){
  return activeVariedades.length === 0 || activeVariedades.includes(v);
}

function kgPptoVariedad(e, sel){
  // sel puede ser un array (nueva multi-selección) o un string (compatibilidad)
  const arr = Array.isArray(sel) ? sel : (sel ? [sel] : []);
  if(arr.length === 0) return e.kgTotal;
  if(arr.length === 1 && arr[0] === 'HASS') return e.kgHass;
  if(arr.length === 1 && arr[0] === 'ETTINGER') return e.kgEtt;
  if(arr.length === 1 && arr[0] === 'ZUTANO') return e.kgZut;
  if(arr.includes('ETTINGER') && arr.includes('ZUTANO') && !arr.includes('HASS')) return e.kgEtt + e.kgZut;
  return e.kgTotal;
}

function kgPptoArandano(sel){
  const arr = Array.isArray(sel) ? sel : (sel ? [sel] : []);
  return ESTIMACION_ARANDANO_VARIEDAD
    .filter(e => arr.length===0 || arr.includes(e.variedad))
    .reduce((s,e)=>s+e.kgTotal,0);
}

/* ============ FILTER POPULATION ============ */
