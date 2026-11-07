# HexDreams IRC 0.12.0 para Windows

- Notify conserva solo el botón + de su cabecera. El engranaje general abre Configuración.
- Eventos de sala muestran expulsiones con autor y motivo, cambios de modos (incluidos bans), rechazos de entrada y avisos de sanciones que el servidor comunica. Las Z-lines también aparecen cuando llegan como motivo de desconexión o aviso; no se inventan datos de otros usuarios.
- Historial TXT con cuatro casillas independientes: salas, privados, status de red y WHOIS/WHO. Carpeta seleccionable, conservación en días y límite por archivo en MB; 0 significa sin límite. El límite de tamaño conserva las líneas más recientes; los días eliminan archivos sin actividad. La retención solo afecta a archivos propios del programa.
- Abrir historial abre una ventana independiente, con árbol de logs por red y categoría a la izquierda y contenido legible a la derecha. Búsqueda por palabra en un archivo o en todos, con acceso al resultado. Los archivos grandes se cargan por partes sin cortar emojis.
- Se elimina el bloque de búsqueda de la configuración general. Cambiar la ruta de TXT cambia el destino, sin mover los logs anteriores.
- Clic en un nick de sala abre el panel lateral de foto y acciones, sin abrir privado ni solicitar WHOIS. El botón Hacer WHOIS abre la consulta completa, conservando el resultado en WHOIS/WHO. Las salas de la consulta permiten unirse con un clic.
- WHOIS conserva emojis recibidos correctamente, con fuentes de emoji. Si el servidor envía caracteres incompletos en el nombre real se indica; no es posible recuperar texto que el servidor ya ha cortado.
- Abrir un menú cierra el anterior. Menú Salas para añadir la sala actual a favoritas, unirse y quitar favoritas.
- Agregar nuevo tema abre un editor con vista previa, colores del entorno y chat, fuente, tamaño, estilo y guardado. Se puede elegir colores fuertes o pastel para nicks, adaptados al fondo del chat.
- Nuevo tema PurpleDreamsLight: entorno púrpura y azul, chat blanco y texto oscuro.
- Exportar e importar configuración abre una ventana para seleccionar redes e identidades, apariencia y temas, notificaciones, multimedia, preferencias de historial y otras preferencias. Importar redes actualiza identificadores coincidentes y conserva las demás. El historial de búsqueda y las credenciales cifradas son opcionales; los TXT permanecen en su carpeta.

Extrae todo el ZIP y abre HexDreamsIRC.exe. Se conservan los datos anteriores. Para firmar el nuevo EXE, utiliza Sign y Verify con tu certificado existente.
