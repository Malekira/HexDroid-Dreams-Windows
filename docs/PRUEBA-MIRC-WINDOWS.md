# HexDreams IRC 0.40.0-beta.1: prueba portable de compatibilidad mIRC

Extraé **todo el ZIP** en una carpeta. Ejecutá `HexDreamsIRC.exe`; no requiere
instalación. Conservá todas las DLL y la carpeta resources junto al ejecutable.

Para probar con configuración separada, ejecutá `Probar-compatibilidad.cmd`.
Ese acceso crea `Datos-Prueba-Compatibilidad` junto al programa. Si la versión
habitual ya está abierta, cerrala antes para que no se reutilice su instancia.
El ejecutable normal conserva el perfil de las versiones anteriores.

## Cómo probar

1. Conectate a tu red y entrá a una sala de prueba.
2. Abrí Configuración → Scripts y desplegá «Compatibilidad mIRC · alias y JOIN».
3. «Importar alias .mrc/.xcr…» instala y activa un archivo compatible. El botón
   «Analizar addon mIRC…» permite revisar su compatibilidad sin instalarlo.
4. En `Extras/mIRC` se incluyen dos ejemplos:
   - `moderacion-basica.mrc`: `/hdident Nick` muestra el ident ya recibido y
     `/hdvoz Nick` solicita voz en la sala actual. El servidor exige permisos.
   - `avisos-join.mrc`: `/hdseguir` muestra avisos locales cuando entran usuarios
     a esa sala; `/hdseguir off` los desactiva. No envía saludos a la red.
5. Los alias aparecen en las sugerencias del cuadro de escritura. Podés desactivar
   o eliminar cada archivo desde el mismo apartado de Scripts.

También se verificó el archivo original `kaos_ident.mrc` que aportaste: `/tp-ident
Nick motivo` conserva su lógica original de kick y control por ident en JOIN.
**Modera automáticamente por ident**, que puede coincidir entre personas: usalo
solo en una sala de prueba donde tengas permisos. `/tp-ident off` lo desactiva.
Este archivo no se incluye en el ZIP: importá el original que ya tenés.

## Alcance real de esta beta

Ejecuta un subconjunto mSL: alias, variables, condiciones, bucles, identificadores,
acciones básicas y eventos JOIN. No ejecuta todavía paneles/dialog, menús nativos,
temporizadores, RAW/WHOIS, START/LOAD, acceso a archivos ni paquetes completos.
Un archivo con declaraciones u órdenes no soportadas se rechaza entero.
No se certifican los 24 addons del lote ni compatibilidad universal.

Las variables de los addons se conservan solo durante la sesión del motor.
Cambiar la activación, importar/eliminar archivos o cerrar la app las reinicia;
por ejemplo, puede ser necesario volver a escribir `/hdseguir`.

La opción «Ver / quitar bans» del perfil solo se muestra si compartís una sala
con el usuario y tenés allí permisos de moderación.

La publicación automática genera el portable en Windows y exige pruebas de
arranque, interfaz y Electron con IRC local, incluidos el worker y el addon
original desde el ejecutable empaquetado. Esta beta sigue siendo una versión
de prueba: esos controles no certifican todos los addons ni todas las redes.
