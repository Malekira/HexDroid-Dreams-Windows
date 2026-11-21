# PROMPT MAESTRO PARA CODEX
# HEXDROID DREAMS — WINDOWS

## 1. OBJETIVO GENERAL

Quiero desarrollar y perfeccionar **HexDroid Dreams para Windows**, un cliente IRC de escritorio moderno, completo, personalizable y con funcionalidades avanzadas, tomando como referencia las características existentes en HexDroid para Android y adaptándolas correctamente a Windows.

El proyecto debe mantener las capacidades de un cliente IRC avanzado, con una interfaz moderna, cómoda, intuitiva y discreta, especialmente para usuarios habituados a programas como mIRC.

**Repositorio principal de Windows:**
https://github.com/Malekira/HexDroid-Dreams-Windows

**Repositorio Android de referencia:**
https://github.com/Malekira/HexDroid-Dreams-Android

El repositorio Android es una referencia funcional, no un proyecto que deba ejecutarse mediante emulación.

No quiero una aplicación Android ejecutándose en Windows, ni una interfaz web genérica presentada como aplicación de escritorio.

Quiero una aplicación diseñada específicamente para Windows 10 y 11, con soporte para Windows x64 y una distribución apropiada para pantallas de escritorio.

Antes de comenzar, inspeccioná el repositorio Windows, identificá la tecnología existente, la arquitectura, el estado de desarrollo, las funciones ya implementadas y los componentes reutilizables.

No reemplaces trabajo existente ni elimines funcionalidades útiles.

Si una característica ya está implementada, verificá su funcionamiento antes de modificarla.

---

## 2. DISEÑO DE LA INTERFAZ PRINCIPAL

Esta sección es prioritaria.

Quiero que la interfaz se organice mediante **paneles ajustables y persistentes**, con una distribución especialmente pensada para un cliente IRC de escritorio.

### Distribución general

La ventana principal tendrá:

**A. Panel izquierdo — Conversaciones privadas**

- Mostrar las conversaciones privadas abiertas.
- Cada conversación debe identificar claramente al usuario.
- Mostrar cantidad de mensajes sin leer.
- Destacar conversaciones con mensajes nuevos.
- Diferenciar mensajes normales de menciones importantes.
- Permitir cerrar una conversación sin desconectar del servidor.
- Permitir silenciar conversaciones individualmente.
- Incluir búsqueda de conversaciones.
- Menú contextual discreto mediante clic derecho.
- Posibilidad de ordenar conversaciones.
- Ajustar el ancho del panel arrastrando su borde.
- Poder ocultarlo o contraerlo.
- Conservar su tamaño al reiniciar la aplicación.

Las conversaciones privadas NO deben mezclarse con las pestañas de canales.

**B. Zona superior central — Pestañas de canales**

Los canales IRC deben mostrarse como pestañas horizontales sobre el área principal de chat.

Características:

- Una pestaña por canal abierto.
- Nombre del canal visible.
- Indicador de actividad.
- Contador de mensajes sin leer.
- Destacado especial ante menciones.
- Cerrar canal desde su pestaña.
- Cambiar rápidamente entre canales.
- Reordenar pestañas arrastrándolas.
- Desplazamiento horizontal cuando hay muchos canales.
- Menú contextual con las acciones del canal.
- Recordar el orden de las pestañas.
- Diferenciar visualmente el canal activo.
- Mostrar el topic y los modos del canal de forma discreta.

Si hay varias redes IRC conectadas, agregar un selector de red compacto, sin sobrecargar la interfaz.

La lista de canales de cada red deberá mantenerse independiente.

**C. Panel central — Chat activo**

Debe ocupar la mayor superficie disponible.

Funciones:

