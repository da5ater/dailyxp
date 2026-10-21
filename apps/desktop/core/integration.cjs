const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

function profileDirectory() {
  return path.resolve(
    process.env.DAILYXP_PROFILE ||
      path.join(
        process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local/state"),
        "dailyxp-desktop",
      ),
  );
}
function socketPath(profile) {
  return path.join(profile, "integration.sock");
}
function serve(core, open) {
  const socket = socketPath(core.directory);
  if (fs.existsSync(socket)) fs.unlinkSync(socket);
  const server = net.createServer((client) => {
    let pending = "";
    client.setEncoding("utf8");
    client.setTimeout(5000, () => client.destroy());
    client.on("error", () => {});
    client.on("data", (chunk) => {
      pending += chunk;
      if (Buffer.byteLength(pending) > 8192) {
        client.destroy();
        return;
      }
      const newline = pending.indexOf("\n");
      if (newline < 0) return;
      let id = null;
      try {
        const request = JSON.parse(pending.slice(0, newline));
        id = request.id;
        if (
          request.version !== 1 ||
          typeof id !== "string" ||
          !id ||
          id.length > 128
        )
          throw new Error("Invalid protocol request");
        const handlers = {
          status: () => core.status(),
          open: () => {
            open();
            return { opened: true };
          },
          pause: () => core.execute("session", { type: "session.pause" }, id),
          resume: () => core.execute("session", { type: "session.resume" }, id),
        };
        if (!Object.hasOwn(handlers, request.method))
          throw new Error("Unsupported integration method");
        const result = handlers[request.method]();
        client.end(JSON.stringify({ version: 1, id, ok: true, result }) + "\n");
      } catch (error) {
        client.end(
          JSON.stringify({ version: 1, id, ok: false, error: error.message }) +
            "\n",
        );
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socket, () => {
      fs.chmodSync(socket, 0o600);
      resolve(server);
    });
  });
}
function request(profile, method, id = crypto.randomUUID()) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath(profile));
    let raw = "";
    client.setEncoding("utf8");
    client.setTimeout(5000, () =>
      client.destroy(new Error("DailyXP did not respond")),
    );
    client.on("error", reject);
    client.on("connect", () =>
      client.write(JSON.stringify({ version: 1, id, method }) + "\n"),
    );
    client.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 65536) client.destroy(new Error("Invalid response"));
    });
    client.on("end", () => {
      try {
        const result = JSON.parse(raw);
        if (!result.ok) throw new Error(result.error);
        resolve(result.result);
      } catch (error) {
        reject(error);
      }
    });
  });
}
module.exports = { profileDirectory, socketPath, serve, request };
