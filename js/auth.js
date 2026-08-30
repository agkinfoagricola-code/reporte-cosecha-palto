/* ============ AUTH ============ */
const EMAIL_DOMAIN = '@agrokasa.com.pe';

async function handleLogin(){
  const usuario = document.getElementById('loginUsuario').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const statusEl = document.getElementById('loginStatus');
  statusEl.className = 'status-msg';
  statusEl.textContent = '';
  if(!usuario || !password){
    statusEl.className='status-msg err'; statusEl.textContent='Ingresa usuario y contraseña.'; return;
  }
  const email = usuario + EMAIL_DOMAIN;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error){
    statusEl.className='status-msg err'; statusEl.textContent='No se pudo ingresar: ' + error.message; return;
  }
  await onLoggedIn(data.user);
}

async function onLoggedIn(user){
  currentUser = user;
  const { data: profile } = await sb.from('profiles').select('role, nombres, apellidos').eq('id', user.id).single();
  currentRole = profile ? profile.role : 'viewer';

  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const usuario = user.email.split('@')[0];
  const nombreCompleto = profile && (profile.nombres || profile.apellidos)
    ? [profile.nombres, profile.apellidos].filter(Boolean).join(' ')
    : usuario;
  document.getElementById('helloName').textContent = nombreCompleto;

  renderSidebarSelectors();

  const isAdmin = currentRole === 'admin';
  document.getElementById('navActualizar').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('navUsuarios').style.display = isAdmin ? 'flex' : 'none';

  await loadStoredData();
  renderAll();
}

async function handleLogout(){
  await sb.auth.signOut();
  currentUser = null; currentRole = 'viewer';
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginUsuario').value = '';
  document.getElementById('loginPassword').value = '';
}

(async function initAuth(){
  const { data: { session } } = await sb.auth.getSession();
  if(session && session.user){
    await onLoggedIn(session.user);
  }
})();

document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.getElementById('loginPassword').addEventListener('keydown', e=>{ if(e.key==='Enter') handleLogin(); });
document.getElementById('logoutBtn').addEventListener('click', handleLogout);
document.getElementById('forgotLink').addEventListener('click', ()=>{
  alert('Contacta a tu administrador para restablecer tu contraseña.');
});
document.getElementById('togglePass').addEventListener('click', ()=>{
  const inp = document.getElementById('loginPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});

/* Crea usuarios sin cerrar la sesión del admin actual: llama directo al endpoint
   de signup de Supabase (con la anon key) en vez de usar sb.auth.signUp(), que
   reemplazaría la sesión activa del navegador por la del usuario nuevo. */
/* Crea usuarios YA CONFIRMADOS llamando a la función de servidor /api/create-user
   (que usa la service_role key de forma segura, solo en el servidor). Esto evita
   por completo el problema de "Email not confirmed" — ya no depende del switch
   "Confirm email" de Supabase. */
async function createUser(){
  const statusEl = document.getElementById('userStatus');
  statusEl.className = 'status-msg'; statusEl.textContent = '';
  const nombres = document.getElementById('newUserNombres').value.trim();
  const apellidos = document.getElementById('newUserApellidos').value.trim();
  const usuario = document.getElementById('newUserName').value.trim().toLowerCase();
  const pass = document.getElementById('newUserPass').value;
  if(!nombres || !apellidos || !usuario || !pass){
    statusEl.className='status-msg err'; statusEl.textContent='Ingresa nombres, apellidos, usuario y contraseña.'; return;
  }
  if(pass.length < 6){
    statusEl.className='status-msg err'; statusEl.textContent='La contraseña debe tener al menos 6 caracteres.'; return;
  }
  const email = usuario + EMAIL_DOMAIN;
  try{
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
    if(!token) throw new Error('Tu sesión expiró, vuelve a ingresar.');

    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ email, password: pass, nombres, apellidos })
    });
    const data = await res.json();
    if(!res.ok){ throw new Error(data.error || 'No se pudo crear el usuario.'); }
    statusEl.className='status-msg ok'; statusEl.textContent = `Usuario "${usuario}" (${nombres} ${apellidos}) creado como viewer (ya confirmado, puede ingresar de inmediato).`;
    document.getElementById('newUserNombres').value = '';
    document.getElementById('newUserApellidos').value = '';
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserPass').value = '';
    loadUsersList();
  }catch(err){
    statusEl.className='status-msg err'; statusEl.textContent = 'Error: ' + err.message;
  }
}
document.getElementById('createUserBtn').addEventListener('click', createUser);

async function loadUsersList(){
  const el = document.getElementById('tableUsuarios');
  el.innerHTML = '<tr><th>Nombre</th><th>Usuario</th><th>Rol</th></tr><tr><td colspan="3">Cargando…</td></tr>';
  try{
    const { data, error } = await sb.from('profiles').select('email, role, nombres, apellidos').order('email');
    if(error) throw new Error(error.message);
    let thead = '<tr><th>Nombre</th><th>Usuario</th><th>Rol</th></tr>';
    let rows = (data||[]).map(u=>{
      const usuario = (u.email||'').split('@')[0];
      const nombreCompleto = [u.nombres, u.apellidos].filter(Boolean).join(' ') || '—';
      const badge = u.role==='admin' ? '<span class="role-badge admin">admin</span>' : '<span class="role-badge viewer">viewer</span>';
      return `<tr><td>${nombreCompleto}</td><td>${usuario}</td><td>${badge}</td></tr>`;
    }).join('');
    el.innerHTML = thead + (rows || '<tr><td colspan="3">Sin usuarios.</td></tr>');
  }catch(err){
    el.innerHTML = `<tr><th>Nombre</th><th>Usuario</th><th>Rol</th></tr><tr><td colspan="3">No se pudo cargar: ${err.message}</td></tr>`;
  }
}

/* ============ STORAGE (compartido en Supabase, visible para todos los usuarios) ============ */
