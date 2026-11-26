# Control de Privados mIRC v87 en HexDreams IRC

Objetivo de esta versión: ejecutar el archivo original `Control_Privados_mIRC_v87.mrc`
sin traducirlo a `.hex` ni modificarlo. SHA-256 del archivo probado:
`b96edd2737254ff9f6c81c562db8a3740b9f6ee75843d55b40c668140e968a1c`.

## Uso

En Configuración → Scripts → Compatibilidad mIRC, elegí «Importar addon .mrc/.xcr…».
El análisis separado no instala ni activa: su resultado lo indica explícitamente.
Desactivá otro control de privados antes de usar este, para que no compitan.

- `/pvconfig`: mensajes de espera, aceptación y rechazo; modo automático o preguntar;
  ventana de solicitudes y aviso emergente.
- `/pvpendientes`: solicitudes por conexión y nicks autoaceptados.
- `/si [nick]`: acepta y reproduce los mensajes guardados.
- `/no [nick]`: responde el rechazo y bloquea nuevas solicitudes durante la sesión del motor.
- `/pvignorar [nick]`: descarta sin responder ni bloquear; puede solicitar de nuevo.
- `/pvreset nick`: reinicia los permisos de ese nick en la conexión actual.
- `/pvautoagregar nick` y `/pvautoquitar nick`: lista persistente; también se controla
  con los botones de la ventana de pendientes.

El propio addon limita su búfer a 25 mensajes por solicitud. Se conserva la
separación por `$cid`, incluyendo la selección de solicitudes de otras conexiones.
Las funciones auxiliares `pv.*` no se muestran en las sugerencias.

## Funciones del motor incorporadas

Condiciones sin llaves, identificadores con puntos, `$+(...)`, caracteres y tokens,
expresiones regulares aisladas, tablas hash y sus contadores/búsquedas, INI,
`scid`/`scon`, eventos privados OPEN/TEXT/ACTION con halt/haltdef, LOAD y diálogos
con IDs numéricos, selección, controles, eventos y actualizaciones did.
Los diálogos usan los colores de HexDreams y conservan IDs, textos y comportamiento.
Los Tips se presentan como aviso de la aplicación y notificación del sistema
cuando las preferencias y Windows lo permiten; su aspecto y duración los controla
el sistema, no el formato de mIRC.

Los INI se representan dentro de `mirc-data/<id del addon>/ini.json`, en el perfil
propio de HexDreams. El script ve un `$scriptdir` virtual: no puede leer ni escribir
archivos ajenos al addon. No se modifica ninguna base de datos para esto.
Las aceptaciones/rechazos manuales viven en memoria; los autoaceptados y la
configuración se conservan al reiniciar. Cargar otro addon no vacía las solicitudes
ni los permisos de los que siguen activos. Desactivar el propio addon sí limpia
su estado de sesión y cierra sus ventanas, conservando su configuración guardada.

## Historial de salas

Las salas recuperan inicialmente 50 líneas, cuando el historial está habilitado.
La configuración anterior se ajusta a 50 una sola vez; después se respeta la
cantidad que el usuario elija en Historial. Esta cantidad solo limita la carga
inicial: las líneas nuevas no se borran al superar 600 ni al cambiar de sala.
Se conservan durante la sesión de la aplicación y no se guardan en settings.json.
La conservación en disco sigue las preferencias existentes de historial y TXT.

## Validación y límites

Se prueba el archivo exacto con solicitudes iniciales, mensajes posteriores,
acciones, aceptación, rechazo, ignorar, reinicio, personalización, dos conexiones,
lista persistente y selección de diálogos. La prueba Electron utiliza IRC local y
comprueba que una respuesta de espera no abra un privado, los botones, el guardado,
la reactivación del addon y una sala con 50 líneas antiguas y 800 nuevas.

Esto no significa compatibilidad universal: quedan fuera otros controles de diálogo,
RAW, temporizadores, evaluación dinámica, DLL y otras APIs no implementadas.
Se mantienen límites de memoria, instrucciones, tamaños y envío por red. El programa
no ejecuta mIRC ni código JavaScript procedente de los addons.
