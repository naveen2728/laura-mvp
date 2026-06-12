const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lauraDesktop", {
  request: (request) => ipcRenderer.invoke("laura:request", request),
  openWorkspace: () => ipcRenderer.invoke("laura:workspace:open"),
  listWorkspace: () => ipcRenderer.invoke("laura:workspace:list"),
  readFile: (relativePath) => ipcRenderer.invoke("laura:workspace:read", relativePath),
  writeFile: (payload) => ipcRenderer.invoke("laura:workspace:write", payload)
});
