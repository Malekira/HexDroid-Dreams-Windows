# Auditoría y plan de HexDroid Dreams Windows

## Base inspeccionada

Commit `c33bdbd`, versión 0.1.0. Se revisaron código, manifiesto, lockfile, pruebas y workflow, además del motor IRC de Android, las clases de cifrado, DCC e historial y `docs/hex-scripting.md`.

Windows utiliza Electron 45, Node y JavaScript, sin dependencias de producción externas. `main.js` administra ventanas e IPC; `irc.js` maneja TCP/TLS y eventos; `storage.js` guarda perfiles; el renderer usa DOM con CSP y sin integración Node. Se conserva esta tecnología: permite las funciones de escritorio sin reemplazar el trabajo existente ni emular Android.

Antes de modificar la aplicación pasaron las 7 pruebas de núcleo, 3 pruebas de interfaz y la integración con Electron real y servidor IRC local. La documentación de una función no se consideró prueba de implementación.

| Área | Windows 0.1.0 comprobado | Falta frente a Android / documento maestro |
| --- | --- | --- |
| Interfaz | Salas, privados y servidor mezclados; divisor izquierdo; usuarios ocultables | Separación estricta, segundo divisor, selector de red, orden persistente, borradores, contexto, búsqueda |
| IRC | Varias redes, TCP/TLS verificado, JOIN/PART/NAMES, mensajes, acciones, WHOIS | CAP/SASL, reconexión, proxies, identidades alternativas, comandos extensos, capacidades negociadas |
| Datos | Perfiles y preferencias atómicos; recuperación de JSON dañado | Historial, búsquedas globales, exportación/importación, datos sensibles cifrados |
| Escritorio | Ventana e instancia única; diagnóstico | Geometría persistente y recuperación entre monitores; bandeja y avisos |
| Seguridad | Aislamiento del renderer, CSP, validación de líneas, TLS | DPAPI/almacén seguro, SASL, certificados cliente, TOFU/STS y cifrado compatible |
| Avanzadas | No implementadas | DCC, multimedia controlada, `.hex`, alias, notificaciones y respaldos |

## Entrega 0.2.0: etapa de interfaz principal

1. Separar privados (izquierda) y canales (pestañas), con redes aisladas y selector compacto.
2. Incorporar modelo de conversaciones comprobable: borradores y posición de lectura por conversación, actividad, menciones, silencios y orden persistente.
3. Ajustar y ocultar ambos paneles; restaurar dimensiones, pestañas y geometría de ventana sin dejar ventanas fuera de pantalla.
4. Implementar menús contextuales con acciones reales, búsqueda de usuarios y mensajes, doble clic para privado y navegación por teclado.
5. Renderizar formato IRC/ANSI mediante nodos de texto seguros; controles de fuente y espaciado. No cargar contenido remoto automáticamente.
6. Probar núcleo, UI y Electron real, compilar Windows x64 y publicar únicamente como versión de prueba.

## Plan original de las etapas 3 y 4 (formulado para 0.2.0)

Etapa IRC: extraer negociación CAP/SASL, reconexión con cancelación y recuperación de canales, credenciales protegidas por el sistema, SOCKS/Tor, bouncers y registro de capacidades. Cada función debe probarse con servidores que la anuncien y con servidores que no la anuncien.

Etapas avanzadas: historial indexado y CHATHISTORY sin duplicados; notificaciones/bandeja; DCC con confirmación y límites; multimedia bajo consentimiento; cifrado interoperable según las especificaciones Android; intérprete `.hex` compatible y aislado con presupuesto de ejecución; copias de seguridad con importación revisable. No se sustituirá `.hex` por JavaScript ejecutado mediante `eval`.

Las reacciones, respuestas, escritura, avatares y funciones de moderación dependen del protocolo y permisos efectivos. No se mostrarán como disponibles por mera apariencia. Esta entrega no afirma paridad con Android.

Los borradores y mensajes permanecen en memoria. Se persisten disposición, orden, conversaciones abiertas y silencios, sin guardar textos o contraseñas. El historial persistente requiere su propia etapa y controles de privacidad.

## Evidencia de la entrega

