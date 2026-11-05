# HexDroid Dreams 0.3.0 — IRC y sistemas avanzados (prueba)

Descarga **HexDroid-Dreams-0.3.0-Windows-x64.zip**, extrae toda la carpeta y abre **HexDroidDreams.exe**. No necesita MSI ni instalar Node.js. Conserva una copia de tus datos antes de probar una versión nueva. El perfil continúa en `%APPDATA%\HexDroidDreams-Desktop`.

Esta entrega continúa las etapas 1 y 2 con los sistemas IRC y avanzados de las etapas 3 y 4. Android permanece en su repositorio independiente.

- SASL PLAIN, SCRAM-SHA-256 y EXTERNAL sobre TLS verificado; certificados cliente PFX, CA, fijación del primer certificado TLS válido y STS. Credenciales opcionales protegidas por DPAPI en Windows.
- Reconexión con recuperación de canales, apodos alternativos, recuperación del principal, autojoin con claves, comandos con retrasos, SOCKS4/5 y perfiles de bouncer.
- CAP/IRCv3 con tiempo de servidor, echo sin duplicación, etiquetas, lotes e historial; respuestas, reacciones, escritura, lectura y redacción según capacidades negociadas.
- Historial SQLite/FTS opcional, búsqueda global, retención, carpeta configurable y exportación TXT/ZIP. Registros de protocolo opcionales cifrados y sin contenido de mensajes ni credenciales.
- Avisos nativos, palabras destacadas, silencios, bandeja, conexiones en segundo plano y temas oscuro, claro, sistema y Matrix.
- DCC SEND/CHAT/SSEND/SCHAT, TLS con certificado previamente intercambiado, IPv4/IPv6, puertos, aceptación/rechazo, progreso, cancelación, envío pasivo y reanudación.
- Vistas previas solicitadas de imágenes/GIF y enlaces, guardado de imágenes, apertura en navegador y filehost cuando lo anuncie la red. No se descargan recursos externos automáticamente.
- AGM, FiSH CBC/recepción ECB y AGE con identidades, firmas, grupos y ratchet privado. Los mensajes protegidos no tienen alternativa automática en texto claro; se bloquea el envío directo que evada el cifrado.
- Administrador `.hex`, alias y eventos, variables/colecciones, condiciones/bucles, vistas y botones, HTTP/JSON por dominio autorizado y selección de archivos con tokens. Los scripts se importan desactivados y requieren permisos explícitos.
- Respaldos de configuración y, opcionalmente, secretos/scripts cifrados con frase de paso. Los scripts restaurados permanecen desactivados.

Accede desde el **engranaje superior derecho → Configuración completa** o **Herramientas**. La apariencia y los tamaños del chat siguen disponibles en **Ver → Apariencia y disposición**.

## Alcance de la versión de prueba

Las comprobaciones automatizadas cubren núcleo, interfaz, Electron real y el ejecutable empaquetado en Windows. Incluyen autenticación TLS real, DPAPI, transferencia de bytes DCC, aislamiento de scripts, recuperación de historial y vectores AGM/FiSH independientes de Java. AGE se verifica mediante pruebas de protocolo y revisión del código Android; falta una sesión cruzada con un dispositivo Android y una auditoría criptográfica independiente.

No se afirma paridad completa con Android: el puente `age.*` para juegos no se ejecuta como una función disponible. WebPush requiere un servicio de recepción externo y no se registra; la bandeja mantiene las conexiones mientras el programa sigue abierto. La compatibilidad final de extensiones debe verificarse con el servidor utilizado. Los videos, YouTube y X se abren en el navegador.

El historial guarda texto local solo si lo activas; los borradores siguen siendo de sesión. Las exportaciones están limitadas a 100.000 mensajes/50 MB por operación; filtra una búsqueda mayor. DCC directo puede revelar tu IP y se bloquea por defecto al usar proxy. Los certificados autofirmados requieren importar y verificar la CA; no se desactiva la validación TLS.

**El ejecutable no está firmado digitalmente.** La regla ASR de reputación de Windows puede volver a bloquearlo; esta actualización no elimina esa política ni sustituye la firma de código. No es necesario desactivar Defender para revisar o compilar el proyecto.
