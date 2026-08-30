/* ============ HELPERS ============ */
const fmt = n => Math.round(n).toLocaleString('es-PE');
const fmt1 = n => n.toLocaleString('es-PE', {maximumFractionDigits:1});
const pct = n => (n*100).toLocaleString('es-PE', {maximumFractionDigits:1}) + '%';

/* ============ SUPABASE CONFIG ============ */
// Reemplaza estos dos valores con los de tu proyecto de Supabase
// (Project Settings → API → Project URL / anon public key).
function uniq(arr){ return [...new Set(arr)].sort(); }
function loteRed(lote, red){ return lote + '-' + red; }

function estFor(lote, red){
  return ESTIMACION.find(e => e.lote == lote && e.red == red);
}

function sumBy(rows, keyFn, valFn){
  const m = new Map();
  rows.forEach(r => {
    const k = keyFn(r);
    m.set(k, (m.get(k)||0) + valFn(r));
  });
  return m;
}

function isoWeekStart(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if(isNaN(d.getTime())) return null;
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0,10);
}

// Número de semana ISO 8601 (semana 1 = la que contiene el primer jueves del año).
function isoWeekNumber(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if(isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 4 - (d.getDay() || 7)); // mover al jueves de esa semana
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function weekLabel(dateStr){
  const n = isoWeekNumber(dateStr);
  return n != null ? 'Semana ' + n : dateStr;
}

// Mapa de calor reutilizable: intensidad de color según qué tan grande es `v` respecto
// al máximo `max` de su columna/grupo. rgb ej. '27,107,60' (verde) o '45,110,142' (azul).
function heatShade(v, max, rgb){
  if(!v || max<=0) return 'transparent';
  const t = Math.min(1, v/max);
  return `rgba(${rgb},${(0.08 + t*0.55).toFixed(2)})`;
}

/* ============ GLOBAL FILTER STATE ============ */
// [] = Todas. Hass es exclusivo (al elegirlo, limpia lo demás).
// Ettinger y Zutano se pueden marcar juntos (multi-selección entre ellos).
