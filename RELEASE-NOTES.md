# HexDreams IRC 0.10.1 para Windows

- Corregida la alineación del logo interno para que no sobresalga de la barra.
- El icono de la ventana y de la barra de tareas utiliza explícitamente el logo, con identidad propia de Windows. Si tenías fijado un acceso anterior, desfíjalo y vuelve a fijar HexDreamsIRC.exe de esta carpeta.
- Notify ordenado alfabéticamente. Su botón + añade usuarios. Debajo hay una raya y una sección Conexiones, con el mundo para agregar redes y una lista compacta para seleccionarlas.
- Resaltado de mensajes que mencionen tu nick, activable y con selector de color en Notificaciones y tema o Chat y mensajes. El color se conserva al reiniciar.
- WHOIS se dirige al servidor del usuario para obtener su idle. El perfil muestra Inactividad (idle); si la red no lo proporciona, lo indica en lugar de inventar un tiempo.
- Notify avisa «nick anterior → nick nuevo» y conserva los cambios recientes en su ventana. Sigue el apodo nuevo durante la conexión; al desconectarse vuelve a vigilar el apodo guardado. Solo puede informar cambios que la red comunique al cliente.
- Si el apodo nuevo también está guardado en Notify, ambos seguimientos se actualizan y la lista de conectados lo muestra una sola vez.
- Cambios de nick en rojo en las salas compartidas.
- Posibles clones en rojo, detectados por el mismo host visible dentro de la sala. Compartir host puede corresponder a usuarios distintos de una misma conexión; el aviso no confirma identidad.
- Selector Vista de sala: Misma ventana o Ventana dividida. La segunda separa mensajes de usuarios y eventos de sala en dos paneles de la misma ventana. El separador se arrastra, admite flechas y Home/End y guarda su posición. Doble clic restaura la proporción inicial. Cada panel tiene desplazamiento independiente; volver a unificar conserva los mensajes y eventos disponibles.

Extrae todo el ZIP y abre HexDreamsIRC.exe. Se mantienen redes, temas, preferencias, historial y certificado personal. Firma el nuevo EXE con Sign y comprueba con Verify usando tu certificado existente.
