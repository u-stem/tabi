// Dev environment setup: Docker Compose orchestrates DB + API + schema + seed
const ROOT = import.meta.dir.replace("/scripts", "");

function run(cmd: string[]) {
  const proc = Bun.spawnSync(cmd, {
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`Command failed: ${cmd.join(" ")}`);
  }
}

async function main() {
  console.log("\n[1/2] Starting all services (db + api + init)...");
  run(["docker", "compose", "--profile", "init", "up", "-d"]);

  console.log("\n[2/2] Waiting for init to complete...");
  run(["docker", "compose", "logs", "-f", "init"]);

  console.log("\nSetup complete! API is running at http://localhost:3001");
  console.log("Run 'bun run --filter @sugara/web dev' to start the web app.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
