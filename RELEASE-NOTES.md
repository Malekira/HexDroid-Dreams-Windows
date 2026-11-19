# HexDreams IRC 0.37.0 — Windows portable

- Notify → Mostrar eventos en un privado agrega entradas, salidas y cambios de nick a una ventana Notify de solo lectura, por conexión. Cada línea identifica red, servidor y hora.
- Abrir registro Notify permite consultar la ventana sin esperar otro evento. Los eventos nuevos no cambian el foco de la conversación actual.
- El registro tiene su propia opción y funciona aunque estén desactivados los avisos emergentes. No convierte el primer sondeo de presencia en entradas ni duplica el cambio de nick como una nueva conexión; no registra usuarios observados únicamente por un PV abierto.
- Al desactivar la opción se dejan de agregar eventos; las líneas ya mostradas permanecen durante esa sesión. El registro no envía mensajes, avisos de escritura ni marcas de lectura a IRC, y sigue visible al ocultar los eventos de sala.

La opción se guarda en la configuración y comienza desactivada. Es un registro local de sesión: no agrega guardado SQLite/TXT y se cierra con las demás pestañas al desconectar, como antes.

Extrae todo el ZIP con HexDreams cerrado. No requiere instalación.
