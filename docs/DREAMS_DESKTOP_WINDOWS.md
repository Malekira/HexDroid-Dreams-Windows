# HexDroid Dreams para Windows 11 de 64 bits

Autorización expresa: «Implementá HexDroid Dreams para Windows 11 de 64 bits en una rama nueva».
Rama: `feat/dreams-desktop-windows`, desde Android 1.0.10 (`0196e83`). Sin merges automáticos.

## Plan después de inspeccionar el proyecto

El repositorio usa Kotlin 2.3.10, Gradle 9.4.1 y Compose para Android. El motor `IrcCore` y el intérprete `.hex` son mayormente JVM; sus puntos específicos de Android son el enlace a una interfaz de red, las credenciales/certificados y los mensajes de diagnóstico. Se separan esos puntos mediante adaptadores pequeños, conservando las implementaciones de Android. Los recursos de texto del protocolo se generan desde los recursos existentes.

Se añade una compilación independiente en `desktop`, con Kotlin y Compose Desktop, que no requiere instalar el SDK Android para producir el instalador de Windows. La ventana de escritorio tendrá redes, árboles de salas/privados, mensajes, lista de usuarios, editor, WHOIS, ajustes, scripts e historial reales. Se reutilizan motor IRC, formatos, autenticación, parser de scripts y criptografía portable existentes. Windows tendrá almacenamiento propio y protección DPAPI para secretos; no se incorporan claves al repositorio.

Se preparan importación de respaldos Android JSON/ZIP y scripts .hex, registro TXT sin vencimiento, búsqueda/exportación, perfiles persistentes, temas y formatos, avatares y notificaciones de escritorio. Se documentará expresamente cualquier función específica de Android o protocolo avanzado que no esté soportada por esta primera versión de escritorio.

GitHub Actions en Windows x64 ejecutará pruebas y generará un instalador con Java incluido. La entrega no se presenta como compilada o probada en Windows hasta verificar la ejecución y el artifact reales.

## Versión de escritorio 0.1.0

Aplicación nativa de escritorio con Compose Desktop y Java 21 incluido. No utiliza un emulador Android. El MSI es para Windows x64 y tiene identificador de actualización estable. Es una primera versión de escritorio: las versiones Android y Windows conservan almacenes separados.

### Funciones operativas

- Perfiles de red: crear, editar, duplicar y eliminar; TLS con validación de certificados, SASL PLAIN/SCRAM/EXTERNAL, proxies y bouncers mediante el motor IRC existente. Importación de certificado cliente PKCS#12 cuando corresponda.
- Árboles independientes y plegables de salas y privados por red; mensajes, acciones, lista real de miembros, cambios de nick y avisos de entrada/salida sin inflar los no leídos.
- Comandos IRC, `/j sala`, consultas y WHOIS agrupado con idle 317 y tiempo conectado cuando el servidor los suministra. WHOIS interno movible, minimizable, recuperable y copiable, con destinos simultáneos configurables. NOTICE respeta su red y no crea PV de servidor.
- Notificaciones del sistema para privados y menciones, opción para la sala visible y apertura del mensaje concreto. Requieren que Windows permita notificaciones del programa.
- Editor con formato IRC persistente, colores de texto/fondo, Tab manual para nicks y selección/ciclo entre coincidencias. Retroceso borra normalmente; flechas de teclado recorren hasta diez mensajes enviados por conversación durante la sesión. Editor de topic con formato y envío TOPIC real, sujeto a permisos del servidor.
- Temas claro/oscuro y temas personalizados con nombre, vista previa, colores hexadecimales/selector, duplicación y eliminación. Los colores IRC del remitente se conservan.
- Historial TXT UTF-8 permanente, sin vencimiento ni límite artificial de líneas; índice SQLite y detección persistente de mensajes repetidos. Búsqueda por palabras/nick/fecha, exportación TXT/ZIP, restauración que agrega y conserva lo existente, eliminación explícita con confirmación. Copias organizadas por día/conversación o combinadas y carpeta elegible. Las 1.500 líneas de memoria y las páginas de búsqueda solo limitan la presentación.
- Importación de respaldo Android JSON o ZIP compatible. La exportación permite incluir historial y cifrar credenciales con frase de paso usando el formato criptográfico existente. Se conservan opciones importadas desconocidas sin fingir que la interfaz de escritorio las implementa.
- Motor `.hex` real: importar, habilitar, editar, recargar y eliminar scripts; comandos, eventos, miembros, temporizadores y paneles básicos con acciones. Los scripts se importan desactivados y las solicitudes HTTPS requieren habilitación explícita. No hay saludos integrados nuevos.
- Avatares por URL de perfil/metadatos y resolución ChatZona existente; caché, carga acotada y ampliación. Con un proxy configurado no se descargan avatares externos; los scripts HTTPS también se deshabilitan para evitar conexiones directas inesperadas.
- Cifrado compatible AGM/FiSH del motor compartido, mediante `/setkey` y `/delkey`. Registrar texto descifrado es una opción independiente y permanece desactivada inicialmente.

