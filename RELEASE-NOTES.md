# HexDroid Dreams 0.2.0 — interfaz de escritorio (prueba)

Descarga **HexDroid-Dreams-0.2.0-Windows-x64.zip**, extrae toda la carpeta y abre **HexDroidDreams.exe**. No necesita MSI ni instalar Node.js. Conserva la versión anterior como respaldo. El perfil de usuario sigue en `%APPDATA%\HexDroidDreams-Desktop`.

## Cambios de esta entrega

- Privados a la izquierda y canales únicamente en pestañas superiores, con selector de red compacto.
- Ambos paneles ajustables y ocultables; orden, silencios, ancho y ventana persistentes.
- Borradores y lectura individuales, redes aisladas, contadores y menciones, búsqueda y primer mensaje sin leer.
- Menús contextuales funcionales, doble clic para privados, WHOIS y moderación según los rangos del servidor.
- Formato IRC/ANSI básico, controles de composición, fuente/espaciado, selección y copia de mensajes, líneas múltiples y navegación por teclado.

No hay funciones simuladas en la aplicación: el contenido proviene de conexiones IRC. Los servidores y mensajes simulados pertenecen exclusivamente a las pruebas.

## Comprobaciones y alcance

Se incluyen 20 pruebas de núcleo, 9 de interfaz y una integración con Electron y servidor IRC local reales. La publicación está condicionada a que pasen en Windows, junto con la compilación. La validación en redes públicas y en el equipo del usuario sigue siendo necesaria. Esta distribución no está firmada digitalmente.

Esta es la primera entrega del documento maestro: auditoría e interfaz principal. SASL/CAP, reconexión, historial persistente, notificaciones/bandeja, DCC, cifrado, multimedia, scripts `.hex`, alias y respaldos permanecen pendientes. Los borradores y mensajes se conservan solo durante la sesión; los silencios se refieren al resaltado de actividad.

El documento completo y el plan ordenado se guardan en `docs/MASTER-PLAN.md` y `docs/IMPLEMENTATION.md`. Android continúa en su repositorio independiente.
