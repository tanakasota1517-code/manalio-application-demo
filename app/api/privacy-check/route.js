import { enforceRateLimit } from "../_rateLimit.js";
import { readLimitedJsonBody } from "../_jsonRequest.js";
import { prepareGenerationPayloadForAi } from "../_privacy.js";
import { enforceSameOriginRequest } from "../_requestSecurity.js";

export const runtime = "nodejs";

const MAX_PRIVACY_CHECK_BYTES = 30000;
const ALLOWED_KINDS = new Set(["diary", "plan"]);
const ALLOWED_PHASES = new Set(["pre_ai", "final"]);

const FIELD_LABELS = {
  date: "日付",
  weather: "天気",
  age: "クラス・年齢",
  scene: "場面",
  goal: "今日のねらい",
  memo: "見たこと・自分の関わり",
  reflection: "自分で考えたこと",
  tomorrowTask: "明日見たいこと・相談したいこと",
  feedbackGuidanceCategory: "受け止めた観点",
  feedbackReceived: "実習先で受けた助言",
  feedbackInterpretation: "助言への自分の理解",
  feedbackUnclear: "まだ分からないこと",
  feedbackTomorrowAction: "明日変えたい行動",
  feedbackTeacherQuestion: "学校の担当教員に相談したいこと",
  finalDraft: "提出前の記録",
  planMemo: "ねらい・不安な点",
  activity: "活動名",
  time: "活動時間",
};

const FINDING_MESSAGES = {
  prompt_injection: "問い返しへの指示に見える表現は、記録本文から外して扱います。",
  contact_info: "連絡先は問い返しへ進む前に入力へ戻して見直すと安心です。",
  address_or_location: "住所や所在地は問い返しへ進む前に入力へ戻して見直すと安心です。",
  student_or_person_identifier: "学籍番号などの識別情報は問い返しへ進む前に入力へ戻して見直すと安心です。",
  likely_full_name: "実名と思われる表現は、A児・担任職員などに置き換えます。",
  medical_or_family_info: "診断名や家庭事情などの要配慮情報は、本文から外して扱います。",
  guardian_name: "保護者名は問い返しへ進む前に入力へ戻して見直すと安心です。",
};

export async function POST(request) {
  try {
    const sameOriginResponse = enforceSameOriginRequest(request);
    if (sameOriginResponse) return sameOriginResponse;

    const rateLimitResponse = enforceRateLimit(request, {
      namespace: "privacy-check",
      limit: 120,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const body = validatePrivacyCheckRequest(await readPrivacyCheckJson(request));
    const result = prepareGenerationPayloadForAi(body.kind, body.payload);
    const fieldChanges = buildFieldChanges(body.payload, result.payload);
    const findings = normalizeFindings(result.findings);
    const contextNotes = buildContextNotes(body.payload);

    return Response.json(
      {
        kind: body.kind,
        phase: body.phase,
        status: buildStatus(result, contextNotes),
        changed: result.changed,
        blocked: result.blocked,
        payload: result.payload,
        fieldChanges,
        findings,
        contextNotes,
        summary: buildSummary({ phase: body.phase, changed: result.changed, findings, contextNotes }),
        guardrail: {
          local: "checked",
          bedrockMode: getBedrockModeLabel(),
        },
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    const publicError = error instanceof PrivacyCheckError;
    if (!publicError) {
      console.error("Privacy check failed:", error.stack || error.message);
    }
    return Response.json(
      {
        code: publicError ? error.code : "privacy_check_failed",
        error: publicError
          ? error.message
          : "安全確認を完了できませんでした。少し時間を置いて再試行してください。",
      },
      {
        status: publicError ? error.status : 500,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}

async function readPrivacyCheckJson(request) {
  return readLimitedJsonBody(request, MAX_PRIVACY_CHECK_BYTES, {
    requireJsonContentType: true,
    contentTypeMessage: "安全確認のContent-Typeはapplication/jsonにしてください。",
    tooLargeMessage: "入力が長すぎます。内容を短くして再試行してください。",
    invalidJsonMessage: "リクエスト形式が不正です。",
    errorFactory: (code, message, status) => new PrivacyCheckError(message, status, code),
  });
}

function validatePrivacyCheckRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PrivacyCheckError("リクエスト形式が不正です。", 400, "invalid_request");
  }
  if (!ALLOWED_KINDS.has(body.kind)) {
    throw new PrivacyCheckError("確認する入力の種類が不正です。", 400, "invalid_kind");
  }
  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    throw new PrivacyCheckError("入力内容の形式が不正です。", 400, "invalid_payload");
  }
  const phase = body.phase && ALLOWED_PHASES.has(body.phase) ? body.phase : "pre_ai";
  return {
    kind: body.kind,
    phase,
    payload: normalizePayloadText(body.payload),
  };
}

function normalizePayloadText(payload) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : value,
    ]),
  );
}

