import { enforceRateLimit } from "../_rateLimit.js";
import { enforceSameOriginRequest } from "../_requestSecurity.js";
import { readLimitedJsonBody } from "../_jsonRequest.js";
import { logSafeApiError, logSafeApiWarning } from "../_safeErrorLog.js";
import { getPublicErrorDetails, registerPublicError } from "../_publicError.js";
import { DEFAULT_SCHOOL_FORMAT, getSchoolFormatForSchool, summarizeStudentSchoolFormat } from "../_schoolFormat.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_DISABLED = process.env.MANABI_DISABLE_SUPABASE === "true";

const ACCESS_COOKIE = "manabi_sb_access_token";
const REFRESH_COOKIE = "manabi_sb_refresh_token";
const DEFAULT_CLASS_NAME = "保育実習I / 2年A組";
const ROLE_LABELS = {
  admin: "管理者",
  teacher: "教員",
  student: "学生",
};

export const runtime = "nodejs";

export async function GET(request) {
  if (isPublicDemoOnly()) return publicDemoApiDisabledResponse();

  if (!isAuthConfigured()) {
    if (isProductionLikeRuntime()) {
      return Response.json(
        {
          configured: false,
          publicSignup: false,
          session: null,
          code: "auth_unavailable",
          error: "学校アカウント認証を利用できません。管理者に連絡してください。",
        },
        { status: 503 },
      );
    }
    return Response.json({ configured: false, publicSignup: false, session: null });
  }

  const accessToken = getCookieValue(request, ACCESS_COOKIE);
  const refreshToken = getCookieValue(request, REFRESH_COOKIE);
  if (!accessToken && !refreshToken) {
    return Response.json({ configured: true, publicSignup: isPublicSignupAllowed(), session: null });
  }

  const cookieUpdates = [];

  try {
    let currentAccessToken = accessToken;
    let user = null;
    if (currentAccessToken) {
      try {
        user = await getAuthUser(currentAccessToken);
      } catch (error) {
        if (getPublicErrorDetails(error)?.code !== "session_expired") throw error;
      }
    }

    if (!user && refreshToken) {
      const refreshed = await refreshAuthSession(refreshToken);
      currentAccessToken = refreshed.access_token;
      user = await resolveAuthUser(refreshed);
      cookieUpdates.push(...buildAuthCookies(refreshed, request));
    }

    if (!user) {
      return jsonWithCookies({ configured: true, publicSignup: isPublicSignupAllowed(), session: null }, clearAuthCookies(request));
    }

    const session = await buildSessionFromUser(user, { accessToken: currentAccessToken });
    return jsonWithCookies({ configured: true, publicSignup: isPublicSignupAllowed(), session }, cookieUpdates);
  } catch (error) {
    const publicError = getPublicErrorDetails(error);
    if (publicError?.code === "school_format_unavailable") {
      return jsonWithCookies(
        {
          configured: true,
          publicSignup: isPublicSignupAllowed(),
          session: null,
          code: publicError.code,
          error: publicError.publicMessage,
        },
        cookieUpdates,
        publicError.status,
      );
    }
    if (publicError?.code === "session_expired" && publicError.status === 401) {
      return jsonWithCookies({ configured: true, publicSignup: isPublicSignupAllowed(), session: null }, clearAuthCookies(request));
    }
    if (publicError && publicError.status < 500) {
      return jsonWithCookies(
        {
          configured: true,
          publicSignup: isPublicSignupAllowed(),
          session: null,
          code: publicError.code,
          error: publicError.publicMessage,
        },
        cookieUpdates,
        publicError.status,
      );
    }
    logSafeApiWarning(error, "auth_session_restore_failed");
    return jsonWithCookies(
      {
        configured: true,
        publicSignup: isPublicSignupAllowed(),
        session: null,
        code: "auth_temporarily_unavailable",
        error: "ログイン状態を確認できませんでした。少し時間を置いて再試行してください。",
      },
      cookieUpdates,
      503,
    );
  }
}

