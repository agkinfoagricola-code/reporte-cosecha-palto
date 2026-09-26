/* ============ KG / JORNAL POR LOTE (CECO) — solo Palto ============
   Indicador semanal (lunes a domingo) de Kg cosechados / Jornales de cosecha por CECO.

   - Jornales: horas del tareo con labor de cosecha (TAREO_COSECHADOR_CODES = 3052 Hass,
     3180 Poli) / 8, asignadas al CECO según el código de Lote/Ubicación del trabajador
     (fila.codlote, ver CECOS_PALTO en data-defaults.js).
   - Filtro de Variedad: 3052 = Hass y 3180 = Poli (Ettinger + Zutano). Con Ettinger o Zutano
     se toman los kg de ambos polinizantes (ver matchVariedadKgJornal en state.js).
   - Kg: balanza de Palto, asignada al CECO por lote + red (R32 -> Lote 12 – Red 3.2,
     R42 -> Lote 16 – Red 4.2).
   - Solo se consideran las fechas cuyo tareo ya trae lote (fechas "con lote"). Los días que se
     cargaron antes del cambio (sin codlote) se excluyen de jornales Y de kg, para no inflar el
     ratio; la vista avisa cuáles son para volver a cargarlos.
   - Horas: el reporte de RR.HH. escribe fracciones como hh.mm (4.30 = 4 h 30 min). Se
     convierten con horasDecimalesTareo() (utils.js), igual que en Kg / Cosechador. */

let kgjMetricaActiva = 'kgjor'; // botón seleccionado en la vista
let kgjDetalleModo = 'semana';  // 'semana' | 'dia' (tabla de detalle)
let kgjExport = { matriz: null, detalle: null }; // última versión renderizada, para Excel

const KGJ_METRICAS = {
  kgjor: { label: 'Kg / Jornal',   fmt: v => fmt1(v) },
  kg:    { label: 'Kg cosechados', fmt: v => fmt(v) },
  jor:   { label: 'Jornales',      fmt: v => fmt1(v) },
  kgha:  { label: 'Kg / Ha',       fmt: v => fmt(v) },
  jorha: { label: 'Jornales / Ha', fmt: v => v.toLocaleString('es-PE', {maximumFractionDigits:2}) },
};

function kgjSemanaLabel(semanaInicio){
  const ini = new Date(semanaInicio + 'T00:00:00');
  const fin = new Date(ini); fin.setDate(fin.getDate() + 6);
  const dm = d => String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
  return { corto: 'S' + isoWeekNumber(semanaInicio), rango: dm(ini) + '–' + dm(fin) };
}

