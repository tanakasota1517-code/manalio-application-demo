import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([".git", ".next", "node_modules", "out"]);
const SKIP_FILES = new Set([".env", ".env.local"]);
const TEXT_EXTENSIONS = new Set([
  "",
  ".css",
  ".env.example",
  ".example",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".svg",
  ".txt",
]);

const SECRET_PATTERNS = [
  {
    label: "OpenAI/Anthropic API key",
    pattern: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{24,}\b/g,
  },
  {
    label: "Supabase/JWT key",
    pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    label: "Private key block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    label: "Slack token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
];

function extensionOf(file) {
  if (file.endsWith(".env.example") || file.endsWith(".local.example")) return ".env.example";
  const dot = file.lastIndexOf(".");
  return dot === -1 ? "" : file.slice(dot);
}

function shouldScan(file) {
  const name = file.split("/").pop();
  if (SKIP_FILES.has(name)) return false;
  return TEXT_EXTENSIONS.has(extensionOf(file));
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...walk(path));
      continue;
    }

    if (entry.isFile() && shouldScan(path)) {
      const size = statSync(path).size;
      if (size <= 1024 * 1024) files.push(path);
    }
  }

  return files;
}

function redact(value) {
  if (value.length <= 12) return "[redacted]";
  return `${value.slice(0, 6)}...[redacted]...${value.slice(-4)}`;
}

function lineNumberFor(text, index) {
  return text.slice(0, index).split("\n").length;
}

const findings = [];

for (const file of walk(ROOT)) {
  const text = readFileSync(file, "utf8");
  const displayPath = relative(ROOT, file) || file;

  for (const { label, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      findings.push({
        file: displayPath,
        label,
        line: lineNumberFor(text, match.index ?? 0),
        value: redact(match[0]),
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Secret audit failed.");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.label}: ${finding.value}`);
  }
  process.exit(1);
}

console.log("Secret audit passed.");
