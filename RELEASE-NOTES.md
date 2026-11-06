# HexDreams IRC 0.9.0 para Windows

El programa pasa a llamarse HexDreams IRC. Incluye el logo elegido, con el exterior transparente, en la aplicación y en sus iconos de Windows.

- Corregida la confirmación de mensajes propios cuando el servidor cambia o elimina códigos de estilo. Se actualiza la copia pendiente, conservando dos envíos iguales intencionales como mensajes separados. El historial antiguo ya duplicado no se elimina automáticamente.
- El nombre real ya no se recorta silenciosamente a 200 caracteres. Se conserva completo si cabe en la línea IRC; si no, aparece un error claro. El editor muestra caracteres visibles y bytes con formato. Los límites propios del servidor siguen aplicándose. Si el texto se había guardado recortado, vuelve a escribirlo completo y reconecta.
- WHOIS abre una ventana flotante con foto, nombre real, idle, ident, host y demás datos, además de conservar las respuestas en WHOIS/WHO. Notify incorpora WHOIS junto a cada usuario.
- Los botones del perfil son compactos, se colocan uno junto a otro y bajan de fila automáticamente según el espacio.
- «Agregar red…» está disponible en el desplegable de redes.
- Se pueden guardar, seleccionar y eliminar hasta 40 temas personalizados con nombre. Incluyen colores del entorno, fondos y estilo de sala, fuente, tamaño y formato de escritura. No contienen redes ni credenciales.
- Nuevo tema «Morado y azul marino», con degradados y sin dorado. Se selecciona en Configuración → Apariencia o Colores del entorno; se conserva tu estilo actual hasta elegirlo.

Extrae toda la carpeta del ZIP y abre HexDreamsIRC.exe. La carpeta de datos y el almacén del certificado personal se mantienen compatibles con las versiones anteriores: no hace falta recrear redes ni certificado. Para firmar este EXE utiliza Sign y Verify apuntando a HexDreamsIRC.exe.
