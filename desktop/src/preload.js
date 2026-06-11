const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lauraDesktop", {
  request: (request) => ipcRenderer.invoke("laura:request", request)
});
