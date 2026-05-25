import { getServerSessionContext, isAuthConfigured, isRestConfigured, supabaseRestFetch } from "../_supabase.js";
import { buildSchoolFormatPromptBlock, getSchoolFormatForSchool, summarizeSchoolFormat } from "../_schoolFormat.js";
import { buildHoikuGuidelinePromptBlock } from "../_hoikuGuideline.js";
import { enforceRateLimit } from "../_rateLimit.js";
import { enforceSameOriginRequest } from "../_requestSecurity.js";
import { readLimitedJsonBody } from "../_jsonRequest.js";
import {
  buildClientGenerationResponse,
  prepareGenerationPayloadForAi,
  sanitizeGenerationInputForLog,
  sanitizeGenerationOutputForLog,
} from "../_privacy.js";
import {
  applyBedrockGuardrail,
  estimateBedrockGuardrailCost,
  getBedrockGuardrailConfig,
  summarizeBedrockGuardrailResponse,
  validateBedrockGuardrailConfig,
} from "../_bedrockGuardrails.js";

const ANTHROPIC_FREE_MODEL = process.env.ANTHROPIC_FREE_MODEL || "claude-haiku-4-5-20251001";
const ANTHROPIC_PRACTICE_MODEL = process.env.ANTHROPIC_PRACTICE_MODEL || "claude-sonnet-4-6";
const OPENAI_FREE_MODEL = process.env.OPENAI_FREE_MODEL || "gpt-5.4-mini";
const OPENAI_PRACTICE_MODEL = process.env.OPENAI_PRACTICE_MODEL || "gpt-5.4";
const FREE_PROVIDER = process.env.MANABI_FREE_PROVIDER || "openai";
const PRACTICE_PROVIDER = process.env.MANABI_PRACTICE_PROVIDER || "openai";
const ALLOW_PROVIDER_FALLBACK = process.env.MANABI_ALLOW_PROVIDER_FALLBACK === "true";
const ANTHROPIC_TIMEOUT_MS = parsePositiveIntegerSetting(process.env.ANTHROPIC_TIMEOUT_MS, 45000, {
  min: 1000,
  max: 120000,
});
const OPENAI_TIMEOUT_MS = parsePositiveIntegerSetting(process.env.OPENAI_TIMEOUT_MS, 45000, {
  min: 1000,
  max: 120000,
});
const USE_MOCK = process.env.MANABI_USE_MOCK === "true";
const UNSAFE_EXAMPLE_PATTERN = /（[^）]*(積む|並べる|手を動か|手元|視線|表情|じっと|声をかける|見守る)[^）]*）/g;
const STUDENT_DAILY_GENERATION_LIMIT = parsePositiveIntegerSetting(process.env.MANABI_STUDENT_DAILY_GENERATION_LIMIT, 20, {
  min: 1,
  max: 500,
});
const STAFF_DAILY_GENERATION_LIMIT = parsePositiveIntegerSetting(process.env.MANABI_STAFF_DAILY_GENERATION_LIMIT, 120, {
  min: 1,
  max: 1000,
});
const BEDROCK_GUARDRAIL_MODES = new Set(["off", "compare", "enforce"]);

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const runtimeConfigError = validateGenerateRuntimeConfig();
    if (runtimeConfigError) return runtimeConfigError;

    const sameOriginResponse = enforceSameOriginRequest(request);
    if (sameOriginResponse) return sameOriginResponse;

    const rateLimitResponse = enforceRateLimit(request, {
      namespace: "generate",
      limit: 40,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    let authContext = null;
    if (shouldRequireAuth()) {
      authContext = await getServerSessionContext(request);
      if (!authContext.user?.id) {
        return Response.json(
          {
            code: "auth_required",
            error: "AI生成にはログインが必要です。学校アカウントでログインしてください。",
          },
          { status: 401 },
        );
      }
      if (!authContext.profile?.id) {
        return Response.json(
          {
            code: "profile_required",
            error: "学校プロフィールが未設定のため、AI生成を利用できません。",
          },
          { status: 403 },
        );
      }
    }

    const body = validateGenerationRequest(await readLimitedJson(request, 30000), authContext);
    const privacyCheckedBody = enforceAiPrivacyGate(body);
    if (authContext) {
      const limitError = await enforceDailyGenerationLimit(authContext);
      if (limitError) return limitError;
    }
    const guardrailCheckedBody = await applyOptionalBedrockGuardrail(privacyCheckedBody);

    const schoolFormat = authContext?.session?.schoolId ? await loadSchoolFormat(authContext.session.schoolId) : null;
    const rawContent = await generateContent(guardrailCheckedBody, schoolFormat);
    rawContent.subscription = guardrailCheckedBody.subscription;
    if (schoolFormat) {
      rawContent.schoolFormat = summarizeSchoolFormat(schoolFormat);
    }
    const generationId = authContext ? await persistGenerationLog(authContext, guardrailCheckedBody, rawContent) : null;
    const content = buildClientGenerationResponse(rawContent);
    if (generationId) {
      content.generationId = generationId;
    }
    return Response.json(content);
  } catch (error) {
    const timedOut = error.name === "TimeoutError";
    const publicError = error instanceof PublicError;
    const status = timedOut ? 504 : publicError ? error.status : 500;
    if (!publicError && !timedOut) {
      console.error("Generation request failed:", error.details || error.stack || error.message);
    }
    return Response.json(
      {
        code: timedOut ? "provider_timeout" : publicError ? error.code : "server_error",
        error: timedOut
          ? "AI生成の応答が時間内に返りませんでした。少し時間を置いて再試行してください。"
          : publicError
            ? error.message
            : "AI生成処理でエラーが発生しました。入力内容を短くするか、少し時間を置いて再試行してください。",
      },
      { status },
    );
  }
}

function enforceAiPrivacyGate(body) {
  const result = prepareGenerationPayloadForAi(body.kind, body.payload);
  if (result.blocked) {
    throw new PublicError(
      result.message || "個人情報や要配慮情報が含まれている可能性があるため、AI送信を停止しました。",
      422,
      "ai_privacy_gate_blocked",
      "AI",
    );
  }
  return {
    ...body,
    payload: result.payload,
    privacyGuard: {
      redactedBeforeAi: result.changed,
      blocked: false,
    },
  };
}

async function applyOptionalBedrockGuardrail(body) {
  const mode = getBedrockGuardrailMode();
  if (mode === "off") return body;

  const text = buildBedrockGuardrailText(body.kind, body.payload);
  const estimatedCost = estimateBedrockGuardrailCost(text, { sensitiveInformationPolicyUnits: true });
  const missing = validateBedrockGuardrailConfig(getBedrockGuardrailConfig());
  if (missing.length > 0) {
    const metadata = buildBedrockGuardrailLogMeta({
      mode,
      status: "skipped",
      reason: "missing_config",
      estimatedCost,
    });
    if (mode === "enforce") {
      throw new PublicError(
        "追加の安全確認設定が未完了のため、AI送信を停止しています。管理者に連絡してください。",
        503,
        "bedrock_guardrail_not_configured",
        "AI",
      );
    }
    console.warn("Bedrock Guardrails compare skipped: config missing.");
    return attachBedrockGuardrailMeta(body, metadata);
  }

  try {
    const response = await applyBedrockGuardrail(text, {
      signal: AbortSignal.timeout(getBedrockGuardrailTimeoutMs()),
    });
    const summary = summarizeBedrockGuardrailResponse(response);
    const metadata = buildBedrockGuardrailLogMeta({
      mode,
      status: "checked",
      summary,
      estimatedCost,
    });
    if (mode === "enforce" && isBedrockGuardrailIntervention(summary)) {
      throw new PublicError(
        "追加の安全確認で個人情報や要配慮情報の可能性を検出しました。該当箇所をA児、実習先園、担任の先生のように置き換えてから再送信してください。",
        422,
        "bedrock_guardrail_blocked",
        "AI",
      );
    }
    return attachBedrockGuardrailMeta(body, metadata);
  } catch (error) {
    if (error instanceof PublicError) throw error;

    const metadata = buildBedrockGuardrailLogMeta({
      mode,
      status: "error",
      reason: normalizeBedrockGuardrailErrorReason(error),
      estimatedCost,
    });
    if (mode === "enforce") {
      throw new PublicError(
        "追加の安全確認を完了できないため、AI送信を停止しています。少し時間を置いて再試行してください。",
        503,
        "bedrock_guardrail_unavailable",
        "AI",
      );
    }
    console.warn("Bedrock Guardrails compare failed:", error.name || error.message);
    return attachBedrockGuardrailMeta(body, metadata);
  }
}

