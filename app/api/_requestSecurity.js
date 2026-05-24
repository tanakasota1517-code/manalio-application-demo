export function enforceSameOriginRequest(request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return buildBlockedResponse();
  }

  const origin = request.headers.get("origin");
  if (!origin) return null;

  const originUrl = safeUrl(origin);
  if (originUrl && getRequestHosts(request).has(originUrl.host.toLowerCase())) return null;

  return buildBlockedResponse();
}

function getRequestHosts(request) {
  const hosts = new Set();
  try {
    hosts.add(new URL(request.url).host.toLowerCase());
  } catch {
    // If the runtime ever provides a non-URL request value, fall back to Host below.
  }

  const host = request.headers.get("host");
  if (host) hosts.add(host.toLowerCase());
  return hosts;
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
