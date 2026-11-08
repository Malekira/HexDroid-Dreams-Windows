# HexDreams IRC 0.17.0 para Windows

- Nick completion multicolor por letras, degradado o arcoíris, con emojis, plantilla y vista previa. El formato usa la paleta clásica IRC de 16 colores: los colores elegidos se aproximan para que otros clientes no muestren códigos hexadecimales como texto.
- La activación de nick completion se guarda al marcarla y resiste las actualizaciones de preferencias del servidor.
- Tema es un selector desplegable como Red, con temas incluidos, guardados y acceso a su configuración. Los controles del gestor tienen más margen interior.
- Salas muestra primero las favoritas de la red activa, seguidas de entrar a otra sala, listado y configuración de favoritas.
- Editar red adopta cuatro secciones adaptables: configuración, identidad, foto/avatar y conexión/comandos. Conserva los controles existentes, la vista previa y el contador del nombre real. Su formato puede editarse sin conexión.
- Se mantienen los directorios de configuración, historial y firma existentes.

## Uso

Extrae todo el ZIP y abre HexDreamsIRC.exe. Configura el multicolor en Configuración → Chat y notificaciones → Diccionario y nick completion. Conserva tu certificado existente para Sign/Verify; el ZIP distribuido no está firmado.

## Validación

138 pruebas de lógica e integración y 54 flujos de interfaz en Chromium. Prueba completa de Electron con IRC TCP/TLS, envío de nick multicolor, preferencias persistentes y ventanas internas. Windows repite las pruebas y comprueba el ejecutable empaquetado antes de publicar la descarga.
