export function enforceSameOriginRequest(request) {
  const fetchSite = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") {
    return buildBlockedResponse();
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    if (isUnsafeMethod(request.method) && !isBrowserSameOriginFetch(fetchSite)) return buildBlockedResponse();
    return null;
  }

  const originUrl = safeUrl(origin);
  if (originUrl && getAllowedOrigins(request).has(originUrl.origin.toLowerCase())) return null;

  return buildBlockedResponse();
}

function isUnsafeMethod(method) {
  return !["GET", "HEAD", "OPTIONS"].includes(String(method || "GET").toUpperCase());
}

function isBrowserSameOriginFetch(fetchSite) {
  return fetchSite === "same-origin";
}

function getAllowedOrigins(request) {
  const origins = new Set();
  const configuredOrigin = safeUrl(process.env.MANABI_APP_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || "");
  if (configuredOrigin) origins.add(configuredOrigin.origin.toLowerCase());

  try {
    origins.add(new URL(request.url).origin.toLowerCase());
  } catch {
    // If the runtime ever provides a non-URL request value, fall back to Host below.
  }

  const host = request.headers.get("host");
  if (host) {
    const proto = String(request.headers.get("x-forwarded-proto") || safeUrl(request.url)?.protocol?.replace(":", "") || "https")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const scheme = proto === "http" ? "http" : "https";
    origins.add(`${scheme}://${host.toLowerCase()}`);
  }
  return origins;
}

function buildBlockedResponse() {
  return Response.json(
    {
      code: "cross_origin_blocked",
      error: "許可されていない送信元からのリクエストです。",
    },
    {
      status: 403,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
