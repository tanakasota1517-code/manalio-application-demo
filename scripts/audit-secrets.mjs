import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([".git", ".next", "node_modules", "out", "dist", "build", ".vercel"]);
const SKIP_FILES = new Set([".env", ".env.local"]);
const MAX_SCAN_BYTES = 1024 * 1024;
const SENSITIVE_FILE_EXTENSIONS = new Set([".pem", ".key", ".p8", ".p12", ".pfx"]);
const SENSITIVE_FILE_NAMES = new Set(["id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", ".env.production", ".env.preview", ".env.staging"]);

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
  {
    label: "GitHub token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/g,
  },
  {
    label: "AWS access key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    label: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    label: "Vercel token",
    pattern: /\bvercel_[A-Za-z0-9]{20,}\b/g,
  },
  {
    label: "Supabase service role assignment",
    pattern: /\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
  },
];

function shouldScan(file) {
  const name = file.split("/").pop();
  if (SKIP_FILES.has(name)) return false;
  return true;
}

function isSensitiveFileName(file) {
  const name = file.split("/").pop();
  if (name.endsWith(".example") || name.endsWith(".sample") || name.includes(".example.")) return false;
  return SENSITIVE_FILE_NAMES.has(name) || SENSITIVE_FILE_EXTENSIONS.has(extname(name));
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
      if (size <= MAX_SCAN_BYTES) files.push(path);
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
  const displayPath = relative(ROOT, file) || file;
  if (isSensitiveFileName(displayPath)) {
    findings.push({
      file: displayPath,
      label: "Sensitive filename",
      line: 1,
      value: "[content not displayed]",
    });
    continue;
  }

  const buffer = readFileSync(file);
  if (buffer.includes(0)) continue;
  const text = buffer.toString("utf8");

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