function getBedrockGuardrailMode() {
  const rawMode = String(process.env.MANABI_BEDROCK_GUARDRAIL_MODE || "off").trim().toLowerCase();
  const mode = rawMode === "monitor" || rawMode === "comparison" ? "compare" : rawMode;
  if (BEDROCK_GUARDRAIL_MODES.has(mode)) return mode;
  throw new PublicError(
    "追加の安全確認設定が不正です。管理者に連絡してください。",
    503,
    "bedrock_guardrail_mode_invalid",
    "AI",
  );
}

function getBedrockGuardrailTimeoutMs() {
  return parsePositiveIntegerSetting(process.env.MANABI_BEDROCK_GUARDRAIL_TIMEOUT_MS, 5000, {
    min: 1000,
    max: 30000,
  });
}

function buildBedrockGuardrailText(kind, payload = {}) {
  const labelsByKind = {
    diary: {
      date: "日付",
      weather: "天気",
      age: "対象年齢",
      scene: "場面",
      goal: "今日のねらい",
      memo: "今日あったこと",
      reflection: "自分で考えたこと",
      tomorrowTask: "明日見たいこと・相談したいこと",
      feedbackGuidanceCategory: "受け止めた観点",
      feedbackReceived: "実習先指導員から受けた助言",
      feedbackInterpretation: "助言への自分の理解",
      feedbackUnclear: "まだ分からないこと",
      feedbackTomorrowAction: "明日変えたい行動",
      feedbackTeacherQuestion: "学校の担当教員に相談したいこと",
    },
    plan: {
      age: "対象年齢",
      time: "活動時間",
      activity: "活動名",
      planMemo: "ねらい・不安な点",
    },
  };
  const labels = labelsByKind[kind] || {};
  return Object.entries(payload || {})
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${labels[key] || key}: ${value.trim()}`)
    .join("\n");
}

function isBedrockGuardrailIntervention(summary = {}) {
  if (summary.intervened) return true;
  return (summary.findings || []).some((finding) => finding.action && finding.action !== "NONE");
}

function attachBedrockGuardrailMeta(body, bedrockGuardrail) {
  return {
    ...body,
    privacyGuard: {
      ...(body.privacyGuard || {}),
      bedrockGuardrail,
    },
  };
}

function buildBedrockGuardrailLogMeta({ mode, status, summary, reason, estimatedCost }) {
  return removeEmptyValues({
    mode,
    status,
    action: cleanLogValue(summary?.action, 40),
    intervened: summary?.intervened,
    findingCount: Array.isArray(summary?.findings) ? summary.findings.length : undefined,
    findingTypes: normalizeBedrockFindingTypes(summary?.findings),
    usage: sanitizeBedrockUsage(summary?.usage),
    estimatedTextUnits: estimatedCost?.textUnits,
    estimatedCostUsd: roundCost(estimatedCost?.totalUsd),
    actualCostUsd: roundCost(summary?.cost?.totalUsd),
    latencyMs: summary?.latencyMs,
    reason: cleanLogValue(reason, 80),
  });
}

function normalizeBedrockFindingTypes(findings = []) {
  if (!Array.isArray(findings)) return undefined;
  return findings
    .map((finding) => [finding.policy, finding.type, finding.action].map((part) => cleanLogValue(part, 40)).filter(Boolean).join(":"))
    .filter(Boolean)
    .slice(0, 20);
}

function sanitizeBedrockUsage(usage = {}) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return undefined;
  return removeEmptyValues(
    Object.fromEntries(
      Object.entries(usage)
        .filter(([, value]) => Number.isFinite(Number(value)))
        .map(([key, value]) => [cleanLogValue(key, 60), Number(value)]),
    ),
  );
}

function normalizeBedrockGuardrailErrorReason(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "timeout";
  if (/config missing/i.test(String(error?.message || ""))) return "missing_config";
  return "request_failed";
}

async function readLimitedJson(request, maxBytes) {
  return readLimitedJsonBody(request, maxBytes, {
    requireJsonContentType: true,
    contentTypeMessage: "AI生成リクエストのContent-Typeはapplication/jsonにしてください。",
    tooLargeMessage: "入力が長すぎます。内容を短くして再試行してください。",
    invalidJsonMessage: "リクエスト形式が不正です。",
    errorFactory: (code, message, status) => new PublicError(message, status, code, "AI"),
  });
}

function parsePositiveIntegerSetting(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function cleanLogValue(value, maxLength) {
  return String(value || "").replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, maxLength);
}

function roundCost(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Number(number.toFixed(8));
}

function removeEmptyValues(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => {
      if (child === undefined || child === null || child === "") return false;
      if (Array.isArray(child) && child.length === 0) return false;
      if (typeof child === "object" && !Array.isArray(child) && Object.keys(child).length === 0) return false;
      return true;
    }),
  );
}

function validateGenerationRequest(body, authContext) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PublicError("リクエスト形式が不正です。", 400, "invalid_request", "AI");
  }

  const kind = body.kind;
  if (kind !== "diary" && kind !== "plan") {
    throw new PublicError("生成の種類が不正です。", 400, "invalid_generation_kind", "AI");
  }
  if (kind === "plan" && !isPlanSupportEnabled()) {
    throw new PublicError(
      "指導案補助は現在のPoC対象外です。実習日誌の整理機能を利用してください。",
      403,
      "plan_generation_disabled",
      "AI",
    );
  }

  const hasProviderControl = body.provider != null && body.provider !== "";
  const hasFallbackControl = body.fallback === false;
  const allowClientControls = canUseClientGenerationControls(authContext);
  if ((hasProviderControl || hasFallbackControl) && !allowClientControls) {
    throw new PublicError("AI生成経路の指定は管理者設定で制御されています。", 400, "client_generation_controls_disabled", "AI");
  }

  const provider = hasProviderControl ? normalizeProviderOrThrow(body.provider) : undefined;
  const subscription = resolveServerSubscription(body.subscription, authContext);
  const payload = kind === "diary" ? normalizeDiaryPayload(body.payload) : normalizePlanPayload(body.payload);

  return {
    kind,
    payload,
    subscription,
    provider,
    fallback: allowClientControls && body.fallback === false ? false : true,
  };
}

function normalizeProviderOrThrow(provider) {
  if (provider === "anthropic" || provider === "claude") return "anthropic";
  if (provider === "openai") return "openai";
  throw new PublicError("AI生成設定の指定が不正です。", 400, "invalid_provider", "AI");
}

function resolveServerSubscription(requestedSubscription, authContext) {
  if (!authContext) {
    return requestedSubscription === "practice" ? "practice" : "free";
  }

  const schoolPlan = String(authContext.session?.schoolPlan || "").toLowerCase();
  const contractStatus = String(authContext.session?.contractStatus || "").toLowerCase();
  const schoolPlanAllowsPractice = ["pilot", "paid", "school", "enterprise"].includes(schoolPlan);
  const contractAllowsUse = ["active", "trialing", "pilot_active", "paid", "contracted"].includes(contractStatus);
  return schoolPlanAllowsPractice && contractAllowsUse ? "practice" : "free";
}

function canUseClientGenerationControls(authContext) {
  if (process.env.MANABI_ALLOW_CLIENT_PROVIDER_OVERRIDE !== "true") return false;
  return authContext?.session?.role === "admin";
}

function isPlanSupportEnabled() {
  return process.env.MANABI_ENABLE_PLAN_SUPPORT === "true";
}

function normalizeDiaryPayload(payload) {
  const source = normalizePayloadObject(payload);
  const memo = normalizeBoundedText(source.memo, 6000, "今日あったこと");
  if (!memo) {
    throw new PublicError("今日あったことを入力してください。", 400, "memo_required", "AI");
  }

  return {
    date: normalizeBoundedText(source.date, 30, "日付") || "（未入力）",
    weather: normalizeBoundedText(source.weather, 30, "天気") || "（未入力）",
    age: normalizeBoundedText(source.age, 60, "対象年齢") || "（未入力）",
    scene: normalizeBoundedText(source.scene, 120, "場面") || "（未入力）",
    goal: normalizeBoundedText(source.goal, 800, "今日のねらい"),
    memo,
    reflection: normalizeBoundedText(source.reflection, 3000, "自分で考えたこと"),
    tomorrowTask: normalizeBoundedText(source.tomorrowTask, 2000, "明日見たいこと・相談したいこと"),
    feedbackGuidanceCategory: normalizeBoundedText(source.feedbackGuidanceCategory, 80, "受け止めた観点"),
    feedbackReceived: normalizeBoundedText(source.feedbackReceived, 1200, "指導を受けて学んだこと"),
    feedbackInterpretation: normalizeBoundedText(source.feedbackInterpretation, 1200, "自分の理解"),
    feedbackUnclear: normalizeBoundedText(source.feedbackUnclear, 800, "まだ分からないこと"),
    feedbackTomorrowAction: normalizeBoundedText(source.feedbackTomorrowAction, 800, "明日変えたい行動"),
    feedbackTeacherQuestion: normalizeBoundedText(source.feedbackTeacherQuestion, 800, "学校の担当教員に相談したいこと"),
    tone: ["short", "balanced", "deep"].includes(source.tone) ? source.tone : "balanced",
  };
}

function normalizePlanPayload(payload) {
  const source = normalizePayloadObject(payload);
  const activity = normalizeBoundedText(source.activity, 200, "活動名");
  const planMemo = normalizeBoundedText(source.planMemo, 6000, "ねらい・不安な点");
  if (!activity && !planMemo) {
    throw new PublicError("活動名、またはねらい・不安な点を入力してください。", 400, "plan_payload_required", "AI");
  }

  return {
    age: normalizeBoundedText(source.age, 60, "対象年齢") || "（未入力）",
    time: normalizeBoundedText(source.time, 60, "活動時間") || "（未入力）",
    activity,
    planMemo,
  };
}

function normalizePayloadObject(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new PublicError("入力内容の形式が不正です。", 400, "invalid_payload", "AI");
  }
  return payload;
}

function normalizeBoundedText(value, maxLength, label) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (text.length > maxLength) {
    throw new PublicError(`${label}が長すぎます。内容を短くしてください。`, 413, "field_too_large", "AI");
  }
  return text;
}

function shouldRequireAuth() {
  if (isProductionLikeRuntime()) return true;
  if (!isAuthConfigured()) return false;
  const authExplicitlyDisabled = process.env.MANABI_REQUIRE_AUTH_FOR_GENERATE === "false";
  return !authExplicitlyDisabled;
}

function validateGenerateRuntimeConfig() {
  if (!isProductionLikeRuntime()) return null;
  if (!isAuthConfigured()) {
    return Response.json(
      {
        code: "auth_not_configured",
        error: "本番環境の認証設定が未完了のため、AI生成を停止しています。",
      },
      { status: 503 },
    );
  }
    if (USE_MOCK && isStrictProductionRuntime()) {
      return Response.json(
        {
          code: "mock_generation_disabled",
          error: "正式公開環境ではモック生成を利用できません。",
        },
        { status: 503 },
      );
  }
  return null;
}

function isProductionLikeRuntime() {
  const explicitRuntime = String(process.env.MANABI_RUNTIME_ENV || "").toLowerCase();
  if (["production", "prod", "preview", "staging"].includes(explicitRuntime)) return true;
  if (["development", "dev", "local", "test"].includes(explicitRuntime)) return false;

  const vercelEnv = String(process.env.VERCEL_ENV || "").toLowerCase();
  if (["production", "preview"].includes(vercelEnv)) return true;

  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function isStrictProductionRuntime() {
  const explicitRuntime = String(process.env.MANABI_RUNTIME_ENV || "").toLowerCase();
  if (["production", "prod"].includes(explicitRuntime)) return true;
  if (["preview", "staging", "development", "dev", "local", "test"].includes(explicitRuntime)) return false;

  const vercelEnv = String(process.env.VERCEL_ENV || "").toLowerCase();
  if (vercelEnv === "production") return true;
  if (["preview", "development"].includes(vercelEnv)) return false;

  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

async function enforceDailyGenerationLimit(context) {
  if (!isRestConfigured()) return null;

  const limit = context.session.role === "student" ? STUDENT_DAILY_GENERATION_LIMIT : STAFF_DAILY_GENERATION_LIMIT;
  const todayStart = getJapanDayStartUtcIso();
  const rows = await supabaseRestFetch(
    `/generation_logs?select=id&user_id=eq.${encodeURIComponent(context.user.id)}&created_at=gte.${encodeURIComponent(todayStart)}&limit=${limit + 1}`,
  ).catch((error) => {
    console.warn("Generation limit check failed:", error.details || error.message);
    if (requiresDurableUsageControls(context)) {
      return Response.json(
        {
          code: "usage_limit_check_unavailable",
          error: "利用上限を確認できないため、AI生成を一時停止しています。少し時間を置いて再試行してください。",
        },
        { status: 503 },
      );
    }
    return null;
  });

  if (rows instanceof Response) return rows;
  if (!Array.isArray(rows)) return null;
  if (rows.length < limit) return null;

  return Response.json(
    {
      code: "daily_generation_limit",
      error: "本日のAI生成上限に達しました。学校管理者に利用枠の確認を依頼してください。",
    },
    { status: 429 },
  );
}

function getJapanDayStartUtcIso() {
  const japanOffsetMs = 9 * 60 * 60 * 1000;
  const nowInJapan = new Date(Date.now() + japanOffsetMs);
  nowInJapan.setUTCHours(0, 0, 0, 0);
  return new Date(nowInJapan.getTime() - japanOffsetMs).toISOString();
}

async function persistGenerationLog(context, body, content) {
  if (!isRestConfigured()) return null;

  const rows = await supabaseRestFetch("/generation_logs", {
    method: "POST",
    body: {
      school_id: context.session.schoolId || null,
      class_id: context.session.classId || null,
      user_id: context.user.id,
      kind: body.kind,
      provider: content.source || "unknown",
      model: null,
      subscription: body.subscription || "free",
      input: sanitizeGenerationInputForLog(body.kind, body.payload, body.privacyGuard),
      output: sanitizeGenerationOutputForLog(content),
      checks: Array.isArray(content.checks) ? content.checks.slice(0, 5) : null,
      session: buildLogSession(context.session),
      status: "completed",
    },
  }).catch((error) => {
    console.warn("Server generation log failed:", error.details || error.message);
    if (requiresDurableUsageControls(context)) {
      throw new PublicError(
        "確認記録を保存できないため、AI生成結果を返せません。少し時間を置いて再試行してください。",
        503,
        "generation_log_unavailable",
        "AI",
      );
    }
    return null;
  });

  return rows?.[0]?.id || null;
}

function requiresDurableUsageControls(context) {
  if (!context?.user?.id) return false;
  return isProductionLikeRuntime() || process.env.MANABI_REQUIRE_DURABLE_USAGE_CONTROLS === "true";
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

async function loadSchoolFormat(schoolId) {
  if (!isRestConfigured() || !schoolId) return null;
  return getSchoolFormatForSchool(schoolId).catch((error) => {
    console.warn("School format load skipped:", error.details || error.message);
    return null;
  });
}

async function generateContent({ kind, payload, subscription = "free", provider, fallback = true }, schoolFormat = null) {
  if (!["diary", "plan"].includes(kind)) {
    throw new Error("Invalid generation kind");
  }

  if (USE_MOCK) {
    return buildMock(kind, payload, subscription, schoolFormat);
  }

  const requestedProvider = provider ? normalizeProvider(provider) : null;
  if (requestedProvider && fallback === false) {
    if (!isProviderConfigured(requestedProvider)) {
      throw new PublicError("AI生成設定が未完了です。管理者に連絡してください。", 400, `${requestedProvider}_missing_key`, "AI");
    }
    return generateWithProvider(requestedProvider, kind, payload, subscription, schoolFormat);
  }

  return generateWithFallback(kind, payload, subscription, requestedProvider, schoolFormat);
}

async function generateWithFallback(kind, payload, subscription, providerOverride = null, schoolFormat = null) {
  const primaryProvider = providerOverride || normalizeProvider(subscription === "practice" ? PRACTICE_PROVIDER : FREE_PROVIDER);
  const fallbackProvider = primaryProvider === "openai" ? "anthropic" : "openai";
  const providers = ALLOW_PROVIDER_FALLBACK ? [primaryProvider, fallbackProvider] : [primaryProvider];
  let lastError = null;

  for (const provider of providers) {
    if (!isProviderConfigured(provider)) continue;
    try {
      return await generateWithProvider(provider, kind, payload, subscription, schoolFormat);
    } catch (error) {
      lastError = error;
      console.warn(`${provider} generation failed:`, error.code || error.name || error.message);
    }
  }

  if (lastError) throw lastError;
  throw new PublicError("AI生成設定が未完了です。管理者に連絡してください。", 503, "provider_not_configured", "AI");
}

function normalizeProvider(provider) {
  return provider === "anthropic" ? "anthropic" : "openai";
}

function isProviderConfigured(provider) {
  return provider === "openai" ? Boolean(process.env.OPENAI_API_KEY) : Boolean(process.env.ANTHROPIC_API_KEY);
}

async function generateWithProvider(provider, kind, payload, subscription, schoolFormat) {
  return provider === "openai"
    ? generateWithOpenAI(kind, payload, subscription, schoolFormat)
    : generateWithAnthropic(kind, payload, subscription, schoolFormat);
}

async function generateWithAnthropic(kind, payload, subscription, schoolFormat) {
  const model = subscription === "practice" ? ANTHROPIC_PRACTICE_MODEL : ANTHROPIC_FREE_MODEL;
  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: subscription === "practice" ? 4200 : 1800,
      temperature: 0.4,
      system: buildSystemPrompt(subscription, schoolFormat),
      messages: [
        { role: "user", content: buildUserPrompt(kind, payload, schoolFormat) },
        { role: "assistant", content: "{" },
      ],
    }),
  });

  if (!anthropicResponse.ok) {
    const errorText = await anthropicResponse.text();
    throw buildProviderError("anthropic", anthropicResponse.status, errorText);
  }

  const data = await anthropicResponse.json();
  const generatedText = extractMessageContent(data);
  if (!generatedText) {
    throw new Error("Anthropic response did not include text");
  }
  const text = String(generatedText).trimStart().startsWith("{") ? generatedText : `{${generatedText}`;

  try {
    return normalizeGeneratedText(text, "claude", model, kind, schoolFormat, payload);
  } catch (error) {
    console.error("Claude JSON parse failed:", {
      responseLength: String(text || "").length,
      error: error.message,
    });
    throw error;
  }
}

async function generateWithOpenAI(kind, payload, subscription, schoolFormat) {
  const model = subscription === "practice" ? OPENAI_PRACTICE_MODEL : OPENAI_FREE_MODEL;
  const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: buildSystemPrompt(subscription, schoolFormat) },
        { role: "user", content: buildUserPrompt(kind, payload, schoolFormat) },
      ],
      store: false,
      max_output_tokens: subscription === "practice" ? 2600 : 1300,
      text: {
        format: {
          type: "json_schema",
          name: "manabi_generation",
          strict: true,
          schema: OUTPUT_SCHEMA,
        },
      },
    }),
  });

  if (!openAIResponse.ok) {
    const errorText = await openAIResponse.text();
    throw buildProviderError("openai", openAIResponse.status, errorText);
  }

  const data = await openAIResponse.json();
  const text = extractOpenAIText(data);
  if (!text) {
    throw new PublicError("AI生成の応答を確認できませんでした。少し時間を置いて再試行してください。", 502, "ai_empty_response", "AI");
  }

  try {
    return normalizeGeneratedText(text, "openai", model, kind, schoolFormat, payload);
  } catch (error) {
    console.error("OpenAI JSON parse failed:", {
      responseLength: String(text || "").length,
      error: error.message,
    });
    throw error;
  }
}

function buildProviderError(provider, status, errorText) {
  const text = String(errorText || "");
  const normalized = text.toLowerCase();
  const providerName = provider === "openai" ? "openai" : "anthropic";

  if (normalized.includes("credit") || normalized.includes("balance") || normalized.includes("billing") || normalized.includes("quota") || normalized.includes("insufficient_quota")) {
    return new PublicError(
      "AI生成の利用枠を確認できませんでした。管理者に連絡してください。",
      402,
      `${providerName}_billing`,
      "AI",
    );
  }

  if (status === 401 || status === 403) {
    return new PublicError(
      "AI生成の認証に失敗しました。管理者に連絡してください。",
      status,
      `${providerName}_auth`,
      "AI",
    );
  }

  if (status === 429) {
    return new PublicError(
      "AI生成の利用上限に達しました。少し時間を置いてから再試行してください。",
      429,
      `${providerName}_rate_limit`,
      "AI",
    );
  }

  if (status >= 500) {
    return new PublicError(
      "AI生成側で一時的なエラーが発生しています。少し時間を置いて再試行してください。",
      502,
      `${providerName}_unavailable`,
      "AI",
    );
  }

  return new PublicError(
    "AI生成でエラーが発生しました。少し時間を置いて再試行してください。",
    502,
    `${providerName}_error`,
    "AI",
  );
}

class PublicError extends Error {
  constructor(message, status, code, provider = "AI") {
    super(message);
    this.name = "PublicError";
    this.status = status;
    this.code = code;
    this.provider = provider;
  }
}

function extractMessageContent(data) {
  const block = data.content?.[0];
  if (!block) return "";
  if (block.type === "text") return block.text;
  if (block.type === "json") return JSON.stringify(block.json);
  if (block.type === "output_json") return JSON.stringify(block.json);
  if (typeof block === "object") return JSON.stringify(block);
  return "";
}

function extractOpenAIText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  if (data.output_parsed) return JSON.stringify(data.output_parsed);

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
      if (content.json) chunks.push(JSON.stringify(content.json));
      if (content.type === "refusal") {
        throw new PublicError("AIが安全上の理由で出力を返せませんでした。入力内容を見直してください。", 400, "ai_refusal", "AI");
      }
    }
  }
  return chunks.join("");
}

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headings", "sections", "checks"],
  properties: {
    headings: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: { type: "string" },
    },
    sections: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: { type: "string" },
    },
    checks: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string" },
    },
  },
};

function buildSystemPrompt(subscription, schoolFormat = null) {
  const premium = subscription === "practice";
  return [
    "あなたは保育士・幼稚園教諭養成課程の実習生を支援する、日本語の省察支援・提出前安全確認アシスタントです。",
    "目的は『代筆』ではなく『学生が自分で書いた記録への問い返し』です。学生が入力した事実・考えたこと・明日の課題を土台に、確認すべき点、危険表現、追記すべき観察事実、先生に相談する問いを返してください。",
    "学生がそのまま提出する完成文や、日誌本文として貼れる文章は返しません。各sectionは、短い確認メモ、問い返し、追記観点として書き、学生本人が自分の言葉で書き直す余地を残してください。",
    "学生が『自分で考えたこと』『明日見たいこと・相談したいこと』を入力している場合は、それを尊重し、AIが別の考察や反省文を作らず、根拠・断定・不足・相談点を確認してください。",
    "【補完禁止ルール】以下は入力にない限り絶対に書かないでください。",
    "・子どもの内面、意図、感情の断定。『〜したかったのだろう』『嬉しそう』『やる気がなさそう』などは、入力にあっても出力では観察できる様子へ置き換える。",
    "・保育者の意図、声かけの背景、配慮の理由。",
    "・天気、時間帯、室内外、人数、活動の前後関係、クラスの雰囲気。",
    "・具体的な発話、エピソードの細部、子ども同士のやりとり。",
    "・入力にない身体の動き、視線、表情、手元の様子、姿勢、距離感。例:『手を動かしながら』『手元を見ながら』『じっと見ていた』などは、メモに明記がない限り書かない。",
    "・『手伝った』『関わった』『声をかけた』『見た』など抽象的な入力を、入力にない具体的援助へ言い換えない。例:『手を添えた』『一緒に行った』『近くで見守った』『促した』『励ました』などは、メモに明記がない限り書かない。",
    "・『声をかけて座らせた』のように発話内容が不明な入力は、『座ることにつながる声かけをした』程度に留める。『座るよう促した』『座るよう指示した』など、指示内容を具体化した表現へ置き換えない。",
    "・活動の一般的な教育的効果、発達への効果、理論説明。例:『手指の発達を促す』『空間認識を育む』などは、学生メモや指導案のねらいに明記がない限り書かない。",
    "・薄いメモでよく出やすい補完表現。例:『楽しそう』『集中していた』『達成感』『満足感』『意欲的』『主体的』『友だちと協力』は、入力に明記がない限り使わない。",
    "・園名、保育者名、子どもの実名、年齢以外の属性、家庭環境、診断名。",
    "入力に該当情報がない場合は、文章中で創作せず、checksに『〜は記入されていません。実際の場面を確認して追記してください』として残してください。",
    "抽象的な入力を扱う場合は、本文では抽象度を保ち、checksで『どのように関わったか』『どのような声かけだったか』を確認項目として残してください。",
    "上記の禁止・置換対象の言葉は、本文だけでなくchecksにもそのまま出さないでください。『入力なしに〜と書いていないか』『〜と判断していないか』のような禁止例の引用も避け、より中立的な確認表現にしてください。",
    "未入力項目の追記を促す場合も、括弧内で具体例を列挙しないでください。例:『積む・並べる』『声をかける・見守る』のような候補提示は、入力にない行動を学生が採用しやすいため避けます。",
    "学生メモに子どもの実名や愛称が含まれていた場合は、出力では『A児』『B児』『C児』のように置換・マスキングしてください。保育者名は『担任の先生』『主任の先生』等の役割表現に置き換えます。",
    "入力にない出来事、子どもの発言、保育者の意図、成果を勝手に作らないでください。足りない情報は補完せず、提出前の自己確認で確認項目として示してください。",
    "天気、時間帯、室内外、クラスの雰囲気、子どもたちの落ち着き、保育者の様子なども、入力に明記されていない場合は書かないでください。",
    "【子どもの記述】評価・診断・問題行動視する表現は使いません。",
    "避ける例:『できない』『落ち着きがない』『協調性がない』『理解が遅い』『わがまま』『乱暴』『内気』『発達が気になる』。",
    "置き換え例:『〜する姿が見られた』『〜しようとしていた』『〜する様子があった』『〜に時間をかけていた』『〜を繰り返していた』。",
    "学生メモに評価語・感情語・自己評価語が含まれていても、出力ではその語を引用しないでください。『嬉しそう』『やる気がなさそう』『落ち着きがない』『うまくいった』等は、打ち消しや確認の文脈でも使わず、中立的な観察表現へ置き換えてください。",
    "子どもの行動の理由を一つに決めつけず、複数の解釈の可能性に開いた書き方をしてください。",
    "考察でも、活動一般の発達的意味づけを追加しないでください。学生メモが薄い場合は『このメモだけでは考察材料が不足しているため、〜を追記したい』という形にしてください。",
    "指導案でも、学生メモにない活動手順を提案・例示しないでください。新聞紙遊びであっても、入力にない限り『破る』『丸める』『投げる』『玉入れ』『輪投げ』などの展開を作らないでください。",
    "checksで活動手順を確認する場合も、具体的な遊び方の例を列挙せず『具体的な遊び方』『活動の流れ』のように抽象化してください。",
    "【援助の記述】実習生の関わりを断定的に肯定も否定もしません。",
    "避ける例:『適切な援助ができた』『効果的であった』『効果的である』『正しく対応した』『失敗した』『不適切だった』。",
    "置き換え例:『〜と考えて関わった』『〜という意図で声をかけた』『結果として〜という姿が見られた』『この関わりについては〜の点で振り返りたい』。",
    "『意図』と『結果』と『振り返りたい点』を分けて書くことで、自己評価ではなく省察にしてください。",
    "【文体】学生が自分で書き直すための確認メモとして、短く具体的に書きます。『提出文』ではなく『問い・確認観点・追記すべき点』として読める形にしてください。",
    "学生に返す言い回しは、内容の基準を緩めずに柔らかくします。『抽象的です』『不足しています』『できていません』のように断定的に指摘せず、『やや抽象的です』『もう少し具体化できそうですか』『〜を確認してみましょう』のように、学生が受け取りやすい問いにしてください。",
    "避けるもの: そのまま提出できる長い完成文、ビジネス文書調、AIらしい総括（『総じて〜でした』『以上のように〜』）、絵文字、感嘆符、過度な敬語。",
    "各sectionは、確認メモ・問い・追記観点として書いてください。日誌本文として貼れる段落文や、入力にない具体例を含む箇条書きは避けます。",
    "各sectionには見出しと同じ内容のラベル（例: 【子どもの姿】）を重複して入れないでください。UI側で見出しを表示します。",
    "checksは『指摘・減点』ではなく『学生が見直せる問い』として書きます。",
    "良い例:『〜の場面の保育者の声かけは記録できていますか』『〜の表現は断定的になっていないか確認しましょう』『見られた子どもの姿と、5領域や保育所保育指針の観点はどのようにつながりますか』。",
    "悪い例:『〜が抜けています』『〜が不十分です』『〜は抽象的です』。",
    "個人情報を推測・補完せず、入力にない固有名、園名、診断名、家庭情報を書かないでください。",
    buildHoikuGuidelinePromptBlock("common"),
    buildSchoolFormatPromptBlock("common", schoolFormat),
    premium
      ? [
          "【実習パス版】観察事実・学生自身の考察・明日の観察視点・教員に確認したい点を分け、問い返しとして深めてください。",
          "考察では『なぜそう考えたか』の根拠を学生メモの事実から確認し、別の見方の余地がある場合は問いとして示します。評価語や断定語は引用せず、中立表現に置き換えます。",
          "指導案では、環境構成（物・空間・時間）、安全面、個別配慮、予想される子どもの姿（複数パターン）、5領域との関連（学生入力から推測できる範囲のみ）を扱います。",
          "各sectionは120〜220字、checksは各60〜90字。",
        ].join(" ")
      : [
          "【無料版】文章化ではなく、提出前の確認メモを中心にします。考察への助言は『観察事実→気づき』の一往復を確認する程度に留め、深い解釈や複数視点は提示しません。",
          "入力情報が少ない場合は、本文を短くし、未記入の情報をchecksで確認項目として残してください。一般論で本文を水増ししないでください。",
          "指導案も骨子（概要・ねらい・大まかな展開）のみ。個別配慮や予想される姿の詳細展開は省略します。",
          "各sectionは80〜160字、checksは各40〜80字。",
          "有料機能の宣伝・案内文は一切出力しません。",
        ].join(" "),
    "【出力形式】JSONオブジェクトのみを返します。前置き、後書き、Markdown、コードブロック（```）、説明文は一切禁止です。",
    'スキーマ: {"headings": string[5], "sections": string[5], "checks": string[3-5]}',
    "headings と sections は同じ順序で対応します。headings[i] は sections[i] の見出しです。",
    "headings の各要素は18字以内の短い見出し。sections は確認メモ・問い・追記観点。checks は確認の問い。",
    '出力例の構造: {"headings":["エピソードの整理","気づきの確認","表現の確認","明日の観察","教員への相談"],"sections":["...","...","...","...","..."],"checks":["...","...","..."]}',
  ].join("\n");
}

