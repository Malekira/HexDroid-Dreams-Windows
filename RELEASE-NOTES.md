# HexDreams IRC 0.16.0 para Windows

- Implementa las correcciones del PDF de versión 16 y lo anotado después de la versión 15, con controles compactos.
- Diccionario de reemplazos en Configuración → Chat y notificaciones → Diccionario y nick completion. Permite agregar, editar, eliminar y activar reglas, con coincidencia de palabras completas y mayúsculas opcionales. Reemplaza al pulsar espacio o enviar; conserva los nombres y destinatarios de comandos.
- Nick completion con plantilla, emojis, colores, fondo, negrita, cursiva y subrayado. Incluye `{nick}`, `{red}` y `{sala}`, ayudas, ejemplos y vista previa. El editor muestra texto legible y el formato se aplica al enviar; Tab/Shift+Tab siguen recorriendo las coincidencias originales. Los borradores conservan el formato durante la sesión.
- Se elimina el selector duplicado de colores de nicks y se corrige el tamaño, ancho y contraste de las sugerencias sobre fondos claros y oscuros.
- Cada ventana interna tiene Minimizar. Se restaura desde la barra inferior o el árbol sin perder el borrador. Ver → Ventanas incorpora mosaico vertical y horizontal, además de cascada y maximizar.
- Configuración separa General, Away, NOTICE, notificaciones, resaltado y sonido. Privados y menciones se notifican por separado. NOTICE admite destino original o copias en PV, sala y Status, color/fondo/estilo local y aviso de Windows independiente; no duplica los avisos de la campana por cada copia.
- Archivo reúne conexión, redes, salas, favoritas, listado y configuración. Ver reúne historial, visor de logs, ventanas y paneles. Se elimina Red; Comandos y Scripts conservan sus funciones.
- Barra superior compacta y ordenada: Red, conexión, consola, Salas, Topic, Notify, Tema, configuración y campana. Tema reúne los temas incluidos y guardados, con acceso a su configuración. Usuarios queda en cada conversación. Se conserva el logo y se muestra el contador y aviso del límite del nombre real.
- Las nuevas preferencias forman parte del respaldo y se conservan al importar y reiniciar. Los directorios de datos, logs y firma permanecen iguales.

## Uso

Extrae todo el ZIP y abre HexDreamsIRC.exe. Activa y configura tus reemplazos y plantilla de nick desde Diccionario y nick completion. Conserva tu certificado existente para la firma personal con Sign/Verify; el ZIP distribuido no está firmado.

## Validación

135 pruebas de lógica e integración, 49 flujos de interfaz en Chromium y Electron real con IRC TCP/TLS. Incluye envío de reemplazos y nicks con formato, minimización y restauración de borradores, NOTICE, respaldos e historial. Windows repite las pruebas y verifica el ejecutable empaquetado antes de publicar la descarga.
