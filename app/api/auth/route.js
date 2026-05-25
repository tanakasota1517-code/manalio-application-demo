import { enforceRateLimit } from "../_rateLimit.js";
import { enforceSameOriginRequest } from "../_requestSecurity.js";
import { readLimitedJsonBody } from "../_jsonRequest.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_DISABLED = process.env.MANABI_DISABLE_SUPABASE === "true";

const ACCESS_COOKIE = "manabi_sb_access_token";
const REFRESH_COOKIE = "manabi_sb_refresh_token";
const DEFAULT_CLASS_NAME = "保育実習I / 2年A組";
const ALLOW_PUBLIC_SIGNUP = process.env.MANABI_ALLOW_PUBLIC_SIGNUP === "true";
const ROLE_LABELS = {
  admin: "管理者",
  teacher: "教員",
  student: "学生",
};

export const runtime = "nodejs";

export async function GET(request) {
  if (!isAuthConfigured()) {
    return Response.json({ configured: false, publicSignup: false, session: null });
  }

  const accessToken = getCookieValue(request, ACCESS_COOKIE);
  const refreshToken = getCookieValue(request, REFRESH_COOKIE);
  if (!accessToken && !refreshToken) {
    return Response.json({ configured: true, publicSignup: ALLOW_PUBLIC_SIGNUP, session: null });
  }

  const cookieUpdates = [];

  try {
    let currentAccessToken = accessToken;
    let user = null;
    if (currentAccessToken) {
      user = await getAuthUser(currentAccessToken).catch(() => null);
    }

    if (!user && refreshToken) {
      const refreshed = await refreshAuthSession(refreshToken);
      currentAccessToken = refreshed.access_token;
      user = refreshed.user || (currentAccessToken ? await getAuthUser(currentAccessToken) : null);
      cookieUpdates.push(...buildAuthCookies(refreshed));
    }

    if (!user) {
      return jsonWithCookies({ configured: true, publicSignup: ALLOW_PUBLIC_SIGNUP, session: null }, clearAuthCookies());
    }

    const session = await buildSessionFromUser(user, { accessToken: currentAccessToken });
    return jsonWithCookies({ configured: true, publicSignup: ALLOW_PUBLIC_SIGNUP, session }, cookieUpdates);
  } catch (error) {
    console.warn("Supabase session restore failed:", error.message);
    return jsonWithCookies({ configured: true, publicSignup: ALLOW_PUBLIC_SIGNUP, session: null }, clearAuthCookies());
  }
}

