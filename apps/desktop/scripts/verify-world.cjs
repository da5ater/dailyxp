#!/usr/bin/env node
const { _electron: electron } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const { request } = require("../core/integration.cjs");
const { prepareWorld } = require("./world-fixture.cjs");
const repository = path.resolve(__dirname, "../../..");
const run = path.resolve(process.argv[2]);
fs.mkdirSync(run, { mode: 0o700 });
const profile = path.join(run, "profile");
const before = prepareWorld(profile);
assert.ok(before.story.antagonists.some((a) => a.id === "hollow-king"));
function display(action) {
  const result = spawnSync(
    "python",
    [
      "-c",
      `import sys,json\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1])\nimport display\n${action === "start" ? "print(json.dumps(display.start(Path(sys.argv[2]))))" : "display.stop(Path(sys.argv[2]))"}`,
      path.join(repository, "apps/desktop/.agents/skills/verify/scripts"),
      run,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  return action === "start" ? JSON.parse(result.stdout) : null;
}
(async () => {
  let app;
  try {
    const env = display("start");
    const privateHome = path.join(run, "home");
    fs.mkdirSync(privateHome);
    app = await electron.launch({
      executablePath:
        process.env.DAILYXP_VERIFY_EXECUTABLE || require("electron"),
      args: [
        ...(process.env.DAILYXP_VERIFY_EXECUTABLE ? [] : [repository]),
        "--ozone-platform=wayland",
        "--disable-gpu",
      ],
      env: {
        ...env,
        HOME: privateHome,
        XDG_CONFIG_HOME: path.join(privateHome, ".config"),
        XDG_DATA_HOME: path.join(privateHome, ".local/share"),
        DAILYXP_PROFILE: profile,
      },
    });
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "World", exact: true }).click();
    await page
      .getByRole("region", { name: "Hollow King", exact: true })
      .waitFor();
    const resting = page.locator('[data-province-id="return-province"]');
    const reclaimed = page.locator('[data-province-id="reclaimed-province"]');
    await resting.getByText("Hollow King · Resting", { exact: true }).waitFor();
    await reclaimed
      .getByText("Reclaimed · Visitable", { exact: true })
      .waitFor();
    await page.screenshot({
      path: path.join(run, "01-world-resting.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 699, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: path.join(run, "02-world-narrow.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    const actionPage = process.argv[3] === "milestone" ? "Plan" : "Play";
    await page.getByRole("button", { name: actionPage, exact: true }).click();
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    await page.getByRole("button", { name: "World", exact: true }).click();
    assert.equal(
      await page
        .getByRole("region", { name: "Hollow King", exact: true })
        .count(),
      0,
    );
    await resting.getByText("Growing Province", { exact: true }).waitFor();
    assert.ok(
      (await request(profile, "status")).lifetimeXp >=
        before.progression.totals.lifetimeXp,
    );
    await page.screenshot({
      path: path.join(run, "03-world-return.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Private Recovery", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Open private tracks", exact: true })
      .click();
    await page.getByRole("button", { name: "+ Track", exact: true }).click();
    await page
      .getByLabel("Private category name")
      .fill("Never reveal this unfinished input");
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].close(),
    );
    await request(profile, "open");
    await page.waitForFunction(() => !document.hidden);
    assert.equal(await page.locator("#editor[open]").count(), 0);
    assert.equal(await page.getByLabel("Private category name").count(), 0);
    await page
      .getByRole("button", { name: "Private Recovery", exact: true })
      .click();
    await page.getByRole("dialog", { name: "Open private tracks?" }).waitFor();
    await page.keyboard.press("Escape");
    fs.writeFileSync(
      path.join(run, "report.json"),
      JSON.stringify(
        {
          verified: true,
          setup:
            "production commands with controlled clock for seven-day prerequisite",
          before: before.story,
          status: await request(profile, "status"),
          privateWindowClose: "guard reset and unsaved fields cleared",
        },
        null,
        2,
      ),
    );
    console.log(`VERIFIED ${run}`);
  } finally {
    if (app) await app.close();
    display("stop");
    fs.writeFileSync(
      path.join(run, "cleanup.json"),
      JSON.stringify({ stopped: true }),
    );
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
