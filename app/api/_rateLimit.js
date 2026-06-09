import { createHash } from "node:crypto";

const buckets = globalThis.__manabiRateLimitBuckets || new Map();
globalThis.__manabiRateLimitBuckets = buckets;

const MAX_BUCKETS = 5000;
let requestsSincePrune = 0;

export function enforceRateLimit(request, options = {}) {
  const namespace = options.namespace || "default";
  const limit = normalizePositiveInteger(options.limit, 60);
  const windowMs = normalizePositiveInteger(options.windowMs, 60_000);
  const now = Date.now();
  pruneExpiredBuckets(now);

  const key = `${namespace}:${getClientIdentifier(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  current.count += 1;
  if (current.count <= limit) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return Response.json(
    {
      code: "rate_limited",
      error: "リクエストが多すぎます。少し時間を置いてから再試行してください。",
    },
    {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(retryAfterSeconds),
      },
    },
  );
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.floor(number);
}

function pruneExpiredBuckets(now) {
  requestsSincePrune += 1;
  if (requestsSincePrune < 100 && buckets.size < 1000) return;

  requestsSincePrune = 0;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  pruneOverflowBuckets();
}

function pruneOverflowBuckets() {
  if (buckets.size <= MAX_BUCKETS) return;
  const overflow = buckets.size - MAX_BUCKETS;
  const oldestKeys = [...buckets.entries()]
    .sort(([, left], [, right]) => left.resetAt - right.resetAt)
    .slice(0, overflow)
    .map(([key]) => key);
  for (const key of oldestKeys) {
    buckets.delete(key);
  }
}

function getClientIdentifier(request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rawIdentifier = (
    forwardedFor ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("fly-client-ip") ||
    "local"
  );
  return normalizeClientIdentifier(rawIdentifier);
}

function normalizeClientIdentifier(value) {
  const normalized = String(value || "").replace(/[\r\n\t ]+/g, " ").trim();
  if (!normalized || normalized === "local") return "local";
  const bounded = normalized.slice(0, 512);
  return createHash("sha256").update(bounded).digest("hex").slice(0, 32);
}
