"use strict";
const electron = require("electron");
const { app, BrowserWindow, ipcMain, dialog, shell, screen, clipboard } =
  electron;
let Runtime, Store, WindowState;
const fs = require("node:fs");
const path = require("node:path");
// A fixed, separate profile avoids inheriting data from older Dreams packages.
const requestedProfile = app.commandLine.getSwitchValue("user-data-dir");
const dataDirectory = requestedProfile
  ? path.resolve(requestedProfile)
  : path.join(app.getPath("appData"), "HexDroidDreams-Desktop");
try {
  fs.mkdirSync(dataDirectory, { recursive: true });
  app.setPath("userData", dataDirectory);
} catch (error) {
  dialog.showErrorBox(
    "HexDreams IRC",
    "No se pudo crear la carpeta de datos: " + error.message,
  );
  app.exit(1);
}
let historyWindow;
let window,
  store,
  config,
  logFile,
  runtime,
  tray,
  quitting = false;
const startupWarnings = [];
function log(message) {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    logFile ||= path.join(app.getPath("userData"), "startup.log");
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1048576)
      fs.renameSync(logFile, logFile + ".previous");
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`);
  } catch {}
}
function fatal(error) {
  log(error.stack || String(error));
  if (quitting) return;
  dialog.showErrorBox(
    "HexDreams IRC — error",
    `${error.message || error}\n\nRegistro: ${logFile || app.getPath("userData")}`,
  );
}
process.on("uncaughtException", fatal);
process.on("unhandledRejection", (error) =>
  fatal(error instanceof Error ? error : new Error(String(error))),
);
function emit(id, type, data) {
  if (quitting) return;
  if (window && !window.isDestroyed() && !window.webContents.isDestroyed())
    try {
      window.webContents.send("irc:event", {
        ...data,
        id,
        type,
        subtype: data?.type,
        transferId: data?.id,
      });
    } catch (error) {
      if (!quitting) log("Evento no entregado: " + error.message);
    }
}
function register(name, handler) {
  ipcMain.handle(name, async (event, ...args) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw new Error("Solicitud no autorizada.");
    try {
      return await handler(...args);
    } catch (e) {
      return { error: e.message };
    }
  });
}
function createWindow() {
  const stateStore = new WindowState(dataDirectory);
  const bounds = stateStore.load(
    screen.getAllDisplays().map((d) => d.workArea),
  );
  window = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 760,
    minHeight: 500,
    title: "HexDreams IRC",
    icon: path.join(__dirname, "assets", "logo.png"),
    backgroundColor: "#0c1019",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  window.setIcon(
    electron.nativeImage
      .createFromPath(path.join(__dirname, "assets", "logo.png"))
      .resize({ width: 256, height: 256 }),
  );
  if (process.platform === "win32" && app.isPackaged)
    window.setAppDetails({
      appId: "org.hexdreams.irc",
      relaunchDisplayName: "HexDreams IRC",
      appIconPath: process.execPath,
      appIconIndex: 0,
      relaunchCommand: '"' + process.execPath + '"',
    });
  window.removeMenu();
  require("./services/editor-menu").attachEditorMenu(window,electron.Menu);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("render-process-gone", (_, details) => {
    log("Renderer terminado: " + details.reason);
    if (quitting || details.reason === "clean-exit") return;
    dialog.showErrorBox(
      "HexDreams IRC",
      "La interfaz se cerró inesperadamente. Vuelve a abrir la aplicación. El diagnóstico está en startup.log.",
    );
  });
  window.webContents.once("did-finish-load", () => log("Ventana preparada"));
  window.loadFile(path.join(__dirname, "index.html")).catch(fatal);
  if (bounds.maximized) window.maximize();
  let boundsTimer;
  const saveBounds = () => {
    if (window && !window.isDestroyed() && !window.isMinimized())
      try {
        stateStore.save(window.getNormalBounds(), window.isMaximized());
      } catch (e) {
        log("No se pudo guardar la ventana: " + e.message);
      }
  };
  for (const event of ["resize", "move", "maximize", "unmaximize"])
    window.on(event, () => {
      clearTimeout(boundsTimer);
      boundsTimer = setTimeout(saveBounds, 200);
    });
  window.on("close", (event) => {
    clearTimeout(boundsTimer);
    saveBounds();
    if (!quitting && config.settings.closeToTray && tray) {
      event.preventDefault();
      window.hide();
    }
  });
  window.on("minimize", () => {
    if (config.settings.minimizeToTray && tray) window.hide();
  });
  window.on("focus", () => {
    window.flashFrame(false);
    app.setBadgeCount(0);
    if (runtime) runtime.badge = 0;
    if (process.platform === "win32") window.setOverlayIcon(null, "");
  });
  window.on("closed", () => {
    window = null;
    if(historyWindow&&!historyWindow.isDestroyed())historyWindow.close();
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(() => {
      log(`Inicio ${app.getVersion()} · ${process.platform} ${process.arch}`);
      ({ Store } = require("./storage"));
      ({ WindowState } = require("./window-state"));
      ({ Runtime } = require("./services/runtime"));
      store = new Store(app.getPath("userData"), (message) => {
        startupWarnings.push(message);
        log(message);
      });
      config = store.load();
      config.workspace={networks:[],active:null};config=store.save(config);
      register("config:load", () => ({
        ...config,
        warnings: startupWarnings,
        version: app.getVersion(),
      }));
      register("config:save", (data) => {
        if(quitting)return config;
        config = store.save(data);
        return config;
      });
      runtime = new Runtime({
        directory: dataDirectory,
        electron,
        getWindow: () => window,
        getConfig: () => config,
        saveConfig: (data) => (config = store.save(data)),
        emit,
      });
      register("irc:connect", (data) => runtime.connect(data));
      register("irc:disconnect", (id) => {
        runtime.sessions.disconnect(id);
        return { ok: true };
      });
      register("irc:send", (data) => runtime.send(data));
      register("advanced:action", (name, data) => {
        if(name==="app.hide"){if(!tray)throw Error("La bandeja del sistema no está disponible.");window.hide();return{ok:true};}
        if (name === "history.window") {
          if (historyWindow && !historyWindow.isDestroyed()) {
            historyWindow.show();
            historyWindow.focus();
            return { ok: true };
          }
          historyWindow = new BrowserWindow({
            width: 1050,
            height: 740,
            minWidth: 700,
            minHeight: 420,
            title: "Historial — HexDreams IRC",
            icon: path.join(__dirname, "assets", "logo.png"),
            webPreferences: {
              preload: path.join(__dirname, "history-preload.js"),
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
      spellcheck: true,
            },
          });
          historyWindow.removeMenu();
          historyWindow.webContents.setWindowOpenHandler(() => ({
            action: "deny",
          }));
          historyWindow.webContents.on("will-navigate", (event) =>
            event.preventDefault(),
          );
          historyWindow.on("closed", () => (historyWindow = null));
          historyWindow
            .loadFile(path.join(__dirname, "history-viewer.html"))
            .catch(fatal);
          return { ok: true };
        }
        return runtime.action(name, data);
      });
      ipcMain.handle("history:action", async (event, name, data) => {
        if (
          !historyWindow ||
          event.sender !== historyWindow.webContents ||
          event.senderFrame !== historyWindow.webContents.mainFrame ||
          !["logs.text.list", "logs.text.read", "logs.text.search"].includes(
            name,
          )
        )
          throw Error("Solicitud no autorizada.");
        try {
          return await runtime.action(name, data);
        } catch (e) {
          return { error: e.message };
        }
      });
      register("app:copy", (text) => {
        if (typeof text !== "string" || text.length > 1000000)
          throw new Error("Texto no válido.");
        clipboard.writeText(text);
        return { ok: true };
      });
      register("app:logs", async () => {
        const error = await shell.openPath(app.getPath("userData"));
        if (error) throw new Error(error);
        return { ok: true };
      });
      register("app:quit", () => {
        app.quit();
      });
      app.setAppUserModelId("org.hexdreams.irc");
      createWindow();
      if (app.commandLine.getSwitchValue("ozone-platform") !== "headless") {
        tray = new electron.Tray(path.join(__dirname, "assets", "tray.png"));
        tray.setToolTip("HexDreams IRC");
        const show = () => {
          window?.restore();
          window?.show();
          window?.focus();
        };
        tray.on("double-click", show);
        try{electron.globalShortcut.register("CommandOrControl+Shift+Z",()=>window?.hide());}catch(error){log("Atajo de bandeja: "+error.message);}
        tray.setContextMenu(
          electron.Menu.buildFromTemplate([
            { label: "Abrir HexDreams IRC", click: show },
            { label: "Salir", click: () => app.quit() },
          ]),
        );
      }
      window.webContents.once("did-finish-load", () => {
        for (const p of config.profiles.filter((p) => p.autoConnect))
          try {
            runtime.connect({ id: p.id });
          } catch (e) {
            emit(p.id, "problem", { text: e.message });
          }
      });
      app.on("activate", () => {
        if (!BrowserWindow.getAllWindows().length) createWindow();
      });
    })
    .catch(fatal);
  app.on("before-quit", () => {
    quitting = true;
    electron.globalShortcut.unregisterAll();
    if(store&&config)try{config.workspace={networks:[],active:null};store.save(config);}catch(error){log(error.message);}
    runtime?.close();
    tray?.destroy();
    log("Cierre normal");
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
