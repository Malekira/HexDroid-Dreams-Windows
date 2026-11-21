# HexDreams IRC 0.25.0 — anotaciones 16 a 24 y correcciones de envío

Implementación sobre `feat/irc-advanced-systems`, partiendo de 0.24.0, sin fusionar con main. Se leyó el PDF y se revisó la maqueta aprobada de su página 7.

| Anotación | Cambio |
| --- | --- |
| 16 | Se unifican fondos, métricas, encabezados, controles y cuadro de escritura entre ventanas activas e inactivas. Ctrl+F resalta coincidencias sin filtrar mensajes; anterior/siguiente, Enter/Shift+Enter y Esc. La barra se superpone sin cambiar la altura disponible ni los borradores. Se conserva la lupa de usuarios y se retira la de mensajes. |
| 17 | Listado de salas queda solo en Salas, después de Comandos. Ventanas vuelve a ser un submenú de Ver, conservando cuadrícula, mosaicos, cascada y maximizaciones. |
| 18 | Cuadro y botones rectangulares, con dos píxeles de separación, mínimos márgenes y altura ajustada al texto. Un solo tamaño compartido evita crecer por el placeholder al reducir ventanas. |
| 19 | Importar tema abre el selector de archivos de Windows y valida el JSON; lista, vista previa, aplicación y persistencia conservan los temas anteriores. |
| 20 | El diccionario incorpora formato por fragmentos: negrita, cursiva, subrayado y los 16 colores IRC clásicos. Guarda los códigos, los previsualiza al editar y mantiene la sustitución automática. Se rechazan colores extendidos/RGB en el editor; la validación conserva solo los códigos permitidos. |
| 21 | General, Away, NOTICE, Notificaciones, Resaltado, Sonido, Status, Diccionario y Nick completion. Las últimas dos opciones son secciones independientes. |
| 22 | Espaciado en Apariencia → Chat, en una fila con vista previa y aplicación inmediata. Sin duplicación en Colores del entorno. |
| 23 | Status queda en Chat y notificaciones → Status; se conservan filtros y guardado. Se eliminan sus accesos duplicados anteriores. |
| 24 | Chat muestra Espaciado, Formato de NOTICE y Formato de /me, abiertos y en ese orden, con fondo liso y filas compactas. Vistas previas, guardado inmediato y restauración por formato. /me hereda el color normal del nick; se elimina el selector independiente. Se conserva Listo en el pie. |

Las opciones de eventos/clones se mantienen en Paneles y las de menciones en Resaltado. Los formatos NOTICE mantienen sus opciones de rutas y notificación. Apariencia de sala y Temas siguen disponibles desde la navegación de Apariencia.

## Confirmación de mensajes e identificación

- El primer comando al conectar se ejecuta sin la demora de separación. El intervalo se aplica entre comandos. Esto evita retrasar innecesariamente un IDENTIFY/LOGIN configurado como primer comando.
- La recuperación automática del nick no repite intentos en menos de 30 segundos aunque haya varias consultas ISON.
- Un eco que llega después de un cambio de nick puede confirmar el envío original por su identificador/autor y contenido, sin atribuirlo al usuario equivocado por el simple texto.
- Las confirmaciones de transporte pasan fuera de la cola de acciones de scripts; un script lento no aplaza el final de Pendiente. Si la confirmación llega antes de la copia local, se conserva temporalmente por clientId.
- Un aviso de entrega actualiza únicamente sus campos: no sustituye el texto del mensaje ni su identificador DOM. Invalida la revisión también en ventanas inactivas.
- Tras 15 segundos sin eco termina Pendiente y se indica que no hubo confirmación. Nunca se reenvía automáticamente. Se conserva una ventana acotada de correlación para ecos tardíos y se limita la memoria a 256 envíos pendientes/recientes.

El cambio del nick a Guest lo decide la red. Las pruebas verifican la demora inicial, el límite de recuperación y los ecos tras renombrar; no se han usado credenciales personales para identificar al usuario en un servidor real. Por eso no se afirma que se haya validado la política de identificación concreta de esa red.

## IPVirtual

Se reconoce como servicio IRC, también con destino `IPVirtual@servidor`. PV, /msg y /notice omiten formato IRC/ANSI de salida; no añaden nick completion ni sustituciones del diccionario. Se conservan los argumentos y la presentación de las respuestas recibidas. Las pruebas nativas comprueban `help` y `request` sobre el cable con un servidor de prueba.
