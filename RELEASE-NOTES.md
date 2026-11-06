# HexDroid Dreams 0.6.0 — perfiles, salas y edición visual

Extrae toda la carpeta del ZIP y abre HexDroidDreams.exe. Conserva una copia del perfil antes de actualizar. Tus redes, preferencias y certificado de firma personal se mantienen.

- El tema de la sala y los resultados WHOIS interpretan los colores y estilos IRC. El tema admite varios renglones. Los mensajes muestran hora, nick y texto en la misma línea, con fotos redondas y sin deformación.
- Un clic en un usuario abre su perfil dentro del panel derecho: nombre real, ident, host, servidor, salas, cuenta e inactividad cuando el servidor los proporciona. Incluye mencionar, ignorar, silenciar notificaciones y abrir privado. El doble clic sigue abriendo un privado.
- Las fotos se cargan automáticamente desde `https://chat-avatars.chateagratis.net/avatar/Chat/{Nick}.png`, conservando las mayúsculas del nick. La actualización activa este valor una vez; después puedes cambiarlo o desactivarlo en Multimedia. Las miniaturas mantienen la proporción original. Al pulsar la foto del perfil se abre la imagen completa, con opción de guardarla.
- Identidad por red: nick alternativo, nombre real amplio con editor visual de negrita/cursiva/subrayado y colores de texto/fondo, URL de foto, vista previa, ampliación y reintento. Se conserva el guardado por red y la alternativa de foto local.
- Certificados TLS: un certificado no validado o distinto del aprobado abre un aviso con servidor, emisor, vigencia y huella SHA-256. Aceptar guarda la aprobación para ese servidor y puerto; cancelar mantiene la conexión cerrada. Las credenciales IRC se envían después de validar la conexión.
- Respaldos: opción «Incluir historial» para exportar y restaurar mensajes y consultas. Al restaurar un respaldo con historial, se reemplaza el historial local después de confirmar. Los respaldos anteriores siguen siendo compatibles.
- Modo claro: fondos de campos, etiquetas, botones, menús y vistas previas con colores del tema. Se elimina el formulario de URL para vistas previas manuales de Multimedia; las imágenes enlazadas en mensajes siguen teniendo su acción de carga.
- Panel de emojis junto a las herramientas del chat.
- Acceso «Apariencia de sala» junto a Conectar/Desconectar: vista previa, fondo, cuadro de texto, fuente, tamaño, estilo y nicks coloreados.
- «Unirse a sala» muestra la lista de la red con orden por miembros o nombre y búsqueda por nombre parcial/completo. `/j sala` y `/join sala` agregan `#` cuando falta.

Las consultas WHOIS y LIST dependen de los datos y permisos del servidor. Las fotos requieren HTTPS accesible y las descargas directas se mantienen bloqueadas al utilizar proxy IRC.

Para firmar el EXE nuevo, usa Sign y Verify con tu certificado existente; no hace falta recrearlo. El ZIP incluye el script y las instrucciones en docs/FIRMA-PERSONAL.md.
