# Paneles de addons · HexDreams IRC 0.40.0-beta.6

Los paneles se dibujan y ejecutan con el motor propio de HexDreams. No necesitan
mIRC. Su tamaño y controles proceden de la tabla `dialog` del archivo original.
No se instalan parcialmente addons que el intérprete no pueda compilar.

## Paneles originales verificados

### Ignorar Querys (`ignorakuerys.xcr`)

1. Importar el archivo desde Configuración → Scripts → Importar addon .mrc/.xcr.
2. En Scripts, elegir «Ignorar Querys (…) › Configuración».
3. Escribir un nick y pulsar Añadir; elegir una fila y pulsar Borrar para quitarlo.
4. Editar el mensaje y activar la casilla para filtrar los privados.
5. Cerrar conserva la edición, incluso al hacerlo inmediatamente después de escribir.

La lista y el mensaje de este archivo utilizan variables de sesión. No se anuncia
persistencia después de reiniciar. Sus registros de privados ignorados se escriben
en el espacio virtual del addon; no en una carpeta arbitraria del sistema.

### PVGuard (`PVGuard.mrc`)

Importar y ejecutar `/pvguard on`. Una solicitud nueva abre el panel original con
Aceptar y Rechazar. Enter acciona el botón predeterminado y Escape el de cancelar
(Rechazar). La aceptación permite mensajes posteriores de la máscara; el rechazo
activa el ignore temporal de cinco minutos definido por el archivo.

Este addon decide por máscaras de host: dos nicks con el mismo vhost pueden
coincidir con la misma regla. Se conserva esa lógica del original. La solicitud
inicial descartada por el propio script no se reproduce al aceptar.

Usar un solo control de privados activo para evitar que sus filtros compitan.
El control v87 sigue disponible y conserva su propia lista/INI persistentes.

## Controles y acciones implementados

Listas editables (combo), listas, campos de una o varias líneas, contraseña,
solo lectura, casillas, grupos de radios, botones, enlaces como acciones locales
y pestañas. Seleccionar pestaña funciona con clic y flechas, Home y End.

`did` permite agregar, borrar, insertar, reemplazar y seleccionar filas;
marcar/desmarcar, habilitar/deshabilitar, mostrar/ocultar y asignar foco.
Se conservan los identificadores numéricos de los controles y los eventos
init, sclick, dclick, edit y close, incluidos comodines y rangos de IDs.

`dialog -m/-md` abre o trae al frente el panel; `-v` lo trae al frente y `-x`
lo cierra sin ejecutar el evento close, como requieren estos originales.
El cierre del usuario sí notifica close. Los botones ok/cancel ejecutan su
manejador antes de cerrar; un botón default no cierra por sí mismo.

## Límites pendientes

Esto no habilita todos los paneles de todos los addons. El archivo `modera.mrc`
no está entre los adjuntos. Los paneles MP3 de SkeDDoN todavía necesitan las APIs
multimedia y la sintaxis del resto de ese addon. AntiPv conserva instrucciones
no admitidas; TotalProtection requiere eventos de moderación y otras APIs.
DLL/COM, binarios externos y acceso general al disco siguen sin ejecutarse.

## Verificación

Pruebas del motor con los dos originales sin modificar; interfaz con pestañas,
combo, campos, casillas, foco, Enter y Escape; Electron con IPC, worker y servidor
IRC local para altas/bajas, filtrado, aceptación y rechazo. Regresión de v87 y
salas con 50 líneas recuperadas más 800 nuevas, sin recorte.
La publicación exige también la ejecución de estas pruebas sobre el portable
empaquetado en Windows.

Los paneles se pueden arrastrar desde el encabezado, que permanece accesible por encima de la barra principal. La posición se conserva mientras el panel siga abierto.
