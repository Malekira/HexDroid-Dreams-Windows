"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("historyApi", {
  call: (name, data) => ipcRenderer.invoke("history:action", name, data),
});
