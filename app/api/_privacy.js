import {
  createContactLabelPattern,
  createFamilyInfoPattern,
  createGuardianNamePattern,
  createJapaneseAddressPattern,
  createLikelyFullNamePattern,
  createMedicalInfoPattern,
  createPhonePattern,
  normalizePrivacyScanText,
} from "../privacyPatterns.js";

const MAX_LOG_TEXT = 280;

const COMMON_FULL_NAME_PATTERN = createLikelyFullNamePattern();
const COMMON_FULL_NAME_REDACTION_PATTERN = createLikelyFullNamePattern("g");
const PHONE_PATTERN = createPhonePattern();
const PHONE_REDACTION_PATTERN = createPhonePattern("g");
const CONTACT_LABEL_PATTERN = createContactLabelPattern("i");
const CONTACT_LABEL_REDACTION_PATTERN = createContactLabelPattern("gi");
const JAPANESE_ADDRESS_PATTERN = createJapaneseAddressPattern();
const JAPANESE_ADDRESS_REDACTION_PATTERN = createJapaneseAddressPattern("g");
const MEDICAL_INFO_PATTERN = createMedicalInfoPattern("i");
const MEDICAL_INFO_REDACTION_PATTERN = createMedicalInfoPattern("gi");
const FAMILY_INFO_PATTERN = createFamilyInfoPattern("i");
const FAMILY_INFO_REDACTION_PATTERN = createFamilyInfoPattern("gi");
const GUARDIAN_NAME_PATTERN = createGuardianNamePattern();
const GUARDIAN_NAME_REDACTION_PATTERN = createGuardianNamePattern("g");
const ABSTRACT_FACILITY_LABEL_SOURCE =
  "認定こども園名|こども園名|保育園名|保育所名|幼稚園名|ナーサリー名|キッズ園名|園名|実習先名|施設名";
const ABSTRACT_FACILITY_LABEL_PREFIX_SOURCE =
  "(?:実習先の|施設の|学校の|学校が指定する|学校指定の|指定する|各|該当の|対象の|日誌の|様式の|記入欄の|入力欄の|この|その|当該)?";
const ABSTRACT_FACILITY_LABEL_TOKEN_SOURCE = `${ABSTRACT_FACILITY_LABEL_PREFIX_SOURCE}(?:${ABSTRACT_FACILITY_LABEL_SOURCE})`;
const ABSTRACT_FACILITY_LABEL_QUALIFIER_SOURCE = "(?:(?:の)?(?:欄|項目)|の場合|場合)?";
const FACILITY_LABEL_PARTICLE_SOURCE = "(?:には|では|として|は|へ|に|を)";
const FACILITY_LABEL_SEPARATOR_SOURCE = "[:：=＝>＞→⇒\\-ー−–—・/／、,，;；|｜（(【「『\\[［《〈〔<＜{｛]";
const FACILITY_LABEL_BRACKET_OPEN_SOURCE = "[（(【「『\\[［《〈〔<＜{｛]";
const FACILITY_LABEL_BRACKET_CLOSE_SOURCE = "[）)】」』\\]］》〉〕>＞}｝]";
const ABSTRACT_FACILITY_LABELS = new Set(ABSTRACT_FACILITY_LABEL_SOURCE.split("|"));
const ABSTRACT_FACILITY_LABEL_PATTERN = new RegExp(`(?:${ABSTRACT_FACILITY_LABEL_SOURCE})`, "g");
const FACILITY_NAME_LIKE_PATTERN =
  /([一-龯ぁ-んァ-ンA-Za-z0-9０-９〇○々ヶヵー・]{1,30})[\s　\-ー−–—・/／]*(認定こども園|こども園|保育園|保育所|幼稚園|ナーサリー|キッズ園)名?/;
const FACILITY_NAME_REDACTION_PATTERN =
  /([一-龯ぁ-んァ-ンA-Za-z0-9０-９〇○々ヶヵー・]{1,30})[\s　\-ー−–—・/／]*(認定こども園|こども園|保育園|保育所|幼稚園|ナーサリー|キッズ園)名?/g;
