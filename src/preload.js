'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('dreams', {
  advanced: (name, data) => ipcRenderer.invoke('advanced:action', name, data),
  load: () => ipcRenderer.invoke('config:load'),
  save: data => ipcRenderer.invoke('config:save', data),
  connect: data => ipcRenderer.invoke('irc:connect', data),
  disconnect: id => ipcRenderer.invoke('irc:disconnect', id),
  send: data => ipcRenderer.invoke('irc:send', data),
  logs: () => ipcRenderer.invoke('app:logs'),
  quit: () => ipcRenderer.invoke('app:quit'),
  copy: text => ipcRenderer.invoke('app:copy', text),
  onEvent: callback => { const listener = (_, data) => callback(data); ipcRenderer.on('irc:event', listener); return () => ipcRenderer.removeListener('irc:event', listener); }
});