function buildUserPrompt(kind, payload, schoolFormat = null) {
  if (kind === "plan") {
    return [
      "【種類】指導案補助",
      "",
      "【入力情報】",
      `・対象年齢: ${payload.age}`,
      `・活動時間: ${payload.time}`,
      `・活動名: ${payload.activity || "（未入力）"}`,
      `・ねらい・不安な点: ${payload.planMemo || "（未入力）"}`,
      "",
      buildHoikuGuidelinePromptBlock("plan"),
      "",
      buildSchoolFormatPromptBlock("plan", schoolFormat),
      "",
      "【sectionsの構成（headingsと同順）】",
      "1. 活動概要 — 学生が書いた活動名・内容を、指導案の冒頭にふさわしい簡潔な記述に整える。活動内容を勝手に増やさない。",
      "2. ねらい — 学生のメモから読み取れる『経験としてのねらい』を整理する。年齢に対して無理のある表現は問いとして残す。学生メモに記載のない領域や発達観点を断定的に追加しない。",
      "3. 環境構成・準備 — 学生メモから読み取れる範囲の物的・空間的・時間的環境を整理する。材料、場所、人数、配置が未入力なら、本文では触れずchecksで確認項目として残す。",
      "4. 展開と援助 — 導入・展開・まとめの流れと、実習生が意識したい援助の視点。学生メモにない展開を創作しない。活動手順が未定なら、本文では『展開は未定であり、担当の先生と確認したい』と書き、具体案はchecksに確認項目として残す。素材名から具体的な動作や遊び方を入力なしに追加しない。簡潔な箇条書きを使ってよい。",
      "5. 安全面・配慮・相談ポイント — 想定される安全面の留意、個別配慮の視点、担当の先生に相談すべき点。",
      "",
      "【checks】指導案として提出前に学生自身が確認すべき問いを3〜5件。未入力項目、ねらいと活動の整合、安全面、年齢適切性などの観点。",
    ].join("\n");
  }

  return [
    "【種類】実習日誌補助",
    "",
    "【入力情報】",
    `・日付: ${payload.date}`,
    `・天気: ${payload.weather}`,
    `・対象年齢: ${payload.age}`,
    `・場面: ${payload.scene}`,
    `・今日のねらい: ${payload.goal || "（未入力）"}`,
    `・問い返しの詳しさ: ${payload.tone}`,
    "",
    "【学生が見たこと・自分の関わり（この内容のみを事実として扱う）】",
    payload.memo,
    "",
    "【学生が自分で考えたこと】",
    payload.reflection || "（未入力）",
    "",
    "【学生が明日見たいこと・相談したいこと】",
    payload.tomorrowTask || "（未入力）",
    "",
    "【実習先指導員からのフィードバックを学生が要約した内容】",
    `・受け止めた観点: ${payload.feedbackGuidanceCategory || "（未入力）"}`,
    `・指導を受けて学んだこと: ${payload.feedbackReceived || "（未入力）"}`,
    `・自分の理解: ${payload.feedbackInterpretation || "（未入力）"}`,
    `・まだ分からないこと: ${payload.feedbackUnclear || "（未入力）"}`,
    `・明日変えたい行動: ${payload.feedbackTomorrowAction || "（未入力）"}`,
    `・学校の担当教員に相談したいこと: ${payload.feedbackTeacherQuestion || "（未入力）"}`,
    "",
    buildToneInstruction(payload.tone),
    "",
    buildHoikuGuidelinePromptBlock("diary"),
    "",
    buildSchoolFormatPromptBlock("diary", schoolFormat),
    "",
    "【sectionsの構成（headingsと同順）】",
    "1. エピソードの整理 — 日付・天気・年齢・場面・ねらいを確認し、学生が記録したエピソードと未記入の情報を分ける。情景描写は学生メモにある範囲のみ。",
    "2. 気づきの確認 — 学生自身の気づき・考察に対して、根拠となる観察事実があるか、断定しすぎていないかを問い返す。AIが新しい考察文を作らない。",
    "3. 表現の確認 — 子どもの姿、保育者・実習生の関わりについて、評価語・診断的表現・入力内容から確認できない事実・個人情報がないかを確認する。保育者の関わりも、入力にない意図を推測しない。",
    "『手伝った』『関わった』とだけ書かれている場合は、手を添えた・見守った等の具体的な援助へ補完せず、関わりの内容は未記入としてchecksに残す。",
    "発話の内容が未記入の場合は、『〜するよう促した』『〜と伝えた』のように声かけの中身を作らず、『〜につながる声かけをした』程度に留め、具体的な言葉はchecksで確認する。",
    "4. 明日の観察 — 学生が書いた明日の課題と、実習先指導員からのフィードバック要約をもとに、次に見たい観察事実、5領域や保育所保育指針とつなげて考えるための問いを示す。領域名を足して文章を水増ししない。",
    "考察の禁止: 学生メモにない発達効果や一般論（例: 手指の発達、空間認識、創造性、社会性など）で水増ししない。情報が足りない場合は、何を追記すべきかを書く。",
    "5. 教員への相談 — 学校の担当教員に確認したい点を、学生が質問しやすい形で整理する。実習先の指導内容を評価・分析する表現にしない。実習先指導員からの助言は、翌日の観察や学生の理解確認に変換し、実習先への評価・批判にしない。翌日の実習中に意識する内容は『明日の観察』に分け、実習担当教員への相談と混同しない。",
    "",
    "【checks】学生が提出前に見直すための問いを3〜5件。断定表現の確認、個人情報、入力不足、先生への確認事項、5領域や保育所保育指針とのつながりなどの観点。",
  ].join("\n");
}