const FACILITY_LABEL_VALUE_REDACTION_PATTERN = new RegExp(
  `(^|[\\s　、。,.：:【（(「『])(${ABSTRACT_FACILITY_LABEL_TOKEN_SOURCE})(?:${ABSTRACT_FACILITY_LABEL_QUALIFIER_SOURCE})(?:\\s*${FACILITY_LABEL_SEPARATOR_SOURCE}\\s*|\\s+)(?!(?:${ABSTRACT_FACILITY_LABEL_TOKEN_SOURCE})|(?:には|では|として|は|へ|を|に|と|や|及び|並びに|または|又は))([^、。\\n\\r】）)」』]{1,80})`,
  "g",
);
const FACILITY_LABEL_BRACKET_VALUE_REDACTION_PATTERN = new RegExp(
  `(^|[\\s　、。,.：:【（(「『])(${ABSTRACT_FACILITY_LABEL_TOKEN_SOURCE})(?:${ABSTRACT_FACILITY_LABEL_QUALIFIER_SOURCE})\\s*${FACILITY_LABEL_BRACKET_OPEN_SOURCE}\\s*([^）)】」』\\]］》〉〕>＞}｝\\n\\r]{1,40})\\s*${FACILITY_LABEL_BRACKET_CLOSE_SOURCE}[^。\\n\\r]{0,40}`,
  "g",
);
const FACILITY_LABEL_HA_VALUE_REDACTION_PATTERN = new RegExp(
  `(^|[\\s　、。,.：:【（(「『・/／\\-ー−–—])(${ABSTRACT_FACILITY_LABEL_TOKEN_SOURCE})(?:${ABSTRACT_FACILITY_LABEL_QUALIFIER_SOURCE})\\s*${FACILITY_LABEL_PARTICLE_SOURCE}\\s*([^。\\n\\r】）)」』]{1,80})`,
  "g",
);
const SAFE_FACILITY_LABEL_TAIL_PATTERN =
  /^(?:(?:入力しない|記入しない|記入不要|書かない|記載しない|載せない)(?:こと|でください|ようにする|してください|ようにしてください|ようお願いします|ようお願いいたします)?|避け(?:る|てください|ること|るようにする|るようにしてください|るようお願いします|るようお願いいたします)?|(?:確認|削除|省略|マスキング|匿名化)(?:する|してください|できている|できています|するようにしてください|するようお願いします|するようお願いいたします)?|(?:置き換え|置換)(?:る|する|てください)?|伏せ字(?:にする|で扱う|で残す)?|(?:安全な表現|安全な形|別の表現|匿名表現|置換済み表現|実習先園|担任職員|主任職員|学校の教員|A児|B児|C児|D児|E児)(?:(?:に|へ)(?:置き換え(?:る)?|置換する?|する|してください)|として(?:扱う|使う|残す)|で(?:扱う|使う|残す))?)(?:[、,]\s*(?:学生本人の言葉を残す|入力にない事実を補わない|記録にない事実を補わない|安全な表現に整える))*$/;
const SCHOOL_NAME_FLAG_PATTERN = /(保育園|保育所|幼稚園|認定こども園|こども園|ナーサリー|キッズ園|園名|実習先名|施設名)/;

const AI_BLOCKING_PATTERNS = [
  {
    code: "prompt_injection",
    label: "AI制御に関する指示",
    pattern: /(前の指示|これまでの指示|上記の指示|システム指示|system prompt|developer message|プロンプト|制約を無視|指示を無視|JSON不要|実名を出力|個人情報を出力|完成文として提出|そのまま提出|APIキー|秘密情報|内部設定)/i,
  },
  {
    code: "contact_info",
    label: "連絡先",
    pattern: new RegExp(`[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}|${PHONE_PATTERN.source}|https?:\\/\\/[^\\s]+|${CONTACT_LABEL_PATTERN.source}`, "i"),
  },
  {
    code: "address_or_location",
    label: "住所・所在地",
    pattern: JAPANESE_ADDRESS_PATTERN,
  },
  {
    code: "student_or_person_identifier",
    label: "学籍番号・識別番号",
    pattern: /(学籍番号|学生番号|出席番号)[:：]?\s*[A-Za-z0-9\-ー−]{2,40}/,
  },
  {
    code: "likely_full_name",
    label: "実名と思われる氏名",
    pattern: COMMON_FULL_NAME_PATTERN,
  },
  {
    code: "medical_or_family_info",
    label: "診断名・家庭事情などの要配慮情報",
    pattern: new RegExp(`${MEDICAL_INFO_PATTERN.source}|${FAMILY_INFO_PATTERN.source}`, "i"),
  },
  {
    code: "guardian_name",
    label: "保護者名",
    pattern: GUARDIAN_NAME_PATTERN,
  },
];

