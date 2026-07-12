import { isRestConfigured, supabaseRestFetch } from "./_supabase.js";
import { prepareGenerationPayloadForAi } from "./_privacy.js";
import { registerPublicError } from "./_publicError.js";
import { normalizePrivacyScanText } from "../privacyPatterns.js";

const DEFAULT_STUDENT_DIARY_FIELD_LABELS = {
  goalReflection: "その日の実習目標に対する振り返り",
  episodeMemo: "エピソード",
  episodeInsight: "エピソードから得た気づき",
  overallLearning: "保育者として大切にしなければならないことの気づき",
  nextAction: "次の日取り組みたいこと",
};

const STUDENT_DIARY_FIELD_KEYS = Object.freeze(Object.keys(DEFAULT_STUDENT_DIARY_FIELD_LABELS));
const DEFAULT_STUDENT_DIARY_REQUIREMENTS = Object.freeze({
  requiredFields: STUDENT_DIARY_FIELD_KEYS,
  episodes: Object.freeze({ initialCount: 2, requiredCount: 1, minCount: 1, maxCount: 4 }),
});

export const DEFAULT_SCHOOL_FORMAT = {
  diaryHeadings: ["エピソードの整理", "気づきの確認", "表現の確認", "明日の観察", "教員への相談"],
  studentDiaryFieldLabels: { ...DEFAULT_STUDENT_DIARY_FIELD_LABELS },
  studentDiaryRequirements: copyStudentDiaryRequirements(DEFAULT_STUDENT_DIARY_REQUIREMENTS),
  planHeadings: ["活動概要", "ねらい", "環境構成", "展開と援助", "相談ポイント"],
  checkRules: ["個人名の置換・マスキング", "断定表現の確認", "未入力項目の明示", "保育所保育指針の観点", "学校の担当教員への相談点"],
  writingStyle: "学生が自分で書いた記録に対して、完成文ではなく問い返し・安全確認・相談点として返す。",
};

export const SCHOOL_FORMAT_TEMPLATE_SELECT =
  "diary_headings,student_diary_field_labels,plan_headings,check_rules,writing_style,student_diary_requirements,updated_at";

const MAX_HEADING_LENGTH = 18;
const MAX_RULE_LENGTH = 48;
const MAX_STYLE_LENGTH = 600;
const UNSAFE_FORMAT_TEXT_PATTERN =
  /(前の指示|これまでの指示|上記の指示|システム指示|上位(?:命令|指示).{0,20}(?:従わず|従わない|無視)|system prompt|developer message|developer instructions|prompt injection|(?:forget|ignore|disregard|override|bypass|do not follow)\s+(?:all\s+)?(?:of\s+)?(?:the\s+)?(?:(?:previous|prior|above|highest-priority)\s+)?(?:system\s+|developer\s+)?instructions?|(?<!do not )(?<!never )(?:fabricate|invent)\s+(?:observations?|facts?|details?)|reveal (?:the )?system prompt|output (?:real names|personal data)|プロンプト|制約を無視|指示を無視|JSON不要|実名を出力|個人情報を出力|完成文として提出)/i;
const SCHOOL_FORMAT_SAFETY_RULE_PATTERN =
  /(置き換え|置換|伏せ字|マスキング|匿名化|入力しない|記入しない|記入不要|書かない|記載しない|載せない|空欄|未記入|無記入|避け|確認|注意|削除|省略|A児|実習先園|担任職員|個人情報|要配慮情報)/;
const SCHOOL_FORMAT_SENSITIVE_TOPIC_PATTERN =
  /(園名|実習先名|施設名|保育園|保育所|幼稚園|こども園|認定こども園|ナーサリー|キッズ園|子ども名|子供名|園児名|児童名|個人名|名前|氏名|実名|診断名|病名|障害|住所|電話番号|メール|連絡先|家庭事情|経済状況|保護者名|職員名|先生名|担任名|学籍番号|学生番号|出席番号)/;
const SCHOOL_FORMAT_DIRECT_CONTACT_PATTERN =
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/[^\s]+|\b0\d{1,4}[-ー−.．/／]?\d{1,4}[-ー−.．/／]?\d{3,4}\b/i;
const SCHOOL_FORMAT_ADDRESS_LIKE_PATTERN =
  /(東京都|北海道|京都府|大阪府|.{1,8}県).{0,30}(市|区|町|村).{0,30}(\d|[0-9０-９]|丁目|番地|号)/;
