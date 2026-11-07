# Uso de las herramientas avanzadas

## Redes y autenticación

Añade la red con el formulario habitual y selecciónala. En el engranaje, **Red y autenticación** permite ajustar usuario/nombre real, mecanismo SASL, codificación, apodo alternativo y recuperación, reconexión, comandos y proxy SOCKS. Tor puede utilizarse mediante el SOCKS local de tu instalación.

Guarda los cambios de perfil antes de conectar con las credenciales nuevas. Los campos de contraseña vacíos conservan la credencial existente. **Guardar credenciales** utiliza el almacén seguro de Windows; sin marcarlo solo se mantienen en memoria. Las claves de canales y los comandos con credenciales se introducen en los campos protegidos, nunca en los comandos públicos del perfil. Para EXTERNAL importa un PFX/P12 con su frase de paso. Los PEM/CRT se importan como CA de confianza. Una CA importada no omite la comprobación del nombre del servidor.

TOFU fija el primer certificado que ya haya superado la validación TLS. Un certificado no validado o distinto del aprobado abre un aviso con huella SHA-256 y detalles. La aprobación explícita se guarda por red, servidor y puerto; si cambia la huella, se vuelve a solicitar. No se envían comandos ni credenciales IRC antes de validar PKI o comprobar la huella aprobada. Los certificados de cliente mantienen la validación de la cadena TLS. STS anunciado por una conexión TLS se conserva y exige TLS en conexiones posteriores hasta expirar.

## Historial

Activa **Guardar historial local** si quieres conservar mensajes. La búsqueda admite texto/frases, apodo, conversación y red. `0` días significa conservación indefinida. Cambiar carpeta abre otra base; no mueve ni elimina la anterior. Las búsquedas muestran hasta 500 resultados. Exportar obtiene hasta 100.000 mensajes/50 MB; para más volumen, filtra por red o texto. ZIP separa las conversaciones en archivos TXT.

Pedir historial al servidor requiere CHATHISTORY negociado. Los msgids y las confirmaciones de echo evitan duplicados identificables. Un servidor que repita texto sin identificadores no permite distinguir una repetición de un mensaje nuevo con el mismo contenido.

Los registros de protocolo son opcionales. Se cifran con el sistema y omiten credenciales, endpoints WebPush, etiquetas y cuerpos PRIVMSG/NOTICE antes de persistirlos. Su vista de diagnóstico no contiene las conversaciones.

## Cifrado

Selecciona la conversación antes de abrir **Cifrado**. AGM usa una clave de 32 bytes en Base64; FiSH admite claves de 4 a 56 bytes. Si dejas el campo vacío se genera una clave aleatoria. Copiar la clave requiere confirmación y expone ese valor al portapapeles: compártelo por otro medio seguro.

AGE crea una identidad protegida, anuncia su clave pública y negocia sesiones privadas o claves de canal. Verifica las huellas fuera de IRC. Una identidad cambiada requiere confirmación explícita. El texto queda pendiente si el destinatario aún no ha establecido AGE; no se envía en claro como alternativa. Desactivar AGE cancela su cola pendiente para ese destino. Cambiar de clave requiere coordinación con los demás participantes.

AGM y FiSH tienen vectores independientes generados por Java JCE. AGE dispone de pruebas de firmas, ratchet, grupos, invitaciones, fragmentación, manipulación y repeticiones, pero sigue pendiente una sesión cruzada Windows–Android y revisión criptográfica independiente. El puente `age.*` de juegos Android permanece fuera del intérprete Windows; sus comandos se rechazan expresamente.

## DCC y multimedia

Selecciona un privado para enviar un archivo o iniciar CHAT. Configura la IP anunciada y los puertos si tu router requiere redirección. Las ofertas recibidas aparecen en **Transferencias DCC**: acepta, elige destino, rechaza, cancela o reanuda. Los archivos parciales se conservan para reanudar. El envío se confirma mediante ACK del receptor.

SSEND/SCHAT requieren intercambiar y verificar previamente el certificado público exportado por el emisor. Si cambias de IP anunciada o certificado, vuelve a intercambiarlo. DCC directo está bloqueado al usar proxy, salvo autorización expresa en sus ajustes. La aceptación automática está desactivada; si la habilitas, limita la lista a personas de confianza y recuerda que un apodo puede ser suplantado.

