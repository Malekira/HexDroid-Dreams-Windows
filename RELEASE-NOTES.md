# HexDreams IRC 0.32.0 — Windows portable

- Aviso visible y registro en la campanita cuando el servidor rechaza o corta la conexión, con el motivo real: G/Z/K-line, contraseña, TLS, DNS, tiempo agotado u otros errores. Si no indica motivo, se informa sin inventarlo.
- Status conserva el diagnóstico después de una desconexión inesperada, incluso si los errores están filtrados. Cerrar voluntariamente sigue cerrando las conversaciones.
- Las respuestas rutinarias ISON/MONITOR de Notify no llenan Status ni el historial TXT. Se conservan los cambios de presencia, las respuestas ISON manuales y los errores importantes.

Se mantienen la secuencia de inicio, redes, preferencias y scripts. Los pendientes de autenticación /login no se modifican en esta entrega.

Extrae todo el ZIP y ejecuta HexDreamsIRC.exe desde su carpeta. No requiere instalación.
