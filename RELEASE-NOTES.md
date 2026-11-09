# HexDreams IRC 0.18.0 para Windows

- El administrador de scripts incorpora Eliminar junto a Activado y Ayuda. El script se retira de la aplicación, deja de ofrecer comandos y se detienen sus temporizadores.
- El historial de cada sala conserva mensajes y eventos recibidos: entradas, salidas, cambios de nick, expulsiones con autor y motivo, clones, sanciones, tema y modos. Se guarda con fecha y hora en TXT y en el historial de búsqueda cuando está activado. Funciona con eventos unidos o en panel dividido.
- El historial existente se actualiza conservando sus mensajes. Los respaldos mantienen la distinción entre mensajes y eventos.
- Editar red muestra los selectores de color inmediatamente junto a sus etiquetas, también en ventanas estrechas.
- Hacer clic en el fondo o título de una sala, PV o Status activa su cuadro de escritura, incluso si esa ventana ya estaba activa. Conserva el borrador y permite seguir usando los controles y seleccionar texto.
- Se conservan las rutas de configuración, historial y firma.

## Uso

Extrae todo el ZIP y abre HexDreamsIRC.exe. Elimina scripts desde Scripts → Administrar scripts .hex. El guardado TXT de mensajes y eventos se controla en Configuración → Historial → Guardar historial en TXT por sala. El ZIP distribuido no está firmado.

## Validación

141 pruebas de lógica e integración y 57 flujos de interfaz. Electron con IRC TCP/TLS verifica foco de escritura, eliminación de scripts y registro de expulsiones en TXT y búsqueda. Windows comprueba también el arranque normal y el ejecutable empaquetado antes de publicar el ZIP.
