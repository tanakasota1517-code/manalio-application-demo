import { getServerSessionContext, isProductionLikeRuntime, isRestConfigured, shouldFailClosedWhenRestMissing, supabaseRestFetch } from "../../_supabase.js";
import { DEFAULT_SCHOOL_FORMAT, SCHOOL_FORMAT_TEMPLATE_SELECT, isStoredSchoolFormatRowValid, normalizeSchoolFormat, toSchoolFormatRow } from "../../_schoolFormat.js";
import { enforceRateLimit } from "../../_rateLimit.js";
import { enforceSameOriginRequest } from "../../_requestSecurity.js";
import { JsonRequestError, readLimitedJsonBody } from "../../_jsonRequest.js";
import { getPublicErrorDetails } from "../../_publicError.js";
import { logSafeApiError } from "../../_safeErrorLog.js";

export const runtime = "nodejs";

export async function GET(request) {
  if (isPublicDemoOnly()) return publicDemoApiDisabledResponse();

  const sameOriginResponse = enforceSameOriginRequest(request);
  if (sameOriginResponse) return sameOriginResponse;

  if (isProductionLikeRuntime() && !isRestConfigured()) {
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

  let context;
  try {
    context = await requireStaffContext(request);
  } catch (error) {
    logSafeApiError(error, "school_template_context_failed");
    return schoolFormatUnavailableResponse({
      localError: "学校フォーマットを取得できませんでした。",
      localStatus: 500,
    });
  }
  if (context instanceof Response) return context;

  try {
    const rows = await supabaseRestFetch(
      `/school_format_templates?select=${SCHOOL_FORMAT_TEMPLATE_SELECT}&school_id=eq.${encodeURIComponent(context.session.schoolId)}&limit=1`,
    );
    if (!Array.isArray(rows)) throw new Error("school_format_response_invalid");
    if (rows?.[0] && !isStoredSchoolFormatRowValid(rows[0])) throw new Error("school_format_row_invalid");
    return Response.json({
      configured: true,
      schemaReady: true,
      template: rows?.[0] ? normalizeSchoolFormat(rows[0]) : DEFAULT_SCHOOL_FORMAT,
      updatedAt: rows?.[0]?.updated_at || null,
    });
  } catch (error) {
    logSafeApiError(error, "school_template_fetch_failed");
    return schoolFormatUnavailableResponse({
      localError: "学校フォーマット用テーブルがまだ適用されていません。",
    });
  }
}

function schoolFormatUnavailableResponse({ localError, localStatus = 200 }) {
  if (isProductionLikeRuntime()) {
    return Response.json(
      {
        configured: true,
        schemaReady: false,
        code: "school_format_unavailable",
        error: "学校フォーマットを取得できませんでした。少し時間を置いて再試行してください。",
      },
      { status: 503 },
    );
  }

  return Response.json(
    {
      configured: true,
      schemaReady: false,
      template: DEFAULT_SCHOOL_FORMAT,
      error: localError,
    },
    { status: localStatus },
  );
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

  let context;
  try {
    context = await requireStaffContext(request);
  } catch (error) {
    logSafeApiError(error, "school_template_context_failed");
    return Response.json(
      {
        saved: false,
        code: "school_template_save_unavailable",
        error: "学校フォーマットを保存できませんでした。少し時間を置いて再試行してください。",
      },
      { status: 503 },
    );
  }
  if (context instanceof Response) return context;
  if (context.session?.role !== "admin") {
    return Response.json(
      {
        saved: false,
        code: "admin_required",
        error: "学校フォーマットの保存は管理者のみ利用できます。",
      },
      { status: 403 },
    );
  }

  try {
    const body = await readLimitedJson(request, 20000);
    const template = normalizeSchoolFormat(getTemplateInput(body));
    const submittedRow = toSchoolFormatRow(template, context);
    const rows = await supabaseRestFetch("/school_format_templates?on_conflict=school_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: submittedRow,
    });
    if (!isConfirmedSchoolFormatSave(rows, template, submittedRow)) {
      throw new Error("school_format_save_response_invalid");
    }

    return Response.json({
      saved: true,
      template: normalizeSchoolFormat(rows[0]),
      updatedAt: rows[0].updated_at || null,
    });
  } catch (error) {
    const publicError = getPublicErrorDetails(error);
    if (!publicError) {
      logSafeApiError(error, "school_template_save_failed");
    }
    return Response.json(
      {
        saved: false,
        code: publicError && publicError.status < 500 ? publicError.code : "school_template_save_unavailable",
        error: publicError && publicError.status < 500
          ? publicError.publicMessage
          : "学校フォーマットを保存できませんでした。少し時間を置いて再試行してください。",
      },
      { status: publicError && publicError.status < 500 ? publicError.status : 503 },
    );
  }
}

