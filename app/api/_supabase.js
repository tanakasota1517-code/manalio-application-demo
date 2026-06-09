export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_DISABLED = process.env.MANABI_DISABLE_SUPABASE === "true";

export const ACCESS_COOKIE = "manabi_sb_access_token";
export const REFRESH_COOKIE = "manabi_sb_refresh_token";
const SUPABASE_TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS || 10000);

const ROLE_LABELS = {
  admin: "管理者",
  teacher: "教員",
  student: "学生",
};

export function isAuthConfigured() {
  if (SUPABASE_DISABLED) return false;
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function isRestConfigured() {
  if (SUPABASE_DISABLED) return false;
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

export function isProductionLikeRuntime() {
  const explicitRuntime = normalizeRuntimeEnv(process.env.MANABI_RUNTIME_ENV);
  if (["production", "prod", "preview", "staging"].includes(explicitRuntime)) return true;
  if (["development", "dev", "local", "test"].includes(explicitRuntime)) return false;

  const vercelEnv = normalizeRuntimeEnv(process.env.VERCEL_ENV);
  if (["production", "preview"].includes(vercelEnv)) return true;

  return normalizeRuntimeEnv(process.env.NODE_ENV) === "production";
}

export function shouldFailClosedWhenRestMissing() {
  return !SUPABASE_DISABLED && isProductionLikeRuntime() && !isRestConfigured();
}

export async function getAuthenticatedUser(request) {
  if (!isAuthConfigured()) return null;
  const accessToken = getCookieValue(request, ACCESS_COOKIE);
  if (!accessToken) return null;

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

export async function getServerSessionContext(request) {
  const user = await getAuthenticatedUser(request);
  if (!user?.id) return { user: null, profile: null, session: null };

  const profile = await getProfile(user.id);
  const role = normalizeRole(profile?.role);
  const school = profile?.school_id ? await getRowById("schools", profile.school_id) : null;
  const classRecord = profile?.class_id ? await getRowById("classes", profile.class_id) : null;

  return {
    user,
    profile,
    session: {
      source: "supabase",
      userId: user.id,
      email: user.email || "",
      name: profile?.display_name || user.email?.split("@")[0] || "利用者",
      role,
      roleLabel: ROLE_LABELS[role],
      schoolId: profile?.school_id || "",
      classId: profile?.class_id || "",
      schoolName: school?.name || "未設定の学校",
      schoolPlan: school?.plan || "",
      contractStatus: school?.contract_status || "",
      className: classRecord?.name || "未設定のクラス",
    },
  };
}

export async function getProfile(userId) {
  if (!isRestConfigured() || !userId) return null;
  const rows = await supabaseRestFetch(`/profiles?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`);
  return rows?.[0] || null;
}

export async function getRowById(table, id) {
  if (!isRestConfigured() || !id) return null;
  const rows = await supabaseRestFetch(`/${table}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}

export async function supabaseRestFetch(path, options = {}) {
  if (!isRestConfigured()) {
    throw new Error("Supabase REST is not configured");
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1${path}`, {
    method: options.method || "GET",
    signal: AbortSignal.timeout(Number(options.timeoutMs || SUPABASE_TIMEOUT_MS)),
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: options.prefer || "return=representation",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;
  if (!response.ok) {
    const error = new Error("Supabase REST request failed");
    error.status = response.status;
    error.details = text;
    throw error;
  }

  return data;
}

export function getCookieValue(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return "";
}

export function normalizeRole(role) {
  if (role === "admin" || role === "teacher" || role === "student") return role;
  return "student";
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