function buildToneInstruction(tone) {
  if (tone === "short") {
    return [
      "【問い返しの長さ】",
      "・各sectionは130〜180字程度で簡潔に。",
      "・考察は『観察事実 → 気づき』の一往復で締める。",
      "・冗長な接続や総括は省く。",
    ].join("\n");
  }
  if (tone === "deep") {
    return [
      "【問い返しの長さ】",
      "・各sectionは260〜360字程度で深める。",
      "・考察セクションでは以下の3点が読み取れる構成にする:",
      "  1. 観察された事実（学生メモのどこを根拠にしているか分かるように）",
      "  2. 考えられること（複数の解釈の可能性を残す）",
      "  3. 明日見たい・試したいこと",
      "・ただし入力にない事実の追加は禁止。深めるのは『解釈の余地』であって『情報量』ではない。",
      "・一般的な発達効果や理論説明で水増しせず、学生メモにある事実から考えられる範囲に留める。",
    ].join("\n");
  }
  return [
    "【問い返しの長さ】",
    "・各sectionは120〜200字程度で、提出前の確認メモとして整える。",
    "・観察と考察のバランスを意識する。",
    "・入力情報が少ない場合は、本文を短くし、確認すべき点をchecksに回す。",
  ].join("\n");
}

function normalizeGeneratedText(text, source, model, kind = "diary", schoolFormat = null, payload = {}) {
  const parsed = typeof text === "string" ? JSON.parse(extractJson(text)) : text;
  if (!Array.isArray(parsed.headings) || !Array.isArray(parsed.sections) || !Array.isArray(parsed.checks)) {
    throw new Error("Invalid response shape");
  }

  const outputGuard = buildOutputGuard(payload);
  const fallbackHeadings = kind === "plan"
    ? schoolFormat?.planHeadings || DEFAULT_PLAN_HEADINGS
    : schoolFormat?.diaryHeadings || DEFAULT_DIARY_HEADINGS;
  const headings = normalizeFixedOutputList(parsed.headings, fallbackHeadings, 5);
  const sections = normalizeFixedOutputList(parsed.sections, DEFAULT_EMPTY_SECTIONS, 5, outputGuard);
  const checks = normalizeChecks(parsed.checks, outputGuard, kind);

  return {
    headings,
    sections,
    checks,
    source,
    model,
  };
}

