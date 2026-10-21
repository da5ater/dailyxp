const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { Core } = require("../core/core.cjs");
const { serve, socketPath } = require("../core/integration.cjs");
test("integration rejects malformed, oversized and unsupported requests without mutation", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dailyxp-protocol-"));
  const core = new Core(dir);
  const server = await serve(core, () => {});
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    core.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const revision = core.status().revision;
  const exchange = (raw) =>
    new Promise((resolve) => {
      const client = net.createConnection(socketPath(dir));
      let response = "";
      client.on("connect", () => client.write(raw));
      client.on("data", (chunk) => (response += chunk));
      client.on("close", () => resolve(response));
    });
  assert.equal(JSON.parse(await exchange("{broken\n")).ok, false);
  assert.equal(
    JSON.parse(
      await exchange('{"version":2,"id":"request","method":"pause"}\n'),
    ).ok,
    false,
  );
  assert.equal(await exchange("x".repeat(8193)), "");
  assert.equal(core.status().revision, revision);
  assert.equal(fs.statSync(socketPath(dir)).mode & 0o777, 0o600);
});
