# HexDroid Dreams para Windows

Cliente IRC de escritorio creado desde cero. Primera versión funcional: **0.1.0**.

Este repositorio contiene exclusivamente el proyecto Windows activo. El proyecto Android está en [Malekira/HexDroid-Dreams-Android](https://github.com/Malekira/HexDroid-Dreams-Android).

**[Descargar la versión Windows](https://github.com/Malekira/HexDroid-Dreams-Windows/releases/tag/dreams-windows-v0.1.0)**

## Abrir en Windows

1. Extrae **todo** `HexDroid-Dreams-0.1.0-Windows-x64.zip` en una carpeta normal.
2. Abre `HexDroidDreams.exe` dentro de la carpeta extraída. No necesita MSI ni instalar Node.js.
3. Añade una red: servidor, puerto, TLS, apodo y, opcionalmente, salas de inicio.
4. Pulsa **Guardar y conectar**. Usa el botón **+** de la conversación para entrar en más salas.

Necesita Windows 10/11 de 64 bits. La distribución de prueba no está firmada digitalmente; Windows puede mostrar la advertencia de editor desconocido. El código fuente y sus dependencias fijadas se entregan para revisión. No desactives las protecciones de Windows.

Si no aparece la ventana, ejecuta `Iniciar-con-diagnostico.cmd`. La configuración y `startup.log` se guardan en `%APPDATA%\HexDroidDreams-Desktop`. El lanzador añade `launcher.log` allí. También puedes abrir esa carpeta desde **Archivo → Abrir carpeta de diagnóstico**. No hace falta eliminar tus datos ni reinstalar para obtener el registro. Esta carpeta es independiente del nombre del ejecutable y de las versiones anteriores.

## Disposición

- Salas y privados en pestañas encima de la conversación.
- Conversaciones a la izquierda; arrastra su borde derecho para ajustar el ancho.
- Usuarios a la derecha; botón de usuarios o **Ctrl+U** para ocultarlos.
- Menús discretos en la parte superior.
- Configuración en la esquina superior derecha, con redes, apariencia, conversaciones y diagnóstico.

## Funciones de esta versión

Conexiones IRC TCP o TLS con validación de certificados, varias redes simultáneas, salas, usuarios, mensajes privados, temas de sala, avisos de entrada/salida, cambios de apodo, contadores de mensajes no leídos y comandos básicos. Ajustes de texto, mensajes compactos, horas, seguimiento de nuevos mensajes y disposición persistente.

Comandos: `/join #sala`, `/part`, `/nick apodo`, `/me acción`, `/msg apodo mensaje`, `/whois apodo`, `/topic texto`, `/quit`. Escribe `//` para enviar un mensaje que empiece por `/`.

**Límites actuales:** no incluye SASL ni identificación automática con NickServ, DCC, cifrado de extremo a extremo, scripts, notificaciones de escritorio ni historial persistente. La contraseña del formulario es la contraseña del **servidor**, no la de NickServ; solo se conserva para la conexión actual. Los mensajes se mantienen en memoria, hasta 600 por conversación. No hay conexión automática al iniciar ni reconexión automática. Se pueden guardar hasta 30 redes.

## Desarrollar

Usa el checkout existente; no es necesario crear otro worktree. Requiere Node.js 24 o posterior compatible y npm.

```sh
npm ci
npx install-electron --no
npm start
```

Electron descarga su runtime oficial en el primer uso. Se mantienen la verificación TLS y los checksums oficiales. Si tu entorno requiere proxy, Node.js 24 admite `NODE_USE_ENV_PROXY=1` junto a las variables de proxy correspondientes. No guardes credenciales en el proyecto.

```sh
npm test
npm run test:desktop
npm run test:ui
npm run build:win
node scripts/package-artifacts.js
```

`test:ui` utiliza Chromium en `/usr/bin/chromium` por defecto. En Windows configura `CHROMIUM_PATH` con la ruta de un Chrome/Chromium instalado. `test:desktop` usa el Electron real; en Linux añade únicamente para esta prueba las opciones de ejecución sin pantalla del entorno. La aplicación de Windows mantiene su sandbox normal.

El empaquetado genera `dist/HexDroidDreams-win32-x64/HexDroidDreams.exe`; distribuye toda la carpeta, no solo el ejecutable. `package-artifacts.js` añade el lanzador de diagnóstico y crea el ZIP mediante PowerShell en Windows o `zip` en Linux.

## Validación realizada

- 7 pruebas de protocolo IRC, inyección de comandos, límites y guardado de configuración.
- 3 pruebas de interfaz en Chromium, con el puente de escritorio simulado.
- Prueba adicional de Electron real con puente IPC y servidor IRC local: arranque, conexión, mensajes, usuarios, salida y reentrada de sala, segundo arranque con preferencias guardadas, instancia única y recuperación de configuración dañada.
- Empaquetado cruzado para Windows x64 y revisión del contenido del archivo ASAR.

Las pruebas de protocolo, almacenamiento, reapertura e IPC en Electron y la compilación también pasaron en el runner Windows de GitHub Actions. **El resultado puede variar en otros equipos Windows.** No se probó conexión con redes IRC públicas. Las capturas de ejemplo contienen conversaciones simuladas, no mensajes reales.

El código Windows se mantiene en la rama `main` de [Malekira/HexDroid-Dreams-Windows](https://github.com/Malekira/HexDroid-Dreams-Windows). GitHub Actions compila y prueba Windows al actualizar esa rama. Sus versiones y descargas se publican en este mismo repositorio.

La versión 0.1.0 y su etiqueta conservan el commit y el ZIP originales de antes de la separación. La rama `legacy/windows-prototype` conserva el prototipo Windows anterior como referencia histórica.
