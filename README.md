# Reporte de Producción Palto — Fundo Las Mercedes 2026

Dashboard (HTML + JS + Chart.js) del avance de cosecha de palto, comparando el presupuesto de
campaña (estimación) contra los datos reales de balanza y hectáreas. Login con usuario/contraseña
(Supabase Auth) y dos roles:

- **admin** (ej. `jguevara`): ve y filtra todo, además puede **alimentar la data** (página "Carga
  de Datos") y **crear usuarios nuevos** (página "Usuarios").
- **viewer** (ej. `cvalverde`): solo puede ver y filtrar el reporte, sin esas dos páginas.

El usuario ingresa solo su nombre de usuario (ej. `jguevara`) — el sistema arma el correo interno
`jguevara@agrokasa.com.pe` automáticamente, igual que en la plataforma CREA de referencia.

---

## 1. Configurar Supabase (backend de login + datos compartidos, una sola vez)

1. Crea una cuenta y un proyecto en [supabase.com](https://supabase.com) (la capa gratuita alcanza de sobra para pocos usuarios).
2. **SQL Editor → New query** → pega todo el contenido de `supabase_setup.sql` (está en este repo) → **Run**. Esto crea las tablas, los roles (`admin`/`viewer`) y los permisos (RLS).
3. **Authentication → Providers → Email** → apaga **"Confirm email"**. Esto es obligatorio: usamos correos internos como `jguevara@agrokasa.com.pe` que no reciben emails reales, así que no puede quedar pendiente una confirmación por correo.
4. **Authentication → Settings** → si quieres, desactiva "Allow new users to sign up" (igual no importa mucho, porque solo el admin puede crear usuarios desde dentro de la app).
5. **Authentication → Users → Add user** → crea el primer usuario (el admin) a mano:
   - Email: `jguevara@agrokasa.com.pe`
   - Password: `jguevara28`
6. **SQL Editor** → vuélvelo admin:
   ```sql
   update profiles set role = 'admin' where email = 'jguevara@agrokasa.com.pe';
   ```
7. **Project Settings → API** → copia el **Project URL** y el **anon public key**.
8. Abre `index.html`, busca (`Ctrl+F`) estas dos líneas cerca del inicio del `<script>` y reemplázalas con tus valores reales:
   ```js
   const SUPABASE_URL = 'https://nzgrllrmflnpzumaksgr.supabase.co';
   const SUPABASE_ANON_KEY = 'sb_publishable_YXAHBYS68J-UEoVW6zmpFg_mho_V3To';
   ```
   (La `anon key` es pública por diseño — la seguridad la dan las políticas RLS del paso 2, no esta llave.)

Con esto ya puedes entrar con `jguevara` / `jguevara28`. Desde la página **"Usuarios"** del panel,
jguevara puede crear a `cvalverde` (y a cualquier otro) sin volver a tocar Supabase — quedan como
`viewer` por defecto.

---

## 2. Abrir y editar el proyecto en Visual Studio Code

1. Instala VS Code si no lo tienes: [code.visualstudio.com](https://code.visualstudio.com).
2. Crea una carpeta en tu computadora (ej. `reporte-cosecha-palto`) y guarda ahí `index.html`, `README.md` y `supabase_setup.sql`.
3. VS Code → **File → Open Folder...** → selecciona esa carpeta.
4. Abre `index.html`, `Ctrl+F` → busca `SUPABASE_URL` → pon tus valores del paso 1.8 → guarda (`Ctrl+S`).
5. (Opcional) Extensión **"Live Server"** → clic derecho en `index.html` → "Open with Live Server", para verlo en el navegador antes de subirlo.

---

## 3. Subir a GitHub

Desde la terminal integrada de VS Code (`` Ctrl+` ``), dentro de la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Reporte de cosecha palto 2026"
git branch -M main
git remote add origin https://github.com/tu-usuario/reporte-cosecha-palto.git
git push -u origin main
```

(Si no tienes el repo creado en GitHub todavía: entra a github.com → **New repository** → dale
un nombre → **no** marques "Add a README" → copia la URL que te da y úsala en el `git remote add`.)

---

## 4. Publicar en Vercel

1. Ve a [vercel.com](https://vercel.com) → **Sign Up** → "Continue with GitHub".
2. **Add New... → Project** → autoriza acceso a GitHub si te lo pide → selecciona tu repo → **Import**.
3. Configuración: **Framework Preset: Other**, Build Command y Output Directory **en blanco** (Vercel sirve `index.html` directo desde la raíz, no hay build).
4. **Deploy**. En menos de un minuto te da una URL tipo `https://reporte-cosecha-palto.vercel.app` — ese es el link que compartes.
5. Cada vez que hagas `git push` a `main`, Vercel vuelve a publicar solo.

---

## 5. Uso diario

- **Alimentar datos nuevos** (solo admin): página **"Carga de Datos"** → pega el CSV de balanza y/o hectáreas (mismos encabezados que los archivos originales) → **"Guardar y aplicar"**. Se guarda en Supabase y lo ven todos.
- **Crear un usuario nuevo** (solo admin): página **"Usuarios"** → nombre de usuario + contraseña → queda como `viewer`. Para volver a alguien `admin`, hazlo por SQL Editor (paso 1.6, con su correo).
- **Responsive**: en pantallas angostas (celular/tablet) aparece un botón ☰ arriba a la izquierda que abre/cierra el menú lateral.

---

## Limitación conocida

Los datos base (estimación de campaña, presupuesto semanal) están **embebidos en el HTML** — no
se leen de Supabase. Para cambiarlos hay que regenerar `index.html` y volver a hacer push, porque
cambian una vez por campaña, no semanalmente. Los datos de balanza/hectáreas sí son 100% dinámicos
vía la página "Carga de Datos".
