'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const appDir = path.join(dist, 'HexDroidDreams-win32-x64');
if (!fs.existsSync(path.join(appDir, 'HexDroidDreams.exe'))) throw new Error('Primero ejecuta npm run build:win.');
const launcher = `@echo off
setlocal
set "DREAMS_LOG_DIR=%APPDATA%\\HexDroidDreams-Desktop"
if not exist "%DREAMS_LOG_DIR%" mkdir "%DREAMS_LOG_DIR%"
echo HexDroid Dreams - Inicio con diagnostico
echo El registro se guardara en "%DREAMS_LOG_DIR%\\launcher.log"
pushd "%~dp0"
"%~dp0HexDroidDreams.exe" --enable-logging=file --log-file="%DREAMS_LOG_DIR%\\chromium.log" > "%DREAMS_LOG_DIR%\\launcher.log" 2>&1
set "DREAMS_EXIT=%ERRORLEVEL%"
echo Codigo de salida: %DREAMS_EXIT% >> "%DREAMS_LOG_DIR%\\launcher.log"
popd
echo Si no aparece la ventana, envia launcher.log y startup.log de esa carpeta.
pause
exit /b %DREAMS_EXIT%
`;
fs.writeFileSync(path.join(appDir, 'Iniciar-con-diagnostico.cmd'), launcher.replace(/\n/g, '\r\n'));
fs.copyFileSync(path.join(root, 'README.md'), path.join(appDir, 'LEEME.md'));
const zipPath = path.join(dist, 'HexDroid-Dreams-0.1.0-Windows-x64.zip');
fs.rmSync(zipPath, { force: true });
if (process.platform === 'win32') {
  // Arguments are delivered through the environment, not interpolated into PowerShell code.
  execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Compress-Archive -LiteralPath $env:DREAMS_PACKAGE_SOURCE -DestinationPath $env:DREAMS_PACKAGE_ZIP -Force'], { env: { ...process.env, DREAMS_PACKAGE_SOURCE: appDir, DREAMS_PACKAGE_ZIP: zipPath }, stdio: 'inherit' });
} else execFileSync('zip', ['-qr', zipPath, path.basename(appDir)], { cwd: dist, stdio: 'inherit' });
console.log(zipPath);
