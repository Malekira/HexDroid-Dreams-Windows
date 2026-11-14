# Revisión de HexDreams IRC 0.21.0

Se partió de la versión 0.20.0 del repositorio Windows. No se modificó Android. Los documentos adjuntos anteriores se consideran evidencia y contexto; la autorización y alcance corresponden al pedido actual.

## Cambios y validación

| Pedido | Cambio implementado | Comprobación |
| --- | --- | --- |
| Lentitud al cambiar chats | Caché de filas con máximo de ocho conversaciones; reconciliación del DOM; formateadores de fecha reutilizados; lecturas de geometría agrupadas. | Medición antes/después y pruebas de identidad de filas al agregar mensajes, volver a un chat y actualizar una foto. |
| Lentitud al mover ventanas | Movimientos agrupados por requestAnimationFrame; no reconstruyen mensajes. Las ventanas cubiertas o minimizadas no se redibujan hasta mostrarse. | Una ráfaga de 100 movimientos produce menos de 20 escrituras de estilo y ninguna llamada al formateador de mensajes. Pruebas de arrastre, tamaño, mosaico y restauración. |
| Recursos | Caché acotada; eliminación de referencias a chats cerrados; actualización parcial de usuarios y avatares; búsqueda del árbol por mapa en lugar de recorrerlo para cada elemento. | Pruebas de límite de caché y vaciado al cerrar conversaciones. No se infiere el consumo total del equipo del usuario. |
| Presentación inconsistente | Un único constructor de filas para chat activo e inactivo, con los mismos avatares, horas, colores, estilos, avisos y eventos. Las filas se trasladan conservando sus acciones. CSS compartido y adaptación del modo compacto a ventanas estrechas. | Comparación de estilos computados, avatares e identidad DOM antes/después de activar, minimizar y restaurar; captura de prueba. |
| Zonas blancas y saltos | Se conserva el fondo elegido en los contenedores; no se vacía y reconstruye todo el historial al actualizar. Un fondo blanco elegido por el usuario sigue siendo blanco. | Pruebas con chat blanco dentro de tema oscuro, estilos al restaurar, posición de lectura y primer mensaje sin leer. Falta contrastar con los videos nuevos no disponibles. |
| Conexión en WHOIS | El primer campo de 317 es idle; el segundo es el instante UNIX de conexión en segundos. Fecha/hora y duración al consultar solo se muestran con sign-on válido. | Casos con campos completos, faltantes, cero, negativos, texto y unidades incorrectas; prueba de interfaz y servidor IRC local en Electron. |
| Pendiente `/dice` | Un único dado de seis lados, conforme a la aclaración del usuario; disponible en sala/PV, menú y sugerencias. | Resultado entre 1 y 6 y ACTION exacta recibida por el servidor local; rechazo en Status o con argumentos extra. |
| Pendiente clic derecho para corregir | Menú nativo en campos editables con sugerencias, reemplazo, diccionario y edición. Se habilita español cuando está disponible en Electron. | Pruebas de plantilla y callbacks; Electron real comprueba el enlace entre el evento nativo y replaceMisspelling. Las sugerencias concretas dependen de sus diccionarios. |

## Regresiones de pendientes anteriores ya implementados

La suite completa conserva las comprobaciones de MeMo en texto plano, perfiles desde Notify sin PV/WHOIS automático, comandos largos en Status, eliminación de scripts, historial TXT/eventos, estilos y nick completion, favoritos, respaldos y manejo de ventanas. No se vuelven a presentar como funciones nuevas ni se da por revisado cada comportamiento histórico solo por aparecer en la conversación.

## Medición reproducible

Se usó Chromium headless en el mismo entorno Linux, con viewport 1280 × 900, seis salas de 600 mensajes y 150 usuarios por sala. Se midieron doce alternancias y la incorporación de un mensaje; incluyen primeras visitas a salas. Se utilizó el mismo conjunto de datos y script antes y después. Son tiempos síncronos de interfaz en laboratorio, no tiempos de red ni una medición del hardware del usuario.

| Medida | Antes | Después |
| --- | ---: | ---: |
| Mediana de cambio de chat | 494,7 ms | 197,3 ms |
| Máximo de las doce alternancias | 749,8 ms | 267,7 ms |
| Incorporar un mensaje | 338,5 ms | 7,3 ms |
| Llamadas al formateador durante la muestra | 8.414 | 3.014 |
| Conserva la primera fila al agregar un mensaje | No | Sí |
| Nodos unidos al documento al finalizar | 34.627 | 7.582 |

Los nodos unidos al documento no equivalen a toda la memoria: las filas en caché separadas del DOM no se cuentan allí. No se afirma una reducción equivalente de RAM ni que el 82 % observado explique la lentitud. Se conservan los 600 mensajes cargados por conversación; no se recortó el historial para mejorar el resultado.

Datos originales: [antes](performance-0.21.0/before.json), [después](performance-0.21.0/after.json). Para repetir, con dependencias y Chromium instalados y el puerto 4173 libre: `node scripts/benchmark-ui.cjs resultado.json`. Se puede indicar otro Chromium mediante CHROMIUM_PATH.

## Evidencia no disponible y límites

No se encontraron los videos `20261110-2221-36.9362703.mp4` y `20261110-2225-47.6740769.mp4` ni la captura nueva del Administrador de tareas. El segundo video no se analizó y no se extrajeron conclusiones sobre su contenido. Los seis videos disponibles del 6 de noviembre no sustituyen esa evidencia nueva.

Queda pendiente contrastar el resultado con esos archivos y con el equipo del usuario. La revisión implementa y verifica causas reproducibles del código; no promete eliminar cualquier lentitud externa, del servidor, del sistema operativo o de otro hardware. La validación visual cubre las ventanas internas existentes, mosaico y estados restaurados; no añade un sistema nuevo de chats en ventanas nativas independientes.
