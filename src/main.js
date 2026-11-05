'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, screen, clipboard } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { IrcClient } = require('./irc');
const { Store } = require('./storage');
const { WindowState } = require('./window-state');
const { executeInput } = require('./commands');
// A fixed, separate profile avoids inheriting data from older Dreams packages.
const requestedProfile = app.commandLine.getSwitchValue('user-data-dir');
const dataDirectory = requestedProfile ? path.resolve(requestedProfile) : path.join(app.getPath('appData'), 'HexDroidDreams-Desktop');
try { fs.mkdirSync(dataDirectory, { recursive: true }); app.setPath('userData', dataDirectory); }
catch (error) { dialog.showErrorBox('HexDroid Dreams', 'No se pudo crear la carpeta de datos: ' + error.message); app.exit(1); }
let window, store, config, logFile;
const clients = new Map();
const startupWarnings = [];
function log(message) {
  try { fs.mkdirSync(app.getPath('userData'), { recursive: true });
    logFile ||= path.join(app.getPath('userData'), 'startup.log');
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1048576) fs.renameSync(logFile, logFile + '.previous');
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`);
  } catch {}
}
function fatal(error) {
  log(error.stack || String(error));
  dialog.showErrorBox('HexDroid Dreams — error', `${error.message || error}\n\nRegistro: ${logFile || app.getPath('userData')}`);
}
process.on('uncaughtException', fatal);
process.on('unhandledRejection', error => fatal(error instanceof Error ? error : new Error(String(error))));
function emit(id, type, data) { if (window && !window.isDestroyed()) window.webContents.send('irc:event', { id, type, ...data }); }
function register(name, handler) {
  ipcMain.handle(name, async (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Solicitud no autorizada.');
    try { return await handler(...args); }
    catch (e) { return { error: e.message }; }
  });
}
function createWindow() {
  const stateStore = new WindowState(dataDirectory);
  const bounds = stateStore.load(screen.getAllDisplays().map(d => d.workArea));
  window = new BrowserWindow({ x:bounds.x, y:bounds.y, width:bounds.width, height:bounds.height, minWidth:760, minHeight:500,
    title: 'HexDroid Dreams', backgroundColor: '#0c1019', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('render-process-gone', (_, details) => { log('Renderer terminado: ' + details.reason); dialog.showErrorBox('HexDroid Dreams', 'La interfaz se cerró inesperadamente. Vuelve a abrir la aplicación. El diagnóstico está en startup.log.'); });
  window.loadFile(path.join(__dirname, 'index.html')).catch(fatal);
  if (bounds.maximized) window.maximize();
  let boundsTimer;
  const saveBounds = () => { if (window && !window.isDestroyed() && !window.isMinimized()) try { stateStore.save(window.getNormalBounds(), window.isMaximized()); } catch (e) { log('No se pudo guardar la ventana: ' + e.message); } };
  for (const event of ['resize','move','maximize','unmaximize']) window.on(event, () => { clearTimeout(boundsTimer); boundsTimer = setTimeout(saveBounds,200); });
  window.on('close', () => { clearTimeout(boundsTimer); saveBounds(); });
  window.on('closed', () => { window = null; });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(() => {
    log(`Inicio ${app.getVersion()} · ${process.platform} ${process.arch}`);
    store = new Store(app.getPath('userData'), message => { startupWarnings.push(message); log(message); }); config = store.load();
    register('config:load', () => ({ ...config, warnings: startupWarnings, version: app.getVersion() }));
    register('config:save', data => { config = store.save(data); return config; });
    register('irc:connect', ({ id, password = '' } = {}) => {
      const profile = config.profiles.find(p => p.id === id); if (!profile) throw new Error('Guarda la red antes de conectar.');
      if (clients.has(id)) throw new Error('Esta red ya está conectada o conectando.');
      const client = new IrcClient(profile, password); clients.set(id, client);
      for (const type of ['status','message','users','channel','nick','topic','modes','server','problem']) client.on(type, data => {
        const safeData = type === 'problem' ? { text:data } : type === 'status' ? { ...data, connection:{host:client.profile.host,port:client.profile.port,tls:client.profile.tls} } : data;
        emit(id, type, safeData);
        if (type === 'status' && data.state === 'disconnected' && clients.get(id) === client) clients.delete(id);
      });
      try { client.connect(); } catch (e) { clients.delete(id); throw e; }
      return { ok: true };
    });
    register('irc:disconnect', id => { clients.get(id)?.disconnect(); return { ok: true }; });
    register('irc:send', ({ id, target, text } = {}) => {
      executeInput(clients.get(id), target, text, (type, data) => emit(id, type, data));
      return { ok:true };
    });
    register('app:copy', text => { if (typeof text !== 'string' || text.length > 1000000) throw new Error('Texto no válido.'); clipboard.writeText(text); return { ok:true }; });
    register('app:logs', async () => { const error = await shell.openPath(app.getPath('userData')); if (error) throw new Error(error); return { ok: true }; });
    register('app:quit', () => { app.quit(); });
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  }).catch(fatal);
  app.on('before-quit', () => { for (const client of clients.values()) client.disconnect(); log('Cierre normal'); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
