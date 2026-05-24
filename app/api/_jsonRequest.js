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

  try {
    return JSON.parse(text || "{}");
  } catch {
    throw buildError(options, "invalid_json", options.invalidJsonMessage || "リクエスト形式が不正です。", 400);
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

  const error = new Error(message);
  error.name = "JsonRequestError";
  error.code = code;
  error.publicMessage = message;
  error.status = status;
  return error;
}