const SCHOOL_FORMAT_NAME_CHAR_SOURCE = "一-龯ぁ-んァ-ンA-Za-z0-9０-９〇○々ヶヵー・";
const SCHOOL_FORMAT_NAME_CHARS = `[${SCHOOL_FORMAT_NAME_CHAR_SOURCE}]`;
const SCHOOL_FORMAT_NAME_CHAR_PATTERN = new RegExp(`[${SCHOOL_FORMAT_NAME_CHAR_SOURCE}]$`);
const SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_SOURCE =
  "認定こども園名|こども園名|保育園名|保育所名|幼稚園名|ナーサリー名|キッズ園名|園名|実習先名|施設名";
const SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_PREFIX_SOURCE =
  "(?:実習先の|施設の|学校の|学校が指定する|学校指定の|指定する|各|該当の|対象の|日誌の|様式の|記入欄の|入力欄の|この|その|当該)?";
const SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_TOKEN_SOURCE = `${SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_PREFIX_SOURCE}(?:${SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_SOURCE})`;
const SCHOOL_FORMAT_SAFE_FACILITY_LABEL_VALUE_SOURCE = "実習先園|担任職員|主任職員|学校の教員|A児|B児|C児|D児|E児";
const SCHOOL_FORMAT_FACILITY_LABEL_QUALIFIER_SOURCE = "(?:(?:の)?(?:欄|項目)|の場合|場合)?";
const SCHOOL_FORMAT_FACILITY_LABEL_PARTICLE_SOURCE = "(?:には|では|として|は|へ|に|を)";
const SCHOOL_FORMAT_FACILITY_LABEL_SEPARATOR_SOURCE = "[:：=＝>＞→⇒\\-ー−–—・/／、,，;；|｜（(【「『\\[［《〈〔<＜{｛]";
const SCHOOL_FORMAT_FACILITY_ABSTRACT_LABELS = SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_SOURCE.split("|");
const SCHOOL_FORMAT_ABSTRACT_FACILITY_LABEL_PATTERN = new RegExp(`(?:${SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_SOURCE})`, "g");
const SCHOOL_FORMAT_DASH_LIKE_SEPARATOR_PATTERN = /[‐‑‒―]/g;
const SCHOOL_FORMAT_ABSTRACT_FACILITY_PREFIX_PATTERN =
  /(?:^|[\s　「『（(【])(?:実習先の|施設の|学校の|学校が指定する|学校指定の|指定する|各|該当の|対象の|日誌の|様式の|記入欄の|入力欄の|この|その|当該)$/;
const SCHOOL_FORMAT_FACILITY_NAME_LIKE_PATTERN =
  new RegExp(`${SCHOOL_FORMAT_NAME_CHARS}{1,30}[\\s　\\-ー−–—・/／]*(?:認定こども園|こども園|保育園|保育所|幼稚園|ナーサリー|キッズ園)名?`);
const SCHOOL_FORMAT_BARE_FACILITY_NAME_SEPARATOR_SOURCE = "\\s　\\-ー−–—・/／";
const SCHOOL_FORMAT_BARE_FACILITY_NAME_PATTERN = new RegExp(
  `(?:^|[^${SCHOOL_FORMAT_NAME_CHAR_SOURCE}])(${SCHOOL_FORMAT_NAME_CHARS}{1,30}(?:[${SCHOOL_FORMAT_BARE_FACILITY_NAME_SEPARATOR_SOURCE}]*園))(?!名|児|庭|長|内|外|舎|生活|時刻|時)`,
  "g",
);
const SCHOOL_FORMAT_SPLIT_FACILITY_LABEL_PATTERN =
  /(認定こども園|こども園|保育園|保育所|幼稚園|ナーサリー|キッズ園|園|実習先|施設)[\s　\-ー−–—・/／]+名/g;
const SCHOOL_FORMAT_ATTACHED_SAFETY_VALUE_PATTERN = new RegExp(
  `(?:${SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_TOKEN_SOURCE})(?:確認済み?|削除済み?|省略済み?|置換済み?|置き換え済み?|マスキング済み?|匿名化済み?|確認|削除|省略|置換|置き換え|マスキング|匿名化|入力しない|記入しない|記入不要|書かない|記載しない|載せない|空欄|未記入|無記入)([^\\s　、。;；|｜]{1,40})`,
  "g",
);
const SCHOOL_FORMAT_CONFIRMATION_FIELD_VALUE_PATTERN = new RegExp(
  `(?:${SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_TOKEN_SOURCE})(?:確認欄|確認項目|確認チェック欄|チェック欄|項目|欄)(?:\\s*${SCHOOL_FORMAT_FACILITY_LABEL_SEPARATOR_SOURCE}\\s*|\\s+|[。｡]\\s*)([^\\n\\r]{1,80})`,
  "g",
);
const SCHOOL_FORMAT_NON_SPECIFIC_FACILITY_WORDS = new Set([
  "保育園",
  "幼稚園",
  "こども園",
  "キッズ園",
  "実習先園",
  "登園",
  "降園",
  "通園",
  "在園",
  "入園",
  "退園",
  "転園",
  "来園",
  "開園",
  "閉園",
  "休園",
]);
const SCHOOL_FORMAT_FACILITY_LABEL_VALUE_PATTERN = new RegExp(
  `(?:${SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_TOKEN_SOURCE})(?:${SCHOOL_FORMAT_FACILITY_LABEL_QUALIFIER_SOURCE})(?:\\s*${SCHOOL_FORMAT_FACILITY_LABEL_SEPARATOR_SOURCE}\\s*|\\s+)(?!(?:${SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_TOKEN_SOURCE})|(?:${SCHOOL_FORMAT_SAFE_FACILITY_LABEL_VALUE_SOURCE})|(?:には|では|として|は|へ|を|に|と|や|及び|並びに|または|又は)|(?:入力しない|記入しない|記入不要|書かない|記載しない|載せない|伏せ字|マスキング|匿名化|置き換え|置換|確認|削除|省略))[^\\s、。]{1,40}`,
);
const SCHOOL_FORMAT_FACILITY_LABEL_TAIL_PATTERN = new RegExp(
  `(?:${SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_TOKEN_SOURCE})(?:${SCHOOL_FORMAT_FACILITY_LABEL_QUALIFIER_SOURCE})(?:\\s*${SCHOOL_FORMAT_FACILITY_LABEL_SEPARATOR_SOURCE}\\s*|\\s+)([^\\n\\r]{1,80})`,
  "g",
);
const SCHOOL_FORMAT_FACILITY_ACTION_VALUE_PATTERN = new RegExp(
  `(?:${SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_TOKEN_SOURCE})(?:${SCHOOL_FORMAT_FACILITY_LABEL_QUALIFIER_SOURCE})(?:\\s*${SCHOOL_FORMAT_FACILITY_LABEL_SEPARATOR_SOURCE}\\s*|\\s+)(?:確認済み?|削除済み?|省略済み?|置換済み?|置き換え済み?|マスキング済み?|匿名化済み?|確認|削除|省略|置換|置き換え|マスキング|匿名化)(?:\\s*${SCHOOL_FORMAT_FACILITY_LABEL_SEPARATOR_SOURCE}\\s*|\\s+)([^\\n\\r]{1,80})`,
  "g",
);
const SCHOOL_FORMAT_FACILITY_HA_VALUE_PATTERN = new RegExp(
  `(?:${SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_TOKEN_SOURCE})(?:${SCHOOL_FORMAT_FACILITY_LABEL_QUALIFIER_SOURCE})\\s*${SCHOOL_FORMAT_FACILITY_LABEL_PARTICLE_SOURCE}\\s*[^\\n\\r]{1,80}`,
  "g",
);
const SCHOOL_FORMAT_NO_ENTRY_RULE_SOURCE =
  "(?:(?:入力しない|記入しない|記入不要|書かない|記載しない|載せない)(?:こと|でください|ようにする|してください|ようにしてください|ようお願いします|ようお願いいたします)?|(?:空欄|未記入|無記入)(?:にする|で残す|で扱う|のままにする|にしてください|にしておく))";
const SCHOOL_FORMAT_SAFE_FACILITY_LABEL_CONTINUATION_PATTERN =
  /^(?:学生本人の言葉を残す|入力にない事実を補わない|記録にない事実を補わない|安全な表現に整える)$/;
const SCHOOL_FORMAT_SAFE_FORMAT_INSTRUCTION_PATTERN =
  /^(?:登園|降園)(?:時刻|時間)は(?:書く|記入する|入力する|残す)$/;
const SCHOOL_FORMAT_SAFE_FACILITY_LABEL_TAIL_PATTERN =
  /^(?:(?:入力しない|記入しない|記入不要|書かない|記載しない|載せない)(?:こと|でください|ようにする|してください|ようにしてください|ようお願いします|ようお願いいたします)?|(?:空欄|未記入|無記入)(?:にする|で残す|で扱う|のままにする|にしてください|にしておく)|避け(?:る|てください|ること|るようにする|るようにしてください|るようお願いします|るようお願いいたします)?|(?:確認|削除|省略|マスキング|匿名化)(?:する|してください|できている|できています|するようにしてください|するようお願いします|するようお願いいたします)?|(?:置き換え|置換)(?:る|する|てください)?|伏せ字(?:にする|で扱う|で残す)?|(?:安全な表現|安全な形|別の表現|匿名表現|置換済み表現|実習先園|担任職員|主任職員|学校の教員|A児|B児|C児|D児|E児)(?:(?:に|へ)(?:置き換え(?:る)?|置換する?|する|してください)|として(?:扱う|使う|残す)|で(?:扱う|使う|残す))?)(?:[、,]\s*(?:学生本人の言葉を残す|入力にない事実を補わない|記録にない事実を補わない|安全な表現に整える))*$/;
const SCHOOL_FORMAT_RAW_VALUE_PATTERN =
  /(?:氏名|名前|実名|本名|園児名|児童名|子ども名|子供名|保護者名|園名|実習先名|施設名|住所|電話番号|メール|連絡先|学籍番号|学生番号|出席番号)[:：]\s*(?!A児|B児|C児|D児|E児|実習先園|担任職員|主任職員|学校の教員|入力しない|記入しない|記入不要|記載しない|伏せ字|マスキング|匿名化)[^\s、。]{1,40}/;
const SCHOOL_FORMAT_LATIN_FACILITY_LABEL_PATTERN =
  /\b(?:facility|school)\s*name\s*[:=]\s*[A-Za-z][A-Za-z0-9'&.\- ]{1,60}/i;
const SCHOOL_FORMAT_LATIN_FACILITY_NAME_PATTERN =
  /\b[A-Z][A-Za-z0-9'&.-]{2,}(?:\s+[A-Z][A-Za-z0-9'&.-]{2,}){0,3}\s+(?:Nursery|Preschool|Kindergarten|Daycare|Hoikuen|Kodomoen|NURSERY|PRESCHOOL|KINDERGARTEN|DAYCARE|HOIKUEN|KODOMOEN)\b/;

export async function getSchoolFormatForSchool(schoolId) {
  if (!isRestConfigured() || !schoolId) return { ...DEFAULT_SCHOOL_FORMAT };

  const rows = await supabaseRestFetch(
    `/school_format_templates?select=${SCHOOL_FORMAT_TEMPLATE_SELECT}&school_id=eq.${encodeURIComponent(schoolId)}&limit=1`,
  );
  if (!Array.isArray(rows)) throw new Error("school_format_response_invalid");
  if (!rows?.[0]) return { ...DEFAULT_SCHOOL_FORMAT };
  if (!isStoredSchoolFormatRowValid(rows[0])) throw new Error("school_format_row_invalid");
  return normalizeSchoolFormat(rows[0]);
}

export function isStoredSchoolFormatRowValid(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const labels = input.student_diary_field_labels;
  const requirements = input.student_diary_requirements;
  const episodes = requirements?.episodes;
  const episodeKeys = ["initialCount", "requiredCount", "minCount", "maxCount"];
  const episodeValues = episodeKeys.map((key) => episodes?.[key]);

  return isCompleteTextList(input.diary_headings, DEFAULT_SCHOOL_FORMAT.diaryHeadings.length, MAX_HEADING_LENGTH)
    && labels && typeof labels === "object" && !Array.isArray(labels)
    && STUDENT_DIARY_FIELD_KEYS.every((key) => isNonEmptyText(labels[key], 80))
    && requirements && typeof requirements === "object" && !Array.isArray(requirements)
    && Array.isArray(requirements.requiredFields) && requirements.requiredFields.length > 0
    && requirements.requiredFields.every((key) => STUDENT_DIARY_FIELD_KEYS.includes(key))
    && episodes && typeof episodes === "object" && !Array.isArray(episodes)
    && episodeValues.every(Number.isInteger)
    && 1 <= episodes.minCount
    && episodes.minCount <= episodes.initialCount
    && episodes.initialCount <= episodes.maxCount
    && episodes.maxCount <= 8
    && 1 <= episodes.requiredCount
    && episodes.requiredCount <= episodes.maxCount
    && isCompleteTextList(input.plan_headings, DEFAULT_SCHOOL_FORMAT.planHeadings.length, MAX_HEADING_LENGTH)
    && isTextListWithinRange(input.check_rules, 3, 8, MAX_RULE_LENGTH)
    && isNonEmptyText(input.writing_style, MAX_STYLE_LENGTH)
    && isValidTimestamp(input.updated_at);
}

export function normalizeSchoolFormat(input = {}) {
  const source = {
    diaryHeadings: input.diaryHeadings ?? input.diary_headings,
    studentDiaryFieldLabels: input.studentDiaryFieldLabels ?? input.student_diary_field_labels ?? input.diaryFieldLabels ?? input.diary_field_labels,
    studentDiaryRequirements: input.studentDiaryRequirements ?? input.student_diary_requirements,
    planHeadings: input.planHeadings ?? input.plan_headings,
    checkRules: input.checkRules ?? input.check_rules,
    writingStyle: input.writingStyle ?? input.writing_style,
  };

  return {
    diaryHeadings: normalizeFixedList(source.diaryHeadings, DEFAULT_SCHOOL_FORMAT.diaryHeadings, MAX_HEADING_LENGTH),
    studentDiaryFieldLabels: normalizeStudentDiaryFieldLabels(source.studentDiaryFieldLabels),
    studentDiaryRequirements: normalizeStudentDiaryRequirements(source.studentDiaryRequirements),
    planHeadings: normalizeFixedList(source.planHeadings, DEFAULT_SCHOOL_FORMAT.planHeadings, MAX_HEADING_LENGTH),
    checkRules: normalizeFlexibleList(source.checkRules, DEFAULT_SCHOOL_FORMAT.checkRules, MAX_RULE_LENGTH, 3, 8),
    writingStyle: normalizeText(source.writingStyle, DEFAULT_SCHOOL_FORMAT.writingStyle, MAX_STYLE_LENGTH),
  };
}

export function toSchoolFormatRow(template, context) {
  return {
    school_id: context.session.schoolId,
    diary_headings: template.diaryHeadings,
    student_diary_field_labels: template.studentDiaryFieldLabels,
    student_diary_requirements: template.studentDiaryRequirements,
    plan_headings: template.planHeadings,
    check_rules: template.checkRules,
    writing_style: template.writingStyle,
    updated_by: context.user.id,
    updated_at: new Date().toISOString(),
  };
}

export function summarizeSchoolFormat(template) {
  if (!template) return null;
  return {
    diaryHeadings: template.diaryHeadings,
    studentDiaryFieldLabels: template.studentDiaryFieldLabels,
    studentDiaryRequirements: normalizeStudentDiaryRequirements(template.studentDiaryRequirements ?? template.student_diary_requirements),
    planHeadings: template.planHeadings,
    checkRules: template.checkRules,
  };
}

export function summarizeStudentSchoolFormat(template) {
  const normalized = normalizeSchoolFormat(template || DEFAULT_SCHOOL_FORMAT);
  return {
    studentDiaryFieldLabels: normalized.studentDiaryFieldLabels,
    studentDiaryRequirements: normalized.studentDiaryRequirements,
  };
}

function normalizeStudentDiaryRequirements(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return copyStudentDiaryRequirements(DEFAULT_STUDENT_DIARY_REQUIREMENTS);
  }

  const requiredFields = Array.isArray(value.requiredFields)
    ? [...new Set(value.requiredFields.filter((field) => STUDENT_DIARY_FIELD_KEYS.includes(field)))]
    : [];
  const episodeResult = normalizeStudentDiaryEpisodes(value.episodes);
  if (!episodeResult.valid) {
    return copyStudentDiaryRequirements(DEFAULT_STUDENT_DIARY_REQUIREMENTS);
  }

  return {
    requiredFields: requiredFields.length > 0 ? requiredFields : [...DEFAULT_STUDENT_DIARY_REQUIREMENTS.requiredFields],
    episodes: episodeResult.episodes,
  };
}

