const { _electron: electron } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { request } = require("../core/integration.cjs");
const repository = path.resolve(__dirname, "../../..");
const run = path.resolve(process.argv[2]);
fs.mkdirSync(run, { mode: 0o700 });
const profile = path.join(run, "profile");
function display(start) {
  const result = spawnSync(
    "python",
    [
      "-c",
      `import sys,json;from pathlib import Path;sys.path.insert(0,sys.argv[1]);import display;r=Path(sys.argv[2]);${start ? "print(json.dumps(display.start(r)))" : "display.stop(r)"}`,
      path.join(repository, "apps/desktop/.agents/skills/verify/scripts"),
      run,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw Error(result.stderr);
  return start ? JSON.parse(result.stdout) : null;
}
function record(action, value) {
  fs.appendFileSync(
    path.join(run, "actions.jsonl"),
    JSON.stringify({ at: new Date().toISOString(), action, value }) + "\n",
  );
}
function journal() {
  return JSON.parse(
    JSON.parse(fs.readFileSync(path.join(profile, "desktop.json"))).envelope
      .payload.eventJournalRaw,
  );
}
(async () => {
  let app, env, page;
  try {
    env = display(true);
    fs.mkdirSync(path.join(run, "home"));
    const launch = async () => {
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
          HOME: path.join(run, "home"),
          XDG_CONFIG_HOME: path.join(run, "home/.config"),
          XDG_DATA_HOME: path.join(run, "home/.local/share"),
          DAILYXP_PROFILE: profile,
        },
        timeout: 30000,
      });
      page = await app.firstWindow();
      await page
        .getByRole("button", { name: "Day blocks", exact: true })
        .waitFor();
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(profile, "writer.lock"))).pid,
        app.process().pid,
      );
      await request(profile, "status");
      record("owned app ready", { pid: app.process().pid, profile });
    };
    const button = (name) => page.getByRole("button", { name, exact: true });
    const shot = async (label) => {
      await page.screenshot({
        path: path.join(run, label + ".png"),
        fullPage: true,
      });
    };
    await launch();
    await button("Day blocks").click();
    await page.getByText("No day blocks yet.", { exact: true }).waitFor();
    assert.equal(
      journal().events.some((e) => e.type.startsWith("dayblocks.")),
      false,
    );
    await shot("01-empty");
    const create = async (name, duration, tasks = []) => {
      await button("+ Block").click();
      await page.getByLabel("Block name", { exact: true }).fill(name);
      await page.getByLabel("Block duration in minutes").fill(String(duration));
      for (const [title, target] of tasks) {
        await button("+ Task target").click();
        const row = page.locator("[data-task-row]").last();
        await row.getByLabel("Task name", { exact: true }).fill(title);
        await row
          .getByLabel("Target minutes", { exact: true })
          .fill(String(target));
      }
      await button("Save").click();
      await page.getByRole("heading", { name, exact: true }).waitFor();
    };
    await create("Life and health", 1);
    await button("+ Block").click();
    await button("Save").click();
    assert.equal(await page.locator("#editor").isVisible(), true);
    await page
      .getByLabel("Block name", { exact: true })
      .fill("Learn and create");
    await page.getByLabel("Block duration in minutes").fill("2");
    for (const name of ["Read one page", "Sketch an idea"]) {
      await button("+ Task target").click();
      const row = page.locator("[data-task-row]").last();
      await row.getByLabel("Task name", { exact: true }).fill(name);
      await row.getByLabel("Target minutes", { exact: true }).fill("1");
    }
    const rows = page.locator("[data-task-row]");
    await rows
      .last()
      .getByRole("button", { name: "Move task up", exact: true })
      .click();
    assert.equal(
      await rows.first().getByLabel("Task name", { exact: true }).inputValue(),
      "Sketch an idea",
    );
    await rows
      .first()
      .getByRole("button", { name: "Move task down", exact: true })
      .click();
    await button("+ Task target").click();
    await rows
      .last()
      .getByLabel("Task name", { exact: true })
      .fill("Long text ".repeat(24));
    await page.setViewportSize({ width: 620, height: 600 });
    await shot("02-editor-narrow");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    await rows
      .last()
      .getByRole("button", { name: "Remove task target", exact: true })
      .click();
    fs.chmodSync(profile, 0o500);
    try {
      await button("Save").click();
      await page
        .locator("#form-error")
        .filter({ hasText: "could not save" })
        .waitFor();
      assert.equal(
        await page.getByLabel("Block name", { exact: true }).inputValue(),
        "Learn and create",
      );
      await shot("03-save-error");
    } finally {
      fs.chmodSync(profile, 0o700);
    }
    await button("Save").click();
    await page
      .getByRole("heading", { name: "Learn and create", exact: true })
      .waitFor();
    const learning = () =>
      page.locator("[data-block-id]").filter({
        has: page.getByRole("heading", {
          name: "Learn and create",
          exact: true,
        }),
      });
    await learning()
      .getByRole("button", { name: "Move block up", exact: true })
      .click();
    assert.equal(
      await page.locator(".block-card h2").first().innerText(),
      "Learn and create",
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await shot("04-plan-ready");
    const start = learning().getByRole("button", {
      name: "Start block",
      exact: true,
    });
    await start.focus();
    await page.keyboard.press("Space");
    await page.getByRole("region", { name: "Current day block" }).waitFor();
    const started = journal().events.find(
      (e) => e.type === "dayblocks.block.started",
    );
    assert.ok(started);
    assert.equal(
      journal().events.filter((e) => e.type === "dayblocks.block.started")
        .length,
      1,
    );
    assert.equal(await button("+ Block").count(), 0);
    await shot("05-running");
    await button("Play").click();
    await button("Free Session").click();
    await button("Pause Session").waitFor();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await button("Pause Session").click();
    await button("Resume Session").waitFor();
    const focusBefore = (await request(profile, "status")).session
      .focusedMilliseconds;
    await app.close();
    await launch();
    await button("Resume Session").waitFor();
    assert.equal(
      (await request(profile, "status")).session.focusedMilliseconds,
      focusBefore,
    );
    await button("Day blocks").click();
    assert.equal(
      journal().events.filter((e) => e.type === "dayblocks.block.started")
        .length,
      1,
    );
    await page
      .getByRole("heading", { name: "Read one page", exact: true })
      .waitFor();
    await button("Play").click();
    record("break, paused Session and app restart", {
      focusedMilliseconds: focusBefore,
      startedAtUtc: started.payload.atUtc,
    });
    await page
      .locator("#day-block-reminder")
      .filter({ hasText: "Read one page reached its target." })
      .waitFor({ timeout: 80000 });
    assert.equal((await request(profile, "status")).session.status, "paused");
    await shot("06-target-away");
    await button("View day block").click();
    await page
      .getByRole("heading", { name: "Time to move on?", exact: true })
      .waitFor();
    await shot("07-task-prompt");
    const advance = button("Next task");
    await advance.focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", { name: "Sketch an idea", exact: true })
      .waitFor();
    assert.equal(
      journal().events.filter((e) => e.type === "dayblocks.task.advanced")
        .length,
      1,
    );
    await page.setViewportSize({ width: 620, height: 600 });
    await shot("08-task-after");
    await page
      .getByRole("heading", {
        name: "Learn and create reached its time limit.",
        exact: true,
      })
      .waitFor({ timeout: 80000 });
    assert.equal(
      await page
        .getByRole("heading", { name: "Time to move on?", exact: true })
        .count(),
      0,
    );
    await shot("09-block-prompt");
    assert.equal(
      journal().events.filter((e) => e.type === "dayblocks.block.started")
        .length,
      1,
    );
    const beforeNext = Date.now();
    await button("Start next block").dblclick();
    const active = page.getByRole("region", { name: "Current day block" });
    await active
      .getByRole("heading", { name: "Life and health", exact: true })
      .waitFor();
    const starts = journal().events.filter(
      (e) => e.type === "dayblocks.block.started",
    );
    assert.equal(starts.length, 2);
    assert.ok(Date.parse(starts[1].payload.atUtc) >= beforeNext);
    assert.ok(Date.now() - Date.parse(starts[1].payload.atUtc) < 10000);
    assert.equal(
      starts[1].payload.blockId,
      journal()
        .events.find(
          (e) =>
            e.type === "dayblocks.plan.saved" && e.payload.blocks.length === 2,
        )
        .payload.blocks.find((b) => b.title === "Life and health").id,
    );
    await shot("10-next-block");
    await page
      .getByRole("heading", {
        name: "Life and health reached its time limit.",
        exact: true,
      })
      .waitFor({ timeout: 80000 });
    await button("Finish plan").focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", { name: "Day plan finished.", exact: true })
      .waitFor();
    assert.equal((await request(profile, "status")).lifetimeXp, 0);
    assert.equal((await request(profile, "status")).session.status, "paused");
    await shot("11-finished");
    await button("New day plan").click();
    await page.getByText("No day blocks yet.", { exact: true }).waitFor();
    await button("+ Block").click();
    await page.keyboard.press("Escape");
    await button("+ Block").click();
    await page.keyboard.press("Escape");
    await button("+ Block").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    assert.ok(
      parseFloat(
        await page.evaluate(
          () => getComputedStyle(document.activeElement).outlineWidth,
        ),
      ) >= 2,
    );
    await create("Temporary block", 1);
    await button("Remove block").click();
    await page.getByText("No day blocks yet.", { exact: true }).waitFor();
    await button("Settings").click();
    await page.getByLabel("Reduce motion", { exact: true }).check();
    await page.locator('body[data-reduced="true"]').waitFor();
    await button("Day blocks").click();
    await shot("12-new-plan");
    record("complete explicit execution", {
      xp: 0,
      sessionStillPaused: true,
      starts: starts.length,
      finishedWithoutTaskCompletion: true,
    });
    await app.close();
    await launch();
    await button("Day blocks").click();
    await page.getByText("No day blocks yet.", { exact: true }).waitFor();
    assert.equal(
      journal().events.some(
        (e) =>
          e.type.includes("task.completed") ||
          e.type.includes("occurrence.transition"),
      ),
      false,
    );
    const longName = "W".repeat(240);
    await create(longName, 1, [[longName, 1]]);
    await button("Start block").click();
    for (const width of [1276, 620]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
        false,
      );
      await shot(`13-long-active-${width}`);
    }
    record(
      "unbroken maximum names",
      "active block and task wrap at desktop and narrow widths",
    );
    fs.writeFileSync(
      path.join(run, "report.json"),
      JSON.stringify(
        {
          verified: true,
          profile,
          events: journal().events.length,
          sourceRevision: spawnSync("git", ["rev-parse", "HEAD"], {
            cwd: repository,
            encoding: "utf8",
          }).stdout.trim(),
          realClock: true,
          configuredBlockMinutes: 3,
          sessionFocusPreserved: true,
        },
        null,
        2,
      ),
    );
    console.log("VERIFIED " + run);
  } finally {
    if (app) await app.close();
    if (env) display(false);
    if (fs.existsSync(profile)) {
      fs.chmodSync(profile, 0o700);
      fs.renameSync(profile, path.join(run, "persisted-profile"));
    }
    fs.writeFileSync(
      path.join(run, "cleanup.json"),
      JSON.stringify({
        ownedAppStopped: true,
        ownedDisplayStopped: !!env,
        evidenceRetained: true,
      }),
    );
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