function isConfirmedSchoolFormatSave(rows, template, submittedRow) {
  if (!Array.isArray(rows) || rows.length !== 1) return false;
  const row = rows[0];
  if (
    !isStoredSchoolFormatRowValid(row)
    || row.school_id !== submittedRow.school_id
    || row.updated_by !== submittedRow.updated_by
    || Date.parse(row.updated_at) !== Date.parse(submittedRow.updated_at)
  ) {
    return false;
  }
  return JSON.stringify(normalizeSchoolFormat(row)) === JSON.stringify(template);
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

const SCHOOL_FORMAT_INPUT_KEYS = new Set([
  "diaryHeadings",
  "diary_headings",
  "studentDiaryFieldLabels",
  "student_diary_field_labels",
  "diaryFieldLabels",
  "diary_field_labels",
  "studentDiaryRequirements",
  "student_diary_requirements",
  "planHeadings",
  "plan_headings",
  "checkRules",
  "check_rules",
  "writingStyle",
  "writing_style",
]);

function getTemplateInput(body) {
  const template = Object.hasOwn(body, "template") ? body.template : body;
  const validObject = template && typeof template === "object" && !Array.isArray(template);
  const hasFormatField = validObject && Object.keys(template).some((key) => SCHOOL_FORMAT_INPUT_KEYS.has(key));
  if (hasFormatField && hasCompleteSchoolFormatInput(template)) return template;
  throw new JsonRequestError("invalid_request", "保存する学校フォーマットを入力してください。", 400);
}

function hasCompleteSchoolFormatInput(template) {
  const diaryHeadings = firstOwnValue(template, "diaryHeadings", "diary_headings");
  const fieldLabels = firstOwnValue(
    template,
    "studentDiaryFieldLabels",
    "student_diary_field_labels",
    "diaryFieldLabels",
    "diary_field_labels",
  );
  const requirements = firstOwnValue(template, "studentDiaryRequirements", "student_diary_requirements");
  const planHeadings = firstOwnValue(template, "planHeadings", "plan_headings");
  const checkRules = firstOwnValue(template, "checkRules", "check_rules");
  const writingStyle = firstOwnValue(template, "writingStyle", "writing_style");
  const fieldKeys = ["goalReflection", "episodeMemo", "episodeInsight", "overallLearning", "nextAction"];
  const episodes = requirements?.episodes;

  return isNonEmptyStringList(diaryHeadings, 5, 5)
    && fieldLabels && typeof fieldLabels === "object" && !Array.isArray(fieldLabels)
    && fieldKeys.every((key) => isNonEmptyString(fieldLabels[key]))
    && requirements && typeof requirements === "object" && !Array.isArray(requirements)
    && Array.isArray(requirements.requiredFields) && requirements.requiredFields.length > 0
    && requirements.requiredFields.every((field) => fieldKeys.includes(field))
    && episodes && typeof episodes === "object" && !Array.isArray(episodes)
    && [episodes.initialCount, episodes.requiredCount, episodes.minCount, episodes.maxCount].every(Number.isInteger)
    && 1 <= episodes.minCount && episodes.minCount <= episodes.initialCount
    && episodes.initialCount <= episodes.maxCount && episodes.maxCount <= 8
    && 1 <= episodes.requiredCount && episodes.requiredCount <= episodes.maxCount
    && isNonEmptyStringList(planHeadings, 5, 5)
    && isNonEmptyStringList(checkRules, 3, 8)
    && isNonEmptyString(writingStyle);
}

function firstOwnValue(object, ...keys) {
  const key = keys.find((candidate) => Object.hasOwn(object, candidate));
  return key ? object[key] : undefined;
}

function isNonEmptyStringList(value, min, max) {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every(isNonEmptyString);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