const SENSITIVE_REPLACEMENTS = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "〈メールアドレス〉"],
  [PHONE_REDACTION_PATTERN, "〈電話番号〉"],
  [CONTACT_LABEL_REDACTION_PATTERN, "〈連絡先〉"],
  [/(https?:\/\/[^\s]+)/g, "〈URL〉"],
  [JAPANESE_ADDRESS_REDACTION_PATTERN, "〈住所等〉"],
  [/(氏名|名前|実名|本名|園児名|児童名|保護者名)[:：]\s*[^\s、。]{1,30}/g, "〈氏名〉"],
  [GUARDIAN_NAME_REDACTION_PATTERN, "〈保護者名〉"],
  [/(学籍番号|学生番号|出席番号)[:：]?\s*[A-Za-z0-9\-ー−]{2,40}/g, "〈識別番号〉"],
  [FACILITY_NAME_REDACTION_PATTERN, redactFacilityName],
  [FACILITY_LABEL_BRACKET_VALUE_REDACTION_PATTERN, redactFacilityLabelValue],
  [FACILITY_LABEL_VALUE_REDACTION_PATTERN, redactFacilityLabelValue],
  [FACILITY_LABEL_HA_VALUE_REDACTION_PATTERN, redactFacilityLabelValue],
  [MEDICAL_INFO_REDACTION_PATTERN, "〈診断名等〉"],
  [FAMILY_INFO_REDACTION_PATTERN, "〈配慮情報〉"],
  [/(担任教員名|担任名|職員名|保育者名|先生名)[:：]?\s*[^\s、。]{0,30}/g, "担任職員"],
];

const AI_TEXT_FIELDS_BY_KIND = {
  diary: [
    "date",
    "weather",
    "age",
    "scene",
    "goal",
    "memo",
    "reflection",
    "tomorrowTask",
    "feedbackGuidanceCategory",
    "feedbackReceived",
    "feedbackInterpretation",
    "feedbackUnclear",
    "feedbackTomorrowAction",
    "feedbackTeacherQuestion",
    "tone",
  ],
  plan: ["age", "time", "activity", "planMemo"],
  student_chat: ["target", "formatLabel", "title", "currentQuestion", "practiceGoal", "episodeMemo", "answer"],
};

function removeAllowedAnonymizedTerms(text) {
  return String(text || "").replace(
    /[A-EＡ-Ｅa-eａ-ｅ](児|くん|君|ちゃん|先生)|園[A-EＡ-Ｅa-eａ-ｅ]|実習先園|担任の先生|主任の先生|学校の先生|実習先の先生|担任職員|主任職員|実習先指導員/g,
    "",
  );
}

function isAllowedAnonymizedChildReference(value) {
  return /^[A-EＡ-Ｅa-eａ-ｅ](児|くん|君|ちゃん)$/.test(value);
}

function normalizePossiblyAnonymizedChildReference(raw, name, suffix) {
  if (/^[A-EＡ-Ｅa-eａ-ｅ]$/.test(name)) return raw;
  const nestedAnonymous = String(name || "").match(/^(.*?)([A-EＡ-Ｅa-eａ-ｅ])$/);
  if (nestedAnonymous) return `${nestedAnonymous[1]}${nestedAnonymous[2]}${suffix}`;
  return null;
}