export async function POST(request) {
  if (isPublicDemoOnly()) return publicDemoApiDisabledResponse();

  const sameOriginResponse = enforceSameOriginRequest(request);
  if (sameOriginResponse) return sameOriginResponse;

  let body;
  try {
    body = await readLimitedJson(request, 20000);
  } catch (error) {
    const publicError = getPublicErrorDetails(error);
    if (!publicError) {
      logSafeApiError(error, "auth_operation_failed");
    }
    return Response.json(
      {
        ok: false,
        configured: isAuthConfigured(),
        code: publicError?.code || "auth_failed",
        error: publicError?.publicMessage || "認証リクエストを処理できませんでした。少し時間を置いて再試行してください。",
      },
      { status: publicError?.status || 500 },
    );
  }
  const action = body.action;

  if (action === "signOut") {
    return jsonWithCookies({ ok: true }, clearAuthCookies(request));
  }

  const rateLimitResponse = enforceRateLimit(request, {
    namespace: "auth",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  if (!isAuthConfigured()) {
    const unavailable = isProductionLikeRuntime();
    return Response.json(
      {
        ok: false,
        configured: false,
        ...(unavailable ? { code: "auth_unavailable" } : {}),
        error: unavailable
          ? "学校アカウント認証を利用できません。管理者に連絡してください。"
          : "学校アカウント認証が未設定です。確認用ログインを使用してください。",
      },
      { status: unavailable ? 503 : 400 },
    );
  }

  try {
    if (action === "signUp") {
      return await handleSignUp(body, request);
    }
    if (action === "signIn") {
      return await handleSignIn(body, request);
    }
    return Response.json({ ok: false, error: "auth action is invalid" }, { status: 400 });
  } catch (error) {
    const publicError = getPublicErrorDetails(error);
    if (!isExpectedClientAuthError(error)) {
      logSafeApiError(error, "auth_operation_failed");
    }
    return Response.json(
      {
        ok: false,
        configured: true,
        code: publicError?.code || "auth_failed",
        error: publicError?.publicMessage || "ログインに失敗しました。メールアドレスとパスワードを確認してください。",
      },
      { status: publicError?.status || 500 },
    );
  }
}

function isPublicDemoOnly() {
  return process.env["MANABI_PUBLIC_DEMO_ONLY"] === "true";
}

function publicDemoApiDisabledResponse() {
  return Response.json(
    {
      code: "public_demo_api_disabled",
      error: "公開デモでは、このAPIを使用しません。",
    },
    {
      status: 403,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

async function handleSignIn(body, request) {
  const credentials = normalizeCredentials(body);
  const auth = await supabaseAuthFetch("/token?grant_type=password", {
    method: "POST",
    body: {
      email: credentials.email,
      password: credentials.password,
    },
  });
  assertAuthTokenResponse(auth);
  const user = await resolveAuthUser(auth);
  const session = await buildSessionFromUser(user, { ...body, accessToken: auth.access_token });

  return jsonWithCookies(
    {
      ok: true,
      configured: true,
      session,
    },
    buildAuthCookies(auth, request),
  );
}

async function handleSignUp(body, request) {
  if (!isPublicSignupAllowed()) {
    throw new AuthError(
      "signup_disabled",
      "新規登録は学校管理者の招待が必要です。先にユーザーとプロフィールを作成してください。",
      403,
    );
  }

  const credentials = normalizeCredentials(body);
  const userMetadata = {
    display_name: body.name || credentials.email.split("@")[0],
    role: "student",
    school_name: normalizeText(body.schoolName) || "未設定の学校",
    class_name: normalizeText(body.className) || DEFAULT_CLASS_NAME,
  };

  const auth = await supabaseAuthFetch("/signup", {
    method: "POST",
    body: {
      email: credentials.email,
      password: credentials.password,
      data: userMetadata,
    },
  });

  const sessionAuth = auth.session || auth;
  const user = resolveSignUpUser(auth);
  await ensureProfile(user, userMetadata);

  if (!auth.session && !auth.access_token) {
    return Response.json({
      ok: true,
      configured: true,
      needsConfirmation: true,
      message: "確認メールを送信しました。メール認証後にログインしてください。",
    });
  }

  assertAuthTokenResponse(sessionAuth);
  const session = await buildSessionFromUser(user, userMetadata);
  return jsonWithCookies(
    {
      ok: true,
      configured: true,
      session,
    },
    buildAuthCookies(sessionAuth, request),
  );
}

function normalizeCredentials(body) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !email.includes("@")) {
    throw new AuthError("invalid_email", "メールアドレスを入力してください。", 400);
  }
  if (password.length < 8) {
    throw new AuthError("invalid_password", "パスワードは8文字以上で入力してください。", 400);
  }

  return { email, password };
}

async function buildSessionFromUser(user, fallback = {}) {
  if (!isValidAuthUser(user)) throw createAuthTemporarilyUnavailableError();

  let profile = await getProfile(user.id, fallback.accessToken);
  if (!profile) {
    throw new AuthError(
      "profile_required",
      "学校プロフィールが未設定です。管理者にアカウント招待またはプロフィール作成を依頼してください。",
      403,
    );
  }
  if (!profile.school_id) {
    throw new AuthError(
      "school_profile_required",
      "学校プロフィールに学校情報が未設定です。管理者に学校への紐づけを依頼してください。",
      403,
    );
  }

  const metadata = user.user_metadata || {};
  const role = normalizeRole(profile.role);
  const school = profile?.school_id ? await getRowById("schools", profile.school_id, fallback.accessToken) : null;
  const classRecord = profile?.class_id ? await getRowById("classes", profile.class_id, fallback.accessToken) : null;
  if (profile.class_id && (!classRecord || classRecord.school_id !== profile.school_id)) {
    throw new AuthError(
      "class_profile_mismatch",
      "学校プロフィールのクラス情報が学校情報と一致しません。管理者にクラスへの紐づけを確認してください。",
      403,
    );
  }
  const schoolName = school?.name || profile?.school_name || metadata.school_name || fallback.schoolName || "未設定の学校";
  const className = classRecord?.name || profile?.class_name || metadata.class_name || fallback.className || DEFAULT_CLASS_NAME;
  const name = profile?.display_name || metadata.display_name || fallback.name || user.email?.split("@")[0] || "利用者";
  const schoolFormat = await getSessionSchoolFormat(profile.school_id);

  return {
    source: "supabase",
    userId: user.id,
    email: user.email || fallback.email || "",
    name,
    role,
    roleLabel: ROLE_LABELS[role],
    schoolId: profile?.school_id || school?.id || "",
    classId: classRecord?.id || "",
    schoolName,
    schoolPlan: school?.plan || "",
    contractStatus: school?.contract_status || "",
    className,
    schoolFormat,
    signedInAt: new Date().toISOString(),
  };
}

async function getSessionSchoolFormat(schoolId) {
  if (!schoolId) return summarizeStudentSchoolFormat(DEFAULT_SCHOOL_FORMAT);
  if (isProductionLikeRuntime() && !SUPABASE_SERVICE_ROLE_KEY) {
    throw new AuthError(
      "school_format_unavailable",
      "学校フォーマットを取得できませんでした。少し時間を置いて再試行してください。",
      503,
    );
  }
  try {
    return summarizeStudentSchoolFormat(await getSchoolFormatForSchool(schoolId));
  } catch (error) {
    logSafeApiWarning(error, "school_format_session_load_failed");
    if (isProductionLikeRuntime()) {
      throw new AuthError(
        "school_format_unavailable",
        "学校フォーマットを取得できませんでした。少し時間を置いて再試行してください。",
        503,
      );
    }
    return summarizeStudentSchoolFormat(DEFAULT_SCHOOL_FORMAT);
  }
}

async function ensureProfile(user, metadata = {}) {
  if (!isRestConfigured() || !user?.id) return null;

  const schoolName = normalizeText(metadata.school_name || metadata.schoolName) || "未設定の学校";
  const className = normalizeText(metadata.class_name || metadata.className) || DEFAULT_CLASS_NAME;
  const school = await findOrCreateSchool(schoolName);
  const classRecord = await findOrCreateClass(school.id, className);
  const role = normalizeRole(metadata.role);
  const displayName = normalizeText(metadata.display_name || metadata.name) || user.email?.split("@")[0] || "利用者";

  const rows = await supabaseRestFetch("/profiles?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      id: user.id,
      school_id: school.id,
      class_id: classRecord.id,
      role,
      display_name: displayName,
      email: user.email,
    },
  });

  return rows?.[0] || null;
}

async function getProfile(userId, accessToken) {
  if (!isRestConfigured()) return null;
  const rows = await supabaseRestFetch(`/profiles?select=id,school_id,class_id,role,display_name&id=eq.${encodeURIComponent(userId)}&limit=1`, { accessToken });
  if (!Array.isArray(rows) || rows.length > 1) throw createAuthTemporarilyUnavailableError();
  const profile = rows[0] || null;
  if (!profile) return null;
  if (
    profile.id !== userId
    || !Object.hasOwn(ROLE_LABELS, profile.role)
    || (profile.school_id !== null && typeof profile.school_id !== "string")
    || (profile.class_id !== null && typeof profile.class_id !== "string")
  ) {
    throw createAuthTemporarilyUnavailableError();
  }
  return profile;
}

async function getRowById(table, id, accessToken) {
  if (!isRestConfigured() || !id) return null;
  const selectByTable = {
    schools: "id,name,plan,contract_status",
    classes: "id,school_id,name,practicum_label,starts_on,ends_on",
  };
  const select = selectByTable[table];
  if (!select) return null;
  const rows = await supabaseRestFetch(`/${table}?select=${select}&id=eq.${encodeURIComponent(id)}&limit=1`, { accessToken });
  if (!Array.isArray(rows) || rows.length > 1) throw createAuthTemporarilyUnavailableError();
  const row = rows[0] || null;
  if (!row) return null;
  if (row.id !== id || (table === "classes" && typeof row.school_id !== "string")) {
    throw createAuthTemporarilyUnavailableError();
  }
  return row;
}

async function findOrCreateSchool(name) {
  const existing = await supabaseRestFetch(`/schools?select=id,name&name=eq.${encodeURIComponent(name)}&limit=1`);
  if (existing?.[0]) return existing[0];
  const rows = await supabaseRestFetch("/schools", {
    method: "POST",
    body: { name, plan: "pilot", contract_status: "trial" },
  });
  return rows[0];
}

async function findOrCreateClass(schoolId, name) {
  const existing = await supabaseRestFetch(`/classes?select=id,name,school_id&school_id=eq.${encodeURIComponent(schoolId)}&name=eq.${encodeURIComponent(name)}&limit=1`);
  if (existing?.[0]) return existing[0];
  const rows = await supabaseRestFetch("/classes", {
    method: "POST",
    body: { school_id: schoolId, name, practicum_label: "保育実習" },
  });
  return rows[0];
}

async function getAuthUser(accessToken) {
  const user = await supabaseAuthFetch("/user", {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!isValidAuthUser(user)) throw createAuthTemporarilyUnavailableError();
  return user;
}

async function resolveAuthUser(auth) {
  if (auth.user !== undefined && auth.user !== null) {
    if (!isValidAuthUser(auth.user)) throw createAuthTemporarilyUnavailableError();
    return auth.user;
  }
  return getAuthUser(auth.access_token);
}

function resolveSignUpUser(auth) {
  const wrappedUser = auth.user ?? auth.session?.user;
  if (wrappedUser !== undefined && wrappedUser !== null) {
    if (!isValidAuthUser(wrappedUser)) throw createAuthTemporarilyUnavailableError();
    return wrappedUser;
  }
  if (!auth.session && !auth.access_token && isValidAuthUser(auth)) return auth;
  throw createAuthTemporarilyUnavailableError();
}

async function refreshAuthSession(refreshToken) {
  const auth = await supabaseAuthFetch("/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
  assertAuthTokenResponse(auth);
  return auth;
}

async function supabaseAuthFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1${path}`, {
      method: options.method || "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "content-type": "application/json",
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw createAuthTemporarilyUnavailableError();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw mapSupabaseError(data, response.status, path);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw createAuthTemporarilyUnavailableError();
  }

  return data;
}

async function supabaseRestFetch(path, options = {}) {
  const useUserToken = Boolean(options.accessToken);
  const apiKey = useUserToken ? SUPABASE_ANON_KEY : SUPABASE_SERVICE_ROLE_KEY;
  const authorization = useUserToken ? `Bearer ${options.accessToken}` : `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  let response;
  try {
    response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1${path}`, {
      method: options.method || "GET",
      headers: {
        apikey: apiKey,
        authorization,
        "content-type": "application/json",
        prefer: options.prefer || "return=representation",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw createAuthTemporarilyUnavailableError();
  }

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;
  if (!response.ok) {
    throw createAuthTemporarilyUnavailableError();
  }
  if (!Array.isArray(data)) throw createAuthTemporarilyUnavailableError();

  return data;
}

function mapSupabaseError(data, status, path = "") {
  if (status >= 500) return createAuthTemporarilyUnavailableError();
  const source = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const message = String(source.msg || source.message || source.error_description || source.error || "");
  const lowered = message.toLowerCase();
  const providerCode = String(source.code || source.error_code || "").trim().toLowerCase();

  if (
    [400, 401].includes(status)
    && path.includes("grant_type=password")
    && (providerCode === "invalid_credentials" || lowered.includes("invalid login"))
  ) {
    return new AuthError("invalid_login", "メールアドレスまたはパスワードが違います。", 401);
  }
  if (status === 422 && lowered.includes("already")) {
    return new AuthError("already_registered", "このメールアドレスはすでに登録されています。ログインしてください。", 409);
  }
  if (status === 429) {
    return new AuthError("auth_rate_limit", "ログイン試行が多すぎます。少し時間を置いてください。", 429);
  }
  if ([400, 401].includes(status) && isConfirmedSessionExpiry(providerCode, lowered, path)) {
    return new AuthError("session_expired", "ログインの有効期限が切れました。もう一度ログインしてください。", 401);
  }
  if (status === 401) return createAuthTemporarilyUnavailableError();
  return new AuthError("auth_failed", "学校アカウント認証でエラーが発生しました。", 500);
}

function isConfirmedSessionExpiry(providerCode, message, path) {
  const isUserLookup = path === "/user";
  const isRefresh = path.includes("grant_type=refresh_token");
  if (!isUserLookup && !isRefresh) return false;

  if (
    isUserLookup
    && ["bad_jwt", "session_expired", "session_not_found", "user_not_found"].includes(providerCode)
  ) {
    return true;
  }
  if (
    isRefresh
    && [
      "refresh_token_not_found",
      "refresh_token_already_used",
      "session_expired",
      "session_not_found",
      "user_not_found",
    ].includes(providerCode)
  ) {
    return true;
  }
  if (isUserLookup && ["invalid token", "jwt expired", "token has expired"].some((term) => message.includes(term))) return true;
  return isRefresh
    && message.includes("refresh token")
    && ["invalid", "not found", "already used", "expired"].some((term) => message.includes(term));
}

function assertAuthTokenResponse(auth) {
  if (!isNonEmptyString(auth?.access_token) || !isNonEmptyString(auth?.refresh_token)) {
    throw createAuthTemporarilyUnavailableError();
  }
}

function isValidAuthUser(user) {
  return Boolean(user && typeof user === "object" && !Array.isArray(user) && isNonEmptyString(user.id));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function createAuthTemporarilyUnavailableError() {
  return new AuthError(
    "auth_temporarily_unavailable",
    "学校アカウント認証を一時的に利用できません。少し時間を置いて再試行してください。",
    503,
  );
}

function buildAuthCookies(auth, request) {
  const accessToken = auth.access_token;
  const refreshToken = auth.refresh_token;
  if (!accessToken || !refreshToken) return [];
  const accessMaxAge = Number(auth.expires_in || 3600);
  const secure = shouldUseSecureCookies(request);
  return [
    serializeCookie(ACCESS_COOKIE, accessToken, { maxAge: accessMaxAge, secure }),
    serializeCookie(REFRESH_COOKIE, refreshToken, { maxAge: 60 * 60 * 24 * 30, secure }),
  ];
}

function clearAuthCookies(request) {
  const secure = shouldUseSecureCookies(request);
  return [
    serializeCookie(ACCESS_COOKIE, "", { maxAge: 0, secure }),
    serializeCookie(REFRESH_COOKIE, "", { maxAge: 0, secure }),
  ];
}

function serializeCookie(name, value, options = {}) {
  const secure = options.secure ? "; Secure" : "";
  const maxAge = Number(options.maxAge || 0);
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Strict; HttpOnly${secure}`;
}

function shouldUseSecureCookies(request) {
  const override = normalizeRuntimeEnv(process.env.MANABI_COOKIE_SECURE);
  if (override === "true") return true;

  try {
    if (new URL(request?.url || "").protocol === "https:") return true;
  } catch {
    // Invalid or missing request URL falls back to environment-based detection.
  }

  const vercelEnv = normalizeRuntimeEnv(process.env.VERCEL_ENV);
  if (["production", "preview"].includes(vercelEnv)) return true;

  return normalizeRuntimeEnv(process.env.NODE_ENV) === "production";
}

function jsonWithCookies(payload, cookieHeaders = [], status = 200) {
  const response = Response.json(payload, { status });
  for (const cookie of cookieHeaders) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

function isAuthConfigured() {
  if (SUPABASE_DISABLED) return false;
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function isRestConfigured() {
  if (SUPABASE_DISABLED) return false;
  return Boolean(SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY));
}

function isPublicSignupAllowed() {
  return process.env.MANABI_ALLOW_PUBLIC_SIGNUP === "true" && !isProductionLikeRuntime();
}

function isProductionLikeRuntime() {
  const vercelEnv = normalizeRuntimeEnv(process.env.VERCEL_ENV);
  if (["production", "preview"].includes(vercelEnv)) return true;

  const explicitRuntime = normalizeRuntimeEnv(process.env.MANABI_RUNTIME_ENV);
  if (["production", "prod", "preview", "staging"].includes(explicitRuntime)) return true;
  if (["development", "dev", "local", "test"].includes(explicitRuntime)) return false;

  return normalizeRuntimeEnv(process.env.NODE_ENV) === "production";
}

function normalizeRole(role) {
  if (role === "admin" || role === "teacher" || role === "student") return role;
  return "student";
}

function normalizeText(value) {
  return String(value || "").trim();
}

async function readLimitedJson(request, maxBytes) {
  return readLimitedJsonBody(request, maxBytes, {
    requireJsonContentType: true,
    contentTypeMessage: "認証リクエストのContent-Typeはapplication/jsonにしてください。",
    tooLargeMessage: "認証リクエストが大きすぎます。",
    invalidJsonMessage: "認証リクエストの形式が不正です。",
    errorFactory: (code, message, status) => new AuthError(code, message, status),
  });
}

function getCookieValue(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      try {
        return decodeURIComponent(rawValue.join("="));
      } catch {
        return "";
      }
    }
  }
  return "";
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeRuntimeEnv(value) {
  return String(value || "").trim().toLowerCase();
}

class AuthError extends Error {
  constructor(code, publicMessage, status = 500) {
    super(publicMessage);
    const safeStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
    this.name = "AuthError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.status = safeStatus;
    registerPublicError(this, { code, publicMessage, status: safeStatus });
  }
}

function isExpectedClientAuthError(error) {
  const details = getPublicErrorDetails(error);
  return details !== null && details.status >= 400 && details.status < 500;
}