const DEFAULT_DIARY_HEADINGS = ["エピソードの整理", "気づきの確認", "表現の確認", "明日の観察", "教員への相談"];
const DEFAULT_PLAN_HEADINGS = ["活動概要", "ねらい", "環境構成", "展開と援助", "相談ポイント"];
const DEFAULT_EMPTY_SECTIONS = [
  "入力内容を確認し、実際の記録に合わせて追記してください。",
  "入力内容を確認し、実際の記録に合わせて追記してください。",
  "入力内容を確認し、実際の記録に合わせて追記してください。",
  "入力内容を確認し、実際の記録に合わせて追記してください。",
  "入力内容を確認し、実際の記録に合わせて追記してください。",
];
const DEFAULT_CHECKS = [
  "入力にない事実を補っていないか確認しましょう。",
  "個人名や特定につながる情報が残っていないか確認しましょう。",
  "担当の教員に確認したい点を整理できていますか。",
];
const GUIDELINE_CHECK = "実際に見られた子どもの姿は、5領域や保育所保育指針のどの観点とつながるか、自分の言葉で確認できていますか。";

const RISK_TERM_REPLACEMENTS = [
  ["落ち着きがない", "席を離れる姿など、観察された行動"],
  ["協調性がない", "友だちとの関わりの具体的な姿"],
  ["理解が遅い", "理解の過程に時間をかけている姿"],
  ["できない", "取り組みに時間をかけている姿"],
  ["うまく使えない", "扱いに時間をかけている姿"],
  ["やる気がなさそう", "取り組み始めるまでに時間をかけている姿"],
  ["嬉しそう", "実際に観察した行動や発言"],
  ["うまくいった", "関わりの意図と結果を分けて振り返る必要がある場面"],
  ["わがまま", "自分の思いを示す姿"],
  ["乱暴", "強い動きや関わりが見られた場面"],
  ["発達が気になる", "継続して観察したい姿"],
];

