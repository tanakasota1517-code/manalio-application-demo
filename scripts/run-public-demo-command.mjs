import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const allowedCommands = new Set(["dev", "build", "start"]);
const [command, ...args] = process.argv.slice(2);

if (!allowedCommands.has(command)) {
  console.error("Usage: node scripts/run-public-demo-command.mjs <dev|build|start> [next args...]");
  process.exit(1);
}

const nextCli = resolve("node_modules/next/dist/bin/next");
if (!existsSync(nextCli)) {
  console.error("Next.js CLI was not found. Run npm install inside this public demo repository first.");
  process.exit(1);
}

const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  MANABI_PUBLIC_DEMO_ONLY: "true",
  MANABI_USE_MOCK: "true",
  MANABI_DISABLE_SUPABASE: "true",
  MANABI_ALLOW_PUBLIC_SIGNUP: "false",
  NEXT_PUBLIC_MANABI_SHOW_DEMO_SHORTCUTS: "false",
  NEXT_PUBLIC_MANABI_ENABLE_LOG_EXPORTS: "false",
  NEXT_PUBLIC_MANABI_ENABLE_STUDENT_PROCESS_PERSISTENCE: "false",
  MANABI_STUDENT_PROCESS_SERVER_PERSISTENCE: "false",
  MANABI_BEDROCK_GUARDRAIL_MODE: "off",
  MANABI_RUNTIME_ENV: command === "dev" ? "local" : "preview",
};

const result = spawnSync(process.execPath, [nextCli, command, ...args], {
  stdio: "inherit",
  env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.signal) {
  console.error(`Next.js ${command} stopped by signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 0);
