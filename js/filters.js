/* ============ FILTER POPULATION ============ */
// Arándano trae muchas más "variedades" que Palto (incluye códigos de prueba y
// variedades nuevas con poca o ninguna área todavía), así que el botón de Variedad se
// ordena por Kg real cosechado (de mayor a menor) y las de bajo volumen quedan
// agrupadas detrás de un botón "+N variedades" que las despliega al hacer clic — así
// la top (hoy Ventura) queda al lado de "Todas" y no hay que scrollear 20+ botones.
// Se conserva entre renders (no se resetea en cada populateFilters) para no colapsar
// la lista solo por cambiar de página o de filtro.
let variedadesExpandido = false;
const VARIEDADES_VISIBLES_ARANDANO = 6;

function populateFilters(){
  const esAra = cultivoActivo === 'arandano';
  const variedades = esAra
    ? uniq([...balanza.map(r=>r.variedad), ...ESTIMACION_ARANDANO_VARIEDAD.map(e=>e.variedad), ...computeSectorDetailsArandano().map(e=>e.variedad)])
    : uniq(balanza.map(r=>r.variedad));
  const lotes = uniq(balanza.map(r=>r.lote));

  const gf = document.getElementById('gfButtons');
  const label = v => v.charAt(0)+v.slice(1).toLowerCase();
  let opts;
  if(esAra){
    const kgPorVariedad = new Map();
    balanza.forEach(r=> kgPorVariedad.set(r.variedad, (kgPorVariedad.get(r.variedad)||0) + r.kg));
    const ordenadas = [...variedades].sort((a,b)=> (kgPorVariedad.get(b)||0) - (kgPorVariedad.get(a)||0));
    const visibles = ordenadas.slice(0, VARIEDADES_VISIBLES_ARANDANO);
    const ocultas = ordenadas.slice(VARIEDADES_VISIBLES_ARANDANO);
    opts = [{v:'', label:'Todas'}, ...visibles.map(v=>({v, label:label(v)}))];
    if(ocultas.length){
      const hayOcultaActiva = ocultas.some(v=>activeVariedades.includes(v));
      opts.push({ v:'__toggle__', toggle:true,
        label: (variedadesExpandido ? 'Ocultar ▲' : `+${ocultas.length} variedades ▾`) + (hayOcultaActiva && !variedadesExpandido ? ' ●' : '') });
      if(variedadesExpandido) opts.push(...ocultas.map(v=>({v, label:label(v)})));
    }
  } else {
    opts = [{v:'', label:'Todas'}, ...variedades.map(v=>({v, label:label(v)}))];
  }
  gf.innerHTML = opts.map(o=> `<button data-v="${o.v}" class="${o.toggle ? 'gf-toggle' : (isVariedadBtnActive(o.v)?'active':'')}">${o.label}</button>`).join('');
  gf.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const v = btn.dataset.v;
      if(v === '__toggle__'){
        variedadesExpandido = !variedadesExpandido;
        populateFilters();
        return;
      }
      if(v === ''){
        activeVariedades = [];
      } else if(cultivoActivo === 'palto' && v === 'HASS'){
        activeVariedades = (activeVariedades.length===1 && activeVariedades[0]==='HASS') ? [] : ['HASS'];
      } else if(cultivoActivo === 'palto') {
        // ETTINGER o ZUTANO: multi-selección entre ellos, exclusivos de HASS
        activeVariedades = activeVariedades.filter(x=>x!=='HASS');
        if(activeVariedades.includes(v)) activeVariedades = activeVariedades.filter(x=>x!==v);
        else activeVariedades = [...activeVariedades, v];
      } else {
        // Arándano: permite seleccionar una o varias variedades libremente.
        if(activeVariedades.includes(v)) activeVariedades = activeVariedades.filter(x=>x!==v);
        else activeVariedades = [...activeVariedades, v];
      }
      gf.querySelectorAll('button').forEach(b=> b.classList.toggle('active', isVariedadBtnActive(b.dataset.v)));
      renderKPIs(); renderCosecha(); renderPlan(); renderAvance(); renderSectores(); renderBins(); populateCalibresFilters(); renderCalibres(); renderCosechadores(); renderKgJornalLote();
      if(cultivoActivo === 'palto'){ renderInicio(); } else { populateCicloFilters(); renderCiclo(); }
    });
  });

  const selLote = document.getElementById('f1-lote');
  const prev = selLote.value;
  const lotesOrdenados = [...lotes].sort((a,b)=>Number(a)-Number(b));
  selLote.innerHTML = '<option value="">Todos los lotes</option>' + lotesOrdenados.map(l=>`<option value="${l}">Lote ${l}</option>`).join('');
  if(lotes.map(String).includes(prev)) selLote.value = prev;
  populateSectorFilters();
}

function isVariedadBtnActive(v){
  if(v === '') return activeVariedades.length === 0;
  return activeVariedades.includes(v);
}

/* ============ KPIs ============ */

/* ============ SECTOR-SPECIFIC FILTER POPULATION (página Detalle Sectores) ============ */
function populateSectorFilters(){
  const selLote = document.getElementById('f5-lote');
  const lotesConSector = cultivoActivo === 'arandano'
    ? uniq([...estimacionArandanoLoteRed, ...computeSectorDetailsArandano()].map(e=>e.lote)).sort((a,b)=>Number(a)-Number(b))
    : uniq(ESTIMACION.map(e=>e.lote)).sort((a,b)=>Number(a)-Number(b));
  const prevLote = selLote.value;
  selLote.innerHTML = '<option value="">Todos los lotes</option>' + lotesConSector.map(l=>`<option value="${l}">Lote ${l}</option>`).join('');
  if(lotesConSector.map(String).includes(prevLote)) selLote.value = prevLote;

  const loteSel = selLote.value;
  const redsDelLote = loteSel
    ? (cultivoActivo === 'arandano'
        ? uniq([...estimacionArandanoLoteRed, ...computeSectorDetailsArandano()].filter(e=>e.lote==loteSel).map(e=>e.red))
        : uniq(ESTIMACION.filter(e=>e.lote==loteSel).map(e=>e.red)))
    : [];
  const selRed = document.getElementById('f5-red');
  const prevRed = selRed.value;
  selRed.innerHTML = '<option value="">Todas las redes</option>' + redsDelLote.map(r=>`<option value="${r}">${r}</option>`).join('');
  if(redsDelLote.includes(prevRed)) selRed.value = prevRed;
}

