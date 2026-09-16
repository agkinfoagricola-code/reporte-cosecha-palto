/* ============ RENDER ALL ============ */
function renderAll(){
  configureCultivoUI();
  populateFilters();
  renderKPIs();
  renderCosecha();
  renderPlan();
  renderAvance();
  renderSectores();
  renderBins();
  populateCalibresFilters();
  renderCalibres();
  renderCosechadores();
  if(cultivoActivo === 'arandano'){ populateCicloFilters(); renderCiclo(); return; }
  renderInicio();
}

function configureCultivoUI(){
  const esAra = cultivoActivo === 'arandano';
  document.body.classList.toggle('theme-arandano', esAra);
  document.querySelectorAll('.nav-sub button[data-page]').forEach(btn=>{
    const page = btn.dataset.page;
    if(page === 'ciclo'){ btn.style.display = esAra ? '' : 'none'; return; }
    btn.style.display = (!esAra || ['cosecha','plan','avance','sectores','bins','calibres','cosechadores'].includes(page)) ? '' : 'none';
  });
  const navBinsBtn = document.getElementById('navBinsBtn');
  if(navBinsBtn) navBinsBtn.textContent = esAra ? 'Kg. Jabas' : 'Kg. Bins';
  const binsSemanaTitle = document.getElementById('binsSemanaTitle');
  if(binsSemanaTitle) binsSemanaTitle.textContent = esAra ? 'Prom. Kg/Jaba semanal por variedad' : 'Prom. Kg/Bin semanal por variedad';
  const binsDiaTitle = document.getElementById('binsDiaTitle');
  if(binsDiaTitle) binsDiaTitle.textContent = esAra ? 'Detalle diario de peso promedio por jaba' : 'Detalle diario de peso promedio por bin';
  const navCalibresBtn = document.getElementById('navCalibresBtn');
  if(navCalibresBtn) navCalibresBtn.textContent = esAra ? 'Calibres de Fruto' : 'Calibres y Peso Fruto';
  const upPal = document.getElementById('uploadPaltoBlock');
  const upAra = document.getElementById('uploadArandanoBlock');
  const resetBtn = document.getElementById('resetBtn');
  if(upPal) upPal.style.display = esAra ? 'none' : 'block';
  if(upAra) upAra.style.display = esAra ? 'block' : 'none';
  if(resetBtn) resetBtn.style.display = esAra ? 'none' : '';
  if(esAra){
    document.querySelectorAll('#sidebar button[data-page]').forEach(b=>b.classList.remove('active'));
    const cosechaBtn = document.querySelector('#sidebar button[data-page="cosecha"]');
    if(cosechaBtn) cosechaBtn.classList.add('active');
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-cosecha').classList.add('active');
    document.getElementById('pageTitle').textContent = 'Kg. Cosechados - Arándano';
  } else if(document.getElementById('pageTitle').textContent === 'Kg. Cosechados - Arándano'){
    document.getElementById('pageTitle').textContent = 'Kg. Cosechados';
  }
}

/* ============ NAVEGACIÓN (sidebar) ============ */

/* ============ NAVEGACIÓN (sidebar) ============ */
const PAGE_TITLES = {
  inicio: 'Inicio',
  cosecha: 'Kg. Cosechados',
  plan: 'Kg. Cosechados vs Presupuestados',
  bins: 'Kg. Bins',
  avance: 'Kg Real vs Ppto (x Ha)',
  sectores: 'Detalle Sectores',
  calibres: 'Calibres y Peso Fruto',
  cosechadores: 'Kg. / Cosechador',
  ciclo: 'Días de Ciclo',
  actualizar: 'Carga de Datos',
  usuarios: 'Usuarios'
};

document.getElementById('sidebar').addEventListener('click', e=>{
  const btn = e.target.closest('button[data-page]');
  if(!btn) return;
  document.querySelectorAll('#sidebar button[data-page]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+btn.dataset.page).classList.add('active');
  const esAraTitle = cultivoActivo === 'arandano';
  const ARA_PAGE_TITLES = { bins: 'Kg. Jabas', calibres: 'Calibres de Fruto' };
  document.getElementById('pageTitle').textContent = (esAraTitle && ARA_PAGE_TITLES[btn.dataset.page]) || PAGE_TITLES[btn.dataset.page] || '';
  if(btn.dataset.page === 'usuarios') loadUsersList();
  closeSidebarMobile();
});

function closeSidebarMobile(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarScrim').classList.remove('active');
}
document.getElementById('hamburgerBtn').addEventListener('click', ()=>{
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarScrim').classList.toggle('active');
});
document.getElementById('sidebarScrim').addEventListener('click', closeSidebarMobile);

document.getElementById('f1-lote').addEventListener('change', renderCosecha);
document.getElementById('f5-lote').addEventListener('change', ()=>{ sectoresPage = 0; populateSectorFilters(); renderSectores(); });
document.getElementById('f5-red').addEventListener('change', ()=>{ sectoresPage = 0; renderSectores(); });
document.getElementById('f5-sectorSearch').addEventListener('input', ()=>{ sectoresPage = 0; renderSectores(); });
document.getElementById('f5-pageSize').addEventListener('change', ()=>{ sectoresPage = 0; renderSectores(); });
document.getElementById('f3-lote').addEventListener('change', ()=>{ binsDiaPage = 0; renderBins(); });
document.getElementById('f3-fecha').addEventListener('change', ()=>{ binsDiaPage = 0; renderBins(); });
document.getElementById('f3-fechaClear').addEventListener('click', ()=>{
  document.getElementById('f3-fecha').value = '';
  binsDiaPage = 0;
  renderBins();
});
document.getElementById('f4-lote').addEventListener('change', renderAvance);

/* ============ ACTUALIZAR DATOS (página, antes modal) ============ */

/* ============ SELECTORES DE CAMPAÑA Y CULTIVO (sidebar) ============
   Selects reales (no botones decorativos): eligen qué campaña y qué cultivo se está
   viendo. Campaña 2026 con datasets independientes por cultivo. Arándano inicia con
   el módulo de Kg. Cosechados y su propia carga de balanza. */
function renderSidebarSelectors(){
  const campanaEl = document.getElementById('campanaSelector');
  const cultivoEl = document.getElementById('cultivoSelector');
  if(!campanaEl || !cultivoEl) return;

  campanaEl.innerHTML = CAMPANAS_DISPONIBLES.map(c=>`<option value="${c}">${c}</option>`).join('');
  campanaEl.value = campanaActiva;
  campanaEl.addEventListener('change', ()=>{ campanaActiva = campanaEl.value; });

  const cultivoLabels = { palto: '🥑 Palto', arandano: '🫐 Arándano' };
  cultivoEl.innerHTML = CULTIVOS_DISPONIBLES.map(c=>
    `<option value="${c}">${cultivoLabels[c] || c}</option>`
  ).join('');
  cultivoEl.value = cultivoActivo;
  cultivoEl.addEventListener('change', ()=>{
    cultivoActivo = cultivoEl.value;
    balanza = cultivoActivo === 'arandano' ? balanzaArandano : balanzaPalto;
    activeVariedades = [];
    renderAll();
  });
}
