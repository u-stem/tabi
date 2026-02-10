// Dev environment setup: Docker -> DB schema -> API start -> Seed
const API_URL = "http://localhost:3001";
const DB_PORT = 5432;
const ROOT = import.meta.dir.replace("/scripts", "");

function run(cmd: string[], opts?: { cwd?: string }) {
  const proc = Bun.spawnSync(cmd, {
    cwd: opts?.cwd ?? ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`Command failed: ${cmd.join(" ")}`);
  }
}

async function waitForPort(port: number, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const socket = await Bun.connect({
        hostname: "localhost",
        port,
        socket: {
          data() {},
          open(socket) {
            socket.end();
          },
          error() {},
        },
      });
      socket.end();
      return;
    } catch {
      await Bun.sleep(500);
    }
  }
  throw new Error(`Timeout waiting for port ${port}`);
}

async function waitForApi(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await Bun.sleep(500);
  }
  throw new Error("Timeout waiting for API server");
}

async function main() {
  // 1. Start PostgreSQL
  console.log("\n[1/4] Starting PostgreSQL...");
  run(["docker", "compose", "up", "-d"]);
  await waitForPort(DB_PORT);
  console.log("  PostgreSQL is ready");

  // 2. Push DB schema
  console.log("\n[2/4] Pushing DB schema...");
  run(["bun", "run", "db:push"]);

  // 3. Start API server in background
  console.log("\n[3/4] Starting API server...");
  const apiProc = Bun.spawn(["bun", "run", "--filter", "@tabi/api", "dev"], {
    cwd: ROOT,
    stdout: "ignore",
    stderr: "ignore",
  });
  await waitForApi();
  console.log("  API server is ready");

  // 4. Seed
  console.log("\n[4/4] Seeding database...");
  try {
    run(["bun", "run", "db:seed"]);
  } finally {
    apiProc.kill();
    await apiProc.exited;
  }

  console.log("\nSetup complete! Run 'bun run dev' to start development.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