function normalizePossiblyAnonymizedTeacherReference(raw, name) {
  if (name === "担任の") return "担任職員";
  if (name === "主任の") return "主任職員";
  if (name === "学校の") return "学校の教員";
  if (name === "実習先の") return "実習先指導員";
  if (/^[A-EＡ-Ｅa-eａ-ｅ]$/.test(name)) return "担任職員";
  const nestedAnonymous = String(name || "").match(/^(.*?)([A-EＡ-Ｅa-eａ-ｅ])$/);
  if (nestedAnonymous) return `${nestedAnonymous[1]}担任職員`;
  return null;
}

export function prepareGenerationPayloadForAi(kind, payload = {}) {
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const fields = AI_TEXT_FIELDS_BY_KIND[kind] || Object.keys(source);
  const scanText = fields.map((field) => String(source[field] || "")).filter(Boolean).join("\n");
  const blockingFindings = detectAiBlockingFindings(scanText);
  const redactedPayload = {};
  let changed = false;

  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string") {
      redactedPayload[key] = value;
      continue;
    }
    const redacted = redactSensitiveText(value);
    redactedPayload[key] = redacted;
    if (redacted !== value) changed = true;
  }

  return {
    blocked: blockingFindings.length > 0,
    payload: redactedPayload,
    changed,
    findings: blockingFindings,
    message: buildAiPrivacyBlockMessage(blockingFindings),
  };
}

function detectAiBlockingFindings(text) {
  const normalizedText = normalizePrivacyScanText(text);
  const compactText = compactInstructionText(normalizedText);
  return AI_BLOCKING_PATTERNS
    .filter(({ pattern, code }) => pattern.test(normalizedText) || (code === "prompt_injection" && pattern.test(compactText)))
    .map(({ code, label }) => ({ code, label }));
}

function compactInstructionText(text) {
  return String(text || "").replace(/[\s　]+/g, "");
}

function buildAiPrivacyBlockMessage(findings) {
  if (!findings.length) return "";
  const labels = Array.from(new Set(findings.map((finding) => finding.label))).join("、");
  return [
    `入力内容に${labels}が含まれている可能性があります。`,
    "この内容は問い返し処理へ送信せず、入力を止めました。",
    "子どもの名前、園名、職員名は A児、実習先園、担任職員 のように置き換え、住所・連絡先・診断名・家庭事情などは入力しないでください。",
  ].join("");
}

export function sanitizeGenerationInputForLog(kind, payload = {}, privacyGuard = null) {
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const base = kind === "student_chat"
    ? {
        stage: cleanShortValue(source.stage, 30),
        target: cleanShortValue(source.target, 80),
        formatLabel: cleanShortValue(source.formatLabel, 120),
        title: cleanShortValue(source.title, 120),
        currentQuestionLength: textLength(source.currentQuestion),
        practiceGoalLength: textLength(source.practiceGoal),
        episodeMemoLength: textLength(source.episodeMemo),
        answerLength: textLength(source.answer),
      }
    : kind === "plan"
    ? {
        age: cleanShortValue(source.age, 60),
        time: cleanShortValue(source.time, 60),
        activity: cleanShortValue(source.activity, 120),
        planMemoLength: textLength(source.planMemo),
      }
    : {
        date: cleanShortValue(source.date, 30),
        weather: cleanShortValue(source.weather, 30),
        age: cleanShortValue(source.age, 60),
        scene: cleanShortValue(source.scene, 120),
        goalLength: textLength(source.goal),
        memoLength: textLength(source.memo),
        reflectionLength: textLength(source.reflection),
        tomorrowTaskLength: textLength(source.tomorrowTask),
        feedbackReceivedLength: textLength(source.feedbackReceived),
        feedbackTomorrowActionLength: textLength(source.feedbackTomorrowAction),
        tone: cleanShortValue(source.tone, 30),
      };

  return removeEmptyValues({
    ...base,
    privacyFlags: buildPrivacyFlags(source),
    privacyGuard: sanitizePrivacyGuardForLog(privacyGuard),
    sanitized: true,
  });
}