function isCompleteTextList(value, expectedLength, maxLength) {
  return Array.isArray(value)
    && value.length === expectedLength
    && value.every((item) => isNonEmptyText(item, maxLength));
}

function isTextListWithinRange(value, minItems, maxItems, maxLength) {
  return Array.isArray(value)
    && value.length >= minItems
    && value.length <= maxItems
    && value.every((item) => isNonEmptyText(item, maxLength));
}

function isNonEmptyText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isValidTimestamp(value) {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function normalizeStudentDiaryEpisodes(value) {
  const defaults = DEFAULT_STUDENT_DIARY_REQUIREMENTS.episodes;
  if (value === undefined) return { valid: true, episodes: { ...defaults } };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, episodes: { ...defaults } };

  const episodes = {
    initialCount: value.initialCount ?? defaults.initialCount,
    requiredCount: value.requiredCount ?? defaults.requiredCount,
    minCount: value.minCount ?? defaults.minCount,
    maxCount: value.maxCount ?? defaults.maxCount,
  };
  const allIntegers = Object.values(episodes).every(Number.isInteger);
  const consistent = 1 <= episodes.minCount
    && episodes.minCount <= episodes.initialCount
    && episodes.initialCount <= episodes.maxCount
    && episodes.maxCount <= 8
    && 1 <= episodes.requiredCount
    && episodes.requiredCount <= episodes.maxCount;
  return allIntegers && consistent
    ? { valid: true, episodes }
    : { valid: false, episodes: { ...defaults } };
}