- Mostrar mensajes del canal o conversación seleccionada.
- Renderizar colores y formatos IRC.
- Mostrar marcas de hora configurables.
- Mostrar nicks con colores configurables.
- Reconocer mensajes de acción `/me`.
- Mostrar respuestas y reacciones cuando estén disponibles.
- Permitir copiar mensajes individuales o múltiples.
- Acceso al historial.
- Búsqueda de mensajes.
- Indicadores de mensajes nuevos.
- Desplazamiento fluido.
- Mantener la posición de lectura.
- Ir al último mensaje.
- Ir al primer mensaje sin leer.
- Mostrar contenido multimedia compatible sin alterar la legibilidad.
- Permitir ajustar tamaño, fuente, separación y colores.

El cuadro de escritura debe permanecer siempre en la parte inferior.

Deberá conservar los borradores individuales de cada conversación.

**D. Panel derecho — Lista de usuarios**

- Mostrar los usuarios del canal activo.
- Distinguir rangos mediante símbolos o indicadores discretos.
- Separar u ordenar por rango cuando corresponda.
- Mostrar estados away.
- Mostrar avatares cuando el servidor los proporcione.
- Buscar usuarios.
- Abrir conversación privada con doble clic.
- Acceder a WHOIS.
- Ejecutar acciones de moderación desde el menú contextual.
- Permitir ajustar el ancho arrastrando el divisor.
- Posibilidad de contraer u ocultar el panel.
- Recordar su ancho y visibilidad.

**E. Esquina superior derecha — Configuración**

El botón de configuración debe estar siempre ubicado **arriba a la derecha**.

Utilizar un icono de engranaje discreto.

Al pulsarlo, abrir la configuración general organizada por categorías:

- Apariencia.
- Chat y mensajes.
- Redes y conexiones.
- IRC.
- Notificaciones.
- Privacidad.
- Seguridad y cifrado.
- Transferencias.
- Historial y registros.
- Scripts y automatizaciones.
- Alias y comandos.
- Copias de seguridad.
- Información de la aplicación.

Agregar búsqueda de opciones dentro de la configuración.

No colocar botones de configuración grandes dentro del área de conversación.

