# HexDreams IRC 0.31.0 — Windows portable

Integra en la versión actual los cambios del PR #4 necesarios para el Seguidor de Nicks, sin revertir las correcciones anteriores de conexión y Notify.

- El motor .hex recibe JOIN con red, sala, nick, host, ident y estado propio.
- NICK conserva host/ident del prefijo IRC y transmite nick anterior/nuevo y la primera sala afectada (o Status si no hay sala).
- Extras/Seguidor-de-Nicks.hex incluye el script del PR adaptado para no avisar en el primer ingreso ni mostrar comas vacías. Aprende nicks por red y host y muestra un aviso local cuando hay anteriores. No envía mensajes al canal.

El script se importa manualmente desde Scripts. No se reemplazan automáticamente los scripts instalados. La coincidencia de host es orientativa y no demuestra identidad personal.

Extrae todo el ZIP y ejecuta HexDreamsIRC.exe desde su carpeta. No requiere instalación.
