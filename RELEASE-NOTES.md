# HexDroid Dreams 0.6.2 — foto propia, topic ajustable y Notify

Extrae toda la carpeta del ZIP y abre HexDroidDreams.exe. Se conservan las redes, preferencias y el certificado personal existente.

- La foto propia se anuncia mediante METADATA al conectar y al guardar la identidad. Se utiliza la dirección HTTPS de esa red o, si está vacía, la plantilla común con el nick actual. Así los clientes web compatibles pueden cargar la imagen. Los cambios se mantienen al reconectar automáticamente.
- Identidad incluye «Publicar mi foto en esta red». Desactivarlo retira el anuncio. La foto local no se sube: para que otros clientes la vean debe existir una imagen accesible mediante HTTPS. La publicación requiere soporte METADATA en la red.
- Botón «Topic» junto a los controles de conexión para ocultar o volver a mostrar el tema y aprovechar más altura para los mensajes.
- Separador horizontal debajo del encabezado para ajustar la altura del topic arrastrándolo hacia arriba o abajo. También admite flechas arriba/abajo, Home/End y doble clic para recuperar el tamaño automático. Se guarda la altura elegida.
- Botón «Notify»: lista independiente por red de apodos cuyo estado se sigue aunque no estén en la sala actual. Se pueden añadir o quitar apodos, abrir privados y configurar avisos, desconexiones y sonido.
- El perfil de usuario incorpora «Seguir conexión» / «Dejar de seguir conexión».
- Notify utiliza MONITOR cuando la red lo permite e ISON cada 30 segundos como alternativa. La primera consulta establece el estado sin emitir sonidos repetidos. Las entradas y desconexiones observadas directamente también actualizan el estado; salir de una sala no se interpreta como desconectarse.

Se mantienen las mejoras de fotos de 0.6.1. Para firmar el EXE nuevo reutiliza tu certificado con Sign y Verify; no hace falta recrearlo.