### Datos y privacidad

Los datos normales viven en `%LOCALAPPDATA%\HexDroidDreamsData`, fuera de la carpeta instalada. `settings.json` guarda perfiles y preferencias; `credentials.dpapi` protege contraseñas, claves de conversación y certificados importados con Windows DPAPI, vinculado al usuario de Windows. Copiar ese archivo a otra cuenta no es un respaldo portable: utilizar exportación cifrada.

`logs` conserva los TXT canónicos por red y conversación; `history.db` es su índice. La carpeta seleccionada para registros organizados recibe una copia adicional: no mueve ni elimina archivos previos. Cambiar opciones, desconectar o desinstalar no ordena borrar historiales. Un borrado manual desde la app requiere confirmación y no borra copias que se hayan exportado a otras carpetas. Los registros son texto legible; no compartirlos sin revisar su contenido. Los comandos de autenticación y patrones conocidos de secretos se excluyen o redactan; evitar escribir secretos en conversaciones.

La importación de Android no comparte automáticamente archivos ni sesiones activas entre dispositivos. Los certificados de Android Keystore y los permisos del teléfono no son transportables. Revisar credenciales/certificados y las salas antes de conectar desde Windows. El programa no ejecuta automáticamente comandos de conexión importados de Android.

### Límites de esta primera versión

No se han portado transferencias DCC, cifrado `+AGE`, funciones multimedia/subida de archivos, las capacidades nativas de Android invocadas por scripts, todos los tipos avanzados de intención y disposición visual de scripts, ni todos los ajustes y pantallas de Android. Los paneles `.hex` básicos sí son interactivos; las capacidades no disponibles se informan. Los temas Matrix/Terminal de Android no se incluyen como presets en este primer escritorio. La gestión de solicitudes de PV continúa mediante scripts; no se añade un sistema automático separado.

Esta implementación reutiliza los avatares existentes: no afirma resolver la incidencia Android de una foto propia que carga en web y no en la app. El MSI no tiene firma comercial Authenticode; no se incluye ninguna clave de firma privada en el repositorio.

## Compilar y verificar

En Windows x64 con JDK 21:

```powershell
./gradlew.bat -p desktop test uiTest windowsTest --no-daemon
python tools/verify_desktop_reports.py
./gradlew.bat -p desktop packageMsi --no-daemon
```

El empaquetado requiere WiX 3.14; GitHub Actions lo prepara. El usuario que instala el MSI no necesita JDK, Gradle, Python, WiX ni Android Studio. La compilación de escritorio es independiente y no configura el SDK Android.

Para desarrollo Linux, las pruebas unitarias usan `test`; las pruebas gráficas `uiTest` requieren un display real o Xvfb. `windowsTest` exige Windows y prueba DPAPI; no se presenta como ejecutada en Linux.

El workflow `.github/workflows/dreams-windows.yml` ejecuta pruebas JVM, gráficas y DPAPI en Windows Server 2025 x64, genera el MSI, lo instala, ejecuta el programa instalado y lo desinstala. La prueba del runtime instalado valida perfiles, DPAPI, SQLite/TXT y conexión TLS/IRC real contra un servidor efímero local. El certificado de esa prueba se genera en el runner y no se distribuye. Un segundo job compila Android y ejecuta sus pruebas unitarias. Los resultados se comprueban desde XML: no se aceptan suites omitidas ni tests fallidos.

## Comprobaciones manuales en Windows 11

1. Instalar y abrir desde Inicio sin Java instalado; revisar escalado de pantalla y ventanas.
2. Importar una copia Android, revisar red/credenciales y conectar. Comprobar salas/PV, reconexión y desconexión.
3. Enviar mensajes con acentos, emojis y formato; Tab con varios nicks; edición de topic con permisos.
4. WHOIS sobre una sala: mover, minimizar, restaurar y cerrar; verificar destinos múltiples y datos reales de idle.
5. Conceder notificaciones de Windows, probar mención visible y en segundo plano y abrir el mensaje pulsando el aviso.
6. Cerrar/reabrir: verificar temas, formato, perfiles, secretos e historial; exportar/restaurar una copia de prueba.
7. Importar los scripts propios y revisar permisos/acciones que usan; comprobar avatares y ampliación.

## Estado de entrega

Validación en curso. Los enlaces y resultados definitivos se añaden después de verificar el artifact real de GitHub Actions. No se ha fusionado ninguna rama.
