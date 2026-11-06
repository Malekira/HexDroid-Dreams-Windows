# HexDroid Dreams 0.5.0 — colores, fotos y avisos

Extrae toda la carpeta del ZIP y abre HexDroidDreams.exe. Se conservan tus redes y preferencias del perfil de Windows. Guarda una copia antes de actualizar.

- Color, negrita, cursiva y subrayado permanentes entre mensajes. El editor muestra el formato sin insertar cuadraditos; al enviar utiliza los controles IRC. Se mantienen los colores extendidos, los fondos y los emojis.
- Lista de usuarios con nick y rango, sin ident ni host. Las acciones WHOIS/WHO usan solamente el nick y los cambios de apodo actualizan la lista automáticamente.
- Configuración → Multimedia: activar multimedia, mostrar miniaturas y guardar una plantilla HTTPS común, por ejemplo `https://tu-servidor/fotos/{nickLower}.jpg`. También admite `{nick}`, `%nick%` y `%s`. La carga automática se activa explícitamente; el servidor de fotos recibe los nicks solicitados. La foto local de identidad sigue disponible por red.
- WHOIS y WHO abren la conversación «WHOIS / WHO», donde se acumulan los resultados. Su historial local se guarda por defecto y se puede desactivar en Historial.
- Pestañas con actividad por mensajes y entradas/salidas. Avisos visuales y sonidos configurables para menciones, privados y mensajes de sala, incluyendo la ventana y la sala activas. El sonido usa Windows, sin depender de la reproducción automática del navegador.
- Acceso rápido sol/luna junto al selector de red. Configuración → Colores del entorno permite guardar fondos, paneles, texto y selección, o restaurar los del tema.
- Menú superior compacto, sin el acceso duplicado «Herramientas». Configuración sigue en la esquina superior derecha.

Las fotos requieren una URL de imagen válida y accesible; las descargas directas siguen bloqueadas si utilizas proxy. Los resultados de consultas dependen de lo que permita y devuelva el servidor IRC.

El ZIP incluye el script de firma personal. Para el EXE nuevo repite Sign y Verify con el certificado existente; no hace falta volver a crearlo. La firma personal no garantiza evitar ASR o SmartScreen. Véase docs/FIRMA-PERSONAL.md.