function normalizeFixedOutputList(value, fallback, count, outputGuard = null) {
  const list = Array.isArray(value) ? value : [];
  return Array.from({ length: count }, (_, index) => {
    const item = sanitizeOutputText(String(list[index] || ""), outputGuard);
    return item || fallback[index] || "";
  });
}

function normalizeChecks(value, outputGuard = null, kind = "diary") {
  const list = Array.isArray(value) ? value : [];
  const cleaned = list.map((item) => sanitizeOutputText(String(item || ""), outputGuard)).filter(Boolean).slice(0, 5);
  if (kind === "diary" && !cleaned.some((item) => /5領域|五領域|保育所保育指針|指針/.test(item))) {
    cleaned.push(GUIDELINE_CHECK);
  }
  if (outputGuard?.redactedNames) {
    cleaned.push("個人名や職員名をA児・担任の先生などへ置換できているか確認しましょう。");
  }
  if (outputGuard?.replacedRiskTerms) {
    cleaned.push("評価語ではなく、観察された行動として書けているか確認しましょう。");
  }
  const next = cleaned.length >= 3 ? cleaned : [...cleaned, ...DEFAULT_CHECKS].slice(0, 3);
  return [...new Set(next)].slice(0, 5);
}

function sanitizeOutputText(text, outputGuard = null) {
  let next = text.replace(UNSAFE_EXAMPLE_PATTERN, "");
  if (outputGuard) {
    next = redactSensitiveNames(next, outputGuard);
    next = replaceRiskTerms(next, outputGuard);
  }
  return next.replace(/\s{2,}/g, " ").trim();
}

