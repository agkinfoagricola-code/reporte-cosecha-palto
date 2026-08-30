/* ============ CHARTS ============ */
function getThemeColor(cssVar, fallback){
  const v = getComputedStyle(document.body).getPropertyValue(cssVar).trim();
  return v || fallback;
}

function drawBar(id, labels, data, label, color, showTrend, showPercent, showValue, yDecimals){
  if(charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  const datasets = [{ label, data, backgroundColor: color, borderRadius:4, maxBarThickness:46, order:2 }];

  if(showTrend){
    // Línea de tendencia: promedio móvil de 15 valores (centrado) — ventana más ancha
    // para que salga una curva suave tipo campana (la forma general de la temporada),
    // no una línea que sigue de cerca cada sube-y-baja diario.
    const ventana = 15;
    const trendData = data.map((_, i)=>{
      const start = Math.max(0, i - Math.floor(ventana/2));
      const end = Math.min(data.length, i + Math.ceil(ventana/2));
      const slice = data.slice(start, end);
      return slice.reduce((s,v)=>s+v, 0) / slice.length;
    });
    datasets.push({
      type:'line', label:'Tendencia', data:trendData,
      borderColor:getThemeColor('--cielo', '#2D6E8E'), backgroundColor:'transparent', borderWidth:2.5,
      pointRadius:0, tension:0.55, cubicInterpolationMode:'monotone', order:1,
    });
  }

  // Plugin liviano (sin librerías externas) que dibuja el % de cada barra sobre el
  // total, justo encima de la barra — usado en "Acumulado por variedad".
  const percentLabelsPlugin = {
    id: 'percentLabels',
    afterDatasetsDraw(chart){
      if(!showPercent) return;
      const total = data.reduce((s,v)=>s+v, 0);
      if(total <= 0) return;
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = "600 12px 'Inter', sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      meta.data.forEach((bar, i)=>{
        const pct = ((data[i]/total)*100).toFixed(1) + '%';
        ctx.fillText(pct, bar.x, bar.y - 8);
      });
      ctx.restore();
    }
  };

  // Plugin liviano (sin librerías externas) que dibuja el valor de cada barra en kg,
  // justo encima de la barra, en el mismo color — usado en "Kg Cosechado por Lote".
  const valueLabelsPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart){
      if(!showValue) return;
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = "600 11px 'Inter', sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      meta.data.forEach((bar, i)=>{
        if(!data[i]) return;
        ctx.fillText(fmt(data[i]), bar.x, bar.y - 8);
      });
      ctx.restore();
    }
  };

  charts[id] = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets },
    plugins:[percentLabelsPlugin, valueLabelsPlugin],
    options:{
      responsive:true, maintainAspectRatio:false,
      layout:{ padding:{ top: showPercent ? 20 : (showValue ? 26 : 0) } },
      plugins:{ legend:{display: !!showTrend, position:'top', labels:{ boxWidth:12, font:{family:"'Inter',sans-serif", size:11} } } },
      scales:{ y:{ ticks:{ callback:v=> yDecimals ? v.toLocaleString('es-PE', {minimumFractionDigits:yDecimals, maximumFractionDigits:yDecimals}) : fmt(v) }, grid:{color:'#EFEBDD'} }, x:{ grid:{display:false} } }
    }
  });
  document.getElementById(id).parentElement.querySelector('canvas').style.height='300px';
}

function drawComboBar(id, labels, planData, realData){
  if(charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  const colorPlan = '#2D6E8E', colorReal = cultivoActivo==='arandano' ? getThemeColor('--pulpa','#7B4D9D') : '#3F9E64';

  // Plugin liviano que dibuja el valor de cada barra, en vertical, encima de ella —
  // en el mismo color de su serie (azul para Ppto, verde para Cosechado).
  const valueLabelsPlugin = {
    id: 'valueLabelsVertical',
    afterDatasetsDraw(chart){
      const { ctx } = chart;
      ctx.save();
      ctx.font = "600 10px 'Inter', sans-serif";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      chart.data.datasets.forEach((ds, di)=>{
        const meta = chart.getDatasetMeta(di);
        const color = di===0 ? colorPlan : colorReal;
        meta.data.forEach((bar, i)=>{
          const val = ds.data[i];
          if(!val) return;
          ctx.save();
          ctx.translate(bar.x, bar.y - 8);
          ctx.rotate(-Math.PI/2);
          ctx.fillStyle = color;
          ctx.fillText(fmt(val), 0, 0);
          ctx.restore();
        });
      });
      ctx.restore();
    }
  };

  const maxVal = Math.max(0, ...planData, ...realData);

  charts[id] = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[
      { label:'Kg Presupuestados', data:planData, backgroundColor:colorPlan, borderRadius:4, maxBarThickness:26 },
      { label:'Kg Cosechado', data:realData, backgroundColor:colorReal, borderRadius:4, maxBarThickness:26 },
    ]},
    plugins:[valueLabelsPlugin],
    options:{
      responsive:true, maintainAspectRatio:false,
      layout:{ padding:{ top: 10 } },
      plugins:{ legend:{ position:'top', labels:{ boxWidth:12, font:{family:"'Inter',sans-serif", size:11} } } },
      scales:{
        y:{ suggestedMax: maxVal*1.55, ticks:{ callback:v=>fmt(v) }, grid:{color:'#EFEBDD'} },
        x:{ grid:{display:false} }
      }
    }
  });
  document.getElementById(id).parentElement.querySelector('canvas').style.height='320px';
}

/* ============ RENDER ALL ============ */
