'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { IrcClient, token, cleanText } = require('./irc');
const { Store } = require('./storage');
// A fixed, separate profile avoids inheriting data from older Dreams packages.
const dataDirectory = path.join(app.getPath('appData'), 'HexDroidDreams-Desktop');
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
  window = new BrowserWindow({ width: 1280, height: 820, minWidth: 820, minHeight: 560,
    title: 'HexDroid Dreams', backgroundColor: '#0c1019', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('render-process-gone', (_, details) => { log('Renderer terminado: ' + details.reason); dialog.showErrorBox('HexDroid Dreams', 'La interfaz se cerró inesperadamente. Vuelve a abrir la aplicación. El diagnóstico está en startup.log.'); });
  window.loadFile(path.join(__dirname, 'index.html')).catch(fatal);
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
      for (const type of ['status','message','users','channel','nick','topic','server','problem']) client.on(type, data => {
        emit(id, type, type === 'problem' ? { text: data } : data);
        if (type === 'status' && data.state === 'disconnected' && clients.get(id) === client) clients.delete(id);
      });
      try { client.connect(); } catch (e) { clients.delete(id); throw e; }
      return { ok: true };
    });
    register('irc:disconnect', id => { clients.get(id)?.disconnect(); return { ok: true }; });
    register('irc:send', ({ id, target, text } = {}) => {
      const client = clients.get(id); if (!client?.ready) throw new Error('Conecta primero esta red.');
      cleanText(text); if (text.length > 2000) throw new Error('Mensaje demasiado largo.');
      if (!text.startsWith('/') || text.startsWith('//')) client.sendMessage(target, text.startsWith('//') ? text.slice(1) : text);
      else {
        const split = text.indexOf(' '), command = (split < 0 ? text.slice(1) : text.slice(1, split)).toLowerCase(), args = split < 0 ? '' : text.slice(split + 1).trim();
        if (command === 'join') client.join(args);
        else if (command === 'me') client.sendMessage(target, args, true);
        else if (command === 'msg') {
          const space = args.indexOf(' '); if (space < 1) throw new Error('Uso: /msg apodo mensaje');
          client.sendMessage(args.slice(0, space), args.slice(space + 1));
        } else if (command === 'part') { token(target, 'Sala'); client.sendRaw(`PART ${target} :${args || 'Hasta pronto'}`); }
        else if (command === 'nick') { token(args, 'Apodo'); client.sendRaw(`NICK ${args}`); }
        else if (command === 'whois') { token(args, 'Apodo'); client.sendRaw(`WHOIS ${args}`); }
        else if (command === 'topic') { token(target, 'Sala'); client.sendRaw(`TOPIC ${target}${args ? ' :' + args : ''}`); }
        else if (command === 'quit') client.disconnect();
        else throw new Error('Comando desconocido. Usa /join, /part, /nick, /me, /msg, /whois, /topic o /quit.');
      }
      return { ok: true };
    });
    register('app:logs', async () => { const error = await shell.openPath(app.getPath('userData')); if (error) throw new Error(error); return { ok: true }; });
    register('app:quit', () => { app.quit(); });
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  }).catch(fatal);
  app.on('before-quit', () => { for (const client of clients.values()) client.disconnect(); log('Cierre normal'); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
