# Uso de las herramientas avanzadas

## Redes y autenticación

Añade la red con el formulario habitual y selecciónala. En el engranaje, **Red y autenticación** permite ajustar usuario/nombre real, mecanismo SASL, codificación, apodo alternativo y recuperación, reconexión, comandos y proxy SOCKS. Tor puede utilizarse mediante el SOCKS local de tu instalación.

Guarda los cambios de perfil antes de conectar con las credenciales nuevas. Los campos de contraseña vacíos conservan la credencial existente. **Guardar credenciales** utiliza el almacén seguro de Windows; sin marcarlo solo se mantienen en memoria. Las claves de canales y los comandos con credenciales se introducen en los campos protegidos, nunca en los comandos públicos del perfil. Para EXTERNAL importa un PFX/P12 con su frase de paso. Los PEM/CRT se importan como CA de confianza. Una CA importada no omite la comprobación del nombre del servidor.

TOFU fija el primer certificado que ya haya superado la validación TLS. Un certificado autofirmado se importa y verifica antes de utilizarse; no existe un modo de conexión con validación desactivada. STS anunciado por una conexión TLS se conserva y exige TLS en conexiones posteriores hasta expirar.

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

Las vistas previas son manuales, con confirmación del dominio y sin SVG/HTML ejecutable. Puedes guardar la imagen cargada o abrir enlaces en el navegador. Videos, YouTube y X se abren externamente. Filehost aparece solo si la red lo anuncia y la conexión IRC utiliza TLS. Solo se comparten credenciales con el mismo hostname de la red, tras confirmación; nunca se comparte la contraseña SCRAM/EXTERNAL como contraseña SASL PLAIN.

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

La importación muestra cuántas redes contiene, requiere confirmación y reemplaza redes/preferencias. Cierra conexiones antes de restaurar. Los scripts importados quedan desactivados y sin permisos. El historial y los archivos DCC no forman parte del respaldo de configuración.

## Windows

Minimizar/cerrar a bandeja mantiene conexiones mientras el proceso continúa abierto. **Salir** termina realmente el programa. No hay recepción WebPush al cerrar el proceso. El binario sin firma puede seguir sujeto al bloqueo ASR de reputación; compilar y empaquetar no elimina esa política.
