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
3. **Authentication → Users → Add user** → crea el primer usuario (el admin) a mano:
   - Email: `jguevara@agrokasa.com.pe`
   - Password: `jguevara28`
   - Marca **"Auto Confirm User"** si aparece esa opción (así entra de inmediato).
4. **SQL Editor** → vuélvelo admin:
   ```sql
   update profiles set role = 'admin' where email = 'jguevara@agrokasa.com.pe';
   ```
5. **Project Settings → API Keys** → copia el **Project URL** y la **Publishable key** (antes llamada "anon key").
6. Abre `index.html`, busca (`Ctrl+F`) estas dos líneas cerca del inicio del `<script>` y reemplázalas con tus valores reales:
   ```js
   const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
   const SUPABASE_ANON_KEY = 'TU-ANON-KEY';
   ```
   (Esta llave es pública por diseño — la seguridad la dan las políticas RLS del paso 2, no esta llave.)

Con esto ya puedes entrar con `jguevara` / `jguevara28`. Desde la página **"Usuarios"** del panel,
jguevara puede crear a `cvalverde` (y a cualquier otro) sin volver a tocar Supabase — quedan como
`viewer`, **ya confirmados**, y pueden entrar de inmediato (la creación pasa por la función segura
`/api/create-user.js`, que no depende del switch "Confirm email" del proyecto — ver sección 4).

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
3. Configuración: **Framework Preset: Other**. Deja Build Command y Output Directory en blanco — Vercel detecta `index.html` en la raíz y la carpeta `api/` sola, no hace falta configurar nada más.
4. **Antes de darle Deploy** (o justo después, y luego rehaces el deploy), agrega dos variables de entorno — pestaña **"Environment Variables"** en esa misma pantalla de importación (o después en Project Settings → Environment Variables):
   - `SUPABASE_URL` = `https://nzgrllrmflnpzumaksgr.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = la **service_role key** (Supabase → Project Settings → API Keys → pestaña "Legacy anon, service_role API keys" → copia la que dice `service_role`, **no** la publishable).

   ⚠️ **Esta llave nunca va en el `index.html` ni en ningún archivo del repo** — solo aquí, como variable de entorno de Vercel. Es la que le da poder de administrador a la función `/api/create-user.js`, así que si se filtra, cualquiera podría controlar toda tu base de datos.
5. **Deploy**. En menos de un minuto te da una URL tipo `https://reporte-cosecha-palto.vercel.app` — ese es el link que compartes.
6. Cada vez que hagas `git push` a `main`, Vercel vuelve a publicar solo. Si agregas las variables de entorno **después** del primer deploy, tienes que forzar un redeploy (pestaña Deployments → "..." del último deploy → "Redeploy") para que las tome.

---

## 5. Uso diario

- **Alimentar datos nuevos** (solo admin): página **"Carga de Datos"** → pega el CSV de balanza y/o hectáreas (mismos encabezados que los archivos originales) → **"Guardar y aplicar"**. Se guarda en Supabase y lo ven todos.
- **Crear un usuario nuevo** (solo admin): página **"Usuarios"** → nombre de usuario + contraseña → queda como `viewer`, **ya confirmado** (puede entrar de inmediato, sin depender de ningún switch de Supabase). Para volver a alguien `admin`, hazlo por SQL Editor (paso 1.4, con su correo).
- **Responsive**: en pantallas angostas (celular/tablet) aparece un botón ☰ arriba a la izquierda que abre/cierra el menú lateral.

---

## Limitación conocida

Los datos base (estimación de campaña, presupuesto semanal) están **embebidos en el HTML** — no
se leen de Supabase. Para cambiarlos hay que regenerar `index.html` y volver a hacer push, porque
cambian una vez por campaña, no semanalmente. Los datos de balanza/hectáreas sí son 100% dinámicos
vía la página "Carga de Datos".
