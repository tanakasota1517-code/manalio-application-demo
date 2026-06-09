import { getServerSessionContext, isRestConfigured, shouldFailClosedWhenRestMissing, supabaseRestFetch } from "../../_supabase.js";
import { DEFAULT_SCHOOL_FORMAT, normalizeSchoolFormat, toSchoolFormatRow } from "../../_schoolFormat.js";
import { enforceRateLimit } from "../../_rateLimit.js";
import { enforceSameOriginRequest } from "../../_requestSecurity.js";
import { readLimitedJsonBody } from "../../_jsonRequest.js";

export const runtime = "nodejs";

export async function GET(request) {
  if (isPublicDemoOnly()) return publicDemoApiDisabledResponse();

  const sameOriginResponse = enforceSameOriginRequest(request);
  if (sameOriginResponse) return sameOriginResponse;

  if (shouldFailClosedWhenRestMissing()) {
    return Response.json(
      {
        configured: false,
        schemaReady: false,
        code: "rest_not_configured",
        error: "学校フォーマット保存設定が未完了のため、標準フォーマット表示へ戻さず停止しています。",
      },
      { status: 503 },
    );
  }

  if (!isRestConfigured()) {
    return Response.json({
      configured: false,
      schemaReady: false,
      template: DEFAULT_SCHOOL_FORMAT,
      message: "学校フォーマット保存先が未設定のため、標準フォーマットを表示しています。",
    });
  }

  const context = await requireStaffContext(request);
  if (context instanceof Response) return context;

  try {
    const rows = await supabaseRestFetch(
      `/school_format_templates?select=diary_headings,plan_headings,check_rules,writing_style,updated_at&school_id=eq.${encodeURIComponent(context.session.schoolId)}&limit=1`,
    );
    return Response.json({
      configured: true,
      schemaReady: true,
      template: rows?.[0] ? normalizeSchoolFormat(rows[0]) : DEFAULT_SCHOOL_FORMAT,
      updatedAt: rows?.[0]?.updated_at || null,
    });
  } catch (error) {
    console.error("School template fetch failed:", error.details || error.message);
    return Response.json({
      configured: true,
      schemaReady: false,
      template: DEFAULT_SCHOOL_FORMAT,
      error: "学校フォーマット用テーブルがまだ適用されていません。",
    });
  }
}

export async function PUT(request) {
  if (isPublicDemoOnly()) return publicDemoApiDisabledResponse();

  const sameOriginResponse = enforceSameOriginRequest(request);
  if (sameOriginResponse) return sameOriginResponse;

  if (shouldFailClosedWhenRestMissing()) {
    return Response.json(
      {
        saved: false,
        code: "rest_not_configured",
        error: "学校フォーマット保存設定が未完了のため保存できません。",
      },
      { status: 503 },
    );
  }

  if (!isRestConfigured()) {
    return Response.json({ error: "学校フォーマット保存先が未設定のため保存できません。" }, { status: 503 });
  }

  const rateLimitResponse = enforceRateLimit(request, {
    namespace: "school-template-save",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const context = await requireStaffContext(request);
  if (context instanceof Response) return context;

  try {
    const body = await readLimitedJson(request, 20000);
    const template = normalizeSchoolFormat(body.template || body);
    const rows = await supabaseRestFetch("/school_format_templates?on_conflict=school_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: toSchoolFormatRow(template, context),
    });

    return Response.json({
      saved: true,
      template: normalizeSchoolFormat(rows?.[0] || template),
      updatedAt: rows?.[0]?.updated_at || null,
    });
  } catch (error) {
    console.error("School template save failed:", error.details || error.message);
    return Response.json(
      {
        saved: false,
        error: error.status ? error.message : "学校フォーマットを保存できませんでした。管理者に連絡してください。",
      },
      { status: error.status || 500 },
    );
  }
}

async function requireStaffContext(request) {
  const context = await getServerSessionContext(request);
  if (!context.user?.id) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }
  if (!["teacher", "admin"].includes(context.session?.role)) {
    return Response.json({ error: "学校フォーマット設定は教員・管理者のみ利用できます。" }, { status: 403 });
  }
  if (!context.session?.schoolId) {
    return Response.json({ error: "学校プロフィールが未設定です。" }, { status: 403 });
  }
  return context;
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

async function readLimitedJson(request, maxBytes) {
  return readLimitedJsonBody(request, maxBytes, {
    requireJsonContentType: true,
    contentTypeMessage: "学校フォーマット保存リクエストのContent-Typeはapplication/jsonにしてください。",
    tooLargeMessage: "リクエストが大きすぎます。",
    invalidJsonMessage: "リクエスト形式が不正です。",
  });
}
