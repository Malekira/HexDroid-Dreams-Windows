# Firma personal en tu Windows

No necesitas comprar un certificado ni instalar el SDK de Windows. El script usa Windows PowerShell 5.1 y el almacén de certificados de **tu usuario**. Ejecuta los comandos en tu equipo, sin abrir PowerShell como administrador.

Guarda `sign-personal.ps1` junto al ejecutable extraído y cierra HexDroid Dreams antes de firmarlo. Revisa el script antes de usarlo. Si Windows indica que el script procede de Internet, desbloquea **ese archivo** desde Propiedades → Desbloquear, después de revisarlo. No cambies la política global de ejecución.

Abre una terminal en esa carpeta (clic derecho → Abrir en Terminal). Ejecuta estos comandos, uno por uno; acepta las confirmaciones solamente si la huella corresponde al certificado que acabas de crear:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\sign-personal.ps1 -Action Create
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\sign-personal.ps1 -Action Trust
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\sign-personal.ps1 -Action Sign -FilePath .\HexDroidDreams.exe
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\sign-personal.ps1 -Action Verify -FilePath .\HexDroidDreams.exe
```

`RemoteSigned` se aplica solo a ese proceso de PowerShell; no altera la configuración permanente. Una política impuesta por el sistema puede prevalecer.

La primera vez, `Create` crea una clave privada **no exportable** en `Cert:\CurrentUser\My`. Su huella se guarda en `%LOCALAPPDATA%\HexDroidDreams-Signing\certificate.json`; no es una contraseña ni una clave. Al repetir `Create` se conserva el certificado existente.

`Trust` instala exclusivamente el certificado público en `CurrentUser\Root` y `CurrentUser\TrustedPublisher`. Eso confía en **todos los archivos que firmes con esa clave**, no solo en HexDroid. La clave privada no sale de `My` y no se crea un PFX. No subas ni compartas la clave.

Para cada versión nueva solo repite **Sign** y **Verify**. Firma antes de comprimir o distribuir tu copia. No modifiques después el EXE firmado: su firma dejará de ser válida. Conserva el resto de archivos de la carpeta, que también son necesarios para ejecutar Electron.

El certificado dura tres años. Sin sello de tiempo, la comprobación puede fallar al caducar: firma de nuevo antes de esa fecha. `Sign` permite `-TimestampServer URL` si dispones de un servicio compatible; requiere conexión y que el servicio acepte ese certificado. El script informa si realmente existe un sello de tiempo.

La firma autentica únicamente el EXE, no los archivos `app.asar`, DLL ni toda la carpeta. No convierte tu aplicación en un editor verificado comercial ni garantiza evitar la regla ASR o SmartScreen por reputación. No modifica Defender ni sus exclusiones.

Para retirar la confianza, abre `certmgr.msc`, busca **la huella exacta** mostrada por el script en Entidades de certificación raíz de confianza y Editores de confianza y elimina esas dos copias públicas. Conserva la de Personal si quieres seguir firmando; eliminarla también borra el acceso a la clave privada no exportable. Haz una nueva configuración si cambias de usuario o de equipo.

Desde el código fuente, el orden es:

```powershell
npm run build:win
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\sign-personal.ps1 -Action Sign
node .\scripts\package-artifacts.js
```