### Boceto conceptual de distribución

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ HexDroid Dreams       [Red activa ▼]                            [⚙] [—][□][X]│
├──────────────────┬───────────────────────────────────────────┬───────────────┤
│ CONVERSACIONES   │ #dreams  │ #general │ #juegos │ +         │   USUARIOS    │
│ PRIVADAS         ├───────────────────────────────────────────┤               │
│                  │ Topic del canal                         │ @Operadores   │
│ ● Usuario1       ├───────────────────────────────────────────┤               │
│   Usuario2       │                                           │ +Usuarios     │
│ ● Usuario3 (2)   │                                           │               │
│                  │             ÁREA DEL CHAT                 │ Usuarios      │
│                  │                                           │ conectados    │
│                  │                                           │               │
│                  │                                           │               │
│                  ├───────────────────────────────────────────┤               │
│                  │ Escribir mensaje...            [Enviar]  │               │
├──────────────────┴───────────────────────────────────────────┴───────────────┤
│ ● Conectado    | Servidor: irc.example.net | Usuarios: 42 | Lag: 35 ms      │
└──────────────────────────────────────────────────────────────────────────────┘
```

El boceto representa la jerarquía deseada, no las medidas exactas.

### Requisitos de redimensionamiento

Todos los paneles deben:

- Ajustarse mediante divisores arrastrables.
- Tener tamaños mínimos razonables.
- Permitir maximizar la ventana sin perder la distribución.
- Adaptarse al cambio de resolución.
- Recordar el tamaño de paneles y ventana.
- Respetar el escalado DPI de Windows.
- Permitir ocultar y restaurar los paneles laterales.

**No usar proporciones fijas que impidan personalizar la distribución.**

### Menús discretos

Quiero menús contextuales modernos, compactos y funcionales.

- Clic derecho sobre usuarios.
- Clic derecho sobre canales.
- Clic derecho sobre conversaciones.
- Clic derecho sobre mensajes.
- Menús de tres puntos cuando corresponda.
- Barras de herramientas pequeñas.
- Iconos sencillos.
- Sin grandes botones decorativos.
- Sin menús que ocupen demasiado espacio.

Priorizar una interfaz elegante y práctica, sin exceso de elementos visuales.

---

## 3. CONEXIÓN A SERVIDORES IRC

Implementar o conservar:

- Conexiones simultáneas a múltiples redes IRC.
- Perfiles independientes por servidor.
- Servidor y puerto configurables.
- TLS/SSL.
- Nick principal y alternativo.
- Usuario y nombre real.
- Contraseña del servidor.
- Conexión automática.
- Reconexión automática.
- Intervalo de reconexión configurable.
- Recuperación del nick principal.
- Autojoin de canales.
- Claves de canales.
- Ejecución de comandos tras conectar.
- Retrasos configurables entre comandos.
- Reconexión y recuperación de canales después de un corte.
- Perfiles favoritos.
- Reordenamiento de perfiles.
- Codificación configurable por servidor.
- Soporte IPv4 e IPv6.
- Uso de proxies SOCKS y Tor.
- Compatibilidad con ZNC, soju y bouncers genéricos.
- Gestión de redes soju cuando el servidor lo permita.

Cada red debe mantener sus propias conversaciones, configuraciones, pestañas, historial y usuarios.

No mezclar información de distintas redes.

---

## 4. AUTENTICACIÓN Y SEGURIDAD

Adaptar a Windows:

- SASL PLAIN.
- SASL SCRAM-SHA-256.
- SASL EXTERNAL.
- Certificados TLS de cliente.
- Importación de certificados compatibles.
- Validación de certificados.
- Fijación de certificados mediante TOFU.
- Strict Transport Security.
- Protección de contraseñas.
- Almacenamiento seguro mediante mecanismos adecuados de Windows, como DPAPI cuando corresponda.
- Gestión de claves de cifrado.
- Cifrado extremo a extremo +AGE.
- AES-256-GCM (+AGM).
- Compatibilidad con Blowfish/FiSH (+OK).
- Cifrado de conversaciones privadas y canales cuando el protocolo lo permita.

Mantener compatibilidad de protocolos con los clientes que implementan estos formatos.

No inventar formatos criptográficos propietarios.

No almacenar contraseñas ni claves en texto plano.

No incluir secretos en logs.

---

## 5. CHAT Y MENSAJERÍA

Implementar:

- Mensajes de canales.
- Mensajes privados.
- Mensajes de acción `/me`.
- Mensajes multilínea.
- Respuestas a mensajes.
- Reacciones con emojis.
- Consulta de quién reaccionó.
- Eliminación de mensajes, cuando el servidor permita hacerlo.
- Indicadores de escritura IRCv3.
- Confirmaciones de lectura compatibles.
- Contadores de mensajes sin leer.
- Mensajes destacados.
- Conservación de borradores por conversación.
- Historial de mensajes escritos.
- Autocompletado de nicks y comandos.
- Acciones mediante teclado.
- Copiar y pegar texto.
- Selección múltiple de mensajes.
- Composición de mensajes con negrita, cursiva, subrayado y colores.
- Vista previa de los formatos IRC antes de enviar.
- Aviso cuando un mensaje no se haya podido entregar.

Agregar navegación cómoda mediante teclado, incluido Ctrl+Tab para cambiar entre pestañas.

---

## 6. APARIENCIA Y PERSONALIZACIÓN

Conservar y adaptar:

- Tema claro.
- Tema oscuro.
- Tema automático según Windows.
- Tema Matrix.
- Posibilidad futura de temas personalizados.
- Colores individuales para los nicks.
- Color personalizable del nick propio.
- Colores IRC/mIRC.
- Colores ANSI.
- Fuentes personalizables.
- Selección de tamaño de letra.
- Altura de línea.
- Separación entre mensajes.
- Marcas de hora configurables.
- Visualización u ocultación del topic.
- Ocultar determinados eventos de canal.
- Modo compacto.
- Renderizado de dibujos ASCII/ANSI.
- Compatibilidad con emojis.
- Soporte de imágenes de perfil.
- Escalado adecuado en monitores de alta resolución.
- Distribución adaptable a distintas resoluciones.
- Posibilidad de trabajar con varios monitores.

Los estilos visuales deben ser consistentes en toda la aplicación.

---

## 7. GESTIÓN DE USUARIOS Y MODERACIÓN

Incorporar herramientas para:

- WHOIS.
- WHO.
- Abrir privado.
- Invitar usuarios.
- Expulsar usuarios.
- Aplicar bans.
- Retirar bans.
- Kick + ban.
- Dar y quitar voz.
- Dar y quitar operador.
- Administrar halfop y otros rangos reconocidos por el servidor.
- Editar topic.
- Administrar modos de canal.
- Consultar listas de bans y excepciones.
- Ban por nick, host, cuenta o dominio cuando esté soportado.
- Silenciar usuarios mediante modos compatibles.
- Lista de usuarios ignorados.
- Lista de usuarios destacados.
- Herramientas de IRCop para usuarios autorizados.

Los menús deben mostrar las acciones de manera contextual.

Las herramientas de IRCop no deben confundirse con los permisos de operador de canal.

La aplicación debe respetar siempre las capacidades y permisos reales del servidor.

---

## 8. NOTIFICACIONES DE WINDOWS

Adaptar las notificaciones Android al escritorio:

- Notificaciones nativas de Windows.
- Avisos por privados.
- Avisos por menciones.
- Palabras destacadas configurables.
- Notificaciones por red.
- Silenciar canales individualmente.
- Silenciar conversaciones privadas.
- Sonidos configurables.
- Avisos de desconexión o problemas de conexión.
- Contador de mensajes nuevos.
- Indicador en el icono de la barra de tareas cuando corresponda.
- Icono en la bandeja del sistema.
- Minimizar a la bandeja del sistema.
- Mantener conexiones activas mientras la aplicación permanezca ejecutándose en segundo plano.
- Abrir la conversación correspondiente al seleccionar una notificación.
- Posibilidad de desactivar avisos cuando la ventana está activa.

Implementar notificaciones push solamente cuando sean compatibles y útiles con bouncers o servidores.

No intentar reproducir las burbujas de Android literalmente.

---

## 9. HISTORIAL Y LOGS

Conservar las funciones de registros adaptadas al sistema de archivos de Windows.

Características:

- Guardado automático de conversaciones.
- Logs individuales por servidor, canal y privado.
- Carpeta configurable.
- Conservación indefinida o por días.
- Eliminación automática según antigüedad.
- Exportación a TXT o ZIP.
- Búsqueda de texto.
- Búsqueda por nick.
- Búsqueda de frases.
- Búsqueda global entre conversaciones.
- Resultados con fecha, servidor, canal y contexto.
- Acceso al mensaje encontrado.
- Recuperación de historial mediante IRCv3 CHATHISTORY.
- Sincronización con bouncers compatibles.
- Logs de protocolo para diagnóstico, opcionales y protegidos.
- Evitar duplicados en la recuperación del historial.

Priorizar búsquedas rápidas incluso con grandes cantidades de mensajes.

---

## 10. MULTIMEDIA

Implementar:

- Vista previa de imágenes.
- Soporte de GIF animados.
- Vista previa de enlaces.
- Reproducción o apertura apropiada de videos.
- Compatibilidad con enlaces de YouTube.
- Compatibilidad con contenidos de X/Twitter cuando sea técnicamente posible.
- Apertura de enlaces mediante navegador.
- Copiado de enlaces.
- Guardado de imágenes.
- Compartir archivos.
- Selección mediante el explorador de Windows.
- Control para activar o desactivar previsualizaciones.

Evitar la descarga automática de contenidos externos cuando afecte a la privacidad.

---

## 11. TRANSFERENCIAS DCC

Implementar:

- DCC SEND.
- DCC CHAT.
- DCC SSEND.
- DCC SCHAT.
- Transferencias con TLS cuando sean compatibles.
- Aceptar o rechazar archivos.
- Selección de archivos para enviar.
- Carpeta de descargas configurable.
- Seguimiento del progreso.
- Velocidad de transferencia.
- Cancelación.
- Reanudación de transferencias interrumpidas.
- IPv4 e IPv6.
- Configuración de puertos.
- Lista de remitentes autorizados para aceptación automática.

Incluir una ventana discreta y completa de transferencias.

La aceptación automática debe estar desactivada por defecto.

---

## 12. SCRIPTS, ALIAS Y AUTOMATIZACIÓN

Esta función es especialmente importante.

Conservar y adaptar el sistema de scripts `.hex` de HexDroid.

Requisitos:

- Cargar scripts externos.
- Activar o desactivar scripts.
- Administrar scripts instalados.
- Crear comandos personalizados.
- Definir alias.
- Reaccionar a eventos IRC.
- Ejecutar condiciones y bucles.
- Utilizar variables.
- Gestionar funciones y colecciones.
- Hacer solicitudes HTTP/JSON bajo permisos controlados.
- Crear interfaces gráficas sencillas desde scripts.
- Mostrar cuadros de diálogo.
- Crear botones y herramientas.
- Interactuar con mensajes y canales.
- Guardar configuraciones de scripts.
- Mostrar errores de ejecución.
- Evitar que un script defectuoso bloquee la aplicación.

Tomar la documentación `docs/hex-scripting.md` del proyecto Android como referencia.

Conservar la sintaxis y compatibilidad con los scripts existentes siempre que sea posible.

No reemplazar el lenguaje `.hex` por scripts incompatibles sin necesidad.

Diseñar el sistema para permitir futuras funcionalidades, como juegos IRC, respuestas automáticas, filtros de mensajes, herramientas administrativas y personalizaciones.

Agregar un administrador de scripts accesible desde Configuración.

---

## 13. COMANDOS IRC

Mantener un conjunto amplio de comandos compatibles con IRC tradicional.

Como mínimo:

`/join`, `/part`, `/cycle`, `/quit`, `/nick`, `/msg`, `/query`, `/notice`, `/me`, `/amsg`, `/ame`, `/away`, `/back`, `/whois`, `/who`, `/list`, `/mode`, `/topic`, `/invite`, `/kick`, `/ban`, `/unban`, `/kickban`, `/op`, `/deop`, `/voice`, `/devoice`, `/ctcp`, `/ping`, `/time`, `/version`, `/motd`, `/admin`, `/info`, `/raw`, `/quote`, `/dns`, `/monitor`, `/markread`, `/metadata`, `/register`, `/verify` y comandos DCC.

Incluir accesos directos para NickServ, ChanServ y otros servicios configurables.

Agregar comandos de IRCop que se encuentren disponibles en el proyecto Android y que tengan sentido en Windows.

Permitir alias propios.

No bloquear comandos desconocidos que deban enviarse al servidor mediante la interfaz adecuada.

---

## 14. FUNCIONALIDADES IRCv3

Mantener compatibilidad con las capacidades anunciadas por cada servidor, incluidas, cuando correspondan:

- CAP negotiation.
- SASL.
- Server Time.
- Message Tags.
- Echo Message.
- Labeled Response.
- Batch.
- Multiline.
- CHATHISTORY.
- Read Markers.
- Typing Indicators.
- Replies.
- Reactions.
- Message Redaction.
- Account Notify.
- Away Notify.
- Extended Join.
- Metadata y avatares.
- Filehost.
- WebPush.
- Network Icons.
- Otras capacidades soportadas por el proyecto.

No mostrar como disponible una función que el servidor no pueda ofrecer.

Degradar el comportamiento de forma segura y comprensible cuando una capacidad no esté disponible.

---

## 15. COPIAS DE SEGURIDAD Y DATOS

Incluir:

- Exportar configuración.
- Importar configuración.
- Exportar perfiles de servidores.
- Conservar organización de paneles.
- Guardar temas y preferencias.
- Guardar alias y ajustes de scripts.
- Importar configuraciones desde archivos JSON.
- Exportar contraseñas únicamente si están cifradas mediante una frase de paso.
- Restaurar configuración sin sobrescribir datos importantes inadvertidamente.
- Confirmar operaciones destructivas.
- Guardar los datos de usuario en las ubicaciones apropiadas de Windows.

No guardar datos temporales o configuraciones personales dentro de la carpeta de instalación cuando corresponda usar AppData.

---

## 16. EXPERIENCIA DE USUARIO EN WINDOWS

Agregar comportamientos propios del escritorio:

- Maximizar, restaurar y minimizar la ventana.
- Recordar la posición y tamaño.
- Icono en bandeja del sistema.
- Cierre configurable: salir o minimizar a bandeja.
- Inicio automático con Windows como opción.
- Soporte de múltiples monitores.
- Atajos de teclado configurables cuando sea viable.
- Clic derecho contextual.
- Arrastrar archivos hacia una conversación para ofrecer su envío, con confirmación.
- Selección mediante explorador de archivos.
- Compatibilidad con copiar y pegar.
- Menús compactos.
- Ventanas de configuración no invasivas.
- Indicadores de conexión y latencia.
- Soporte de escalado DPI.
- Interfaz accesible mediante teclado.

La aplicación debe seguir siendo utilizable con muchos canales y privados abiertos.

---

## 17. IDENTIDAD VISUAL DREAMS

La aplicación se llamará **HexDroid Dreams**.

Personalizar:

- Nombre de la aplicación.
- Título de ventana.
- Iconos.
- Pantalla de inicio, si corresponde.
- Pantalla Acerca de.
- Archivos de instalación y distribución.
- Recursos de marca.

No conservar referencias visuales al proyecto original donde deban estar las de Dreams.

Mantener los avisos de derechos de autor, atribuciones y licencias exigidos por las dependencias y el proyecto original.

No incluir contraseñas ni identidades IRC privadas en el código.

La configuración de servidores deberá ser editable por el usuario.

---

## 18. CALIDAD, RENDIMIENTO Y SEGURIDAD

Exijo que el programa:

- Mantenga la interfaz fluida mientras recibe muchos mensajes.
- No se bloquee por reconexiones.
- No duplique mensajes al recuperar historial.
- Mantenga separadas las redes.
- No pierda conversaciones al cambiar de pestaña.
- No pierda borradores.
- No exponga credenciales.
- No ejecute scripts sin los permisos correspondientes.
- No permita que errores de scripts afecten al núcleo IRC.
- No cierre inesperadamente al recibir eventos del servidor.
- Gestione correctamente las tareas simultáneas.
- Respete las convenciones de seguridad de Windows.
- No incluya publicidad ni telemetría invasiva.

Utilizar una arquitectura modular y mantenible, separando interfaz, conexiones IRC, gestión de conversaciones, historial, cifrado, DCC, scripts y configuración.

---

## 19. METODOLOGÍA OBLIGATORIA PARA CODEX

### Primera etapa — Auditoría

Antes de modificar archivos:

1. Inspeccionar el repositorio Windows.
2. Identificar su arquitectura actual.
3. Revisar las funciones existentes.
4. Comparar con las funcionalidades de Android.
5. Identificar funciones faltantes o incompletas.
6. Revisar dependencias, compilación y pruebas.
7. Preparar un plan ordenado de implementación.

No asumir que una función está implementada solo porque aparece en documentación.

### Segunda etapa — Interfaz principal

Dar máxima prioridad a:

1. Panel izquierdo de conversaciones privadas.
2. Pestañas superiores de canales.
3. Panel central de chat.
4. Panel derecho de usuarios.
5. Divisores ajustables.
6. Persistencia de tamaños y posiciones.
7. Botón de configuración arriba a la derecha.
8. Menús contextuales discretos.
9. Selector de redes.
10. Barra de estado inferior.

Esta distribución debe quedar funcional antes de abordar personalizaciones secundarias.

### Tercera etapa — Funciones IRC

Completar y verificar conexiones, canales, privados, usuarios, autenticación, reconexión, comandos y compatibilidad IRCv3.

### Cuarta etapa — Funciones avanzadas

Implementar progresivamente los demás sistemas:

- Historial y registros.
- Notificaciones.
- DCC.
- Multimedia.
- Cifrado.
- Scripts.
- Copias de seguridad.
- Personalización avanzada.

### Quinta etapa — Pruebas y distribución

- Compilar en modo de desarrollo.
- Ejecutar pruebas automatizadas disponibles.
- Validar conexión y desconexión.
- Validar cambios entre canales.
- Validar múltiples redes simultáneas.
- Validar persistencia de paneles.
- Validar menús contextuales.
- Comprobar reconexión y recuperación de datos.
- Revisar errores de seguridad.
- Generar una distribución Windows x64.
- Documentar instalación y ejecución.

No dar por finalizada una característica que solamente tenga una interfaz visual sin lógica funcional.

---

## 20. CRITERIOS DE ACEPTACIÓN DE LA INTERFAZ

La interfaz principal se considerará terminada cuando pueda:

- Conectarme a un servidor IRC real.
- Entrar a varios canales.
- Ver los canales como pestañas arriba del chat.
- Recibir conversaciones privadas en el panel izquierdo.
- Cambiar entre canales y privados sin perder mensajes.
- Mostrar la lista de usuarios en el panel derecho.
- Ajustar ambos paneles laterales con el mouse.
- Ocultar y restaurar los paneles.
- Cerrar y abrir nuevamente el programa conservando la distribución.
- Acceder a Configuración desde el engranaje superior derecho.
- Utilizar menús contextuales discretos con clic derecho.
- Escribir, enviar y recibir mensajes normalmente.
- Mantener una interfaz fluida.

La distribución descrita es un requisito, no una sugerencia opcional.

---

## 21. RESULTADO ESPERADO

Quiero obtener una aplicación Windows real, con un cliente IRC funcional y profesional, no una maqueta.

El resultado debe incluir:

- Código fuente organizado.
- Interfaz completa y ajustable.
- Funciones existentes conservadas.
- Nuevas funciones integradas gradualmente.
- Compilación verificable.
- Pruebas de funcionamiento.
- Documentación actualizada.
- Distribución instalable o ejecutable para Windows x64 cuando la etapa correspondiente esté completa.

No introducir dependencias innecesarias.

No cambiar la tecnología existente sin una justificación técnica clara.

No generar implementaciones simuladas ni afirmar que una función funciona sin haberla probado.

Si una función requiere soporte específico del servidor, indicarlo y manejar correctamente su ausencia.

Si alguna característica requiere mucho trabajo, dividirla en tareas implementables, manteniendo siempre una versión estable.

**COMENZÁ revisando el repositorio real de HexDroid Dreams Windows. Después realizá la auditoría y avanzá con la implementación de la interfaz principal, priorizando exactamente la distribución de paneles, pestañas, conversaciones y configuración descrita.**

No te limites a describir cómo hacerlo: implementá los cambios posibles en el repositorio, compilá, probá y documentá los resultados. No publiques una versión como estable hasta que haya superado las comprobaciones necesarias.