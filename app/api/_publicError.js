const PUBLIC_ERROR_DETAILS = new WeakMap();
const PUBLIC_ERROR_CODE_PATTERN = /^[a-z0-9_]{1,80}$/;
const DEFAULT_PUBLIC_ERROR_MESSAGE = "処理を完了できませんでした。少し時間を置いて再試行してください。";

export function registerPublicError(error, details) {
  if ((typeof error !== "object" || error === null) && typeof error !== "function") return error;
  if (!details || typeof details !== "object" || Array.isArray(details)) return error;
  try {
    const code = typeof details.code === "string" && PUBLIC_ERROR_CODE_PATTERN.test(details.code)
      ? details.code
      : "server_error";
    const publicMessage = typeof details.publicMessage === "string" && details.publicMessage.trim()
      ? details.publicMessage.trim().slice(0, 500)
      : DEFAULT_PUBLIC_ERROR_MESSAGE;
    const status = Number.isInteger(details.status) && details.status >= 400 && details.status <= 599
      ? details.status
      : 500;
    PUBLIC_ERROR_DETAILS.set(error, Object.freeze({ code, publicMessage, status }));
  } catch {
    return error;
  }
  return error;
}

export function getPublicErrorDetails(error) {
  if ((typeof error !== "object" || error === null) && typeof error !== "function") return null;
  return PUBLIC_ERROR_DETAILS.get(error) || null;
}