function calcularKgJornalLote(){
  // 1) Fechas del tareo con y sin lote.
  const filasFecha = {}; // fecha -> {conLote, sinLote}
  for(const r of tareo){
    if(!TAREO_COSECHADOR_CODES.has(r.codlab)) continue;
    if(!filasFecha[r.fecha]) filasFecha[r.fecha] = { conLote: 0, sinLote: 0 };
    if(r.codlote) filasFecha[r.fecha].conLote++; else filasFecha[r.fecha].sinLote++;
  }
  const fechasConLote = new Set(Object.keys(filasFecha).filter(f => filasFecha[f].conLote > 0));
  const fechasSinLote = Object.keys(filasFecha).filter(f => filasFecha[f].conLote === 0).sort();

  // 2) Jornales por semana x CECO (solo fechas con lote, respetando el filtro de Variedad).
  const celdasDia = new Map(); // "fecha|ceco" -> {horas, kg}
  const celdaDia = (fecha, ceco) => {
    const k = fecha + '|' + ceco;
    if(!celdasDia.has(k)) celdasDia.set(k, { horas: 0, kg: 0 });
    return celdasDia.get(k);
  };
  const celdas = new Map(); // "semana|ceco" -> {horas, kg}
  const celda = (sem, ceco) => {
    const k = sem + '|' + ceco;
    if(!celdas.has(k)) celdas.set(k, { horas: 0, kg: 0 });
    return celdas.get(k);
  };
  const ubisSinCeco = new Map(); // codlote -> horas (cosecha en ubicaciones fuera de los 12 CECOs)
  for(const r of tareo){
    if(!TAREO_COSECHADOR_CODES.has(r.codlab)) continue;
    if(!fechasConLote.has(r.fecha) || !r.codlote) continue;
    if(!codlabAllowedByVariedadFilter(r.codlab)) continue;
    const horas = horasDecimalesTareo(r.horas);
    const ceco = UBI_A_CECO_PALTO.get(r.codlote);
    if(!ceco){ ubisSinCeco.set(r.codlote, (ubisSinCeco.get(r.codlote)||0) + horas); continue; }
    celda(isoWeekStart(r.fecha), ceco).horas += horas;
    celdaDia(r.fecha, ceco).horas += horas;
  }

  // 3) Kg por semana x CECO (misma cobertura de fechas).
  let kgFueraDeCobertura = 0;
  for(const r of balanzaPalto){
    if(!matchVariedadKgJornal(r.variedad)) continue;
    const ceco = cecoPaltoDesdeBalanza(r.lote, r.red);
    if(!ceco) continue;
    if(!fechasConLote.has(r.fecha)){ kgFueraDeCobertura += r.kg; continue; }
    celda(isoWeekStart(r.fecha), ceco).kg += r.kg;
    celdaDia(r.fecha, ceco).kg += r.kg;
  }

  const semanas = uniq([...celdas.keys()].map(k => k.split('|')[0]));
  const fechas = uniq([...celdasDia.keys()].map(k => k.split('|')[0]));
  return { celdas, semanas, celdasDia, fechas, fechasConLote, fechasSinLote, ubisSinCeco, kgFueraDeCobertura };
}

function kgjValor(metrica, d, ha){
  if(!d) return null;
  const jor = d.horas / 8;
  switch(metrica){
    case 'kgjor': return jor > 0 && d.kg > 0 ? d.kg / jor : null;
    case 'kg':    return d.kg > 0 ? d.kg : null;
    case 'jor':   return jor > 0 ? jor : null;
    case 'kgha':  return ha > 0 && d.kg > 0 ? d.kg / ha : null;
    case 'jorha': return ha > 0 && jor > 0 ? jor / ha : null;
  }
  return null;
}