function copyStudentDiaryRequirements(value) {
  return {
    requiredFields: [...value.requiredFields],
    episodes: { ...value.episodes },
  };
}

function normalizeStudentDiaryFieldLabels(value = {}) {
  const labels = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    goalReflection: normalizeText(labels.goalReflection, DEFAULT_STUDENT_DIARY_FIELD_LABELS.goalReflection, 80),
    episodeMemo: normalizeText(labels.episodeMemo, DEFAULT_STUDENT_DIARY_FIELD_LABELS.episodeMemo, 80),
    episodeInsight: normalizeText(labels.episodeInsight, DEFAULT_STUDENT_DIARY_FIELD_LABELS.episodeInsight, 80),
    overallLearning: normalizeText(labels.overallLearning, DEFAULT_STUDENT_DIARY_FIELD_LABELS.overallLearning, 80),
    nextAction: normalizeText(labels.nextAction, DEFAULT_STUDENT_DIARY_FIELD_LABELS.nextAction, 80),
  };
}

function normalizeFixedList(value, fallback, maxLength) {
  const list = Array.isArray(value) ? value : [];
  return fallback.map((fallbackItem, index) => normalizeText(list[index], fallbackItem, maxLength));
}

function normalizeFlexibleList(value, fallback, maxLength, minItems, maxItems) {
  const list = Array.isArray(value) ? value : [];
  const cleaned = list
    .map((item) => normalizeText(item, "", maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
  const next = cleaned.length >= minItems ? cleaned : fallback;
  return next.slice(0, maxItems);
}

function normalizeText(value, fallback, maxLength) {
  const text = typeof value === "string" ? value : "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  const scanText = normalizeSchoolFormatScanText(cleaned).replace(/\s+/g, " ").trim().replace(/。+$/g, "");
  if (UNSAFE_FORMAT_TEXT_PATTERN.test(scanText)) {
    throw new SchoolFormatError("学校フォーマットに、AIの安全ルールを変更するような表現が含まれています。様式や確認観点だけを入力してください。");
  }
  if (cleaned && containsUnsafeSchoolFormatContent(scanText)) {
    throw new SchoolFormatError("学校フォーマットには、記入済み日誌や個人情報候補を入れず、欄名・見出し・確認観点だけを入力してください。");
  }
  return (cleaned || fallback).slice(0, maxLength);
}

function containsUnsafeSchoolFormatContent(text) {
  if (SCHOOL_FORMAT_LATIN_FACILITY_LABEL_PATTERN.test(text)) return true;
  if (SCHOOL_FORMAT_LATIN_FACILITY_NAME_PATTERN.test(text)) return true;
  if (hasUnsafeFacilityLabelValue(text)) return true;
  if (hasConcreteFacilityNameLikeText(text)) return true;
  const result = prepareGenerationPayloadForAi("diary", { memo: text });
  if (!result.blocked && !result.changed) return false;
  if (isAbstractFacilityLabelList(text)) return false;
  if (isAllowedSchoolSafetyRuleText(text)) return false;
  return true;
}

function normalizeSchoolFormatScanText(text) {
  return normalizePrivacyScanText(text).normalize("NFKC")
    .replace(SCHOOL_FORMAT_DASH_LIKE_SEPARATOR_PATTERN, "-")
    .replace(SCHOOL_FORMAT_SPLIT_FACILITY_LABEL_PATTERN, "$1名");
}

function hasUnsafeFacilityLabelValue(text) {
  const source = normalizeSchoolFormatScanText(text);
  for (const match of source.matchAll(SCHOOL_FORMAT_CONFIRMATION_FIELD_VALUE_PATTERN)) {
    if (!isSafeFacilityLabelTail(match[1])) return true;
  }
  for (const match of source.matchAll(SCHOOL_FORMAT_FACILITY_LABEL_TAIL_PATTERN)) {
    if (isSafeFacilityLabelPlaceholderValue(match[1])) continue;
    if (!isSafeFacilityLabelTail(match[1])) return true;
  }
  for (const match of source.matchAll(SCHOOL_FORMAT_ATTACHED_SAFETY_VALUE_PATTERN)) {
    if (!isSafeAttachedFacilityLabelTail(match[1])) return true;
  }
  if (SCHOOL_FORMAT_FACILITY_LABEL_VALUE_PATTERN.test(source)) return true;
  for (const match of source.matchAll(SCHOOL_FORMAT_FACILITY_ACTION_VALUE_PATTERN)) {
    if (isSafeFacilityLabelPlaceholderValue(match[1])) continue;
    if (!isSafeFacilityLabelTail(match[1])) return true;
  }
  for (const match of source.matchAll(SCHOOL_FORMAT_FACILITY_HA_VALUE_PATTERN)) {
    if (!isSafeFacilityLabelHaRule(match[0])) return true;
  }
  return false;
}

function isSafeFacilityLabelPlaceholderValue(text) {
  return new RegExp(`^(?:${SCHOOL_FORMAT_SAFE_FACILITY_LABEL_VALUE_SOURCE})$`).test(normalizeFacilityLabelTail(text));
}

function isSafeAttachedFacilityLabelTail(text) {
  const normalized = normalizeFacilityLabelTail(text);
  return /^(?:欄|項目|チェック欄|確認欄|確認項目|確認チェック欄|こと|でください|ようにする|してください|ようにしてください|ようお願いします|ようお願いいたします|にする|で残す|で扱う|のままにする|にしてください|にしておく)$/.test(normalized)
    || isSafeFacilityLabelPlaceholderValue(normalized);
}

function isAllowedSchoolSafetyRuleText(text) {
  const normalized = normalizeSchoolFormatScanText(text).replace(/\s+/g, " ").trim();
  if (!SCHOOL_FORMAT_SENSITIVE_TOPIC_PATTERN.test(normalized)) return false;
  if (!SCHOOL_FORMAT_SAFETY_RULE_PATTERN.test(normalized)) return false;
  if (SCHOOL_FORMAT_DIRECT_CONTACT_PATTERN.test(normalized)) return false;
  if (SCHOOL_FORMAT_ADDRESS_LIKE_PATTERN.test(normalized)) return false;
  if (hasConcreteFacilityNameLikeText(normalized)) return false;
  if (SCHOOL_FORMAT_RAW_VALUE_PATTERN.test(normalized)) return false;
  for (const match of normalized.matchAll(SCHOOL_FORMAT_FACILITY_HA_VALUE_PATTERN)) {
    if (!isSafeFacilityLabelHaRule(match[0])) return false;
  }
  return true;
}

function isSafeFacilityLabelHaRule(text) {
  const match = normalizeSchoolFormatScanText(text).match(new RegExp(`(?:${SCHOOL_FORMAT_FACILITY_ABSTRACT_LABEL_SOURCE})(?:${SCHOOL_FORMAT_FACILITY_LABEL_QUALIFIER_SOURCE})\\s*${SCHOOL_FORMAT_FACILITY_LABEL_PARTICLE_SOURCE}\\s*(.+)$`));
  if (!match) return false;
  return isSafeFacilityLabelTail(match[1]);
}

function isSafeFacilityLabelTail(text) {
  const normalized = normalizeFacilityLabelTail(text);
  if (!normalized) return false;
  const segments = normalized.split(/[、,;；|｜。]/).map((segment) => normalizeFacilityLabelTail(segment)).filter(Boolean);
  if (segments.length > 1) return segments.every((segment) => isSafeFacilityLabelTailSegment(segment));
  return isSafeFacilityLabelTailSegment(normalized);
}

function normalizeFacilityLabelTail(text) {
  return normalizeSchoolFormatScanText(text)
    .replace(/\s+/g, " ")
    .replace(/^\s*[:：=＝>＞→⇒\-ー−–—・/／、,，;；|｜（(【「『\[\［《〈〔<＜{｛]?\s*/, "")
    .replace(/\s*[）)】」』\]\］》〉〕>＞}｝]\s*$/g, "")
    .trim();
}

function isSafeFacilityLabelTailSegment(normalized) {
  if (!normalized) return false;
  if (SCHOOL_FORMAT_SAFE_FACILITY_LABEL_CONTINUATION_PATTERN.test(normalized)) return true;
  if (isAbstractFacilityLabelList(normalized)) return true;
  if (isSafeAbstractFacilityNoEntryRule(normalized)) return true;
  if (isAllowedGeneralSafetyRuleSegment(normalized)) return true;
  if (SCHOOL_FORMAT_SAFE_FACILITY_LABEL_TAIL_PATTERN.test(normalized)) return true;
  if (isAllowedNonSensitiveFormatInstructionSegment(normalized)) return true;
  if (hasConcreteFacilityNameLikeText(normalized)) return false;
  if (SCHOOL_FORMAT_DIRECT_CONTACT_PATTERN.test(normalized)) return false;
  if (SCHOOL_FORMAT_ADDRESS_LIKE_PATTERN.test(normalized)) return false;
  return SCHOOL_FORMAT_SAFE_FACILITY_LABEL_TAIL_PATTERN.test(normalized);
}

function isSafeAbstractFacilityNoEntryRule(text) {
  const normalized = normalizeSchoolFormatScanText(text).replace(/\s+/g, " ").trim();
  if (!new RegExp(SCHOOL_FORMAT_NO_ENTRY_RULE_SOURCE).test(normalized)) return false;
  if (hasConcreteFacilityNameLikeText(normalized)) return false;
  const remainder = normalized
    .replace(new RegExp(SCHOOL_FORMAT_NO_ENTRY_RULE_SOURCE, "g"), "")
    .replace(/(?:には|では|として|は|へ|に|を|も)/g, "")
    .trim();
  return isAbstractFacilityLabelList(remainder);
}

function isAllowedGeneralSafetyRuleSegment(text) {
  const normalized = normalizeSchoolFormatScanText(text).replace(/\s+/g, " ").trim();
  if (!SCHOOL_FORMAT_SENSITIVE_TOPIC_PATTERN.test(normalized)) return false;
  if (!SCHOOL_FORMAT_SAFETY_RULE_PATTERN.test(normalized)) return false;
  if (hasConcreteFacilityNameLikeText(normalized)) return false;
  if (SCHOOL_FORMAT_DIRECT_CONTACT_PATTERN.test(normalized)) return false;
  if (SCHOOL_FORMAT_ADDRESS_LIKE_PATTERN.test(normalized)) return false;
  if (SCHOOL_FORMAT_RAW_VALUE_PATTERN.test(normalized)) return false;
  return true;
}

function isAllowedNonSensitiveFormatInstructionSegment(text) {
  const normalized = normalizeSchoolFormatScanText(text).replace(/\s+/g, " ").trim();
  if (!SCHOOL_FORMAT_SAFE_FORMAT_INSTRUCTION_PATTERN.test(normalized)) return false;
  if (hasConcreteFacilityNameLikeText(normalized)) return false;
  if (SCHOOL_FORMAT_DIRECT_CONTACT_PATTERN.test(normalized)) return false;
  if (SCHOOL_FORMAT_ADDRESS_LIKE_PATTERN.test(normalized)) return false;
  if (SCHOOL_FORMAT_RAW_VALUE_PATTERN.test(normalized)) return false;
  return true;
}

function hasConcreteFacilityNameLikeText(text) {
  const source = normalizeSchoolFormatScanText(text);
  const withoutAbstractLabels = source.replace(SCHOOL_FORMAT_ABSTRACT_FACILITY_LABEL_PATTERN, (match, offset) => {
    const beforeLabel = source.slice(0, offset).replace(/[\s　\-ー−–—・/／、,]+$/g, "");
    const followsAnotherAbstractLabel = SCHOOL_FORMAT_FACILITY_ABSTRACT_LABELS.some((label) => beforeLabel.endsWith(label));
    const followsAbstractLabelConnector = SCHOOL_FORMAT_FACILITY_ABSTRACT_LABELS.some((label) =>
      new RegExp(`${escapeRegExp(label)}(?:と|や|及び|並びに|または|又は)$`).test(beforeLabel),
    );
    const followsAnyConnector = /(?:と|や|及び|並びに|または|又は)$/.test(beforeLabel);
    const followsAbstractPrefix = SCHOOL_FORMAT_ABSTRACT_FACILITY_PREFIX_PATTERN.test(beforeLabel);
    const startsAbstractLabel = !beforeLabel || !SCHOOL_FORMAT_NAME_CHAR_PATTERN.test(beforeLabel);
    return startsAbstractLabel || followsAnotherAbstractLabel || followsAbstractLabelConnector || followsAnyConnector || followsAbstractPrefix
      ? "施設ラベル"
      : match;
  });
  return SCHOOL_FORMAT_FACILITY_NAME_LIKE_PATTERN.test(withoutAbstractLabels) || hasBareFacilityNameLikeText(withoutAbstractLabels);
}

function hasBareFacilityNameLikeText(text) {
  const source = normalizeSchoolFormatScanText(text);
  for (const match of source.matchAll(SCHOOL_FORMAT_BARE_FACILITY_NAME_PATTERN)) {
    if (!isNonSpecificBareFacilityCandidate(match[1])) return true;
  }
  return false;
}

function isNonSpecificBareFacilityCandidate(candidate) {
  const compact = normalizeSchoolFormatScanText(candidate).replace(/[\s　\-ー−–—・/／]/g, "");
  if (SCHOOL_FORMAT_NON_SPECIFIC_FACILITY_WORDS.has(compact)) return true;
  if (!compact.endsWith("実習先園")) return false;
  const prefix = compact.slice(0, -"実習先園".length).replace(/施設ラベル|[はへにをがもでとやの]/g, "");
  return prefix === "";
}

function isAbstractFacilityLabelList(text) {
  const remainder = normalizeSchoolFormatScanText(text)
    .replace(SCHOOL_FORMAT_ABSTRACT_FACILITY_LABEL_PATTERN, "")
    .replace(/[\s　\-ー−–—・/／、,とや及び並びにまたは又は]+/g, "")
    .trim();
  return remainder === "";
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class SchoolFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "SchoolFormatError";
    this.status = 400;
    registerPublicError(this, {
      code: "invalid_request",
      publicMessage: message,
      status: 400,
    });
  }
}