export function sanitizeGenerationOutputForLog(content = {}) {
  if (content?.kind === "student_chat") {
    return removeEmptyValues({
      kind: "student_chat",
      stage: cleanShortValue(content.stage, 30),
      target: cleanShortValue(content.target, 80),
      acknowledgementLength: textLength(content.acknowledgement),
      nextQuestionLength: textLength(content.nextQuestion),
      fieldHintLength: textLength(content.fieldHint),
      safetyNoteLength: textLength(content.safetyNote),
      organization: sanitizeStudentChatOrganizationForLog(content.organization),
      sanitized: true,
    });
  }

  return removeEmptyValues({
    headings: normalizeTextList(content.headings, 5, 80),
    sectionCount: Array.isArray(content.sections) ? Math.min(content.sections.length, 5) : undefined,
    checks: sanitizeChecksForLog(content.checks),
    checkCount: Array.isArray(content.checks) ? Math.min(content.checks.filter(Boolean).length, 5) : undefined,
    schoolFormat: sanitizeSchoolFormatSummary(content.schoolFormat),
    sanitized: true,
  });
}

function sanitizeStudentChatOrganizationForLog(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return removeEmptyValues({
    factSummaryLength: textLength(value.factSummary),
    goalConnectionLength: textLength(value.goalConnection),
    professionalReview: sanitizeStudentChatProfessionalReviewForLog(value.professionalReview),
    reflectionStarterLength: textLength(value.reflectionStarter),
    fieldStarterLengths: sanitizeStudentChatFieldStarterLengths(value.fieldStarters),
    missingInformationLength: textLength(value.missingInformation),
  });
}

function sanitizeStudentChatFieldStarterLengths(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return removeEmptyValues({
    goalReflection: textLength(value.goalReflection),
    episodeInsight: textLength(value.episodeInsight),
    overallLearning: textLength(value.overallLearning),
    nextAction: textLength(value.nextAction),
  });
}

function sanitizeStudentChatProfessionalReviewForLog(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return removeEmptyValues({
    focusTextLength: textLength(value.focusText),
    reasonLength: textLength(value.reason),
    revisionPromptLength: textLength(value.revisionPrompt),
  });
}

export function sanitizeFeedbackForLog(feedback = {}) {
  if (!feedback || typeof feedback !== "object" || Array.isArray(feedback)) return {};
  return removeEmptyValues({
    guidanceCategory: cleanShortValue(feedback.guidanceCategory, 40),
    receivedLength: nonZeroTextLength(feedback.received),
    interpretationLength: nonZeroTextLength(feedback.interpretation),
    unclearLength: nonZeroTextLength(feedback.unclear),
    tomorrowActionLength: nonZeroTextLength(feedback.tomorrowAction),
    teacherQuestionLength: nonZeroTextLength(feedback.teacherQuestion),
    nextObservationPlan: sanitizeFeedbackNextObservationPlan(feedback.nextObservationPlan),
    clarity: cleanShortValue(feedback.clarity, 40),
    usefulness: cleanShortValue(feedback.usefulness, 40),
    concernLength: nonZeroTextLength(feedback.concern),
    commentLength: nonZeroTextLength(feedback.comment),
    checkedCount: Array.isArray(feedback.checked) ? Math.min(feedback.checked.filter(Boolean).length, 10) : undefined,
    privacyFlags: buildPrivacyFlags(feedback),
    sanitized: true,
  });
}

export function sanitizeVisibleAiText(value, maxLength = 1200) {
  return redactSensitiveText(value).slice(0, maxLength);
}

export function redactSensitiveTextForPreview(value, maxLength = MAX_LOG_TEXT) {
  return cleanLongValue(value, maxLength);
}

function sanitizeFeedbackNextObservationPlan(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return removeEmptyValues({
    focusLength: nonZeroTextLength(value.focus),
    observationPointCount: countNonEmptyTextItems(value.observationPoints, 5),
    diaryCheckCount: countNonEmptyTextItems(value.diaryChecks, 5),
    consultQuestionCount: countNonEmptyTextItems(value.consultQuestions, 3),
  });
}