Las fotos priorizan METADATA. Si el usuario no ha anunciado un avatar, se utiliza la ruta codificada en el GECOS del chat web y, como última alternativa, la plantilla HTTPS configurada (`https://chat-avatars.chateagratis.net/avatar/Chat/{Nick}.png` por defecto). Una retirada explícita de METADATA se respeta. Se sincronizan avatares al entrar y al activar multimedia, y se ignoran descargas que hayan quedado obsoletas por una actualización. La carga automática se limita al servidor oficial o al dominio configurado; otros dominios HTTPS requieren confirmación al ampliar. Puedes desactivarlas en Multimedia. Los perfiles muestran una foto ampliable y permiten guardarla. Las vistas previas de enlaces en mensajes son manuales, con confirmación del dominio y sin SVG/HTML ejecutable. Puedes guardar la imagen cargada o abrir enlaces en el navegador. Videos, YouTube y X se abren externamente. Filehost aparece solo si la red lo anuncia y la conexión IRC utiliza TLS. Solo se comparten credenciales con el mismo hostname de la red, tras confirmación; nunca se comparte la contraseña SCRAM/EXTERNAL como contraseña SASL PLAIN.

## Scripts .hex

Importa el archivo y revisa sus permisos y dominios antes de habilitarlo. Un script no recibe acceso general a Node, al disco ni al DOM. Tiene un worker separado, memoria y ejecución limitadas. Los errores aparecen en el administrador; un bloqueo termina el motor sin terminar IRC.

- `read`: recibir eventos de mensajes/servidor.
- `intercept`: modificar o suprimir entrada/salida local.
- `send` / `raw`: emitir comandos IRC; los destinos cifrados conservan su protección.
- `http`: solicitudes HTTPS solo a los dominios exactos autorizados.
- `ui`: vistas, botones, lanzadores y solicitudes de selección de archivos.
- `persist`: configuración protegida del script.
- `crypto`: reservado para futuras extensiones del puente de juegos; no habilita comandos inexistentes.

Un alias o señal de otro script no presta sus permisos: las acciones deben estar autorizadas para toda la cadena que las origina. Las cargas de archivos requieren un token del archivo elegido por el usuario y una confirmación del destino; no se entregan rutas al script. Los scripts de traducción, filtro WHOIS y subida de imágenes de Android se prueban como referencia de sintaxis.

La extensión Windows `state.set clave valor` y `state.delete clave` guarda preferencias protegidas; `$state(clave)` las consulta. No modifica la sintaxis de las variables o alias Android. Se admite el conjunto cerrado de funciones documentado en el intérprete; las expresiones regulares Java se adaptan en sus clases Unicode comunes, no se ofrece un motor Java completo.

## Respaldos

La configuración sin secretos puede exportarse directamente. Para incluir credenciales, claves e identidades, código de scripts y preferencias protegidas se exige una frase de paso de al menos 12 caracteres; el archivo usa scrypt y AES-256-GCM. Conserva esa frase fuera del archivo.

La importación muestra cuántas redes contiene, requiere confirmación y reemplaza redes/preferencias. Cierra conexiones antes de restaurar. Los scripts importados quedan desactivados y sin permisos. Activa **Incluir historial** para añadir mensajes y consultas al respaldo (hasta 100.000 registros/50 MB de texto). Al restaurar un respaldo con historial, este reemplaza el historial local tras confirmar. Sin esa opción se mantienen los mensajes locales existentes. Los archivos DCC no se incluyen.

## Windows

Minimizar/cerrar a bandeja mantiene conexiones mientras el proceso continúa abierto. **Salir** termina realmente el programa. No hay recepción WebPush al cerrar el proceso. El binario sin firma puede seguir sujeto al bloqueo ASR de reputación; compilar y empaquetar no elimina esa política.

## Foto propia, topic y Notify (0.6.2)

En la identidad de cada red, **Publicar mi foto en esta red** anuncia la dirección HTTPS mediante METADATA al conectar y guardar. Dejar la dirección vacía utiliza la plantilla común con el nick actual. Desactivar la opción retira el anuncio. La imagen debe estar alojada previamente; elegir una foto local no la sube. El servidor y el cliente receptor deben admitir metadatos de avatar.

**Topic** oculta o muestra el tema desde la conversación. El separador debajo del encabezado ajusta su altura, incluida la reducción hacia arriba para dejar más espacio al chat. Las flechas arriba/abajo y Home/End ajustan el separador por teclado; doble clic vuelve al tamaño automático.

**Notify** conserva hasta 100 apodos por red y permite consultar su estado, abrir privados o dejar de seguirlos. El perfil ofrece el mismo seguimiento. MONITOR proporciona cambios inmediatos; si no está disponible se consulta ISON cada 30 segundos. La primera respuesta fija el estado inicial sin generar sonidos. Los avisos de cambios, las desconexiones y el sonido se pueden desactivar en el panel Notify; la preferencia general de notificaciones y los usuarios silenciados también se respetan.

