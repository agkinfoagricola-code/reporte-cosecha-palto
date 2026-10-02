# Sincronizador de Producción para Windows

Este programa lee los Excel locales y actualiza el Supabase que ya utiliza la web. No modifica los Excel. Se conserva la carga manual. No utiliza `tiempolider.xlsx` ni recalcula fórmulas de Excel: guarde los archivos desde Excel antes de sincronizar.

## 1. Preparación (una sola vez)

1. Descargue y extraiga **toda** esta carpeta en `D:\SincronizadorProduccion`. No ejecute los archivos desde el ZIP.
2. Instale Python 3.11 o superior desde https://www.python.org/downloads/windows/ (incluya el lanzador Python).
3. Abra `INSTALAR.cmd`. Se instala openpyxl en un entorno privado `.venv`.
4. En el proyecto Supabase de la web, abra **SQL Editor → New query**, pegue el contenido completo de `supabase_sync.sql` y pulse **Run**. Requiere acceso de propietario al proyecto, una sola vez. Agrega almacenamiento de lecturas y funciones de sincronización; no borra las tablas existentes ni cambia los datos de Palto. Si falla, guarde el mensaje y no continúe hasta resolverlo.
5. Verifique que su usuario de la web ya tenga rol `admin`. No copie contraseñas ni claves `service_role` en archivos ni en el chat.
6. Ponga estos cuatro archivos, con estos nombres exactos, en `D:\Reporte de Produccion`:
   - `balanza.xlsx`
   - `supervisorHa.xlsx`
   - `tareo.xlsx`
   - `lecturaind.xlsx`
7. Si usa otra carpeta, edite `folder` en `config.json`; use barras dobles, por ejemplo `D:\\Otra carpeta`. El año inicial es 2026.

## 2. Validar sin enviar

Abra `VALIDAR.cmd`. Lee todos los archivos, valida sus campos y muestra el número de registros y fechas. No pide contraseña ni escribe en Supabase. Resuelva cualquier error de fila antes de continuar. Puede ejecutarlo sin haber preparado Supabase.

## 3. Iniciar y actualizar

Abra `INICIAR.cmd`. La primera vez debe confirmar que los Excel representan la versión que quiere subir. Ingrese el mismo usuario y contraseña que usa en la web (la contraseña no se muestra). Se conservan solamente en memoria los tokens de sesión, que se renuevan mientras el proceso está abierto. No se guarda la contraseña.

Mantenga abierta la ventana. Revisa cambios cada 30 segundos; archivos grandes pueden tardar varios minutos en validarse y subir. Solo se envían archivos cuyo contenido cambió. No escriba simultáneamente desde la web y desde Excel. Si un Excel cambia durante la lectura se espera al siguiente ciclo.

Al aparecer **Actualizado**, recargue la web para visualizar los datos. La sincronización no recompila ni vuelve a publicar el sitio. No añade todavía una página de rendimiento individual por jabas: guarda las lecturas y actualiza los envases de balanza que coinciden por fecha, lote, red y variedad.

Para detener: `Ctrl+C` o cierre la ventana. Para volver a iniciar: `INICIAR.cmd` e ingrese sus credenciales nuevamente. La PC debe estar encendida y conectada.

## 4. Qué se conserva y qué se reemplaza

- **Balanza:** kilos totales = KG. NETOS (exportable) + DESCARTE (nacional), según la confirmación del propietario. Reemplaza únicamente las combinaciones fecha/lote/red/variedad presentes. Conserva el resto. Solo el registro del 16/05/2026, lote 7, Ventura, red Z se corrige a R01.
- **Hectáreas:** conserva historial; actualiza fecha/lote/red/sector/variedad presentes. `Hectarea` es superficie; `Total` es avance. No suma superficies entre pasadas.
- **Tareo:** calcula `(HORA_FIN_LAB − HORA_INI_LAB)` en horas decimales, no usa totHoras por cada tramo. Conserva 5129, 5014, 5132 y 5137 por separado. El indicador actual Kg/Cosechador de la web mantiene la labor 5129. No supone turnos nocturnos ni resta refrigerios no indicados en estos tramos; los horarios invertidos se rechazan.
- **Lecturaind:** almacena jabas EXP/NAC con fecha, sector y código de trabajador, sin nombres. No convierte jabas en kilos. Las etiquetas identifican lecturas; no se suman copias idénticas.
- **Tareo y Lecturaind requieren días completos:** reemplazan los días presentes, conservando fechas anteriores no incluidas. No cargue solo un grupo de un día ya existente. Borrar filas del Excel no elimina automáticamente fechas completas antiguas en la nube.
- **Historia previa:** se conserva lo que ya exista en Supabase. Este programa no importa automáticamente las hojas del libro “Producción General”; manténgalo como respaldo hasta migrar y reconciliar ese historial.

Antes de cada envío se guarda `backups/*.json.gz` con los datos anteriores. Los cuatro cambios de un ciclo se aplican en una sola transacción. Si ocurre un error se revierte todo ese ciclo. No hay reintento destructivo de una carga parcial.

## 5. Carga manual y conflictos

La carga manual sigue disponible. Si la web cambió una tabla después de la última sincronización y luego modifica un Excel que afecta esa tabla, el programa se detiene para ese lote y lo indica en pantalla. No sobrescribe silenciosamente esa carga manual.

Revise qué versión es correcta. Si quiere conservar lo manual, incorpórelo al Excel. Cierre `INICIAR.cmd` y solo cuando esté seguro abra `RECONCILIAR.cmd`: confirma que los Excel modificados pueden reemplazar sus días/claves correspondientes y realiza un único envío. Después puede reiniciar `INICIAR.cmd`.

No borre `state.json` para quitar una alerta: contiene las huellas de la última sincronización. `sync.log` registra operaciones y errores sin contraseñas. Los backups sí contienen información de trabajadores: consérvelos solo en su PC y no los publique.

## 6. Arranque con Windows (opcional)

Ejecute `INICIO_AUTOMATICO.cmd`. Crea un acceso directo en Inicio del usuario de Windows. Al iniciar sesión se abrirá la ventana; **tendrá que ingresar su usuario y contraseña**. No es un servicio desatendido. Para desactivarlo: `Win+R → shell:startup`, elimine “Sincronizador Produccion”.

## Verificación y límites

Los parsers y la sincronización se prueban con datos de ejemplo, respuestas simuladas y los cuatro Excel proporcionados. La instalación en Windows, el acceso autenticado y las funciones SQL deben validarse en el proyecto real: no se dispone aquí de una cuenta administradora ni se ejecutó la migración remota. No se declara la nube actualizada hasta ver un envío confirmado.
