import { registerPublicError } from "./_publicError.js";

export async function readLimitedJsonBody(request, maxBytes, options = {}) {
  if (options.requireJsonContentType) {
    enforceJsonContentType(request, options);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw buildError(options, "request_too_large", options.tooLargeMessage || "リクエストが大きすぎます。", 413);
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw buildError(options, "request_too_large", options.tooLargeMessage || "リクエストが大きすぎます。", 413);
  }

  let body;
  try {
    body = JSON.parse(text || "{}");
  } catch {
    throw buildError(options, "invalid_json", options.invalidJsonMessage || "リクエスト形式が不正です。", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw buildError(options, "invalid_request", options.invalidRequestMessage || "リクエスト形式が不正です。", 400);
  }
  return body;
}

export class JsonRequestError extends Error {
  constructor(code, publicMessage, status) {
    super(publicMessage);
    this.name = "JsonRequestError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.status = status;
    registerPublicError(this, { code, publicMessage, status });
  }
}

function enforceJsonContentType(request, options) {
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  const mediaType = contentType.split(";")[0].trim();
  if (/^application\/(?:json|[\w.+-]+\+json)$/.test(mediaType)) return;

  throw buildError(
    options,
    "invalid_content_type",
    options.contentTypeMessage || "リクエストのContent-Typeはapplication/jsonにしてください。",
    415,
  );
}

function buildError(options, code, message, status) {
  if (typeof options.errorFactory === "function") {
    return options.errorFactory(code, message, status);
  }

  return new JsonRequestError(code, message, status);
}
