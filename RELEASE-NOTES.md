# HexDreams IRC 0.36.0 — Windows portable

- Salas → Ver bans: salas abiertas u Otra…, con máscaras completas, autor y fecha cuando el servidor los facilita. Incluye bans, excepciones, invitaciones, silencios y consulta AKICK al servicio configurable. Se pueden solicitar retiradas desde la ventana o abriéndola desde el perfil; se vuelven a comprobar los permisos actuales.
- Agregar / quitar favoritos directamente desde el listado de salas, sin entrar en ellas.
- WHOIS conserva las respuestas adicionales del servidor y muestra idle, fecha de conexión y duración por separado. El perfil normal reutiliza el último idle recibido, con hora de consulta, sin disparar un WHOIS automático.
- Scripts: opciones en menús mediante `; @menu Menú | Etiqueta | alias argumentos`. Se quitan al desactivar/eliminar el script. Los helpers internos se ocultan en ayuda y sugerencias; se admiten `alias -l` y las marcas `; @internal` / `; @public`. El editor incluye Ayuda de menús.
- Status distingue conexión activa, mensajes ocultos por filtros y falta de actividad. Puede recuperar una vista vacía desde los últimos eventos reales de la sesión, en memoria y sin SQLite. WHOIS/WHO marcado permanece visible aunque se oculten las respuestas numéricas generales.

Las listas y sus permisos dependen del servidor. AKICK no tiene un formato IRC universal: se conserva la respuesta original; la retirada desde filas requiere reconocer la máscara/índice. No se inventan autores, hosts ni fechas ausentes. La captura de Status con filtros activados no permite atribuir su vaciado a una causa concreta: se corrigen los fallos reproducibles de presentación y se añade recuperación de eventos.

Extrae todo el ZIP con HexDreams cerrado. No requiere instalación.
