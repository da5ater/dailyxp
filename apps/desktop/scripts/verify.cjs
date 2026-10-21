#!/usr/bin/env node
const { _electron: electron } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { request } = require("../core/integration.cjs");
const repository = path.resolve(__dirname, "../../..");
const run = path.resolve(
  process.argv[3] || `/tmp/dailyxp-electron-verify-${Date.now()}`,
);
const mode = process.argv[2] || "run";
const profile = path.join(run, "profile");
function display(action) {
  const source = path.join(
    repository,
    "apps/desktop/.agents/skills/verify/scripts",
  );
  const result = spawnSync(
    "python",
    [
      "-c",
      `import sys,json\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1])\nimport display\nr=Path(sys.argv[2])\n${action === "start" ? "print(json.dumps(display.start(r)))" : "display.stop(r)"}`,
      source,
      run,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return action === "start" ? JSON.parse(result.stdout) : null;
}
function record(action, result) {
  fs.appendFileSync(
    path.join(run, "actions.jsonl"),
    JSON.stringify({ at: new Date().toISOString(), action, result }) + "\n",
  );
}
async function doctor() {
  const instance = JSON.parse(fs.readFileSync(path.join(run, "instance.json")));
  const cmdline = fs.readFileSync(`/proc/${instance.pid}/cmdline`, "utf8");
  if (!cmdline.includes("electron") && !cmdline.includes("dailyxp"))
    throw new Error("Owned Electron process is not running");
  const owner = JSON.parse(fs.readFileSync(path.join(profile, "writer.lock")));
  if (owner.pid !== instance.pid) throw new Error("Wrong profile writer PID");
  const status = await request(profile, "status");
  fs.writeFileSync(
    path.join(run, "doctor.json"),
    JSON.stringify({ ...instance, status }, null, 2),
  );
  return status;
}
async function execute() {
  if (mode === "doctor") {
    console.log(JSON.stringify(await doctor()));
    return;
  }
  if (mode !== "run") throw new Error("Usage: verify.cjs run|doctor RUN");
  fs.mkdirSync(run, { mode: 0o700 });
  let app,
    migrationApp,
    companion,
    displayStarted = false,
    logs = "";
  let companionLog;
  try {
    const env = display("start");
    displayStarted = true;
    const privateHome = path.join(run, "home");
    fs.mkdirSync(privateHome, { mode: 0o700 });
    const appEnv = {
      ...env,
      HOME: privateHome,
      XDG_CONFIG_HOME: path.join(privateHome, ".config"),
      XDG_DATA_HOME: path.join(privateHome, ".local/share"),
      DAILYXP_PROFILE: profile,
    };
    const launch = async () => {
      const startedAt = Date.now();
      const args = process.env.DAILYXP_VERIFY_EXECUTABLE
        ? ["--ozone-platform=wayland", "--disable-gpu"]
        : [repository, "--ozone-platform=wayland", "--disable-gpu"];
      app = await electron.launch({
        args,
        executablePath:
          process.env.DAILYXP_VERIFY_EXECUTABLE || require("electron"),
        env: appEnv,
        timeout: 30000,
      });
      app.process().stderr.on("data", (chunk) => {
        logs += chunk;
      });
      fs.writeFileSync(
        path.join(run, "instance.json"),
        JSON.stringify({
          pid: app.process().pid,
          profile,
          repository,
          revision: spawnSync("git", ["rev-parse", "HEAD"], {
            cwd: repository,
            encoding: "utf8",
          }).stdout.trim(),
        }),
      );
      const page = await app.firstWindow();
      await page.getByRole("button", { name: "Play", exact: true }).waitFor();
      await doctor();
      record("launch from owned profile", {
        ready: true,
        instrumentedMilliseconds: Date.now() - startedAt,
      });
      return page;
    };
    let page = await launch();
    const shot = async (label) => {
      await page.screenshot({
        path: path.join(run, `${label}.png`),
        fullPage: true,
      });
      record(`capture ${label}`, await request(profile, "status"));
    };
    await shot("01-empty");
    await page.getByRole("button", { name: "World", exact: true }).click();
    await page
      .getByRole("heading", { name: "Your first Province begins with a Goal." })
      .waitFor();
    await shot("09-world-empty");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: "+ Add", exact: true }).click();
    await page
      .getByLabel("Name", { exact: true })
      .fill("Build the Redis parser");
    await page.getByLabel("Planned minutes").fill("25");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByText("Build the Redis parser", { exact: true })
      .first()
      .waitFor();
    record("create commitment through form", "visible");
    await page.getByRole("button", { name: /Build the Redis parser/ }).click();
    await page
      .getByRole("button", { name: "Start Session", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Pause Session", exact: true })
      .waitFor();
    await shot("02-running");
    fs.cpSync(
      path.join(repository, "integrations/omarchy"),
      path.join(run, "companion"),
      { recursive: true },
    );
    fs.copyFileSync(
      path.join(
        repository,
        "apps/desktop/.agents/skills/verify/scripts/companion.qml",
      ),
      path.join(run, "companion-host.qml"),
    );
    fs.mkdirSync(path.join(run, "imports/qs"), { recursive: true });
    for (const name of ["Commons", "Ui"])
      fs.symlinkSync(
        `/usr/share/omarchy/shell/${name}`,
        path.join(run, "imports/qs", name),
      );
    const controller = path.join(run, "dailyxpctl");
    const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
    const controllerCommand = process.env.DAILYXP_VERIFY_CONTROLLER
      ? `exec ${quote(process.env.DAILYXP_VERIFY_CONTROLLER)}`
      : process.env.DAILYXP_VERIFY_EXECUTABLE
        ? `ELECTRON_RUN_AS_NODE=1 exec ${quote(process.env.DAILYXP_VERIFY_EXECUTABLE)} ${quote(path.join(path.dirname(process.env.DAILYXP_VERIFY_EXECUTABLE), "resources/app.asar/apps/desktop/core/cli.cjs"))}`
        : `exec ${quote(process.execPath)} ${quote(path.join(repository, "apps/desktop/core/cli.cjs"))}`;
    fs.writeFileSync(controller, `#!/bin/sh\n${controllerCommand} "$@"\n`, {
      mode: 0o700,
    });
    companionLog = fs.openSync(path.join(run, "companion.log"), "w");
    companion = spawn(
      "quickshell",
      ["-p", path.join(run, "companion-host.qml")],
      {
        env: {
          ...env,
          DAILYXP_PROFILE: profile,
          DAILYXP_CTL: controller,
          QML_IMPORT_PATH: path.join(run, "imports"),
        },
        stdio: ["ignore", companionLog, companionLog],
      },
    );
    const companionCall = (...args) => {
      const response = spawnSync(
        "quickshell",
        [
          "ipc",
          "--pid",
          String(companion.pid),
          "call",
          "dailyxp-companion-verify",
          ...args,
        ],
        { env, encoding: "utf8" },
      );
      if (response.status !== 0)
        throw new Error(response.stderr || "Companion not ready");
      return response.stdout.trim();
    };
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        if (JSON.parse(companionCall("status")).connected) break;
      } catch (error) {
        if (attempt === 39) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!JSON.parse(companionCall("status")).connected)
      throw new Error("Companion disconnected");
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].close(),
    );
    if (
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      )
    )
      throw new Error("Window close did not hide the application");
    companionCall("click", "left");
    for (let attempt = 0; attempt < 30; attempt++) {
      if (
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isVisible(),
        )
      )
        break;
      if (attempt === 29)
        throw new Error("Companion did not reopen the hidden window");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    record(
      "close window then real companion left click",
      "same application window reopened",
    );
    companionCall("click", "right");
    await page
      .getByRole("button", { name: "Resume Session", exact: true })
      .waitFor();
    record("real companion right click", "Electron shows paused");
    await page
      .getByRole("button", { name: "Resume Session", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Pause Session", exact: true })
      .waitFor();
    spawnSync("grim", [path.join(run, "02-companion.png")], { env });
    await request(profile, "pause", "verify-adapter-pause");
    await request(profile, "pause", "verify-adapter-pause");
    await page
      .getByRole("button", { name: "Resume Session", exact: true })
      .waitFor();
    record("adapter pause and duplicate retry", "paused once");
    await page
      .getByRole("button", { name: "Resume Session", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Pause Session", exact: true })
      .waitFor();
    const killed = new Promise((resolve) =>
      app.process().once("exit", resolve),
    );
    app.process().kill("SIGKILL");
    await killed;
    app = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (!JSON.parse(companionCall("status")).connected) break;
      if (attempt === 39)
        throw new Error("Companion retained stale status after app exit");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    page = await launch();
    for (let attempt = 0; attempt < 40; attempt++) {
      if (JSON.parse(companionCall("status")).connected) break;
      if (attempt === 39) throw new Error("Companion failed to reconnect");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (JSON.parse(companionCall("status")).label.includes("XP"))
      throw new Error("Companion replayed an old XP celebration");
    record(
      "companion disconnect and reconnect",
      "stale status cleared; no old celebration",
    );
    await page
      .getByRole("button", { name: "Pause Session", exact: true })
      .waitFor();
    record("restart", "active Session replayed after SIGKILL");
    await page
      .getByRole("button", { name: "Finish Session", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Start Session", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByText("No commitments yet.", { exact: true }).waitFor();
    record("finish Session then complete Task separately", "completed");
    await page.getByRole("button", { name: "+ Habit", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("Stretch");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    await page.getByRole("button", { name: "Undo", exact: true }).waitFor();
    for (let attempt = 0; attempt < 30; attempt++) {
      if (JSON.parse(companionCall("status")).label.includes("XP")) break;
      if (attempt === 29)
        throw new Error("Companion did not show earned XP feedback");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    spawnSync("grim", [path.join(run, "02-companion-xp.png")], { env });
    record(
      "earned Habit XP reaches companion",
      "brief safe XP feedback visible",
    );
    const status = await request(profile, "status");
    if (status.lifetimeXp <= 0)
      throw new Error("Habit completion did not award XP");
    record("complete Habit through real control", status);
    await page.getByRole("button", { name: "Journey", exact: true }).click();
    await page
      .getByRole("heading", { name: "XP Ledger", exact: true })
      .waitFor();
    await shot("03-journey");
    await page.getByRole("button", { name: "Plan", exact: true }).click();
    await page.getByRole("button", { name: "+ Routine", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("Read 20 pages");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByRole("heading", { name: "Read 20 pages", exact: true })
      .waitFor();
    record("create Routine", "visible");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: /Read 20 pages/ }).waitFor();
    await shot("04-quest-cartridge");
    if (
      !(await page
        .locator(".kingdom-scene img")
        .evaluate((img) => img.complete && img.naturalWidth > 0))
    )
      throw new Error("Quest artwork failed to load");
    if (!(await page.evaluate(() => document.fonts.check("24px Pixel"))))
      throw new Error("Quest pixel font failed to load");
    await page.setViewportSize({ width: 699, height: 900 });
    await shot("05-narrow");
    const overlapsNotice = await page.evaluate(() => {
      const notice = document.querySelector("#notice").getBoundingClientRect();
      return [...document.querySelectorAll("button")].some((button) => {
        const rect = button.getBoundingClientRect();
        return (
          rect.width > 0 && rect.top < notice.bottom && rect.bottom > notice.top
        );
      });
    });
    if (overlapsNotice) throw new Error("Status feedback overlaps a control");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (overflow) throw new Error("Narrow viewport overflows horizontally");
    await page.getByRole("button", { name: "+ Add", exact: true }).click();
    await page
      .getByLabel("Name", { exact: true })
      .fill("A long commitment ".repeat(12));
    await shot("06-long-editor");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "+ Add", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Tab");
    if (
      !(await page.evaluate(
        () =>
          document.activeElement?.tagName === "SELECT" ||
          document.activeElement?.tagName === "BUTTON",
      ))
    )
      throw new Error("Keyboard focus is not reachable");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("Reduce motion", { exact: true }).check();
    await page
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    if ((await page.locator("body").getAttribute("data-reduced")) !== "true")
      throw new Error("Reduced motion setting did not apply");
    await shot("07-settings");
    await page.getByRole("button", { name: "Plan", exact: true }).click();
    await page.getByRole("button", { name: "+ Goal", exact: true }).click();
    await page
      .getByLabel("Name", { exact: true })
      .fill("Learn systems programming");
    await page
      .getByLabel("Why this matters")
      .fill("Build software I understand.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByRole("heading", { name: "Learn systems programming", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "+ Milestone", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Finish the parser");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const xpBeforeMilestone = (await request(profile, "status")).lifetimeXp;
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    const completedMilestone = page
      .locator(".entity")
      .filter({ hasText: "Finish the parser" });
    await completedMilestone
      .getByText("completed · binary", { exact: true })
      .waitFor();
    if ((await request(profile, "status")).lifetimeXp <= xpBeforeMilestone)
      throw new Error("Completed Milestone awarded no XP");
    if (
      await completedMilestone
        .getByRole("button", { name: "Complete", exact: true })
        .count()
    )
      throw new Error("Milestone completion control remained after completion");
    const savedMilestoneJournal = JSON.parse(
      JSON.parse(fs.readFileSync(path.join(profile, "desktop.json"))).envelope
        .payload.eventJournalRaw,
    );
    if (
      !savedMilestoneJournal.events.some(
        (e) =>
          e.type === "planning.milestone.progressed" &&
          e.payload.status === "completed",
      )
    )
      throw new Error("Milestone completion did not persist");
    record(
      "create Goal and complete its Milestone",
      "completed label visible; completion persisted",
    );
    await page
      .getByRole("button", { name: "+ Milestone", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Explain the protocol");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "World", exact: true }).click();
    await page
      .getByRole("heading", { name: "Learn systems programming", exact: true })
      .waitFor();
    if ((await page.getByRole("progressbar").getAttribute("value")) !== "0.5")
      throw new Error("World fraction did not follow real Milestones");
    await page.getByText("1 / 2 landmarks built", { exact: true }).waitFor();
    await shot("10-world-progress");
    record(
      "World follows Goal and Milestone progression",
      "50%, real Momentum cause, no competition fixtures",
    );
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page
      .getByRole("button", { name: "Private Recovery", exact: true })
      .click();
    await page.getByRole("dialog", { name: "Open private tracks?" }).waitFor();
    if (
      !(await page
        .getByRole("button", { name: "Cancel", exact: true })
        .evaluate((el) => el === document.activeElement))
    )
      throw new Error("Private gate did not default to Cancel");
    await shot("11-private-confirmation");
    await page.keyboard.press("Enter");
    await page
      .getByRole("dialog", { name: "Open private tracks?" })
      .waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Private Recovery", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Open private tracks", exact: true })
      .click();
    await page.getByRole("button", { name: "+ Track", exact: true }).click();
    await page.getByLabel("Private category name").fill("   ");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .locator("#form-error")
      .filter({ hasText: /customCategory/i })
      .waitFor();
    await page.getByLabel("Private category name").fill("Private review track");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByRole("heading", { name: "Private review track", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await page.getByLabel("Private note").fill("Disposable review note");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByRole("button", { name: "Checked in today", exact: true })
      .waitFor();
    if (
      !(await page
        .getByRole("button", { name: "Checked in today", exact: true })
        .isDisabled())
    )
      throw new Error("Duplicate check-in remains enabled");
    await shot("12-private-checkin");
    await page.keyboard.press("Enter");
    await page
      .getByRole("button", { name: "Record setback", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Checked in today", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Record setback", exact: true })
      .click();
    await page
      .locator("#private-confirmation")
      .getByRole("button", { name: "Record setback", exact: true })
      .click();
    await page.getByRole("button", { name: "Restart", exact: true }).waitFor();
    await page.getByRole("button", { name: "Restart", exact: true }).click();
    await page
      .getByRole("button", { name: "Checked in today", exact: true })
      .waitFor();
    await shot("13-private-restart");
    const privateJournal = JSON.parse(
      JSON.parse(fs.readFileSync(path.join(profile, "desktop.json"))).envelope
        .payload.eventJournalRaw,
    );
    const privateEvents = privateJournal.events.filter((e) =>
      e.type.startsWith("recovery."),
    );
    if (
      privateEvents.some((e) => e.private !== true) ||
      privateEvents.filter((e) => e.type === "recovery.checkin").length !== 1
    )
      throw new Error(
        "Canonical Recovery privacy or once-a-day check-in failed",
      );
    if (
      JSON.stringify(await request(profile, "status")).includes(
        "Private review track",
      )
    )
      throw new Error("Recovery leaked into companion");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page
      .getByRole("button", { name: "Private Recovery", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Open private tracks", exact: true })
      .waitFor();
    if (
      await page
        .getByRole("heading", { name: "Private review track", exact: true })
        .count()
    )
      throw new Error("Recovery privacy gate did not reset");
    await page.keyboard.press("Escape");
    record("private Recovery create/check-in/hide", "no companion disclosure");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: "+ Add", exact: true }).click();
    await page
      .getByLabel("Name", { exact: true })
      .fill("Must not survive a failed save");
    fs.chmodSync(profile, 0o500);
    try {
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page
        .locator("#form-error")
        .filter({ hasText: "DailyXP could not save" })
        .waitFor();
      await shot("08-save-error");
    } finally {
      fs.chmodSync(profile, 0o700);
    }
    await page.keyboard.press("Escape");
    if (
      await page
        .getByRole("button", { name: /Must not survive a failed save/ })
        .count()
    )
      throw new Error("Failed save appeared in projection");
    record(
      "real read-only profile save failure",
      "error shown; no phantom Task",
    );
    const planButton = page.getByRole("button", { name: "Plan", exact: true });
    await planButton.focus();
    await page.keyboard.press("Enter");
    if (
      (await page.evaluate(() => document.activeElement?.dataset.id)) !== "Plan"
    )
      throw new Error("Navigation lost keyboard focus");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await page.getByRole("button", { name: "Journey", exact: true }).focus();
    await page.keyboard.press("Space");
    if (
      (await page.evaluate(() => document.activeElement?.dataset.id)) !==
      "Journey"
    )
      throw new Error("Space navigation lost focus");
    const outline = await page.evaluate(
      () => getComputedStyle(document.activeElement).outlineWidth,
    );
    if (parseFloat(outline) < 2)
      throw new Error("Keyboard focus is not visible");
    record(
      "Enter, Space, Tab and Shift+Tab navigation",
      "focus remains visible on resulting control",
    );
    await page.getByRole("button", { name: "Correct", exact: true }).click();
    await page
      .getByLabel("Primary Skill", { exact: true })
      .fill("systems/review");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .locator(".entity")
      .filter({ hasText: "systems/review" })
      .waitFor();
    record("correct finished Session through form", "revised Skill is visible");

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByRole("button", { name: "Export backup", exact: true })
      .click();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    spawnSync("grim", [path.join(run, "09-native-save-dialog.png")], { env });
    const exportFile = path.join(run, "native-export.json");
    const input = spawnSync(
      "wtype",
      [
        "-M",
        "ctrl",
        "-s",
        "100",
        "-P",
        "a",
        "-s",
        "100",
        "-p",
        "a",
        "-s",
        "100",
        "-m",
        "ctrl",
        "-s",
        "200",
        "-d",
        "10",
        exportFile,
        "-s",
        "1000",
        "-P",
        "Return",
        "-s",
        "100",
        "-p",
        "Return",
        "-s",
        "500",
        "-M",
        "alt",
        "-s",
        "100",
        "-P",
        "s",
        "-s",
        "100",
        "-p",
        "s",
        "-m",
        "alt",
        "-s",
        "1000",
      ],
      { env, encoding: "utf8" },
    );
    if (input.status !== 0)
      throw new Error(input.stderr || "Private native input failed");
    for (
      let attempt = 0;
      attempt < 150 && !fs.existsSync(exportFile);
      attempt++
    )
      await new Promise((resolve) => setTimeout(resolve, 100));
    spawnSync("grim", [path.join(run, "09-native-save-result.png")], { env });
    if (!fs.existsSync(exportFile))
      throw new Error("Native export dialog did not save backup");
    const exportBytes = fs.readFileSync(exportFile, "utf8");
    if (!JSON.parse(exportBytes).payload.eventJournalRaw)
      throw new Error("Native backup is invalid");
    record("native export dialog", "backup file written");
    await shot("09-backup-exported");
    const migrationProfile = path.join(run, "migration-profile");
    migrationApp = await electron.launch({
      args: process.env.DAILYXP_VERIFY_EXECUTABLE
        ? ["--ozone-platform=wayland", "--disable-gpu"]
        : [repository, "--ozone-platform=wayland", "--disable-gpu"],
      executablePath:
        process.env.DAILYXP_VERIFY_EXECUTABLE || require("electron"),
      env: { ...appEnv, DAILYXP_PROFILE: migrationProfile },
      timeout: 30000,
    });
    const importedPage = await migrationApp.firstWindow();
    await importedPage
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await importedPage
      .getByRole("button", { name: "Import legacy state", exact: true })
      .click();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const chosen = spawnSync(
      "wtype",
      [
        "-M",
        "ctrl",
        "-s",
        "100",
        "-P",
        "l",
        "-s",
        "100",
        "-p",
        "l",
        "-s",
        "100",
        "-m",
        "ctrl",
        "-s",
        "200",
        "-d",
        "10",
        exportFile,
        "-s",
        "1000",
        "-P",
        "Return",
        "-s",
        "100",
        "-p",
        "Return",
        "-s",
        "1000",
        "-M",
        "alt",
        "-s",
        "100",
        "-P",
        "o",
        "-s",
        "100",
        "-p",
        "o",
        "-m",
        "alt",
        "-s",
        "1000",
      ],
      { env, encoding: "utf8" },
    );
    if (chosen.status !== 0)
      throw new Error(chosen.stderr || "Native import input failed");
    spawnSync("grim", [path.join(run, "10-native-open-dialog.png")], { env });
    for (let attempt = 0; attempt < 150; attempt++) {
      const importedStatus = await request(migrationProfile, "status");
      if (
        importedStatus.lifetimeXp ===
        (await request(profile, "status")).lifetimeXp
      )
        break;
      if (attempt === 149) throw new Error("Native import did not preserve XP");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await importedPage
      .getByRole("button", { name: "Plan", exact: true })
      .click();
    await importedPage
      .getByRole("heading", { name: "Learn systems programming", exact: true })
      .waitFor();
    await importedPage.screenshot({
      path: path.join(run, "10-native-import.png"),
      fullPage: true,
    });
    if (fs.readFileSync(exportFile, "utf8") !== exportBytes)
      throw new Error("Import modified source backup");
    record(
      "native import into empty profile",
      "XP and Goal preserved; source backup bytes unchanged",
    );
    await migrationApp.close();
    migrationApp = null;
    const measure = () => {
      const pids = [];
      const visit = (pid) => {
        try {
          const children = fs
            .readFileSync(`/proc/${pid}/task/${pid}/children`, "utf8")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map(Number);
          pids.push(pid);
          children.forEach(visit);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      };
      visit(app.process().pid);
      let pssKb = 0,
        ticks = 0;
      for (const pid of pids) {
        const smaps = fs.readFileSync(`/proc/${pid}/smaps_rollup`, "utf8");
        pssKb += Number(smaps.match(/^Pss:\s+(\d+)/m)?.[1] || 0);
        const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
        const values = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
        ticks += Number(values[11]) + Number(values[12]);
      }
      return { pids, pssKb, ticks, at: Date.now() };
    };
    const first = measure();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const last = measure();
    const hz = Number(
      spawnSync("getconf", ["CLK_TCK"], { encoding: "utf8" }).stdout.trim(),
    );
    fs.writeFileSync(
      path.join(run, "resources.json"),
      JSON.stringify(
        {
          scope:
            "One instrumented software-rendered Electron process tree on this Omarchy host; includes Playwright debugging overhead; no cross-distro or speedup claim",
          processes: last.pids.length,
          proportionalMemoryMiB: last.pssKb / 1024,
          idleWindowMilliseconds: last.at - first.at,
          cpuPercentOfOneCore:
            ((last.ticks - first.ticks) / hz / ((last.at - first.at) / 1000)) *
            100,
          pidsStable: JSON.stringify(first.pids) === JSON.stringify(last.pids),
        },
        null,
        2,
      ),
    );
    const saved = JSON.parse(
      fs.readFileSync(path.join(profile, "desktop.json")),
    );
    const journal = JSON.parse(saved.envelope.payload.eventJournalRaw);
    if (
      !journal.events.some((e) => e.type === "planning.task.created") ||
      !journal.events.some((e) => e.type === "habit.completed")
    )
      throw new Error("Visible work did not persist");
    fs.writeFileSync(
      path.join(run, "report.json"),
      JSON.stringify(
        {
          verified: true,
          status: await doctor(),
          eventCount: journal.events.length,
          screenshots: fs.readdirSync(run).filter((n) => n.endsWith(".png")),
        },
        null,
        2,
      ),
    );
    console.log(`VERIFIED ${run}`);
  } finally {
    if (migrationApp) await migrationApp.close();
    if (companion) {
      companion.kill("SIGTERM");
      await new Promise((resolve) => companion.once("exit", resolve));
    }
    if (companionLog !== undefined) fs.closeSync(companionLog);
    if (fs.existsSync(profile)) fs.chmodSync(profile, 0o700);
    if (app) await app.close();
    fs.writeFileSync(path.join(run, "electron.log"), logs);
    if (displayStarted) display("stop");
    if (fs.existsSync(profile))
      fs.renameSync(profile, path.join(run, "persisted-profile"));
    fs.writeFileSync(
      path.join(run, "cleanup.json"),
      JSON.stringify({
        stoppedOwnedApp: true,
        stoppedOwnedDisplay: displayStarted,
        evidencePreserved: true,
      }),
    );
  }
}
execute().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