function renderKgJornalLote(){
  const page = document.getElementById('page-kgjornal');
  if(!page) return;
  if(cultivoActivo !== 'palto') return;

  const metrica = kgjMetricaActiva;
  const res = calcularKgJornalLote();
  const semanasVista = res.semanas.slice().sort(); // toda la campaña

  // ---------- Aviso de cobertura ----------
  const avisoEl = document.getElementById('kgjAviso');
  const avisos = [];
  if(res.fechasSinLote.length){
    const n = res.fechasSinLote.length;
    const primero = res.fechasSinLote[0], ultimo = res.fechasSinLote[n-1];
    avisos.push(`<b>${n} día${n>1?'s':''} de tareo sin lote</b> (del ${primero} al ${ultimo}). Esos días no entran al indicador — ni sus jornales ni sus kg. Para incluirlos, vuelve a cargar esos reportes de tareo en <b>Carga de Datos</b>.`);
  }
  if(res.ubisSinCeco.size){
    const lista = [...res.ubisSinCeco.entries()].sort((a,b)=>b[1]-a[1])
      .map(([u,h]) => `${u} (${fmt1(h/8)} jor.)`).join(', ');
    avisos.push(`Jornales de cosecha en ubicaciones que no son uno de los 12 CECOs: ${lista}. No se asignan a ningún lote.`);
  }
  if(!res.fechasConLote.size){
    avisos.unshift('Todavía no hay tareo con lote. Carga los reportes de tareo de Palto en <b>Carga de Datos</b> para calcular el indicador.');
  }
  avisoEl.innerHTML = avisos.map(a => `<p style="margin:0 0 6px 0;">${a}</p>`).join('');
  avisoEl.style.display = avisos.length ? 'block' : 'none';

  // ---------- Totales del periodo visible ----------
  let totKg = 0, totHoras = 0;
  const porCeco = {}; // ceco -> {horas, kg} en semanas visibles
  const porSemana = {}; // semana -> {horas, kg}
  for(const sem of semanasVista){
    for(const c of CECOS_PALTO){
      const d = res.celdas.get(sem + '|' + c.ceco);
      if(!d) continue;
      totKg += d.kg; totHoras += d.horas;
      porCeco[c.ceco] = porCeco[c.ceco] || { horas:0, kg:0 };
      porCeco[c.ceco].horas += d.horas; porCeco[c.ceco].kg += d.kg;
      porSemana[sem] = porSemana[sem] || { horas:0, kg:0 };
      porSemana[sem].horas += d.horas; porSemana[sem].kg += d.kg;
    }
  }
  const totJor = totHoras / 8;
  const haTotal = CECOS_PALTO.reduce((s,c)=>s+c.ha, 0);


  // ---------- Matriz CECO x semana ----------
  const m = KGJ_METRICAS[metrica];
  document.getElementById('kgjMatrizTitulo').textContent = m.label + ' por CECO y semana';
  let html = '<tr><th style="white-space:nowrap;">CECO</th><th>Ha</th>';
  for(const sem of semanasVista){
    const l = kgjSemanaLabel(sem);
    html += `<th style="white-space:nowrap; text-align:right;">${l.corto}<br><span style="font-weight:400; font-size:11px;">${l.rango}</span></th>`;
  }
  html += '<th style="text-align:right;">Periodo</th></tr>';

  // máximo por columna para el sombreado
  const maxCol = {};
  for(const sem of semanasVista){
    maxCol[sem] = Math.max(0, ...CECOS_PALTO.map(c => kgjValor(metrica, res.celdas.get(sem+'|'+c.ceco), c.ha) || 0));
  }
  const maxPeriodo = Math.max(0, ...CECOS_PALTO.map(c => kgjValor(metrica, porCeco[c.ceco], c.ha) || 0));

  for(const c of CECOS_PALTO){
    html += `<tr><td style="white-space:nowrap;">${c.ceco}</td><td>${c.ha.toLocaleString('es-PE',{minimumFractionDigits:2})}</td>`;
    for(const sem of semanasVista){
      const v = kgjValor(metrica, res.celdas.get(sem+'|'+c.ceco), c.ha);
      html += `<td style="text-align:right; background:${heatShade(v, maxCol[sem], '27,107,60')};">${v!=null ? m.fmt(v) : '—'}</td>`;
    }
    const vp = kgjValor(metrica, porCeco[c.ceco], c.ha);
    html += `<td style="text-align:right; font-weight:600; background:${heatShade(vp, maxPeriodo, '45,110,142')};">${vp!=null ? m.fmt(vp) : '—'}</td></tr>`;
  }
  html += `<tr style="background:#EEF3EE; font-weight:600;"><td>Total Palto</td><td>${haTotal.toLocaleString('es-PE',{minimumFractionDigits:2})}</td>`;
  for(const sem of semanasVista){
    const v = kgjValor(metrica, porSemana[sem], haTotal);
    html += `<td style="text-align:right;">${v!=null ? m.fmt(v) : '—'}</td>`;
  }
  const vt = kgjValor(metrica, { horas: totHoras, kg: totKg }, haTotal);
  html += `<td style="text-align:right;">${vt!=null ? m.fmt(vt) : '—'}</td></tr>`;
  document.getElementById('tableKgJornalMatriz').innerHTML = html;

  const r1 = v => v == null ? null : Math.round(v * 100) / 100;
  const encabezado = ['CECO', 'Ha', ...semanasVista.map(sem => { const l = kgjSemanaLabel(sem); return l.corto + ' (' + l.rango + ')'; }), 'Periodo'];
  const filasM = CECOS_PALTO.map(c => [c.ceco, c.ha,
    ...semanasVista.map(sem => r1(kgjValor(metrica, res.celdas.get(sem+'|'+c.ceco), c.ha))),
    r1(kgjValor(metrica, porCeco[c.ceco], c.ha))]);
  filasM.push(['Total Palto', r1(haTotal), ...semanasVista.map(sem => r1(kgjValor(metrica, porSemana[sem], haTotal))), r1(vt)]);
  kgjExport.matriz = { titulo: m.label, filas: [encabezado, ...filasM] };

  // ---------- Gráfico: indicador del total Palto por semana ----------
  const semConDato = semanasVista.filter(s => kgjValor(metrica, porSemana[s], haTotal) != null);
  drawBar('chartKgJornalSemana',
    semConDato.map(s => { const l = kgjSemanaLabel(s); return l.corto + ' (' + l.rango + ')'; }),
    semConDato.map(s => kgjValor(metrica, porSemana[s], haTotal)),
    m.label + ' — Total Palto', '#3F9E64', false, false, true, metrica === 'jorha' ? 2 : (metrica==='kgjor'||metrica==='jor' ? 1 : 0));

  // ---------- Detalle por semana o por día x CECO ----------
  const fCeco = document.getElementById('f8-ceco').value;
  const porDia = kgjDetalleModo === 'dia';
  const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  // periodos: [{clave, htmlEtiqueta, excel:[...columnas de periodo]}], del más reciente al más antiguo
  const periodos = porDia
    ? res.fechas.slice().sort().reverse().map(f => {
        const dia = DIAS[new Date(f+'T00:00:00').getDay()];
        const sem = kgjSemanaLabel(isoWeekStart(f)).corto;
        return { clave: f, mapa: res.celdasDia,
          html: `${f} <span style="color:#8a8f83;">${dia} · ${sem}</span>`,
          excel: [f, dia, sem] };
      })
    : semanasVista.slice().reverse().map(sem => {
        const l = kgjSemanaLabel(sem);
        return { clave: sem, mapa: res.celdas,
          html: `${l.corto} <span style="color:#8a8f83;">${l.rango}</span>`,
          excel: [l.corto, l.rango, sem] };
      });
  document.getElementById('kgjDetalleTitulo').textContent = porDia ? 'Detalle por día y CECO' : 'Detalle por semana y CECO';
  let det = `<tr><th style="white-space:nowrap;">${porDia ? 'Fecha' : 'Semana'}</th><th style="white-space:nowrap;">CECO</th><th>Ha</th><th>Kg</th><th>Jornales</th><th>Kg / Jornal</th><th>Kg / Ha</th><th>Jor / Ha</th></tr>`;
  let filasDet = 0;
  const detExcel = [[...(porDia ? ['Fecha', 'Día', 'Semana'] : ['Semana', 'Rango', 'Inicio semana']),
    'CECO', 'CECO SAP', 'Ha', 'Kg', 'Jornales', 'Kg / Jornal', 'Kg / Ha', 'Jornales / Ha']];
  for(const p of periodos){
    for(const c of CECOS_PALTO){
      if(fCeco && fCeco !== c.ceco) continue;
      const d = p.mapa.get(p.clave+'|'+c.ceco);
      if(!d || (d.kg <= 0 && d.horas <= 0)) continue;
      const jor = d.horas / 8;
      det += `<tr>
        <td style="white-space:nowrap;">${p.html}</td>
        <td style="white-space:nowrap;">${c.ceco}</td>
        <td>${c.ha.toLocaleString('es-PE',{minimumFractionDigits:2})}</td>
        <td>${d.kg>0 ? fmt(d.kg) : '—'}</td>
        <td>${jor>0 ? fmt1(jor) : '—'}</td>
        <td>${jor>0 && d.kg>0 ? fmt1(d.kg/jor) : '—'}</td>
        <td>${d.kg>0 ? fmt(d.kg/c.ha) : '—'}</td>
        <td>${jor>0 ? (jor/c.ha).toLocaleString('es-PE',{maximumFractionDigits:2}) : '—'}</td>
      </tr>`;
      filasDet++;
      detExcel.push([...p.excel, c.ceco, c.sap, c.ha,
        Math.round(d.kg), Math.round(jor*100)/100,
        jor>0 && d.kg>0 ? Math.round(d.kg/jor*100)/100 : null,
        d.kg>0 ? Math.round(d.kg/c.ha*100)/100 : null,
        jor>0 ? Math.round(jor/c.ha*1000)/1000 : null]);
    }
  }
  kgjExport.detalle = { ceco: fCeco || 'Todos', modo: porDia ? 'diario' : 'semanal', filas: detExcel };
  if(!filasDet) det += '<tr><td colspan="8" style="text-align:center; color:#8a8f83;">Sin datos para el filtro seleccionado.</td></tr>';
  document.getElementById('tableKgJornalDetalle').innerHTML = det;
}

