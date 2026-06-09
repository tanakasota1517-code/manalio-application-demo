import { getServerSessionContext, isRestConfigured, shouldFailClosedWhenRestMissing, supabaseRestFetch } from "../_supabase.js";
import { enforceRateLimit } from "../_rateLimit.js";
import { enforceSameOriginRequest } from "../_requestSecurity.js";
import { readLimitedJsonBody } from "../_jsonRequest.js";
import {
  sanitizeClientResultForLog,
  sanitizeFeedbackForLog,
  sanitizeResultMetaForLog,
} from "../_privacy.js";

const TABLES = {
  feedback: "feedback_logs",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

export async function GET() {
  if (isPublicDemoOnly()) {
    return Response.json(
      {
        persisted: false,
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

  return Response.json(
    {
      code: "method_not_allowed",
      error: "このAPIはログ保存専用です。",
    },
    { status: 405 },
  );
}

export async function POST(request) {
  try {
    if (isPublicDemoOnly()) {
      return Response.json(
        {
          persisted: false,
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

    const sameOriginResponse = enforceSameOriginRequest(request);
    if (sameOriginResponse) return sameOriginResponse;

    const rateLimitResponse = enforceRateLimit(request, {
      namespace: "logs",
      limit: 120,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await readLimitedJson(request, 200000);
    const type = normalizeType(body.type);
    const record = body.record;

    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return Response.json({ error: "record is required" }, { status: 400 });
    }

    if (shouldFailClosedWhenRestMissing()) {
      return Response.json(
        {
          persisted: false,
          code: "rest_not_configured",
          error: "学校データ保存設定が未完了のため、ログ保存を停止しています。",
        },
        { status: 503 },
      );
    }

    if (!isRestConfigured()) {
      return Response.json({
        persisted: false,
        reason: "missing_supabase_env",
      });
    }

    const context = await getServerSessionContext(request);
    if (!context.user?.id) {
      return Response.json(
        {
          persisted: false,
          code: "auth_required",
          error: "ログ保存にはログインが必要です。",
        },
        { status: 401 },
      );
    }
    if (!context.profile?.id) {
      return Response.json(
        {
          persisted: false,
          code: "profile_required",
          error: "学校プロフィールが未設定のため、ログを保存できません。",
        },
        { status: 403 },
      );
    }

    const trustedRecord = {
      ...record,
      session: buildLogSession({
        ...(record.session || {}),
        ...context.session,
      }),
    };
    const generationId = await resolveFeedbackGenerationId(context, trustedRecord);
    const row = buildFeedbackRow(trustedRecord, generationId);
    const result = await insertSupabaseRow(TABLES[type], row);

    return Response.json({
      persisted: true,
      table: TABLES[type],
      id: result.id || row.id || null,
    });
  } catch (error) {
    if (!isExpectedClientLogError(error)) {
      console.error("Log persistence failed:", error.details || error.message);
    }
    return Response.json(
      {
        persisted: false,
        code: error.code || "log_persistence_failed",
        error: error.publicMessage || "ログ保存に失敗しました。画面上のローカル保存は継続されています。",
      },
      { status: error.status || 500 },
    );
  }
}

function isPublicDemoOnly() {
  return process.env["MANABI_PUBLIC_DEMO_ONLY"] === "true";
}

function isExpectedClientLogError(error) {
  return error instanceof LogError && error.status >= 400 && error.status < 500;
}

function buildLogSession(session = {}) {
  return {
    source: session.source || "supabase",
    userId: session.userId || "",
    name: session.name || "利用者",
    role: session.role || "student",
    roleLabel: session.roleLabel || "",
    schoolId: session.schoolId || "",
    classId: session.classId || "",
    schoolName: session.schoolName || "",
    schoolPlan: session.schoolPlan || "",
    contractStatus: session.contractStatus || "",
    className: session.className || "",
  };
}

async function readLimitedJson(request, maxBytes) {
  return readLimitedJsonBody(request, maxBytes, {
    requireJsonContentType: true,
    contentTypeMessage: "ログ保存リクエストのContent-Typeはapplication/jsonにしてください。",
    tooLargeMessage: "ログ保存リクエストが大きすぎます。",
    invalidJsonMessage: "ログ保存リクエストの形式が不正です。",
    errorFactory: (code, message, status) => new LogError(code, message, status),
  });
}

function normalizeType(type) {
  if (type === "generation") {
    throw new LogError("client_generation_log_disabled", "AI確認記録は生成API側で保存されます。", 403);
  }
  if (type === "feedback") return type;
  throw new LogError("unsupported_log_type", "ログ種別が不正です。", 400);
}

async function resolveFeedbackGenerationId(context, record) {
  const requestedId = normalizeUuid(record.generationId || record.resultMeta?.generationId || record.result?.generationId);
  if (!requestedId || !isRestConfigured()) return null;
  if (!context.session.schoolId) return null;

  const query = [
    "/generation_logs?select=id",
    `id=eq.${encodeURIComponent(requestedId)}`,
    `user_id=eq.${encodeURIComponent(context.user.id)}`,
    `school_id=eq.${encodeURIComponent(context.session.schoolId || "")}`,
    "limit=1",
  ].join("&");
  const rows = await supabaseRestFetch(query).catch((error) => {
    console.warn("Feedback generation link check skipped:", error.details || error.message);
    return [];
  });
  return rows?.[0]?.id || null;
}

function buildFeedbackRow(record, generationId = null) {
  const resultMeta = record.resultMeta || record.result?.meta || {};
  const session = record.session || resultMeta.session || {};
  return removeUndefined({
    id: normalizeUuid(record.id),
    school_id: normalizeUuid(session.schoolId),
    class_id: normalizeUuid(session.classId),
    user_id: normalizeUuid(session.userId),
    generation_id: generationId,
    kind: resultMeta.kind || "feedback",
    feedback: sanitizeFeedbackForLog(record.feedback),
    result_meta: sanitizeResultMeta(record.resultMeta),
    result: sanitizeResult(record.result),
    session,
  });
}

function sanitizeResultMeta(resultMeta) {
  if (!resultMeta || typeof resultMeta !== "object" || Array.isArray(resultMeta)) return null;
  return sanitizeNestedSession(sanitizeResultMetaForLog(resultMeta));
}

function sanitizeResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result || null;
  const sanitized = sanitizeNestedSession(sanitizeClientResultForLog(result));
  return {
    headings: sanitized.headings,
    checks: sanitized.checks,
    schoolFormat: sanitized.schoolFormat,
    sanitized: true,
  };
}

function sanitizeNestedSession(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeNestedSession);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "session") {
      sanitized[key] = buildLogSession(child);
      continue;
    }
    sanitized[key] = sanitizeNestedSession(child);
  }
  return sanitized;
}

function normalizeUuid(value) {
  if (typeof value === "string" && UUID_PATTERN.test(value)) return value;
  return undefined;
}

function removeUndefined(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

async function insertSupabaseRow(table, row) {
  const rows = await supabaseRestFetch(`/${table}`, {
    method: "POST",
    prefer: "return=representation",
    body: row,
  }).catch((error) => {
    throw new LogError("supabase_insert_failed", "ログ保存に失敗しました。少し時間を置いて再試行してください。", 502, error.details || error.message);
  });
  return rows?.[0] || {};
}

class LogError extends Error {
  constructor(code, publicMessage, status = 500, details = "") {
    super(publicMessage);
    this.name = "LogError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.status = status;
    this.details = details;
  }
}
