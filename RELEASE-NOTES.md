# HexDreams IRC 0.33.0 — Windows portable

- Los errores del historial SQLite ya no interrumpen los eventos JOIN/PART ni la recepción de mensajes: las salas conservan su estado correcto y el cuadro de escritura se habilita al ingresar.
- También se aíslan los errores de historial en WHOIS, redacciones y recuperación de privados retenidos.
- Al primer fallo se muestra un aviso crítico en Status y se pausan las escrituras automáticas SQLite hasta reiniciar, sin cambiar las preferencias ni repetir el error con cada mensaje. El chat y el historial TXT pueden continuar.

Esta versión corrige el bloqueo del chat; no repara la corrupción FTS5. No borra datos, no reconstruye índices y no cambia el Bot Espía. Las lecturas del historial dañado pueden seguir mostrando errores y requieren un diagnóstico separado.

Extrae todo el ZIP y ejecuta HexDreamsIRC.exe desde su carpeta. No requiere instalación.
