const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("dailyxp", {
  invoke: (message) => ipcRenderer.invoke("dailyxp", message),
  onPrivateLock: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("dailyxp-lock-private", handler);
    return () => ipcRenderer.removeListener("dailyxp-lock-private", handler);
  },
  onChange: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("dailyxp-changed", handler);
    return () => ipcRenderer.removeListener("dailyxp-changed", handler);
  },
});