function buildFieldChanges(source = {}, sanitized = {}) {
  return Object.entries(sanitized)
    .filter(([key, value]) => typeof source[key] === "string" && typeof value === "string" && source[key] !== value)
    .map(([key, value]) => ({
      field: key,
      label: FIELD_LABELS[key] || key,
      action: "auto_redacted",
      severity: "suggestion",
      actionLabel: "別の言い方",
      title: "自然に伝わる表現案があります",
      after: summarizeText(value),
    }));
}

function normalizeFindings(findings = []) {
  return findings.map((finding) => ({
    code: finding.code,
    label: finding.label,
    severity: "must_fix",
    actionLabel: "個人が分かるかも",
    message: FINDING_MESSAGES[finding.code] || "問い返しへ進む前に入力へ戻して見直すと安心です。",
  }));
}

function buildContextNotes(payload = {}) {
  const text = Object.values(payload).filter((value) => typeof value === "string").join("\n");
  const notes = [];
  if (/(発達に遅れ|発達の遅れ|遅れがある|診断|障害|療育)/.test(text)) {
    notes.push({
      code: "development_context",
      label: "発達に関する表現",
      severity: "context",
      actionLabel: "記録前の確認",
      message: "一般的な発達差の記録か、診断名・配慮情報に近い表現かを確認します。",
    });
  } else if (/発達/.test(text)) {
    notes.push({
      code: "development_general",
      label: "発達に関する表現",
      severity: "suggestion",
      actionLabel: "別の言い方",
      message: "一般的な観察として使えている場合はそのままで大丈夫です。",
    });
  }
  if (/(叱責|怒鳴|強く言われ|注意された|指導された)/.test(text)) {
    notes.push({
      code: "guidance_context",
      label: "指導場面の表現",
      severity: "context",
      actionLabel: "記録前の確認",
      message: "実習先批判に見えないよう、受け止めたことと翌日の行動に分けて確認します。",
    });
  }
  return notes;
}

function buildStatus(result, contextNotes) {
  if (result.blocked || contextNotes.some((note) => note.severity === "context")) return "review";
  if (result.changed) return "changed";
  return "clear";
}

function buildSummary({ phase, changed, findings, contextNotes }) {
  if (findings.length) {
    return phase === "final"
      ? "提出前の記録に、個人が分かるかもしれない表現があります。必要な内容だけに整えてから再チェックできます。"
      : "問い返しへ進む前に、個人が分かるかもしれない表現があります。必要な内容だけに整えてから進めます。";
  }
  if (changed) {
    return phase === "final"
      ? "提出前の記録に残っていた個人情報候補を安全な表現に整えました。内容の意味が変わっていないかだけ確認してください。"
      : "Manalio側で個人情報候補を安全な表現に整えました。確認してから問い返しへ進めます。";
  }
  if (contextNotes.some((note) => note.severity === "context")) {
    return phase === "final"
      ? "提出前に見ておきたい表現があります。内容を見て、必要に応じて入力へ戻れます。"
      : "問い返し前に見ておきたい表現があります。内容を見て、必要に応じて入力へ戻れます。";
  }
  return phase === "final"
    ? "提出前の記録では、大きな修正候補は見つかりませんでした。"
    : "大きな修正候補は見つかりませんでした。この内容で問い返しへ進めます。";
}

function getBedrockModeLabel() {
  const mode = String(process.env.MANABI_BEDROCK_GUARDRAIL_MODE || "off").trim().toLowerCase();
  if (mode === "enforce") return "enforce";
  if (mode === "compare" || mode === "monitor" || mode === "comparison") return "compare";
  return "off";
}

function summarizeText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= 180) return text;
  return `${text.slice(0, 170)}...`;
}

class PrivacyCheckError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "PrivacyCheckError";
    this.status = status;
    this.code = code;
  }
}