function buildOutputGuard(payload = {}) {
  const inputText = [
    payload.memo,
    payload.reflection,
    payload.tomorrowTask,
    payload.feedbackReceived,
    payload.feedbackInterpretation,
    payload.feedbackUnclear,
    payload.feedbackTomorrowAction,
    payload.feedbackTeacherQuestion,
    payload.planMemo,
    payload.goal,
    payload.activity,
  ].filter(Boolean).join("\n");
  return {
    replacements: buildNameReplacements(inputText),
    redactedNames: false,
    replacedRiskTerms: false,
  };
}

function buildNameReplacements(text) {
  const replacements = new Map();
  let childIndex = 0;
  const childLabels = ["A児", "B児", "C児", "D児", "E児"];
  for (const match of String(text).matchAll(/([一-龯ぁ-んァ-ンA-Za-z]{1,12})(くん|ちゃん)/g)) {
    const raw = match[0];
    if (!replacements.has(raw)) {
      replacements.set(raw, childLabels[Math.min(childIndex, childLabels.length - 1)]);
      childIndex += 1;
    }
  }
  for (const match of String(text).matchAll(/([一-龯ぁ-んァ-ンA-Za-z]{1,12})(先生)/g)) {
    const raw = match[0];
    if (!replacements.has(raw)) replacements.set(raw, "担任の先生");
  }
  return replacements;
}

