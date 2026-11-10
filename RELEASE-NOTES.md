# HexDreams IRC 0.21.0 para Windows

- Reduce reconstrucciones de mensajes y usuarios: reutiliza filas, actualiza solo las afectadas por una foto y mantiene una caché acotada a ocho conversaciones. Las ventanas cubiertas o minimizadas posponen su renderizado, sin perder mensajes ni borradores. Agrupa movimientos y redimensionados por frame.
- Las ventanas activas, en mosaico y restauradas comparten el renderizador y los estilos de mensajes, avatares, eventos y avisos. La disposición compacta se adapta a ventanas estrechas sin mostrar las palabras letra por letra. Conserva las opciones de presentación existentes.
- WHOIS interpreta 317 separando idle y sign-on. Muestra fecha/hora de conexión y tiempo conectado al consultar solo si recibe un instante válido; no inventa fechas cuando falta el dato.
- Incorpora `/dice`: lanza un dado de seis lados en sala o PV.
- Clic derecho en el editor muestra las sugerencias ortográficas que ofrece Electron, permite reemplazar una palabra o añadirla al diccionario y conserva cortar/copiar/pegar/deshacer.
- Conserva datos, historial, scripts y rutas de firma.

## Validación

153 pruebas de lógica, 66 flujos de interfaz y Electron real con IRC TCP/TLS. Windows comprueba el arranque normal y el ejecutable empaquetado antes de publicar.

Medición reproducible local: seis salas, 600 mensajes y 150 usuarios por sala; doce cambios de chat. La mediana pasó de 494,7 a 197,3 ms y agregar un mensaje de 338,5 a 7,3 ms. No es una garantía para otro hardware ni prueba que la memoria al 82 % sea la causa. Datos y metodología en docs/CORRECCIONES-0.21.0.md.

## Evidencia pendiente

Los archivos 20261110-2221-36.9362703.mp4 y 20261110-2225-47.6740769.mp4 y la captura nueva no estaban disponibles en el entorno. No se atribuyen a esos videos conclusiones sin revisarlos.

Extrae todo el ZIP y abre HexDreamsIRC.exe. El ZIP distribuido no está firmado.