export async function POST(request) {
  const sameOriginResponse = enforceSameOriginRequest(request);
  if (sameOriginResponse) return sameOriginResponse;

  let body;
  try {
    body = await readLimitedJson(request, 20000);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        configured: isAuthConfigured(),
        code: error.code || "invalid_request",
        error: error.publicMessage || "認証リクエストの形式が不正です。",
      },
      { status: error.status || 400 },
    );
  }
  const action = body.action;

  if (action === "signOut") {
    return jsonWithCookies({ ok: true }, clearAuthCookies());
  }

  const rateLimitResponse = enforceRateLimit(request, {
    namespace: "auth",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  if (!isAuthConfigured()) {
    return Response.json(
      {
        ok: false,
        configured: false,
        error: "学校アカウント認証が未設定です。確認用ログインを使用してください。",
      },
      { status: 400 },
    );
  }

  try {
    if (action === "signUp") {
      return handleSignUp(body);
    }
    if (action === "signIn") {
      return handleSignIn(body);
    }
    return Response.json({ ok: false, error: "auth action is invalid" }, { status: 400 });
  } catch (error) {
    console.error("Supabase auth failed:", error.details || error.message);
    return Response.json(
      {
        ok: false,
        configured: true,
        code: error.code || "auth_failed",
        error: error.publicMessage || "ログインに失敗しました。メールアドレスとパスワードを確認してください。",
      },
      { status: error.status || 500 },
    );
  }
}

async function handleSignIn(body) {
  const credentials = normalizeCredentials(body);
  const auth = await supabaseAuthFetch("/token?grant_type=password", {
    method: "POST",
    body: {
      email: credentials.email,
      password: credentials.password,
    },
  });
  const user = auth.user || (auth.access_token ? await getAuthUser(auth.access_token) : null);
  const session = await buildSessionFromUser(user, { ...body, accessToken: auth.access_token });

  return jsonWithCookies(
    {
      ok: true,
      configured: true,
      session,
    },
    buildAuthCookies(auth),
  );
}

async function handleSignUp(body) {
  if (!ALLOW_PUBLIC_SIGNUP) {
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

  const user = auth.user || auth.session?.user;
  if (user) {
    await ensureProfile(user, userMetadata);
  }

  if (!auth.session && !auth.access_token) {
    return Response.json({
      ok: true,
      configured: true,
      needsConfirmation: true,
      message: "確認メールを送信しました。メール認証後にログインしてください。",
    });
  }

  const session = await buildSessionFromUser(user, userMetadata);
  return jsonWithCookies(
    {
      ok: true,
      configured: true,
      session,
    },
    buildAuthCookies(auth.session || auth),
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
  if (!user?.id) {
    throw new AuthError("missing_user", "ユーザー情報を取得できませんでした。", 502);
  }

  let profile = await getProfile(user.id, fallback.accessToken);
  if (!profile) {
    throw new AuthError(
      "profile_required",
      "学校プロフィールが未設定です。管理者にアカウント招待またはプロフィール作成を依頼してください。",
      403,
    );
  }

  const metadata = user.user_metadata || {};
  const role = normalizeRole(profile.role);
  const school = profile?.school_id ? await getRowById("schools", profile.school_id, fallback.accessToken) : null;
  const classRecord = profile?.class_id ? await getRowById("classes", profile.class_id, fallback.accessToken) : null;
  const schoolName = school?.name || profile?.school_name || metadata.school_name || fallback.schoolName || "未設定の学校";
  const className = classRecord?.name || profile?.class_name || metadata.class_name || fallback.className || DEFAULT_CLASS_NAME;
  const name = profile?.display_name || metadata.display_name || fallback.name || user.email?.split("@")[0] || "利用者";

  return {
    source: "supabase",
    userId: user.id,
    email: user.email || fallback.email || "",
    name,
    role,
    roleLabel: ROLE_LABELS[role],
    schoolId: profile?.school_id || school?.id || "",
    classId: profile?.class_id || classRecord?.id || "",
    schoolName,
    schoolPlan: school?.plan || "",
    contractStatus: school?.contract_status || "",
    className,
    signedInAt: new Date().toISOString(),
  };
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
  const rows = await supabaseRestFetch(`/profiles?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`, { accessToken });
  return rows?.[0] || null;
}

async function getRowById(table, id, accessToken) {
  if (!isRestConfigured() || !id) return null;
  const rows = await supabaseRestFetch(`/${table}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`, { accessToken });
  return rows?.[0] || null;
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
  return supabaseAuthFetch("/user", {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

async function refreshAuthSession(refreshToken) {
  return supabaseAuthFetch("/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

async function supabaseAuthFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "content-type": "application/json",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw mapSupabaseError(data, response.status);
  }

  return data;
}

async function supabaseRestFetch(path, options = {}) {
  const useUserToken = Boolean(options.accessToken);
  const apiKey = useUserToken ? SUPABASE_ANON_KEY : SUPABASE_SERVICE_ROLE_KEY;
  const authorization = useUserToken ? `Bearer ${options.accessToken}` : `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: apiKey,
      authorization,
      "content-type": "application/json",
      prefer: options.prefer || "return=representation",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;
  if (!response.ok) {
    throw new AuthError("supabase_rest_failed", "学校・クラス情報の保存に失敗しました。", 502, text);
  }

  return data;
}

function mapSupabaseError(data, status) {
  const message = String(data.msg || data.message || data.error_description || data.error || "");
  const lowered = message.toLowerCase();

  if (status === 400 && lowered.includes("invalid login")) {
    return new AuthError("invalid_login", "メールアドレスまたはパスワードが違います。", 401, message);
  }
  if (status === 422 && lowered.includes("already")) {
    return new AuthError("already_registered", "このメールアドレスはすでに登録されています。ログインしてください。", 409, message);
  }
  if (status === 429) {
    return new AuthError("auth_rate_limit", "ログイン試行が多すぎます。少し時間を置いてください。", 429, message);
  }

  return new AuthError("auth_failed", "学校アカウント認証でエラーが発生しました。", status || 500, message);
}

function buildAuthCookies(auth) {
  const accessToken = auth.access_token;
  const refreshToken = auth.refresh_token;
  if (!accessToken || !refreshToken) return [];
  const accessMaxAge = Number(auth.expires_in || 3600);
  return [
    serializeCookie(ACCESS_COOKIE, accessToken, { maxAge: accessMaxAge }),
    serializeCookie(REFRESH_COOKIE, refreshToken, { maxAge: 60 * 60 * 24 * 30 }),
  ];
}

function clearAuthCookies() {
  return [
    serializeCookie(ACCESS_COOKIE, "", { maxAge: 0 }),
    serializeCookie(REFRESH_COOKIE, "", { maxAge: 0 }),
  ];
}

function serializeCookie(name, value, options = {}) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = Number(options.maxAge || 0);
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Strict; HttpOnly${secure}`;
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
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
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

class AuthError extends Error {
  constructor(code, publicMessage, status = 500, details = "") {
    super(publicMessage);
    this.name = "AuthError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.status = status;
    this.details = details;
  }
}