function redactSensitiveNames(text, outputGuard) {
  let next = text;
  for (const [raw, replacement] of outputGuard.replacements.entries()) {
    if (next.includes(raw)) {
      outputGuard.redactedNames = true;
      next = next.split(raw).join(replacement);
    }
  }
  return next;
}

function replaceRiskTerms(text, outputGuard) {
  let next = text;
  for (const [raw, replacement] of RISK_TERM_REPLACEMENTS) {
    if (next.includes(raw)) {
      outputGuard.replacedRiskTerms = true;
      next = next.split(raw).join(replacement);
    }
  }
  return next;
}


function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Claude response did not contain JSON");
  }
  return text.slice(start, end + 1);
}

function buildMock(kind, payload, subscription, schoolFormat = null) {
  return kind === "plan" ? buildPlanMock(payload, subscription, schoolFormat) : buildDiaryMock(payload, subscription, schoolFormat);
}

function buildDiaryMock(payload, subscription, schoolFormat = null) {
  const premium = subscription === "practice";
  const scene = payload.scene || "保育場面";
  const goal = payload.goal || "（未入力）";
  const memo = payload.memo || "子どもの姿を観察した";
  const feedbackText = [
    payload.feedbackReceived,
    payload.feedbackInterpretation,
    payload.feedbackUnclear,
    payload.feedbackTomorrowAction,
    payload.feedbackTeacherQuestion,
  ].filter(Boolean).join(" ");
  const hasFeedback = feedbackText.trim().length > 0;
  const hasPersonalNames = /(くん|ちゃん|先生|氏名|園名|担任|主任)/.test(memo);
  const hasEvaluationWords = /(うまく使えない|やる気がなさそう|嬉しそう|落ち着きがない|うまくいった|できない|協調性がない|理解が遅い)/.test(memo);
  const headings = schoolFormat?.diaryHeadings || DEFAULT_DIARY_HEADINGS;
  const childSection = hasPersonalNames
    ? "学生メモには個人名や愛称が含まれる可能性があるため、出力ではA児・B児・担任の先生のように置き換えて扱う。A児の行動、周囲の子どもの言葉、実習生の関わりは、入力された事実の範囲で整理したい。"
    : hasEvaluationWords
      ? "学生メモには評価語や感情を断定しやすい表現が含まれている。子どもの姿は、観察できた行動として書き直し、どのような姿が見られたのかを実際の場面に沿って追記したい。"
      : "学生メモに書かれた事実をもとに、子どもの姿を観察表現で整理する。遊びや関わりの具体的な内容は入力された範囲に限り、不足している部分は追記したい。";

  return {
    headings,
    sections: [
      `${payload.date}（${payload.weather}）、${payload.age}の${scene}について記録されている。本日のねらいは「${goal}」。未入力の項目がある場合は、本文として補わず、実際に見たことを追記したい。`,
      childSection,
      "学生自身の考えは、根拠となる観察事実と結びついているか確認したい。実習生の意図、行ったこと、見られた子どもの姿を分け、保育者の意図は入力にない限り断定しない。",
      hasFeedback
        ? `実習先指導員からの助言として「${payload.feedbackReceived || payload.feedbackInterpretation}」が要約されている。明日はこの助言を、子どもの言葉、使っていた物、自分の声かけ前後の姿など、記録できる観察事実に戻して確認したい。`
        : premium
          ? "明日は、同じ場面で子どもの具体的な行動、実習生の声かけ、関わり後の姿を記録できているか確認したい。5領域や保育所保育指針は、領域名の追加ではなく観察を見直す問いとして扱う。"
          : "明日は、同じ場面で子どもの具体的な行動、実習生の声かけ、関わり後の姿を記録できているか確認したい。",
      hasFeedback
        ? `学校の担当教員には、実習先で受けた助言の理解が合っているか、明日見る観察事実をどこまで絞ればよいかを確認したい。${payload.feedbackTeacherQuestion || ""}`.trim()
        : "学校の担当教員には、保育者の関わりを日誌に書く範囲、自分の考察として書いてよい範囲、明日の観察で特に見る点を確認したい。",
    ],
    checks: [
      "子どもの実名や職員名が含まれている場合、A児・担任の先生などへ置換できていますか。",
      "子どもの姿を評価語ではなく、観察された行動として書けていますか。",
      GUIDELINE_CHECK,
      hasFeedback ? "実習先で受けた助言を、翌日に見る具体的な観察事実へ置き換えられていますか。" : "",
      premium ? "事実、実習生の意図、子どもの反応、明日の観察視点を分けて確認できていますか。" : "入力が少ない部分は、創作せず確認項目として残せていますか。",
    ].filter(Boolean).slice(0, 5),
    source: "mock",
  };
}

function buildPlanMock(payload, subscription, schoolFormat = null) {
  const premium = subscription === "practice";
  const title = payload.activity || "子どもの興味を生かした活動";
  const concern = payload.planMemo || "活動の流れ、導入、安全面を整理したい。";
  const headings = schoolFormat?.planHeadings || ["活動概要", "ねらい", "環境構成", "展開と援助", "相談ポイント"];

  return {
    headings,
    sections: [
      `${payload.age}を対象に、${payload.time}程度で行う「${title}」の指導案である。活動内容は学生メモに書かれた範囲で整理し、未定の部分は担当教員に確認したい。`,
      `ねらいは、学生メモにある不安や意図をもとに整理する。不安な点は「${concern}」であり、年齢や活動内容に合っているか確認したい。`,
      "材料、場所、人数、配置、時間配分が未入力の場合は、本文で補わず、実際の環境を確認してから追記する必要がある。",
      premium
        ? "展開が未定の場合は、具体的な活動手順を創作せず、導入、展開、まとめで何を確認すべきかを整理する。援助は、安全面、参加しづらい子への関わり、活動の終え方を先生に相談したい。"
        : "展開が未定の場合は、具体的な活動手順を創作せず、担当の先生と確認したい点として残す。",
      premium
        ? "安全面では、活動場所、素材の扱い、子ども同士の距離、片付けの流れを確認したい。個別配慮が必要な子どもについては、事前に担当の先生へ相談する。"
        : "安全面では、活動場所、素材の扱い、子ども同士の距離、片付けの流れを確認したい。",
    ],
    checks: premium
      ? ["ねらいが子どもの経験として書けていますか。", "保育所保育指針の5領域との関連は入力内容から確認できますか。", "活動の流れは入力した内容から外れていませんか。", "安全面と個別配慮を担当教員に確認できますか。"]
      : ["活動の具体的な流れは入力されていますか。", "保育所保育指針の観点は確認材料として扱えていますか。", "材料、場所、人数、配置は確認できていますか。", "安全面について担当の先生に相談する点は整理できていますか。"],
    source: "mock",
  };
}
