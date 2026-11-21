# HexDreams IRC 0.30.0

Alcance exclusivo: corregir la alineación del encabezado de Notify y priorizar el arranque de red antes de verificar presencia, incluido el aviso MONITOR lleno mostrado por la usuaria.

El gestor de sesiones suspende presencia durante el registro, ejecuta los comandos en orden conservando su separación configurada y solicita las salas después del último comando. La verificación de Notify se habilita cuando llegan las confirmaciones JOIN propias de las salas iniciales y de los JOIN explícitos de los comandos. Los rechazos IRC de entrada resuelven esa espera sin ocultar el error al usuario. Desconectar cancela los comandos pendientes; reconectar vuelve a aplicar la secuencia. El primer comando sigue ejecutándose sin una espera artificial. La publicación de avatar también se posterga al final de esa fase para que no anteceda a los comandos de acceso.

La capacidad de MONITOR se obtiene de ISUPPORT. Solo se registran hasta ese máximo; los contactos restantes, incluidos los privados abiertos, se consultan por ISON. Se siguen interpretando las respuestas ISON mientras MONITOR está activo para ese subconjunto. Si el servidor rechaza MONITOR con 734 se utiliza ISON sin volver a intentar MONITOR repetidamente en esa conexión. No se elimina ningún contacto para cumplir el límite.

El encabezado de Notify utiliza una cuadrícula con título y + de tamaño estable y un selector flexible de 22 px de altura. A anchos menores de 180 px el selector ocupa una segunda línea; con el panel mínimo de 50 px se mantiene el +, que abre el gestor.

Validación: pruebas nuevas del orden de envío, espera de JOIN, continuación tras un rechazo, capacidad MONITOR/ISON y límites geométricos del encabezado a 240/180/140/50 px; suite completa y prueba nativa de Electron con servidor IRC local. La publicación de Windows repite las comprobaciones y prueba el ejecutable empaquetado antes de entregar el ZIP.
