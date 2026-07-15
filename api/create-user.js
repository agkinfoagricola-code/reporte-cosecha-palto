// Función de servidor (Vercel Serverless Function).
// Se ejecuta SOLO en el servidor de Vercel, nunca en el navegador — por eso aquí sí
// es seguro usar la service_role key (viene de una variable de entorno, no del código).
//
// El frontend (index.html) le llama a esta función en vez de hablarle directo a
// Supabase, para poder crear usuarios YA CONFIRMADOS sin depender del switch
// "Confirm email" del proyecto.
const { createClient } = require('@supabase/supabase-js');
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Faltan las variables de entorno SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel.' });
    return;
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    res.status(401).json({ error: 'No autenticado.' });
    return;
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  // 1. Verifica quién está haciendo la petición (usando su token de sesión)
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData || !userData.user) {
    res.status(401).json({ error: 'Sesión inválida o expirada.' });
    return;
  }
  // 2. Verifica que quien pide esto sea admin (no cualquier usuario logueado).
  //    Se busca por EMAIL (no por id) porque así es como el resto de la app vincula
  //    la sesión de auth.users con la fila de profiles — evita problemas si el id de
  //    profiles no coincide 1:1 con el id de auth.users.
  const callerEmail = (userData.user.email || '').toLowerCase();
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('role, email')
    .ilike('email', callerEmail)
    .maybeSingle();
  if (profErr || !profile || profile.role !== 'admin') {
    res.status(403).json({
      error: 'Solo un admin puede crear usuarios.',
      debug: {
        callerEmail,
        profileFound: !!profile,
        roleFound: profile ? profile.role : null,
        profErr: profErr ? profErr.message : null,
      },
    });
    return;
  }
  // 3. Crea el usuario nuevo, YA CONFIRMADO (sin depender de "Confirm email")
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Falta correo o contraseña.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    return;
  }
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) {
    res.status(400).json({ error: createErr.message });
    return;
  }

  // 4. Crea también la fila en profiles para el usuario nuevo (rol viewer por defecto),
  //    para que aparezca de inmediato en "Usuarios registrados" sin pasos manuales.
  await admin.from('profiles').insert({
    id: created.user.id,
    email: created.user.email,
    role: 'viewer',
  });

  res.status(200).json({ ok: true, user: { id: created.user.id, email: created.user.email } });
};
