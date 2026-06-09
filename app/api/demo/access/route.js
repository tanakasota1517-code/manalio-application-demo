import { enforceRateLimit } from "../../_rateLimit.js";
import { readLimitedJsonBody } from "../../_jsonRequest.js";
import { enforceSameOriginRequest } from "../../_requestSecurity.js";
import {
  getServerSessionContext,
  isRestConfigured,
  shouldFailClosedWhenRestMissing,
  supabaseRestFetch,
} from "../../_supabase.js";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 20_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_TYPES = new Set([
  "app_open",
  "view_open",
  "student_sample_loaded",
  "student_safety_checked",
  "student_question_generated",
  "student_final_checked",
  "student_final_copied",
]);
const VIEW_IDS = new Set(["diary", "school", "assignments", "students", "review", "formats", "pass"]);
const FLOW_STEPS = new Set(["", "input", "confirm", "revise", "final"]);
const STATUSES = new Set(["", "clear", "review", "blocked", "completed", "copied"]);
const SAMPLE_IDS = new Set(["", "thin-note", "evaluation-words", "privacy-check", "outdoor-play"]);

export async function GET() {
  return jsonNoStore(
    {
      code: "method_not_allowed",
      error: "このエンドポイントはPOSTのみ対応しています。",
    },
    405,
  );
}

export async function POST(request) {
  const originBlocked = enforceSameOriginRequest(request);
  if (originBlocked) return originBlocked;

  const rateLimited = enforceRateLimit(request, {
    namespace: "demo_access",
    limit: 240,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  if (!isAccessLoggingEnabled()) {
    return jsonNoStore({ ok: true, tracked: false, reason: "disabled" });
  }

  if (!isRestConfigured()) {
    if (shouldFailClosedWhenRestMissing()) {
      return jsonNoStore(
        {
          code: "rest_not_configured",
          error: "利用履歴を安全に保存できないため、アクセス履歴の記録を停止しました。",
        },
        503,
      );
    }
    return jsonNoStore({ ok: true, tracked: false, reason: "missing_supabase_env" });
  }

  let body;
  try {
    body = await readLimitedJsonBody(request, MAX_BODY_BYTES, { requireJsonContentType: true });
  } catch (error) {
    return jsonNoStore(
      {
        code: error.code || "invalid_request",
        error: error.publicMessage || "リクエスト形式が不正です。",
      },
      error.status || 400,
    );
  }

  const event = normalizeEvent(body.event);
  if (!event) {
    return jsonNoStore(
      {
        code: "invalid_event",
        error: "記録できないイベント種別です。",
      },
      400,
    );
  }

  try {
    const context = await getServerSessionContext(request);
    if (!context.user?.id || !context.profile) {
      return jsonNoStore(
        {
          code: "unauthorized",
          error: "ログイン後のアクセス履歴だけを記録します。",
        },
        401,
      );
    }

    const actorUserId = normalizeUuid(context.user.id);
    const schoolId = normalizeUuid(context.session?.schoolId || context.profile?.school_id);
    if (!actorUserId || !schoolId) {
      return jsonNoStore(
        {
          code: "profile_not_ready",
          error: "学校と利用者の紐づきが確認できないため、アクセス履歴を記録できません。",
        },
        403,
      );
    }

    await supabaseRestFetch("/audit_logs", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        school_id: schoolId,
        actor_user_id: actorUserId,
        action_type: `teacher_preview.${event}`,
        target_type: "teacher_preview_access",
        target_id: null,
        metadata: buildSafeMetadata(body.metadata, context.session),
      },
    });

    return jsonNoStore({ ok: true, tracked: true });
  } catch (error) {
    console.error("Failed to track teacher preview access:", error.message);
    return jsonNoStore(
      {
        code: "tracking_failed",
        error: "アクセス履歴を記録できませんでした。",
      },
      500,
    );
  }
}

function isAccessLoggingEnabled() {
  return process.env.MANABI_ACCESS_LOG_ENABLED === "true";
}

function normalizeEvent(value) {
  const event = String(value || "").trim();
  return EVENT_TYPES.has(event) ? event : "";
}

function buildSafeMetadata(rawMetadata, session) {
  const metadata = rawMetadata && typeof rawMetadata === "object" ? rawMetadata : {};
  return {
    surface: "teacher_preview",
    role: normalizeRole(session?.role),
    view: normalizeSetValue(metadata.view, VIEW_IDS),
    flowStep: normalizeSetValue(metadata.flowStep, FLOW_STEPS),
    sampleId: normalizeSetValue(metadata.sampleId, SAMPLE_IDS),
    status: normalizeSetValue(metadata.status, STATUSES),
  };
}

function normalizeRole(value) {
  if (value === "teacher" || value === "student" || value === "admin") return value;
  return "unknown";
}

function normalizeSetValue(value, allowedValues) {
  const normalized = String(value || "").trim();
  return allowedValues.has(normalized) ? normalized : "";
}

function normalizeUuid(value) {
  const normalized = String(value || "").trim();
  return UUID_PATTERN.test(normalized) ? normalized : "";
}

function jsonNoStore(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}
