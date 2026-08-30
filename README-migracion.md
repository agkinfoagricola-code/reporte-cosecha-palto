# Migración a estructura modular — guía rápida

## Qué cambió

El `index.html` original (2093 líneas, 1.23 MB, todo en un solo `<script>`) se dividió en
17 archivos JS + 1 CSS, cargados como `<script src="...">` clásicos (sin bundler, sin build
step — Vercel lo sirve exactamente igual que antes). El contenido de cada función/variable
es **el mismo código real**, extraído del archivo original con un script (no reescrito a
mano), así que el comportamiento no debería cambiar.

```
index.html          ← shell: <head>, <body> (markup real sin cambios), imports de módulos
css/styles.css       ← CSS real, extraído tal cual del <style> original
js/
  data-seed.js        ← DEFAULT_BALANZA / HECTAREAS / TAREO / CALIBRES (datasets grandes, generado)
  data-defaults.js     ← ESTIMACION, PLAN_SEMANAL, códigos de tareo (fijos de campaña)
  state.js              ← balanza/hectareas/tareo/calibres/charts/currentUser/... + filtro Variedad
  supabase-client.js     ← cliente Supabase (URL + anon key)
  utils.js                ← fmt, uniq, sumBy, isoWeekStart, etc.
  charts.js                 ← drawBar, drawComboBar (Chart.js)
  filters.js                 ← poblar selects de Lote/Red/Sector y el filtro global de Variedad
  data-store.js                ← loadStoredData() — trae balanza/hectareas/tareo/calibres de Supabase
  vista-dashboard.js             ← Inicio, KPIs, Cosecha, Plan vs Real, Bins
  calculos-avance-ha.js            ← cálculos compartidos de avance por Ha (Lote-Red y Sector)
  vista-avance.js                    ← página "Kg Real vs Ppto x Ha" + export Excel
  vista-sectores.js                    ← página "Detalle Sectores" (prorrateo por Ha Ppto)
  vista-calibres.js                      ← página "Calibres y Peso Fruto" + export Excel
  vista-cosechadores.js                    ← página "Kg / Cosechador"
  carga-datos.js                             ← parsers de Excel + handlers de "Carga de Datos"
  app.js                                       ← renderAll(), navegación del sidebar, selector de cultivo
  auth.js                                        ← login/logout/usuarios (se carga AL FINAL)
scripts/
  extract-data-defaults.js                        ← script que generó data-seed.js (ver abajo)
supabase_setup.sql                                  ← igual que en el repo original, sin cambios
api/                                                  ← copia tu carpeta api/ tal cual (no la tengo)
```

**Orden de carga en `index.html`:** los `<script>` clásicos (sin `type="module"`) comparten
un mismo scope global de documento, así que todas las funciones/variables `let`/`const`
declaradas en un archivo son visibles en los que se cargan después — por eso el orden
importa y `auth.js` va último (su `initAuth()` llama a `loadStoredData()` y `renderAll()`,
que deben existir ya).

## Antes de subir esto a producción

1. **Copia tu carpeta `api/`** (con `create-user.js` y lo que tengas ahí) dentro de
   `reporte-cosecha-palto/api/` — no estaba en lo que me compartiste, así que no la
   pude incluir. El resto del proyecto no la toca.
2. **Revisa `js/data-seed.js`.** Ya viene generado con tus datos reales (extraídos
   directo de tu `index.html`), así que en principio no necesitas volver a correr nada.
   Si en el futuro quieres regenerarlo desde un `index.html` más nuevo, corre:
   ```
   node scripts/extract-data-defaults.js /ruta/a/tu-index-mas-nuevo.html
   ```
3. **Prueba local antes de hacer push**: abre `index.html` con la extensión "Live Server"
   de VS Code (clic derecho → "Open with Live Server") y confirma que el login, los
   reportes y "Carga de Datos" funcionan igual que en producción.
4. **Verifica en el navegador (F12 → Console)** que no aparezcan errores de "X is not
   defined" al cargar — si aparece alguno, casi seguro es un archivo cargado en el
   orden equivocado en `index.html`.

## Módulo de prorrateo por bines (implementado)

