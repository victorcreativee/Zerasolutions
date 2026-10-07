const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('zeraSetup', {
  open: () => ipcRenderer.invoke('zera:open-workspace'),
  install: input => ipcRenderer.invoke('zera:install', input),
  save: databaseUrl => ipcRenderer.invoke('zera:configure', databaseUrl)
});
