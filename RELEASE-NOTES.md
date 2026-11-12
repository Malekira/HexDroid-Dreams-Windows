# HexDreams IRC 0.25.0 para Windows

- Correcciones de confirmación: Pendiente termina aunque un script esté ocupado, se conserva el texto original y se reconocen ecos después de cambios de nick. No hay reenvíos automáticos.
- El primer comando de identificación no espera el intervalo entre comandos. La recuperación del nick limita los intentos repetidos.
- IPVirtual se trata como servicio: sus comandos salen sin colores ni estilos, tanto en PV como con /msg.
- Ctrl+F resalta y recorre coincidencias sin ocultar mensajes ni cambiar borradores; Esc cierra. Se conserva la lupa de usuarios.
- Ventanas activas e inactivas con presentación compartida. Barra de escritura compacta y rectangular, con controles fuera del texto.
- Listado de salas en Salas; Ventanas dentro de Ver, conservando todas sus acciones.
- Apariencia → Chat reúne espaciado, NOTICE y /me en filas compactas con vistas previas y guardado inmediato. El nick de /me utiliza su color normal.
- Navegación breve, Status en su sección propia y Diccionario separado de Nick completion.
- Diccionario con formato por fragmentos y 16 colores IRC clásicos, conservados al guardar y editar. Importar tema mantiene lista, vista previa y persistencia.

Las correcciones de conexión se prueban con servidores simulados y TCP/TLS locales; el paso a Guest en una red concreta todavía requiere comprobar su identificación real. Detalles y correspondencia con el PDF en docs/CAMBIOS-0.25.0.md.

## Validación

Pruebas de lógica, interfaz y Electron con IRC TCP/TLS, confirmaciones, cambios de nick, IPVirtual, diccionario multicolor y búsqueda. El flujo de Windows repite las comprobaciones y verifica el ejecutable empaquetado antes de publicar.

Extrae todo el ZIP y abre HexDreamsIRC.exe. El ZIP distribuido no está firmado.
