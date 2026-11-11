# HexDreams IRC 0.23.0 para Windows

- Fondo de la ventana independiente del fondo donde aparecen los mensajes, configurable en los estilos y en el editor de temas, con vista previa.
- Altura de línea y separación entre mensajes en puntos, con controles numéricos compactos y vista previa. Se conserva el espaciado anterior hasta editarlo.
- Historial: cantidades independientes para recargar salas y privados (0 desactiva; máximo 600). Usa el historial de búsqueda guardado por la aplicación; elegir filas activa ese guardado. Los TXT conservan sus opciones separadas. Cerrar una conversación impide que una respuesta tardía vuelva a abrirla.
- Se omiten líneas vacías, espacios y líneas que solo contienen formato, también al enviar varias líneas y mensajes privados o NOTICE.
- Los privados abiertos avisan cuando su usuario se desconecta o vuelve. El seguimiento es temporal y no agrega usuarios a Notify. Usa MONITOR cuando está disponible e ISON cada 30 segundos como alternativa.
- Mosaico en cuadrícula disponible desde Ventanas, con distribución ajustada a las ventanas abiertas.
- Campana amarilla mientras quedan notificaciones sin leer; recupera su color habitual al leerlas.

## Validación

Pruebas de lógica e interfaz cubren los nuevos controles, persistencia, fondos independientes, límites de recarga, respuestas tardías, líneas vacías, presencia en privados y campana. La compilación de Windows ejecuta además Electron contra IRC TCP/TLS y comprueba el ejecutable empaquetado antes de publicar.

Extrae todo el ZIP y abre HexDreamsIRC.exe. El ZIP distribuido no está firmado.
