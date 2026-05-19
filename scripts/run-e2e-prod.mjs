import { spawn } from "node:child_process";

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["playwright", "test"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      E2E_BASE_URL: process.env.E2E_BASE_URL || "https://lderly-app.vercel.app"
    }
  }
);

child.on("exit", (code) => {
  process.exit(code || 0);
});