## Interfaz compacta y menús

El árbol izquierdo es el acceso a salas y privados; sus botones se conservan durante la actividad de IRC para no interrumpir los clics. Los privados se ordenan alfabéticamente y los contadores distinguen la actividad de la selección. Topic permite ocultar el tema y ajustar su altura; no se reserva espacio si la sala no tiene topic o la conversación es privada.

El cuadro único conserva el tamaño de letra. El icono de estilos a su derecha abre formato, colores y emojis. «Enviar Estoy escribiendo» se configura allí o en Notificaciones y tema, y controla lo que se anuncia al servidor. Al abrir un privado, el panel derecho muestra su perfil.

La campanita junto a Red registra menciones y NOTICE incluso con la conversación activa. Guarda hasta 500 avisos en memoria durante la sesión de la aplicación; abrirla marca los avisos mostrados como leídos. Puede abrir cada conversación o vaciar el registro. Ignorar o silenciar un usuario sigue suprimiendo sus notificaciones.

Comandos, junto a Ver, prepara comandos en el cuadro de texto según conexión y permisos; completa sus argumentos antes de pulsar Enter. El soporte final depende del servidor. Scripts permite importar, administrar, recargar y seleccionar los alias activos.

Los colores de texto se ajustan visualmente cuando no contrastan con el fondo elegido; el código IRC enviado permanece intacto. Las iniciales representan usuarios sin foto. Los metadatos codificados de la web se separan del nombre real del perfil, sin modificar la fuente de fotos.

## HexDreams IRC: perfiles, temas y compatibilidad

WHOIS abre un perfil flotante y deja también sus respuestas en WHOIS/WHO. Notify ofrece WHOIS por usuario; los botones del perfil se ajustan en filas según el ancho. El desplegable de redes incluye Agregar red.

Configuración → Apariencia y Colores del entorno permiten guardar el estilo actual con un nombre, aplicarlo o eliminarlo. El tema Morado y azul marino incluye degradados sin dorado. Los temas contienen solo preferencias visuales; no redes, claves ni historial.

El nombre real se conserva sin el antiguo recorte a 200 caracteres, dentro del límite de una línea IRC. Su contador muestra bytes UTF-8 incluyendo estilos. La red puede imponer un límite menor. Un texto que ya se había guardado recortado debe introducirse de nuevo; cambiar la identidad requiere reconectar para que se anuncie al servidor.

HexDreamsIRC.exe sigue leyendo la carpeta de datos histórica y el certificado personal existente. Los formatos de respaldo y cifrado mantienen compatibilidad con las versiones anteriores y Android.

## Notify, eventos de sala y menciones

Notify se ordena alfabéticamente y su + abre el formulario para añadir usuarios. Conexiones, debajo de la raya, contiene el mundo para agregar redes y permite seleccionarlas. La lista Notify sigue siendo independiente por red.

Cuando llega un cambio de nick de alguien seguido, Notify muestra anterior → nuevo, sigue su apodo actual durante esa conexión y guarda los últimos 50 cambios de la sesión en la ventana Notify. Al salir de la red vuelve a vigilar el apodo guardado. Se pueden desactivar los avisos de cambios de nick y su sonido. No se deducen cambios de identidad a partir de desconexiones o de nicks parecidos.

En la sala los cambios de nick aparecen en rojo. Los avisos de posibles clones también son rojos y comparan los hosts visibles que proporciona el servidor, sin averiguar IP ocultas ni asumir que dos usuarios con el mismo host son una sola persona.

Vista de sala permite Misma ventana o Ventana dividida. Los mensajes y eventos mantienen su orden dentro de cada panel; el separador horizontal guarda su proporción, se arrastra con ratón, admite flechas y Home/End y vuelve al 25% con doble clic. En privados y WHOIS/WHO se conserva la vista habitual. Los filtros de búsqueda y de mostrar eventos siguen aplicándose.

Notificaciones y tema y Chat y mensajes incluyen el resaltado de menciones y su color. Desactivarlo conserva los mensajes y las preferencias de sonido independientes. WHOIS solicita el idle al servidor del usuario y muestra explícitamente si no ha sido facilitado.

Si Windows conserva el icono de un acceso fijado anterior, desfija ese acceso y fija el nuevo HexDreamsIRC.exe. Se conserva la carpeta histórica de datos y el certificado personal.
