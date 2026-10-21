#!/usr/bin/env node
const { profileDirectory, request } = require("./integration.cjs");
const method = process.argv[2] || "status";
if (!["status", "open", "pause", "resume"].includes(method)) {
  console.error("Usage: dailyxpctl status|open|pause|resume [request-id]");
  process.exitCode = 2;
} else
  request(profileDirectory(), method, process.argv[3])
    .then((value) => console.log(JSON.stringify(value)))
    .catch((error) => {
      console.error(`DailyXP unavailable: ${error.message}`);
      process.exitCode = 1;
    });
