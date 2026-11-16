# HexDreams IRC 0.34.0 — Windows portable

- El historial usa una carpeta y un archivo exclusivos: `HexDreams-IRC-history/hexdreams-history.sqlite`, dentro de la carpeta de historial seleccionada. Se identifica la base como propia de HexDreams y se rechazan archivos ajenos.
- Al abrir por primera vez se copian los mensajes de la antigua `history.sqlite`, sin modificarla ni usar su índice FTS5. El nuevo historial genera su propio índice de búsqueda. La copia es transaccional y se realiza una sola vez.
- Los scripts .hex siguen usando su almacenamiento separado y las funciones controladas del motor, sin acceso directo a SQLite. Los historiales TXT no cambian.
- Se mantiene la protección de 0.33.0: un fallo de historial no bloquea los eventos de sala ni la escritura del chat.

La base anterior se conserva. Si también están dañadas las tablas de mensajes, la copia se cancela sin importar datos parcialmente y se informa del fallo; esos datos requieren recuperación aparte. Esto no es una protección contra otros programas que tengan permisos de acceso a los mismos archivos de Windows.

Extrae todo el ZIP y ejecuta HexDreamsIRC.exe desde su carpeta. No requiere instalación. No cambies la carpeta de historial al actualizar: así se conservan la configuración y el origen de la migración.
