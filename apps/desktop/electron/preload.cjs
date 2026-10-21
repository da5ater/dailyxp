const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("dailyxp", {
  invoke: (message) => ipcRenderer.invoke("dailyxp", message),
  onChange: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("dailyxp-changed", handler);
    return () => ipcRenderer.removeListener("dailyxp-changed", handler);
  },
});
