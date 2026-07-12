import {
  buildStudentProcessEventWriteRow,
  isStudentProcessServerPersistenceEnabled,
  loadStudentProcessPersistenceState,
} from "../../_studentProcessPersistence.js";
import { readLimitedJsonBody } from "../../_jsonRequest.js";
import { getPublicErrorDetails } from "../../_publicError.js";
import { enforceRateLimit, enforceScopedRateLimit } from "../../_rateLimit.js";
import { enforceSameOriginRequest } from "../../_requestSecurity.js";
import { logSafeApiError } from "../../_safeErrorLog.js";
import {
  getServerSessionContext,
  isRestConfigured,
  shouldFailClosedWhenRestMissing,
  supabaseRestFetch,
} from "../../_supabase.js";

export const runtime = "nodejs";

export async function GET() {
  if (isPublicDemoOnly()) return publicDemoApiDisabledResponse();
  return Response.json(
    {
      code: "method_not_allowed",
      error: "このAPIは学生プロセスの保存と削除にだけ使用します。",
    },
    { status: 405, headers: { allow: "POST, DELETE" } },
  );
}

export async function POST(request) {
  if (isPublicDemoOnly()) return publicDemoApiDisabledResponse();
  const receivedAt = new Date().toISOString();
  let boundary;
  try {
    boundary = await requireStudentPersistenceContext(request, "student-process-write", 80);
  } catch (error) {
    logSafeApiError(error, "student_process_context_failed");
    return Response.json(
      {
        persisted: false,
        code: "student_process_persistence_failed",
        error: "学生プロセス情報を保存できませんでした。入力内容は失われません。",
      },
      { status: 500 },
    );
  }
  if (boundary instanceof Response) return boundary;

  try {
    const body = await readLimitedJson(request, 30_000);
    const row = buildStudentProcessEventWriteRow({
      context: boundary.context,
      event: body.event || body,
      policy: boundary.state.policy,
      now: receivedAt,
    });
    if (!row) {
      return Response.json(
        {
          persisted: false,
          code: "invalid_student_process_event",
          error: "保存できる学生プロセス情報ではありません。",
        },
        { status: 400 },
      );
    }

    const persistedId = await supabaseRestFetch("/rpc/upsert_student_process_event", {
      method: "POST",
      body: { p_event: row },
    });

    if (!persistedId) {
      return Response.json({
        persisted: false,
        superseded: true,
        processDate: row.process_date,
        stage: row.stage,
      });
    }

    return Response.json({
      persisted: true,
      processDate: row.process_date,
      stage: row.stage,
      expiresAt: row.expires_at,
    });
  } catch (error) {
    const publicError = getPublicErrorDetails(error);
    if (!isExpectedClientError(error)) {
      logSafeApiError(error, "student_process_persistence_failed");
    }
    return Response.json(
      {
        persisted: false,
        code: publicError?.code || "student_process_persistence_failed",
        error: publicError?.publicMessage || "学生プロセス情報を保存できませんでした。入力内容は失われません。",
      },
      { status: publicError?.status || 500 },
    );
  }
}

export async function DELETE(request) {
  if (isPublicDemoOnly()) return publicDemoApiDisabledResponse();
  let boundary;
  try {
    boundary = await requireStudentPersistenceContext(request, "student-process-delete", 20, { requireWriteGate: false });
  } catch (error) {
    logSafeApiError(error, "student_process_context_failed");
    return Response.json(
      {
        deleted: false,
        code: "student_process_delete_failed",
        error: "学生プロセス情報を削除できませんでした。",
      },
      { status: 500 },
    );
  }
  if (boundary instanceof Response) return boundary;

  const { context } = boundary;
  const query = [
    "/student_process_events?school_id=eq." + encodeURIComponent(context.session.schoolId),
    "class_id=eq." + encodeURIComponent(context.session.classId),
    "user_id=eq." + encodeURIComponent(context.user.id),
  ].join("&");

  try {
    await supabaseRestFetch(query, {
      method: "DELETE",
      prefer: "return=minimal",
    });
    return Response.json({ deleted: true });
  } catch (error) {
    logSafeApiError(error, "student_process_delete_failed");
    return Response.json(
      {
        deleted: false,
        code: "student_process_delete_failed",
        error: "学生プロセス情報を削除できませんでした。",
      },
      { status: 500 },
    );
  }
}

async function requireStudentPersistenceContext(request, namespace, limit, options = {}) {
  const requireWriteGate = options.requireWriteGate !== false;
  if (isPublicDemoOnly()) return publicDemoApiDisabledResponse();

  const sameOriginResponse = enforceSameOriginRequest(request);
  if (sameOriginResponse) return sameOriginResponse;

  const rateLimitResponse = enforceRateLimit(request, {
    namespace: `${namespace}-ip`,
    limit: 1000,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  if (requireWriteGate && !isStudentProcessServerPersistenceEnabled()) {
    return Response.json(
      {
        persisted: false,
        code: "student_process_persistence_disabled",
        error: "学生プロセスのサーバー保存は現在無効です。",
      },
      { status: 403 },
    );
  }

  if (shouldFailClosedWhenRestMissing() || !isRestConfigured()) {
    return Response.json(
      {
        persisted: false,
        code: "rest_not_configured",
        error: "学校データ保存設定が未完了のため、学生プロセス保存を停止しています。",
      },
      { status: 503 },
    );
  }

  const context = await getServerSessionContext(request);
  if (!context.user?.id) {
    return Response.json({ persisted: false, code: "auth_required", error: "ログインが必要です。" }, { status: 401 });
  }
  if (context.session?.role !== "student") {
    return Response.json(
      { persisted: false, code: "student_required", error: "学生アカウントだけが保存できます。" },
      { status: 403 },
    );
  }
  if (!context.session?.schoolId || !context.session?.classId) {
    return Response.json(
      { persisted: false, code: "student_scope_required", error: "学校とクラスの設定が必要です。" },
      { status: 403 },
    );
  }

  const userRateLimitResponse = enforceScopedRateLimit(context.user.id, {
    namespace: `${namespace}-user`,
    limit,
    windowMs: 10 * 60 * 1000,
  });
  if (userRateLimitResponse) return userRateLimitResponse;

  if (!requireWriteGate) return { context, state: null };

  const state = await loadStudentProcessPersistenceState(context.session.schoolId, { runtimeEnabled: true });
  if (!state.gate.canServerPersistNow) {
    return Response.json(
      {
        persisted: false,
        code: "school_student_process_policy_required",
        error: "学校の保存方針が未設定のため、学生プロセス保存を停止しています。",
      },
      { status: 403 },
    );
  }

  return { context, state };
}

async function readLimitedJson(request, maxBytes) {
  return readLimitedJsonBody(request, maxBytes, {
    requireJsonContentType: true,
    contentTypeMessage: "学生プロセス保存リクエストのContent-Typeはapplication/jsonにしてください。",
    tooLargeMessage: "学生プロセス保存リクエストが大きすぎます。",
    invalidJsonMessage: "学生プロセス保存リクエストの形式が不正です。",
  });
}

function isExpectedClientError(error) {
  const details = getPublicErrorDetails(error);
  return details !== null && details.status >= 400 && details.status < 500;
}

function isPublicDemoOnly() {
  return process.env["MANABI_PUBLIC_DEMO_ONLY"] === "true";
}

function publicDemoApiDisabledResponse() {
  return Response.json(
    {
      persisted: false,
      code: "public_demo_api_disabled",
      error: "公開デモでは、このAPIを使用しません。",
    },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}