function kgjEtiquetaVariedad(){
  if(!activeVariedades.length) return 'Todas';
  if(activeVariedades.includes('HASS')) return 'Hass';
  return 'Poli';
}

function kgjDescargarExcel(filas, nombreHoja, archivo, anchoPrimera){
  if(!filas || filas.length < 2){ alert('No hay datos para descargar.'); return; }
  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = filas[0].map((_, i) => ({ wch: i === 0 ? (anchoPrimera || 18) : 14 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja.slice(0, 31));
  XLSX.writeFile(wb, archivo);
}

function kgjDescargarMatriz(){
  const mz = kgjExport.matriz;
  if(!mz) return;
  const hoy = new Date().toISOString().slice(0,10);
  const nombre = mz.titulo.replace(/\s*\/\s*/g, '-').replace(/\s+/g, '_');
  kgjDescargarExcel(mz.filas, mz.titulo.replace(/\//g, '-'),
    `${nombre}_por_CECO_semana_${kgjEtiquetaVariedad()}_${hoy}.xlsx`, 20);
}

function kgjDescargarDetalle(){
  const dt = kgjExport.detalle;
  if(!dt) return;
  const hoy = new Date().toISOString().slice(0,10);
  const ceco = dt.ceco.replace(/[^A-Za-z0-9.]+/g, '_');
  kgjDescargarExcel(dt.filas, 'Detalle', `Kg-Jornal_detalle_${dt.modo}_${ceco}_${kgjEtiquetaVariedad()}_${hoy}.xlsx`, 10);
}

function initKgJornalLoteFiltros(){
  const selCeco = document.getElementById('f8-ceco');
  if(!selCeco) return;
  selCeco.innerHTML = '<option value="">Todos los CECOs</option>' +
    CECOS_PALTO.map(c => `<option value="${c.ceco}">${c.ceco}</option>`).join('');
  selCeco.addEventListener('change', renderKgJornalLote);
  document.getElementById('kgjDescargarMatriz').addEventListener('click', kgjDescargarMatriz);
  document.getElementById('kgjDescargarDetalle').addEventListener('click', kgjDescargarDetalle);
  const modo = document.getElementById('f8-detalleModo');
  modo.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-modo]');
    if(!btn) return;
    kgjDetalleModo = btn.dataset.modo;
    modo.querySelectorAll('button').forEach(b=> b.classList.toggle('active', b === btn));
    renderKgJornalLote();
  });
  const botones = document.getElementById('f8-metrica');
  botones.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-m]');
    if(!btn) return;
    kgjMetricaActiva = btn.dataset.m;
    botones.querySelectorAll('button').forEach(b=> b.classList.toggle('active', b === btn));
    renderKgJornalLote();
  });
}
initKgJornalLoteFiltros();
