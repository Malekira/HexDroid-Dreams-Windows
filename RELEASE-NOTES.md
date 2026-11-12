# HexDreams IRC 0.24.0 para Windows

- Panel de usuarios uniforme con lupa y búsqueda bajo demanda; se conserva el aviso flotante de mensajes nuevos. Estilo y vista dividida pasan al encabezado de las ventanas.
- Privados sin listado lateral ni perfil automático; pulsar un nick abre su perfil. Status tiene nombre propio y entrada en el árbol, con filtros persistentes accesibles desde Chat y Configuración.
- Texto de sala y texto de escritura con colores independientes. Nicks Fuertes/Pastel y negrita independiente, con vista previa. Opciones visuales generales agrupadas en Apariencia.
- Menú Salas después de Comandos, conservando favoritos y acciones. Ventanas incluye Maximizar todo, también para ventanas minimizadas, privados y Status.
- Gestión de temas desde Apariencia: importar/exportar archivos JSON de apariencia, previsualizar, aplicar, restaurar y eliminar temas guardados.
- Formatos visuales de NOTICE y /me desde Chat, con prefijos, colores, vista previa y restauración. ACTION conserva su envío IRC.
- Corrector multicolor con códigos clásicos IRC 00–15, vista previa, Ctrl+K y copia conservando colores; permite editar fragmentos sin unificar el resto.
- Scripts: formularios con campos editables, listas, casillas, radios, selectores y botones; ventanas independientes redimensionables y movibles; transferencia genérica de valores Unicode, selección, clic y doble clic. Nuevas instrucciones delat, tip y view.close. Estado aislado por script en el almacén seguro. Interceptar un privado recibido nuevo lo detiene antes de notificaciones e historiales. No se incorpora un Anti-PV fijo al cliente.
- Tab y Shift+Tab completan también salas en las que se participa y nicks de Notify de la red actual en cualquier posición del mensaje.

Detalles de sintaxis y correspondencia con las 15 anotaciones: docs/CAMBIOS-0.24.0.md.

## Validación

Pruebas automatizadas de lógica, interfaz y Electron con IRC TCP/TLS. El flujo de Windows repite las pruebas y verifica el ejecutable empaquetado, incluidos formularios, persistencia tras reinicio e intercambio de temas, antes de publicar.

Extrae todo el ZIP y abre HexDreamsIRC.exe. El ZIP distribuido no está firmado.
