# HexDreams IRC 0.13.0 para Windows

- Corregido el falso error «Bloque .hex sin cerrar» al encontrar caritas como `=)` en texto. Los comentarios respetan los puntos y coma dentro de comillas; los errores de bloque incluyen línea.
- Compatibilidad del control de privados: variables `$isprivate` y `$isme`, evento NICK con `$newnick`, condiciones dentro de vistas, y `echo -s` en el status de red. Una vista abierta se actualiza en su propia ventana; al cerrarla se envía `SIGNAL:view_closed` al script propietario.
- Scripts → Editor de scripts: crear o abrir archivos, editar scripts instalados, validar sintaxis, guardar en la aplicación y guardar archivos .hex. Incluye posición del cursor y contador de bytes. Guardar cambios deja el script desactivado y sin permisos; se habilita desde Administrar scripts. Una validación fallida no modifica el instalado y se detectan ediciones concurrentes.
- Ver → Historial, Ver → Configuración y Ver → Salas favoritas → Configuración / lista de salas. Favoritas se agregan y eliminan desde su configuración; el menú solo contiene accesos compactos, sin botones Quitar. Se conserva la pertenencia por red.
- Exportar/importar configuración usa filas compactas, con el texto y su casilla en la misma línea.
- Notify muestra filas más bajas, nick y estado alineados y acciones pequeñas del mismo tamaño a la derecha.
- Notificaciones muestra hora, tipo/nick, red/sala y mensaje en filas compactas, con un botón pequeño para abrir la conversación. Los mensajes completos se conservan y el diseño se ajusta al ancho.
- Botones de acciones de usuario con columnas y alturas iguales: dos columnas en el panel lateral y tres en WHOIS.

Extrae todo el ZIP y abre HexDreamsIRC.exe. Se conservan los datos anteriores. Vuelve a importar tu .hex; para el control de privados habilita únicamente los permisos que utiliza: lectura, interceptación, envío y UI. No necesita raw, HTTP ni claves. Firma el nuevo EXE con Sign y Verify usando tu certificado existente.
