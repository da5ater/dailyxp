const { Core } = require("./core.cjs");
const { profileDirectory, serve } = require("./integration.cjs");
const core = new Core(profileDirectory());
serve(core, () => console.log("open requested"))
  .then((server) => {
    console.log("DailyXP core ready");
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, () => {
        server.close();
        core.close();
        process.exit(0);
      });
  })
  .catch((error) => {
    core.close();
    console.error(error);
    process.exitCode = 1;
  });
