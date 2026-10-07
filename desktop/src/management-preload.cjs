const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('zeraManagement',{
  status:() => ipcRenderer.invoke('zera:management','status'),
  connect:input => ipcRenderer.invoke('zera:management','connect',input),
  check:() => ipcRenderer.invoke('zera:management','check'),
  download:() => ipcRenderer.invoke('zera:management','download'),
  choose:kind => ipcRenderer.invoke('zera:management','choose',kind),
  services:input => ipcRenderer.invoke('zera:management','services',input)
});