Se añadieron pruebas del modelo de conversaciones, migración de configuración, formato, comandos y restauración entre monitores. La regresión contiene 20 pruebas de núcleo, 9 flujos de interfaz y el smoke de Electron real ampliado para privados separados, borradores, WHOIS, modos, líneas múltiples y ambos paneles. El indicador TLS utiliza los datos de la conexión efectiva; editar un perfil no puede cambiar retrospectivamente su estado de seguridad.

La distribución es una candidata de interfaz, no una certificación de los 21 apartados del plan. Faltan validación en una red IRC pública y revisión visual del usuario en Windows. Ese era el alcance de 0.2.0; el avance de 0.3.0 se recoge a continuación.

## Entrega 0.3.0: etapas IRC y sistemas avanzados

La base 0.2.0 se mantiene y el motor añade servicios separados para sesiones, autenticación, almacén seguro, historial, transferencias, web, scripts y cifrado. El renderer conserva aislamiento Node/CSP y recibe únicamente operaciones IPC explícitas. El adaptador de criptografía bloquea envíos directos que evadan una conversación protegida.

| Sistema de etapa 3/4 | Implementación y verificación |
| --- | --- |
| Autenticación | PLAIN/SCRAM/EXTERNAL con TLS real; EXTERNAL exige certificado cliente. SCRAM comprueba prueba del servidor. DPAPI se verifica dentro de Electron en Windows. |
| Sesiones | Reconexión exponencial cancelable, recuperación de canales, comandos espaciados, claves, nick alternativo/recuperación, SOCKS, STS y TOFU del primer certificado válido. |
| IRCv3 | CAP ACK, tiempo, echo y deduplicación, lotes/multilínea, etiquetas, historial, typing, replies/reactions/redaction/read markers condicionados a capacidades. ISUPPORT detecta filehost e iconos; metadata permite solicitar avatares. |
| Historial | SQLite con FTS5, separación por red/destino, retención y carpeta, recuperación al abrir, búsqueda global/nick/frase, TXT/ZIP y protocolo cifrado/redactado. |
| Escritorio | Notificaciones, bandeja, segundo plano, palabras destacadas, silencios y temas. El comportamiento visual final del toast depende de Windows y su configuración. |
| DCC | SEND/CHAT/SSEND/SCHAT, conexiones TCP/TLS verificadas, aceptación y destino nativos, ACK, pasivo/reanudación/cancelación. Se transfieren bytes reales en pruebas. |
| Multimedia | Descarga manual y confirmada de imágenes/GIF/títulos, guardado, enlaces externos y filehost. Validación HTTPS, dominios, direcciones privadas, redirecciones y tamaño. |
| Criptografía | AGM/FiSH con vectores Java independientes; AGE con firmas, ratchet transaccional, invitaciones/grupos y fragmentación; secretos protegidos y cambios de identidad explícitos. |
| Scripts | VM .hex sin eval en worker limitado, permisos por acción/cadena, HTTP por dominio, tokens de archivos, alias/eventos, vistas/botones/lanzadores y preferencias protegidas. Referencia de tres scripts Android sin cambiar su sintaxis. |
| Respaldos | Configuración saneada, secretos/scripts opcionales con scrypt/AES-GCM, confirmación antes de reemplazar y scripts restaurados desactivados. |

La integración real abre Electron, conecta un servidor IRC local, importa/habilita un alias .hex por el diálogo de archivos, envía su comando por TCP, guarda/busca/restaura historial SQLite y cambia el tema. En Windows añade DPAPI y un envío AGM, además de comprobar que un raw no puede filtrar texto claro. El workflow repite el recorrido con el ejecutable empaquetado antes de producir el ZIP.

No se declara paridad total con los 21 apartados Android: faltan auditoría criptográfica y una sesión AGE cruzada con Android. El puente de juegos `age.*` no se presenta como disponible. WebPush no se registra sin receptor externo; el programa mantiene conexiones en bandeja mientras está ejecutándose. La aceptación final en servidores públicos y en el equipo del usuario corresponde a la validación de distribución. Véanse [uso y límites](ADVANCED.md).
