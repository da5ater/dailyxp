const {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  dialog,
  Menu,
  Notification,
  powerMonitor,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { Core } = require("../core/core.cjs");
const { profileDirectory, serve, request } = require("../core/integration.cjs");
const profile = profileDirectory();
app.setPath("userData", path.join(profile, "chromium"));
protocol.registerSchemesAsPrivileged([
  {
    scheme: "dailyxp",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
let core,
  server,
  window,
  quitting = false,
  tick;
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) {
  app
    .whenReady()
    .then(() => request(profile, "open").catch(() => {}))
    .finally(() => app.quit());
} else {
  app.on("second-instance", () => show());
  app
    .whenReady()
    .then(async () => {
      const renderer = path.resolve(__dirname, "../renderer");
      protocol.handle("dailyxp", (req) => {
        const url = new URL(req.url);
        const name =
          url.pathname === "/" ? "index.html" : url.pathname.slice(1);
        if (
          url.host !== "app" ||
          ![
            "index.html",
            "app.js",
            "views.js",
            "world.js",
            "editor.js",
            "view-utils.js",
            "style.css",
            "kingdom-ps1.png",
            "fonts/press-start.ttf",
            "fonts/inter.woff2",
            "fonts/ibm-plex-mono.woff2",
          ].includes(name)
        )
          return new Response("Not found", { status: 404 });
        return net.fetch(pathToFileURL(path.join(renderer, name)).href);
      });
      core = new Core(profile);
      server = await serve(core, show);
      ipcMain.handle("dailyxp", async (event, message) => {
        if (
          !window ||
          event.sender !== window.webContents ||
          event.senderFrame !== window.webContents.mainFrame ||
          !event.senderFrame.url.startsWith("dailyxp://app/")
        )
          throw new Error("Invalid IPC sender");
        try {
          const { action, domain, command, requestId, changes } = message || {};
          if (action === "snapshot")
            return { ok: true, value: core.snapshot() };
          if (action === "command")
            return {
              ok: true,
              value: core.execute(domain, command, requestId),
            };
          if (action === "settings") {
            core.settings(changes);
            return { ok: true };
          }
          if (action === "reset") {
            core.reset(message.confirmation);
            return { ok: true };
          }
          if (action === "import") {
            const result = await dialog.showOpenDialog(window, {
              title: "Import legacy DailyXP state",
              properties: ["openFile"],
              filters: [{ name: "DailyXP state", extensions: ["json"] }],
            });
            if (!result.canceled) {
              const file = result.filePaths[0];
              if (fs.statSync(file).size > 32 * 1024 * 1024)
                throw new Error("State file is too large");
              core.importLegacy(fs.readFileSync(file, "utf8"));
            }
            return { ok: true, canceled: result.canceled };
          }
          if (action === "export" || action === "export-journal") {
            const result = await dialog.showSaveDialog(window, {
              title:
                action === "export"
                  ? "Export DailyXP backup"
                  : "Export canonical DailyXP JSON",
              defaultPath:
                action === "export"
                  ? "dailyxp-backup.json"
                  : "dailyxp-journal.json",
            });
            if (!result.canceled)
              fs.writeFileSync(
                result.filePath,
                action === "export" ? core.exportState() : core.exportJournal(),
                {
                  mode: 0o600,
                },
              );
            return { ok: true, canceled: result.canceled };
          }
          throw new Error("Unsupported action");
        } catch (error) {
          console.error(error);
          return {
            ok: false,
            error: ["EACCES", "ENOSPC", "EIO", "EPERM"].includes(error.code)
              ? "DailyXP could not save. Your changes are still in the form. Check free space and file permissions, then try again."
              : error.message,
          };
        }
      });
      let lastXp = core.status().lifetimeXp;
      core.on("change", (status) => {
        window?.webContents.send("dailyxp-changed");
        if (
          core.data.settings.notifications &&
          status.lifetimeXp > lastXp &&
          Notification.isSupported()
        ) {
          new Notification({
            title: "DailyXP",
            icon: path.join(__dirname, "../renderer/icon.png"),
            body: `You earned ${status.lifetimeXp - lastXp} XP. Level ${status.level}.`,
          }).show();
        }
        lastXp = status.lifetimeXp;
      });
      tick = setInterval(() => {
        try {
          core.advanceDay();
          core.observeDesktop(powerMonitor.getSystemIdleTime());
        } catch (error) {
          console.error("Day advance failed", error.message);
        }
      }, 60000);
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: "DailyXP",
            submenu: [
              { label: "Open DailyXP", click: show },
              {
                label: "Quit DailyXP",
                accelerator: "CmdOrCtrl+Q",
                click: () => app.quit(),
              },
            ],
          },
          { role: "editMenu" },
          { role: "viewMenu" },
        ]),
      );
      show();
      console.log("DailyXP desktop ready");
    })
    .catch((error) => {
      console.error(error);
      if (core?.ownsLock) core.close();
      app.exit(1);
    });
}
function show() {
  if (window && !window.isDestroyed()) {
    window.show();
    window.focus();
    return;
  }
  window = new BrowserWindow({
    title: "DailyXP",
    icon: path.join(__dirname, "../renderer/icon.png"),
    width: 1280,
    height: 900,
    minWidth: 620,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== "dailyxp://app/") event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_, __, callback) =>
    callback(false),
  );
  for (const event of ["hide", "minimize"])
    window.on(event, () => window.webContents.send("dailyxp-lock-private"));
  window.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      window.hide();
    }
  });
  window.loadURL(
    process.env.DAILYXP_REVIEW_MODE === "1"
      ? "dailyxp://app/#review"
      : "dailyxp://app/",
  );
}
app.on("before-quit", () => {
  quitting = true;
  clearInterval(tick);
  server?.close();
  if (core?.ownsLock) core.close();
});
app.on("window-all-closed", () => {});
