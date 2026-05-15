import { execFileSync, spawn } from "node:child_process";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3210";
const port = new URL(baseUrl).port || "3000";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const useShell = process.platform === "win32";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let serverExitCode = null;

const waitForServer = async () => {
  const deadline = Date.now() + 45_000;
  let lastError = "";

  while (Date.now() < deadline) {
    if (serverExitCode !== null) {
      throw new Error(`Next server exited before readiness with code ${serverExitCode}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/system/status`, {
        cache: "no-store"
      });

      if (response.ok) {
        return;
      }

      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "fetch failed";
    }

    await wait(1_000);
  }

  throw new Error(`Next server did not become ready at ${baseUrl}: ${lastError}`);
};

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(useShell ? [command, ...args].join(" ") : command, useShell ? [] : args, {
      stdio: "inherit",
      shell: useShell,
      ...options
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });

const server = spawn(
  useShell ? `${npmCommand} start -- -p ${port}` : npmCommand,
  useShell ? [] : ["start", "--", "-p", port],
  {
  stdio: "inherit",
  shell: useShell,
  env: {
    ...process.env,
    PORT: port
  }
  }
);

server.on("exit", (code) => {
  serverExitCode = code;
});

const stopServer = () => {
  if (!server.killed) {
    if (process.platform === "win32" && server.pid) {
      try {
        execFileSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
          stdio: "ignore"
        });
      } catch {
        server.kill("SIGTERM");
      }
    } else {
      server.kill("SIGTERM");
    }
  }
};

process.on("exit", stopServer);
process.on("SIGINT", () => {
  stopServer();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopServer();
  process.exit(143);
});

try {
  await waitForServer();
  await run(npmCommand, ["run", "smoke:production"], {
    env: {
      ...process.env,
      SMOKE_BASE_URL: baseUrl
    }
  });
} finally {
  stopServer();
}
