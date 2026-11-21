# HexDreams IRC 0.29.0

Alcance: los diez ítems de `HexDreams_IRC_Ampliaciones_pendientes_01-10.pdf` y las tres anotaciones posteriores sobre barra de red, filtro de Notify y panel izquierdo. No se modifica la identificación de red ni otros scripts del usuario.

## Programa principal

1. La interceptación de privados ocurre antes de historial, notificación y creación de conversación. `halt` identifica al script propietario; se retiene el primer mensaje por script/red/nick. No se muestran mensajes retenidos.
2. Acciones `.hex`: `send.direct nick texto` responde sin eco local; `conversation.open nick` abre un PV de la red del evento y recupera su primer mensaje retenido; `conversation.close nick` descarta la solicitud retenida y cierra únicamente ese PV. Se rechazan canales, Status, destinos de control y redes inexistentes. La apertura depende de la decisión del script, no es automática por recibir una solicitud.
3. `view` reutiliza su ventana por script/red/identificador, la trae al frente si estaba detrás y le asigna foco. Los campos conservan su edición durante las actualizaciones.
4. `tree.add clave comando contador etiqueta` registra o actualiza una entrada por script/red/clave; `tree.remove clave` la retira. El clic ejecuta exclusivamente el alias del script propietario. Desactivar o eliminar el script retira entradas y mensajes pendientes; los lanzadores existentes se conservan.
5. Paneles contiene la opción Compartir Notify entre todas las redes. Activa una lista común sin reemplazar las listas individuales. El seguimiento se sincroniza en sesiones actuales y se aplica al conectar/reconectar; la presencia sigue separada por red. Las alertas identifican su red. El filtro lateral ofrece Red activa, cada red configurada y Todas.
6. El motor valida permisos de UI/envío y destinos. Las nuevas acciones no modifican scripts anteriores ni se invocan sin que el script las solicite.
7. Apariencia es un menú principal, con Temas y colores, Fuentes y presentación, Apariencia de sala, Diccionario y Nick Completion. Los accesos de configuración de estas últimas se trasladan del grupo Chat a Apariencia.
8. Diccionario y Nick Completion tienen Activar/Desactivar con estado y Configurar, que reutiliza el editor existente. No se reinician las preferencias.
9. Ctrl+Enter envía el texto visible sin marcas IRC solo en ese envío. Enter conserva el formato; Shift+Enter inserta un salto. Se mantienen emojis y sustituciones ya visibles del diccionario.
10. Encabezados compactos de una línea, sin lema decorativo, con cierre visual ×. Se conservan los nombres accesibles y el área de arrastre.

Barra superior: Red, icono de conexión, Topic, Salas, icono Status, configuración, campanita. Se retiran Tema y Notify de la barra; Notify mantiene su gestor en el encabezado del panel lateral.

Panel izquierdo: mínimo 50 px; Conexiones, separador doble, Notify, separador doble, Salas, separador simple, PV. Las entradas propias de scripts se muestran junto a las conexiones y no se convierten en conversaciones.

## Script Anti-PV opcional

`Extras/AntiPV_HexDreams_0.29.hex` se entrega aparte, para importar manualmente. No reemplaza ni migra los scripts instalados. Requiere 0.29 o posterior.

- `/pv`: solicitudes de la red actual, con Aceptar, Rechazar e Ignorar.
- `/pvconfig`: elegir solo entrada lateral, notificación, ventana automática o ambas. El modo se guarda como estado del script cuando el almacenamiento seguro está disponible.
- Aceptar autoriza al nick en esa red y recupera el primer mensaje; rechazar bloquea nuevas solicitudes durante esa ejecución; ignorar no bloquea solicitudes futuras.
- Las solicitudes/decisiones en memoria se reinician al recargar el script o cerrar la aplicación; no son una lista de bloqueo permanente.
- Al conectar o recargar en una red ya conectada se registra Anti-PV (n), sin duplicados.

## Validaciones

Pruebas de lógica del motor, acciones de conversación, aislamiento de red/script, envío directo, árbol y política Notify. Flujos de interfaz para barra/panel/menús, envío sin formato y Notify compartido. Prueba nativa con IRC local verifica que el mensaje retenido no aparece en historial ni abre PV, la aceptación recupera el primer mensaje, el rechazo cierra el PV, `view` reutiliza la ventana y las entradas se eliminan al desactivar. La publicación de Windows queda condicionada a pruebas de fuente, interfaz, arranque empaquetado y ejecutable empaquetado aprobadas.
