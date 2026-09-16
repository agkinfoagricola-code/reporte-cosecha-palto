/* ============ STORAGE (compartido en Supabase, visible para todos los usuarios) ============ */
async function loadStoredData(){
  const timestamps = []; // updated_at de cada tabla, para mostrar la más reciente en el chip
  try{
    const { data: balRow } = await sb.from('balanza_data').select('data, updated_at').eq('id', 1).single();
    if(balRow && Array.isArray(balRow.data) && balRow.data.length){
      balanzaPalto = balRow.data;
      if(balRow.updated_at) timestamps.push(balRow.updated_at);
    }
  }catch(e){}

  try{
    const { data: araRow } = await sb.from('balanza_arandano_data').select('data, updated_at').eq('id', 1).single();
    if(araRow && Array.isArray(araRow.data) && araRow.data.length){
      balanzaArandano = araRow.data;
      if(araRow.updated_at) timestamps.push(araRow.updated_at);
    }
  }catch(e){}
  try{
    const { data: haRow } = await sb.from('hectareas_data').select('data, updated_at').eq('id', 1).single();
    if(haRow && Array.isArray(haRow.data) && haRow.data.length){
      hectareas = haRow.data;
      if(haRow.updated_at) timestamps.push(haRow.updated_at);
    }
  }catch(e){}
  try{
    const { data: tareoRow } = await sb.from('tareo_data').select('data, updated_at').eq('id', 1).single();
    if(tareoRow && Array.isArray(tareoRow.data) && tareoRow.data.length){
      tareo = tareoRow.data;
      if(tareoRow.updated_at) timestamps.push(tareoRow.updated_at);
    }
  }catch(e){}
  try{
    const { data: tareoAraRow } = await sb.from('tareo_arandano_data').select('data, updated_at').eq('id', 1).single();
    if(tareoAraRow && Array.isArray(tareoAraRow.data) && tareoAraRow.data.length){
      tareoArandano = tareoAraRow.data;
      if(tareoAraRow.updated_at) timestamps.push(tareoAraRow.updated_at);
    }
  }catch(e){}
  try{
    const { data: calRow } = await sb.from('calibres_data').select('data, updated_at').eq('id', 1).single();
    if(calRow && Array.isArray(calRow.data) && calRow.data.length){
      calibres = calRow.data;
      if(calRow.updated_at) timestamps.push(calRow.updated_at);
    }
  }catch(e){}
  try{
    const { data: binesRow } = await sb.from('bines_data').select('data, updated_at').eq('id', 1).single();
    if(binesRow && Array.isArray(binesRow.data) && binesRow.data.length){
      bines = binesRow.data;
      if(binesRow.updated_at) timestamps.push(binesRow.updated_at);
    }
  }catch(e){}
  try{
    const { data: haAraRow } = await sb.from('hectareas_arandano_data').select('data, updated_at').eq('id', 1).single();
    if(haAraRow && Array.isArray(haAraRow.data) && haAraRow.data.length){
      hectareasArandano = haAraRow.data;
      if(haAraRow.updated_at) timestamps.push(haAraRow.updated_at);
    }
  }catch(e){}
  try{
    const { data: estAraRow } = await sb.from('estimacion_arandano_lotered_data').select('data, updated_at').eq('id', 1).single();
    if(estAraRow && Array.isArray(estAraRow.data) && estAraRow.data.length){
      estimacionArandanoLoteRed = estAraRow.data;
      if(estAraRow.updated_at) timestamps.push(estAraRow.updated_at);
    }
  }catch(e){}
  try{
    const { data: calAraRow } = await sb.from('calibres_arandano_data').select('data, updated_at').eq('id', 1).single();
    if(calAraRow && Array.isArray(calAraRow.data) && calAraRow.data.length){
      calibresArandano = calAraRow.data;
      if(calAraRow.updated_at) timestamps.push(calAraRow.updated_at);
    }
  }catch(e){}

  balanza = cultivoActivo === 'arandano' ? balanzaArandano : balanzaPalto;

  if(timestamps.length){
    const masReciente = new Date(Math.max(...timestamps.map(t=> new Date(t).getTime())));
    document.getElementById('updatedChip').textContent = 'Datos actualizados: ' + masReciente.toLocaleString('es-PE', {dateStyle:'short', timeStyle:'short'});
  }
}
