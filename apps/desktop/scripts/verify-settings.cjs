const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const Event = require("../../../EventModel.js");
const { Core } = require("../core/core.cjs");
module.exports = async function verifySettings({
  page,
  closeApp,
  env,
  run,
  profile,
  shot,
  record,
  companionCall,
  restart,
}) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  const saved = () =>
    JSON.parse(fs.readFileSync(path.join(profile, "desktop.json")));
  const journal = () =>
    Event.loadJournal(saved().envelope.payload.eventJournalRaw).journal;
  const wait = async (predicate) => {
    for (let i = 0; i < 60; i++) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Settings outcome did not settle");
  };
  await button("Play").click();
  await button("Free Session").click();
  await button("Pause Session").waitFor();
  await button("Settings").click();
  await page.getByLabel("Daily focus target in minutes").fill("91");
  await require("../core/integration.cjs").request(profile, "pause");
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(
    await page.getByLabel("Daily focus target in minutes").inputValue(),
    "91",
  );
  await button("Play").click();
  await button("Resume Session").waitFor();
  await button("Finish Session").click();
  await button("Start Session").waitFor();
  record(
    "companion update while a settings draft has focus",
    "draft kept; navigation uses current paused state",
  );
  await button("Settings").click();
  await page.getByLabel("Day boundary in minutes after midnight").fill("360");
  await page.getByLabel("Daily focus target in minutes").fill("90");
  await button("Save settings").click();
  await wait(() => saved().settings.dayBoundaryMinutes === 360);
  await page.getByLabel("Reduce motion", { exact: true }).uncheck();
  await wait(() =>
    page
      .locator("body")
      .getAttribute("data-reduced")
      .then((v) => v === "false"),
  );
  await page.getByLabel("Reduce motion", { exact: true }).check();
  await wait(() =>
    page
      .locator("body")
      .getAttribute("data-reduced")
      .then((v) => v === "true"),
  );
  await shot("100-settings-during");
  assert.equal(journal().events.at(-1).type, "settings.changed");
  const settingsCount = journal().events.filter(
    (e) => e.type === "settings.changed",
  ).length;
  await button("Save settings").dblclick();
  assert.equal(
    journal().events.filter((e) => e.type === "settings.changed").length,
    settingsCount,
  );
  await page.getByLabel("Day boundary in minutes after midnight").fill("1440");
  await button("Save settings").click();
  assert.equal(saved().settings.dayBoundaryMinutes, 360);
  await page.getByLabel("Day boundary in minutes after midnight").fill("420");
  fs.chmodSync(profile, 0o500);
  try {
    await button("Save settings").click();
    await page
      .getByRole("status")
      .filter({ hasText: "DailyXP could not save" })
      .waitFor();
    assert.equal(
      await page
        .getByLabel("Day boundary in minutes after midnight")
        .inputValue(),
      "420",
    );
    assert.equal(saved().settings.dayBoundaryMinutes, 360);
    await shot("100-settings-error");
  } finally {
    fs.chmodSync(profile, 0o700);
  }
  await page.getByLabel("Day boundary in minutes after midnight").fill("360");
  await closeApp();
  page = await restart();
  await button("Settings").click();
  assert.equal(
    await page
      .getByLabel("Day boundary in minutes after midnight")
      .inputValue(),
    "360",
  );
  assert.equal(
    await page.getByLabel("Daily focus target in minutes").inputValue(),
    "90",
  );
  assert.equal(
    await page.getByLabel("Reduce motion", { exact: true }).isChecked(),
    true,
  );
  await page.setViewportSize({ width: 620, height: 600 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await button("Save settings").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  assert.ok(
    parseFloat(
      await page.evaluate(
        () => getComputedStyle(document.activeElement).outlineWidth,
      ),
    ) >= 2,
  );
  await shot("100-settings-after");
  record(
    "settings events, invalid and failed save, rapid duplicate, restart and narrow keyboard",
    "passed",
  );
  await button("Export JSON").click();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  spawnSync("grim", [path.join(run, "100-export-during.png")], { env });
  const file = path.join(run, "canonical-export.json");
  const typed = spawnSync(
    "wtype",
    [
      "-M",
      "ctrl",
      "-P",
      "a",
      "-p",
      "a",
      "-m",
      "ctrl",
      "-s",
      "200",
      file,
      "-s",
      "400",
      "-P",
      "Return",
      "-p",
      "Return",
      "-s",
      "500",
      "-M",
      "alt",
      "-P",
      "s",
      "-p",
      "s",
      "-m",
      "alt",
    ],
    { env, encoding: "utf8" },
  );
  assert.equal(typed.status, 0, typed.stderr);
  await wait(() => fs.existsSync(file));
  const loaded = Event.loadJournal(fs.readFileSync(file, "utf8"));
  assert.equal(loaded.ok, true);
  assert.ok(JSON.parse(fs.readFileSync(file)).checksum);
  assert.deepEqual(loaded.journal, journal());
  const replay = new Core(path.join(run, "roundtrip-profile"));
  try {
    replay.importLegacy(fs.readFileSync(file, "utf8"));
    assert.equal(
      replay.status().lifetimeXp,
      (await require("../core/integration.cjs").request(profile, "status"))
        .lifetimeXp,
    );
    assert.deepEqual(replay.snapshot().settings, saved().settings);
  } finally {
    replay.close();
  }
  await page.getByRole("status").filter({ hasText: "Export saved." }).waitFor();
  await shot("100-export-after");
  record(
    "native canonical export and clean-profile roundtrip",
    "checksum, events, settings and XP match",
  );
  await button("Reset this profile").click();
  assert.equal(
    await button("Cancel").evaluate((el) => el === document.activeElement),
    true,
  );
  await shot("100-reset-during");
  await page.keyboard.press("Enter");
  assert.ok(journal().events.some((e) => e.type === "habit.completed"));
  await button("Reset this profile").click();
  await page.keyboard.press("Escape");
  await button("Reset this profile").click();
  await button("Clear this profile").click();
  await page.getByText("No commitments yet.", { exact: true }).waitFor();
  await shot("100-reset-after");
  assert.equal(saved().settings.reducedMotion, false);
  assert.ok(fs.readdirSync(profile).some((n) => n.startsWith("reset-backup-")));
  await wait(
    () => JSON.parse(companionCall("status")).label === "Lv 1 · Wanderer",
  );
  spawnSync("grim", [path.join(run, "100-bar-after.png")], { env });
  await closeApp();
  page = await restart();
  await page.getByText("No commitments yet.", { exact: true }).waitFor();
  assert.equal(
    journal().events.some((e) => e.type === "habit.completed"),
    false,
  );
  record(
    "reset default Cancel, Enter/Escape/reopen, clear and restart",
    "fresh empty state; recovery copy retained",
  );
  return page;
};
