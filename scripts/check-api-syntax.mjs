import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["app/api"];
const files = roots.flatMap((root) => collectJsFiles(root));
let failures = 0;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status === 0) {
    console.log(`OK ${file}`);
    continue;
  }

  failures += 1;
  console.log(`FAIL ${file}`);
  if (result.stderr) console.log(result.stderr.trim());
}

if (failures > 0) {
  console.error(`API syntax check failed: ${failures} file(s).`);
  process.exit(1);
}

console.log("API syntax check passed.");

function collectJsFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return collectJsFiles(path);
    return path.endsWith(".js") ? [path] : [];
  });
}