export function sanitizeLogSessionForLog(session = {}) {
  if (!session || typeof session !== "object" || Array.isArray(session)) return {};
  return removeEmptyValues({
    source: cleanShortValue(session.source || "supabase", 40),
    userId: cleanShortValue(session.userId, 80),
    role: cleanShortValue(session.role || "student", 30),
    schoolId: cleanShortValue(session.schoolId, 80),
    classId: cleanShortValue(session.classId, 80),
    sanitized: true,
  });
}

export function sanitizeClientResultForLog(result = {}) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  return sanitizeGenerationOutputForLog(result);
}

export function sanitizeResultMetaForLog(resultMeta = {}) {
  if (!resultMeta || typeof resultMeta !== "object" || Array.isArray(resultMeta)) return null;
  return removeEmptyValues({
    kind: cleanShortValue(resultMeta.kind, 40),
    tone: cleanShortValue(resultMeta.tone, 40),
    createdAt: cleanShortValue(resultMeta.createdAt, 80),
    inputSummary: sanitizeGenerationInputSummaryForLog(resultMeta.input),
    sanitized: true,
  });
}

export function buildClientGenerationResponse(content = {}) {
  const { model, source, subscription, bedrockGuardrail, privacyGuard, schoolFormat, ...clientContent } = content;
  return clientContent;
}

function sanitizePrivacyGuardForLog(privacyGuard = {}) {
  if (!privacyGuard || typeof privacyGuard !== "object" || Array.isArray(privacyGuard)) return undefined;
  return removeEmptyValues({
    redactedBeforeAi: privacyGuard.redactedBeforeAi === true ? true : undefined,
    blocked: privacyGuard.blocked === true ? true : undefined,
    bedrockGuardrail: sanitizeBedrockGuardrailForLog(privacyGuard.bedrockGuardrail),
  });
}

function sanitizeBedrockGuardrailForLog(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return removeEmptyValues({
    mode: cleanShortValue(value.mode, 20),
    status: cleanShortValue(value.status, 20),
    action: cleanShortValue(value.action, 40),
    intervened: value.intervened === true ? true : undefined,
    findingCount: sanitizeNumber(value.findingCount, 1000),
    findingTypes: normalizeTextList(value.findingTypes, 20, 80),
    usage: sanitizeBedrockUsageForLog(value.usage),
    estimatedTextUnits: sanitizeNumber(value.estimatedTextUnits, 100000),
    estimatedCostUsd: sanitizeCost(value.estimatedCostUsd),
    actualCostUsd: sanitizeCost(value.actualCostUsd),
    latencyMs: sanitizeNumber(value.latencyMs, 120000),
    reason: cleanShortValue(value.reason, 80),
  });
}

function sanitizeBedrockUsageForLog(usage = {}) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return undefined;
  return removeEmptyValues(
    Object.fromEntries(
      Object.entries(usage)
        .filter(([key, value]) => /^[A-Za-z0-9_.:-]{1,80}$/.test(String(key)) && Number.isFinite(Number(value)))
        .map(([key, value]) => [key, sanitizeNumber(value, 1000000)]),
    ),
  );
}

function sanitizeNumber(value, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return undefined;
  return Math.min(number, max);
}

function sanitizeCost(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return undefined;
  return Number(number.toFixed(8));
}

function normalizeTextList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanLongValue(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function sanitizeChecksForLog(value) {
  if (!Array.isArray(value)) return [];
  const labels = value.map(classifyCheckForLog).filter(Boolean).slice(0, 5);
  return [...new Set(labels)];
}

function classifyCheckForLog(value) {
  const text = String(value || "");
  if (!text.trim()) return "";
  if (/個人|匿名|置換|実名|名前|園名|施設名|職員|先生/.test(text)) return "個人情報の確認";
  if (/断定|評価|診断|決めつけ|発達|気持ち|判断/.test(text)) return "表現の確認";
  if (/5領域|五領域|保育所保育指針|指針/.test(text)) return "指針とのつながり確認";
  if (/未入力|追記|具体|場面|内容|声かけ|観察/.test(text)) return "入力不足の確認";
  if (/教員|相談|確認/.test(text)) return "教員への相談整理";
  return "提出前の自己確認";
}

function sanitizeSchoolFormatSummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return removeEmptyValues({
    applied: true,
    diaryHeadingCount: countNonEmptyTextItems(value.diaryHeadings, 20),
    studentDiaryFieldLabelCount: countObjectTextValues(value.studentDiaryFieldLabels || value.diaryFieldLabels, 20),
    planHeadingCount: countNonEmptyTextItems(value.planHeadings, 20),
    checkRuleCount: countNonEmptyTextItems(value.checkRules, 30),
    hasWritingStyle: textLength(value.writingStyle) > 0 ? true : undefined,
  });
}

