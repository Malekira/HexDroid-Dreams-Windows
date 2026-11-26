# Compatibilidad mIRC: alias y eventos JOIN · 0.40.0-beta.1

El motor mSL es independiente del intérprete `.hex`; no utiliza mIRC.
Esta etapa permite importar y ejecutar **archivos formados exclusivamente por
alias y eventos JOIN del subconjunto descrito aquí**. No habilita todavía los paquetes completos
analizados anteriormente. Si un archivo contiene otro evento, menú, diálogo,
temporizador u orden no soportada, la importación se rechaza completa.

## Uso

En Configuración → Scripts, «Analizar addon mIRC…» conserva su función de
inspección sin instalar ni ejecutar. El apartado «Compatibilidad mIRC · alias y JOIN»
contiene «Importar alias .mrc/.xcr…», activación y eliminación.
Los alias compatibles se activan al importarse y se invocan desde el chat con
`/nombre argumentos`. Aparecen en las sugerencias; los alias locales `alias -l`
solo son accesibles dentro de su archivo. Si un alias coincide con uno `.hex`,
se mantiene la prioridad de `.hex`. No se permiten dos addons mSL con el mismo
alias público. No se ejecutan eventos LOAD/START ni consultas automáticas.

El archivo [moderacion-basica.mrc](examples/moderacion-basica.mrc) proporciona
`/hdident Nick`, que muestra un ident ya recibido, y `/hdvoz Nick`, que solicita
voz para un usuario en la sala actual. No se instala automáticamente.
La aceptación de una acción de moderación depende del servidor y los permisos.

## Subconjunto ejecutable

- Declaraciones `alias nombre { ... }` y `alias -l nombre { ... }`.
- Eventos `on *:JOIN:#:{ ... }`, con nivel `*` o `1`, para todas las salas
  o una sala literal. No hay supresión de eventos ni otros niveles/prefijos.
  El evento ofrece `$nick`, `$chan`, `$me` y `$1` (sala), y comparte variables
  con los alias del mismo addon. Solo se ejecuta el primer handler coincidente
  dentro de cada archivo, sin bloquear la recepción IRC. Los JOIN recibidos mientras se ejecutan
  los comandos iniciales de conexión no disparan addons mSL ni se reproducen después.
- Separadores de instrucciones por línea o `|`; bloques explícitos para
  `if`, `elseif`, `else`, `while`; `return` y `halt`.
- `var`, `set`, `unset`, `inc`, `dec`, una variable por instrucción. Evaluación
  aritmética básica en `var` y `$calc`, sin JavaScript eval.
- Comparaciones `==`, `!=`, `<`, `>`, `<=`, `>=`, `isin`, `!isin`, condiciones
  negadas, `&&` y `||`. No se implementan todos los operadores de mIRC.
- Argumentos `$0`, `$1`, `$1-`, `$2-3`, concatenación `$+` y llamadas a alias
  del mismo archivo, tanto como órdenes como identificadores de retorno.
- `$me`, `$chan`, `$nick`, `$network`, `$null`, `$true`, `$false`, `$v1`, `$v2`.
- `$chan(índice)` y `$chan(0)` para enumerar salas unidas.
- `$nick(sala,índice)` y `$nick(sala,nick).pnick` sobre usuarios ya recibidos.
- `$address(nick,tipo)` para tipos 0, 2 y 5, solo con ident/host de la caché.
  Si faltan, devuelve vacío; no emite WHOIS/WHO ni inventa datos.
- `$len`, `$lower`, `$upper`, `$replace`, `$gettok`, `$numtok` y `$calc`.
- `echo` (texto, `-a` o `-s`), `msg destino texto`, `notice destino texto`,
  `mode #sala [modos argumentos]` y `kick #sala nick [motivo]`.

El parser es todavía parcial. No admite todos los indicadores de estas órdenes,
propiedades de identificadores, evaluación dinámica, sintaxis sin bloques,
comodines de variables o variantes del lenguaje original. Las funciones y órdenes
no reconocidas fallan explícitamente. Reconocer declaraciones durante el análisis
no demuestra compatibilidad funcional.

## Ejecución y datos

Los archivos se decodifican como UTF-8 o Windows-1252 y se limitan a 256 KB.
El registro separado `mirc-addons.json` conserva fuentes y activación; los fuentes
no se mezclan con `scripts.json`. Un registro inválido se preserva y se informa,
sin impedir usar los comandos IRC estándar. Las variables globales pertenecen
al addon, solo viven en memoria y se reinician al cambiar la configuración del
motor o cerrar la aplicación. Todavía no hay variables compartidas entre addons.

La ejecución usa un worker con memoria limitada, watchdog de un segundo por
petición, presupuesto de instrucciones, límites de texto/variables/recursión y
hasta 40 acciones por invocación. Antes de enviar se valida el lote, incluyendo
inyección de líneas y tamaño IRC en la codificación de la red. Los envíos se
espacian al menos 350 ms en este motor y pasan por las funciones IRC existentes;
se cancelan al desactivar/eliminar un addon, cerrar el motor o cambiar la sesión.
Una desconexión o un rechazo del servidor puede ocurrir después de acciones ya
enviadas: no se promete atomicidad de red ni confirmación de moderación.

## Validación y pendientes

Las pruebas cubren recorrido de usuarios y prefijos, extracción de ident,
condiciones, argumentos, variables, retornos, límites, importación/persistencia,
activación/eliminación, rechazo de módulos no soportados, cancelación y conexión
con `Runtime.send`. La interfaz se prueba con el puente simulado en Chromium.
No equivale a validación en Windows o contra una red IRC pública.

Pendientes: ampliar el parser y las expresiones mSL; eventos RAW y demás
contextos restantes; temporizadores; menús, diálogos/did y ventanas propias; archivos/INI,
tablas hash, dependencias y estado compartido. El original `kaos_ident.mrc` se verifica sin reescritura con escenarios de alias
y JOIN en un servidor local. Los demás addons completos originales no están certificados. Falta el `modera.mrc` referenciado por `addonPack`.

La corrección anterior del perfil se conserva: «Ver / quitar bans» solo aparece
cuando el usuario comparte una sala unida donde el usuario local tiene permisos
q/a/o/h, con el mapeo de prefijos de esa red.
