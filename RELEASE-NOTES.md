# HexDroid Dreams 0.6.1 — fotos compatibles con Chat v92

Extrae toda la carpeta del ZIP y abre HexDroidDreams.exe. Conserva tu perfil y las preferencias de la versión anterior.

- Las fotos anunciadas mediante METADATA tienen prioridad sobre la plantilla por nick.
- Se leen también las rutas de foto codificadas por el chat web en GECOS: WHO, WHOX, JOIN extendido, WHOIS y SETNAME. Las rutas del dominio antiguo se normalizan al servidor actual de avatares.
- La plantilla configurada se usa cuando no existe una foto anunciada ni una ruta del chat. Una retirada explícita de avatar se respeta y no se sustituye por una imagen antigua.
- Se negocian las capacidades necesarias, se solicitan los avatares al entrar y se reciben las actualizaciones. Al activar fotos en Multimedia se sincronizan las conexiones abiertas, sin exigir reiniciar.
- Las miniaturas y la ventana de foto completa usan el mismo criterio para elegir la imagen. Una descarga antigua no puede reemplazar una foto anunciada más recientemente.
- Se respetan las versiones de las URLs publicadas y se versionan las peticiones de la plantilla y las rutas del servidor de fotos para evitar caché antigua. El reintento manual solicita una versión fresca.
- La carga automática utiliza los servidores de avatares oficiales o el dominio de la plantilla configurada. Las fotos anunciadas en otros dominios HTTPS pueden cargarse al ampliar, tras confirmar. Se conservan las comprobaciones TLS, los límites de imagen y el bloqueo de descargas directas al usar proxy IRC.

Se mantienen las funciones de la versión 0.6.0. Para firmar el EXE nuevo reutiliza tu certificado existente con Sign y Verify; no hace falta recrearlo.