function buildPrivacyFlags(value) {
  const text = normalizePrivacyScanText(JSON.stringify(value || {}));
  const riskText = removeAllowedAnonymizedTerms(text);
  return removeEmptyValues({
    hasChildNameLikeText: /(くん|ちゃん|氏名|名前|愛称)/.test(riskText) || undefined,
    hasSchoolNameLikeText: SCHOOL_NAME_FLAG_PATTERN.test(riskText) || undefined,
    hasMedicalOrFamilyInfo: (MEDICAL_INFO_PATTERN.test(riskText) || FAMILY_INFO_PATTERN.test(riskText)) || undefined,
    hasContactInfo: (/@|https?:\/\//i.test(riskText) || PHONE_PATTERN.test(riskText) || CONTACT_LABEL_PATTERN.test(riskText)) || undefined,
    hasIdentifierLikeText: (/(学籍番号|学生番号|出席番号|住所|所在地|保護者名)/.test(riskText) || JAPANESE_ADDRESS_PATTERN.test(riskText) || GUARDIAN_NAME_PATTERN.test(riskText)) || undefined,
  });
}

function sanitizeGenerationInputSummaryForLog(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return removeEmptyValues({
    date: cleanShortValue(input.date, 30),
    age: cleanShortValue(input.age, 60),
    scene: cleanShortValue(input.scene, 120),
    tone: cleanShortValue(input.tone, 30),
    goalLength: textLength(input.goal),
    memoLength: textLength(input.memo),
    reflectionLength: textLength(input.reflection),
    tomorrowTaskLength: textLength(input.tomorrowTask),
    privacyFlags: buildPrivacyFlags(input),
  });
}

function cleanShortValue(value, maxLength) {
  return cleanLongValue(value, maxLength);
}

function cleanLongValue(value, maxLength = MAX_LOG_TEXT) {
  const text = normalizePrivacyScanText(value).replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  return redactSensitiveText(text).slice(0, maxLength);
}

function redactSensitiveText(text) {
  let next = normalizePrivacyScanText(text);
  for (const [pattern, replacement] of SENSITIVE_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  next = next.replace(COMMON_FULL_NAME_REDACTION_PATTERN, "〈氏名〉");
  let childIndex = 0;
  const childLabels = ["A児", "B児", "C児", "D児", "E児"];
  const childNameMap = new Map();
  next = next.replace(/([一-龯ぁ-んァ-ンA-Za-z0-9０-９]{1,18})(くん|ちゃん|君)/g, (raw, name, suffix) => {
    if (isAllowedAnonymizedChildReference(raw)) return raw;
    const normalizedAnonymous = normalizePossiblyAnonymizedChildReference(raw, name, suffix);
    if (normalizedAnonymous) return normalizedAnonymous;
    if (!childNameMap.has(raw)) {
      const label = childLabels[Math.min(childIndex, childLabels.length - 1)];
      childNameMap.set(raw, label);
      childIndex += 1;
    }
    return childNameMap.get(raw);
  });
  next = next.replace(/(子ども名|こども名|園児名|児童名)[0-9０-９]*/g, () => {
    const label = childLabels[Math.min(childIndex, childLabels.length - 1)];
    childIndex += 1;
    return label;
  });
  let bareNameIndex = 0;
  next = next.replace(/(氏名|名前|実名|本名|園児名|児童名|保護者名)[:：]\s*([一-龯ぁ-んァ-ンA-Za-z0-9０-９]{1,18})/g, () => {
    const label = childLabels[Math.min(bareNameIndex, childLabels.length - 1)];
    bareNameIndex += 1;
    return label;
  });
  next = next.replace(/(担任教員名|担任名|職員名|保育者名|先生名)[0-9０-９]*/g, "担任職員");
  next = next.replace(/([一-龯ぁ-んァ-ンA-Za-z0-9０-９]{1,18})(先生)/g, (raw, name) => {
    const normalizedAnonymous = normalizePossiblyAnonymizedTeacherReference(raw, name);
    if (normalizedAnonymous) return normalizedAnonymous;
    return "担任職員";
  });
  return next.replace(/\s{3,}/g, " ");
}

function redactFacilityName(raw, name, facility) {
  const compact = `${name}${facility}${raw.endsWith("名") ? "名" : ""}`;
  return ABSTRACT_FACILITY_LABELS.has(compact) || isAbstractFacilityReference(raw) ? raw : "〈園名〉";
}

function redactFacilityLabelValue(raw, prefix = "", _label = "", tail = "") {
  return isSafeAbstractFacilityLabelRule(tail) ? raw : `${prefix}〈園名〉`;
}

function isAbstractFacilityReference(value) {
  const remainder = String(value || "")
    .replace(ABSTRACT_FACILITY_LABEL_PATTERN, "")
    .replace(/実習先の|施設の|学校の|学校が指定する|学校指定の|指定する|各|該当の|対象の|日誌の|様式の|記入欄の|入力欄の|この|その|当該/g, "")
    .replace(/と|や|及び|並びに|または|又は|[\s　\-ー−–—・/／、,]+/g, "")
    .trim();
  return remainder === "";
}

function isSafeAbstractFacilityLabelRule(value) {
  const text = String(value || "").replace(/^\s*[:：]?\s*/, "").trim();
  if (!text) return false;
  if (isAbstractFacilityLabelList(text)) return true;
  const abstractLabelRuleTail = text
    .replace(ABSTRACT_FACILITY_LABEL_PATTERN, "")
    .replace(/^[\s　\-ー−–—・/／、,とや及び並びにまたは又は]+/g, "")
    .trim();
  if (abstractLabelRuleTail.startsWith("は")) {
    return isSafeFacilityLabelTail(abstractLabelRuleTail.replace(/^は\s*/, ""));
  }
  const withoutAbstractLabels = text.replace(ABSTRACT_FACILITY_LABEL_PATTERN, "");
  if (FACILITY_NAME_LIKE_PATTERN.test(withoutAbstractLabels)) return false;
  return isSafeFacilityLabelTail(text);
}

function isSafeFacilityLabelTail(value) {
  const text = String(value || "")
    .replace(/^\s*[:：=＝>＞→⇒\-ー−–—・/／、,，;；|｜（(【「『\[\［《〈〔<＜{｛]?\s*/, "")
    .replace(/\s*[）)】」』\]\］》〉〕>＞}｝]\s*$/g, "")
    .trim();
  if (!text) return false;
  return SAFE_FACILITY_LABEL_TAIL_PATTERN.test(text);
}

function isAbstractFacilityLabelList(value) {
  const remainder = String(value || "")
    .replace(ABSTRACT_FACILITY_LABEL_PATTERN, "")
    .replace(/[\s　\-ー−–—・/／、,とや及び並びにまたは又は]+/g, "")
    .trim();
  return remainder === "";
}

function textLength(value) {
  return String(value || "").trim().length;
}

function nonZeroTextLength(value) {
  return textLength(value) || undefined;
}

function countNonEmptyTextItems(value, maxItems) {
  if (!Array.isArray(value)) return undefined;
  const count = value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, maxItems).length;
  return count || undefined;
}

function countObjectTextValues(value, maxItems) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const count = Object.values(value).map((item) => String(item || "").trim()).filter(Boolean).slice(0, maxItems).length;
  return count || undefined;
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
