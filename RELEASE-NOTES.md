# HexDreams IRC 0.22.0 para Windows

- La zona de escritura mantiene el recuadro de texto separado de los botones: estilos y Enviar quedan a su derecha, fuera del borde y del fondo del texto, en una fila compacta.
- Las ventanas inactivas y en mosaico también muestran ambos botones. Pulsar estilos activa su conversación y abre las opciones de escritura.
- Conserva colores y tamaño de letra, el crecimiento para varias líneas, borradores, sugerencias y envío. El contraste se calcula sobre el fondo del texto.
- Se conservan datos, historial, scripts y rutas de firma.

## Validación

67 flujos de interfaz verifican posición de los controles fuera del texto, fondos personalizados, uso de estilos, envío y restauración de ventanas. La compilación de Windows ejecuta además las 153 pruebas de lógica, Electron con IRC TCP/TLS y la comprobación del ejecutable empaquetado antes de publicar.

Extrae todo el ZIP y abre HexDreamsIRC.exe. El ZIP distribuido no está firmado.