En `vista-sectores.js` (función `renderSectores`), el Kg de un Lote-Red ahora se reparte
hacia sus sectores usando el **% de bines reportados en campo** (`CNT. BIN IND.` del
comparativo) cuando ese Lote-Red ya tiene bines cargados — más preciso que Ha Ppto porque
sigue el ritmo real de cosecha, no un supuesto fijo de superficie. Si un Lote-Red todavía
no tiene bines cargados (zona que aún no llega, o el admin no ha subido ese Excel), la
página cae de vuelta automáticamente al prorrateo por **Ha Ppto** de siempre — no hay que
elegir nada a mano, y nunca se rompe por falta de datos.

Piezas nuevas:
- **`js/calculos-bines.js`** — `computeBinesPorSector()`, `shareBinesPorLoteRed(lote, red)`,
  `totalBinesBalanzaPorLoteRed(lote, red)`. Es el archivo que reemplazarías si algún día
  cambia la forma de calcular el share (ej. prorratear por fecha en vez de acumulado de
  campaña).
- **`bines_data`** en Supabase (ver `supabase_setup.sql`, sección 4) — mismo patrón jsonb de
  fila única que `balanza_data`.
- **`parseBinesRows()` / `mergeBinesByDate()`** en `carga-datos.js` — nuevo campo de archivo
  "Excel de Comparativo de Bines" en la página "Carga de Datos" (actualiza solo las fechas
  del archivo subido, conserva el resto del histórico, igual que tareo y calibres).
- **Columna nueva "% del Lote-Red"** en la tabla de Detalle Sectores, y una etiqueta
  `Prorrateo: Bines` / `Prorrateo: Ha Ppto` en cada fila de Total, para que siempre quede
  claro con qué método se calculó ese Lote-Red.
- **Alerta de descuadre**: si el total de bines reportado en campo difiere en más de 10% del
  confirmado por balanza (`CNT. BIN BAL.`) para un Lote-Red, aparece una fila de aviso debajo
  de ese grupo — es solo informativo, no bloquea nada.

**Importante — corre el SQL antes de usarlo**: en Supabase → SQL Editor, corre la sección 4
de `supabase_setup.sql` (crear tabla `bines_data` + RLS) si tu proyecto todavía no la tiene,
o el "Guardar y aplicar" del Excel de bines va a fallar.

**Nota sobre `CNT. BIN BAL.`**: esa columna es un conteo de bines confirmados por la
balanza a nivel Lote-Red (no un peso, y no a nivel sector) — se usa solo para la alerta de
descuadre de arriba. El peso en kg que se prorratea entre sectores sigue viniendo de
`balanza_data`, igual que antes; `bines_data` solo cambia el `share` (la proporción con la
que se reparte ese peso).

## Nombre completo del usuario + quitar "Inicio" (ajustes de UI)

- El sidebar ya no tiene el botón "Inicio" — la primera página que se ve al entrar es
  "Kg. Cosechados". El selector de cultivo (Palto/Arándano) quedó arriba, con el texto
  "Seleccione Palto o Arándano".
- "Hola, jguevara" ahora muestra el nombre completo ("Hola, Javier Guevara") cuando el
  perfil tiene `nombres`/`apellidos` cargados; si no, cae de vuelta al usuario.
- **Antes de que esto funcione en producción, tienes que hacer 2 cosas:**
  1. Correr la sección 5 de `supabase_setup.sql` (agrega las columnas `nombres`/`apellidos`
     a tu tabla `profiles` real, y pone el nombre de jguevara — edita esa línea con el
     nombre real antes de correrla, y agrega una línea por cada usuario que ya tengas).
  2. Actualizar tu `api/create-user.js` real para que pase `nombres`/`apellidos` como
     `user_metadata` al crear usuarios nuevos — ver `api/PENDIENTE.md` para el snippet
     exacto a agregar.


## v1.7 — Presupuesto fijo de Arándano
- Se incorporó directamente al código el PPTO 2026 de Arándano desde `Estimacion de Produccion Arandano FLM 2026 V1.0.xlsx`.
- No existe carga manual del presupuesto: queda embebido como dato fijo de campaña, igual que Palto.
- Arándano habilita `Kg. Cosechados vs Presupuestados` y KPIs Real, PPTO, Diferencia y % Cumplimiento.
- La carga manual de Arándano sigue siendo únicamente para la balanza real.
