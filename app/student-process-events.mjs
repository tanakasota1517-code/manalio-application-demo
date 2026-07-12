import { normalizePrivacyScanText } from "./privacyPatterns.js";
import { buildStudentDiaryFieldLabels, hasStudentWrittenText } from "./student-diary-support.mjs";

const STUDENT_PROCESS_STAGES = Object.freeze({
  safety_check_completed: "提出前確認",
  question_generated: "問い返し",
  final_check_completed: "再確認",
  final_copied: "記録コピー",
});

const MIN_STUDENT_PROCESS_EVENT_LIMIT = 50 * 20 * Object.keys(STUDENT_PROCESS_STAGES).length;
const DEFAULT_STUDENT_PROCESS_EVENT_LIMIT = MIN_STUDENT_PROCESS_EVENT_LIMIT;
const DEFAULT_STUDENT_PROCESS_STORAGE_BYTES = 3 * 1024 * 1024;

export const STUDENT_PROCESS_META_CONTRACT = Object.freeze({
  version: "student-process-meta-v1",
  persistence: "local_demo_or_policy_gated_server",
  serverPersistence: "disabled_by_default_until_policy_and_runtime",
  payload: "metadata_only",
  bodyStorage: "never",
  studentIdentity: "safe_demo_key_or_school_approved_identifier",
  teacherUse: "support_checkpoints_not_assessment",
  retention: "latest_student_stage_event_with_policy_retention",
});

const SERVER_PERSISTENCE_POLICY = Object.freeze({
  payload: "metadata_only",
  bodyStorage: "never",
  studentIdentityModes: Object.freeze(["school_approved_student_label"]),
  teacherAccessScope: "practicum_support_teachers_only",
  classShareGrain: "classwide_pattern_only",
  retentionMinDays: 1,
  retentionMaxDays: 180,
});

export const STUDENT_PROCESS_EVENT_STORAGE_KEY = "manabi-student-process-events";
export const STUDENT_PROCESS_SWITCH_STORAGE_KEY = "manabi-student-process-switch";
const EXPECTED_STUDENT_PROCESS_PERSISTENCE_SKIP_CODES = new Set([
  "public_demo_api_disabled",
  "school_student_process_policy_required",
  "student_process_persistence_disabled",
]);

const DIARY_FIELD_KEYS = Object.freeze(["goal_reflection", "episode_memo", "episode_insight", "overall_learning", "next_action"]);
const LEGACY_INSIGHT_FIELD_KEY = "episode_insight_or_overall";
const DIARY_FIELD_LABELS = Object.freeze({
  goal_reflection: "実習目標の振り返り",
  episode_memo: "場面の記録",
  episode_insight: "エピソードの気づき",
  overall_learning: "総合的な気づき",
  next_action: "翌日の観察",
});
const DIARY_FIELD_LABEL_OPTION_KEYS = Object.freeze({
  goal_reflection: "goalReflection",
  episode_memo: "episodeMemo",
  episode_insight: "episodeInsight",
  overall_learning: "overallLearning",
  next_action: "nextAction",
});
const WRITING_COACH_TARGET_FIELD_KEYS = Object.freeze({
  goalReflection: "goal_reflection",
  episodeMemo: "episode_memo",
  episodeInsight: "episode_insight",
  overallLearning: "overall_learning",
  nextAction: "next_action",
});
const REVIEW_ISSUE_DEFINITIONS = Object.freeze({
  none: Object.freeze({
    label: "",
    routeKey: "post_practicum_review",
    needsTeacherCheck: false,
  }),
  privacy_required: Object.freeze({
    label: "個人が分かる表現",
    routeKey: "teacher_check",
    needsTeacherCheck: true,
  }),
  context_expression: Object.freeze({
    label: "文脈確認",
    routeKey: "teacher_check",
    needsTeacherCheck: true,
  }),
  safe_text_apply: Object.freeze({
    label: "安全化した文の反映",
    routeKey: "student_return",
    needsTeacherCheck: false,
  }),
  review_question: Object.freeze({
    label: "確認候補の整理",
    routeKey: "student_return",
    needsTeacherCheck: false,
  }),
});

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function safeRecordList(value) {
  return safeList(value).filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

function normalizeText(value) {
  return normalizePrivacyScanText(value).trim();
}

function countMeaningfulChars(value) {
  return (normalizeText(value).match(/[一-龯ぁ-んァ-ンA-Za-z0-9０-９]/g) || []).length;
}

function hasStudentText(value) {
  return hasStudentWrittenText(value);
}

function clampCount(value, max = 5000) {
  const count = Number(value) || 0;
  if (count <= 0) return 0;
  return Math.min(Math.floor(count), max);
}

function normalizeSafeToken(value, fallback = "") {
  const text = String(value || "").trim().slice(0, 120);
  if (!text) return fallback;
  if (/https?:\/\/|@|password|パスワード|cookie|token|secret|ログイン/i.test(text)) return fallback;
  return text;
}

export function isStudentProcessStage(stage) {
  return Object.hasOwn(STUDENT_PROCESS_STAGES, stage);
}

export function isExpectedStudentProcessPersistenceSkipCode(code) {
  return EXPECTED_STUDENT_PROCESS_PERSISTENCE_SKIP_CODES.has(code);
}

function normalizeStage(stage) {
  return isStudentProcessStage(stage) ? stage : "safety_check_completed";
}

function normalizeReviewIssueKey(value) {
  return Object.hasOwn(REVIEW_ISSUE_DEFINITIONS, value) ? value : "none";
}

function buildReviewIssueMeta(issueKey) {
  const primaryIssueKey = normalizeReviewIssueKey(issueKey);
  const definition = REVIEW_ISSUE_DEFINITIONS[primaryIssueKey];
  return {
    primaryIssueKey,
    primaryIssueLabel: definition.label,
    routeKey: definition.routeKey,
    needsTeacherCheck: definition.needsTeacherCheck,
  };
}

function inferReviewIssueFromReview(review = {}, normalizedStatus = "none") {
  if (!review || typeof review !== "object") return buildReviewIssueMeta("none");

  const rawStatus = normalizeSafeToken(review.status, "");
  const findings = safeRecordList(review.findings);
  const fieldChanges = safeRecordList(review.fieldChanges);
  const contextNotes = safeRecordList(review.contextNotes);
  const hasContextNeed = contextNotes.some((note) => normalizeSafeToken(note.severity, "") === "context") || (
    contextNotes.length > 0 && fieldChanges.length === 0
  );

  if (review.blocked || normalizedStatus === "blocked" || findings.length > 0) return buildReviewIssueMeta("privacy_required");
  if (hasContextNeed) return buildReviewIssueMeta("context_expression");
  if (review.changed || rawStatus === "changed" || fieldChanges.length > 0) return buildReviewIssueMeta("safe_text_apply");
  if (normalizedStatus === "review") return buildReviewIssueMeta("review_question");
  return buildReviewIssueMeta("none");
}

function inferReviewIssueFromMeta(meta = {}, normalizedStatus = "none") {
  const existingIssueKey = normalizeReviewIssueKey(meta.primaryIssueKey);
  if (existingIssueKey !== "none") return buildReviewIssueMeta(existingIssueKey);
  if (meta.blocked || normalizedStatus === "blocked" || clampCount(meta.findingCount, 50) > 0) return buildReviewIssueMeta("privacy_required");
  if (clampCount(meta.contextNoteCount, 50) > 0) return buildReviewIssueMeta("context_expression");
  if (meta.changed || clampCount(meta.fieldChangeCount, 50) > 0) return buildReviewIssueMeta("safe_text_apply");
  if (normalizedStatus === "review") return buildReviewIssueMeta("review_question");
  return buildReviewIssueMeta("none");
}

function createOpaqueDemoId(prefix) {
  const randomSource = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const safeRandom = String(randomSource).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  return `${prefix}-${safeRandom || Math.random().toString(36).slice(2, 10)}`;
}

export function createDemoStudentId() {
  return createOpaqueDemoId("local-demo-student");
}

export function createDemoProcessContextId() {
  return createOpaqueDemoId("demo-context");
}

export function isAllowedDemoStudentId(value) {
  const text = normalizeSafeToken(value, "");
  return text === "public-demo-student" || /^local-demo-student-[A-Za-z0-9_-]{6,80}$/.test(text);
}

export function normalizeDemoStudentId(value, fallback = "") {
  const text = normalizeSafeToken(value, "");
  if (isAllowedDemoStudentId(text)) return text;
  return fallback;
}

export function buildDemoContextKey(session = {}) {
  const contextKey = normalizeSafeToken(session.studentProcessContextKey, "");
  return /^demo-context-[A-Za-z0-9_-]{6,80}$/.test(contextKey) ? contextKey : "";
}

export function buildStudentProcessSwitchMarker(session = {}, nowMs = Date.now()) {
  if (!session || session.source !== "demo" || session.role !== "student") return null;
  const contextKey = buildDemoContextKey(session);
  if (!contextKey) return null;
  return {
    source: "demo",
    role: "student",
    contextKey,
    expiresAt: new Date(nowMs + 30 * 60 * 1000).toISOString(),
  };
}

export function parseStudentProcessSwitchMarker(value, nowMs = Date.now()) {
  try {
    const marker = typeof value === "string" ? JSON.parse(value || "null") : value;
    if (!marker || marker.source !== "demo" || marker.role !== "student") return null;
    const expiresAtMs = Date.parse(marker.expiresAt || "");
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return null;
    const contextKey = normalizeSafeToken(marker.contextKey, "");
    if (!/^demo-context-[A-Za-z0-9_-]{6,80}$/.test(contextKey)) return null;
    return {
      source: "demo",
      role: "student",
      contextKey,
      expiresAt: normalizeSafeToken(marker.expiresAt, ""),
    };
  } catch {
    return null;
  }
}

export function buildDemoTeacherProcessContext({ pendingSwitch, usePendingContext = true, nowMs = Date.now() } = {}) {
  const marker = usePendingContext ? parseStudentProcessSwitchMarker(pendingSwitch, nowMs) : null;
  return marker ? { studentProcessContextKey: marker.contextKey } : {};
}

export function shouldPreserveStudentProcessEventsForDemoSwitch({ pendingSwitch, nextSession, nowMs = Date.now() } = {}) {
  const marker = parseStudentProcessSwitchMarker(pendingSwitch, nowMs);
  const nextContextKey = buildDemoContextKey(nextSession);
  return Boolean(
    marker
    && nextSession?.source === "demo"
    && nextSession.role === "teacher"
    && marker.contextKey
    && marker.contextKey === nextContextKey,
  );
}

function normalizeDiaryFieldKey(value) {
  if (value === LEGACY_INSIGHT_FIELD_KEY) return "episode_insight";
  return DIARY_FIELD_KEYS.includes(value) ? value : "";
}

function normalizeDiaryFieldKeys(value = []) {
  return [...new Set(safeList(value).flatMap((key) => (
    key === LEGACY_INSIGHT_FIELD_KEY
      ? ["episode_insight", "overall_learning"]
      : [normalizeDiaryFieldKey(key)]
  )).filter(Boolean))].slice(0, DIARY_FIELD_KEYS.length);
}

function buildPostPracticumDiaryFieldLabels(options = {}) {
  if (!options?.schoolFormat && !options?.studentDiaryFieldLabels && !options?.diaryFieldLabels) {
    return DIARY_FIELD_LABELS;
  }
  const source = options?.schoolFormat || options || {};
  const labels = buildStudentDiaryFieldLabels(source);
  return Object.fromEntries(DIARY_FIELD_KEYS.map((key) => [
    key,
    labels[DIARY_FIELD_LABEL_OPTION_KEYS[key]] || DIARY_FIELD_LABELS[key],
  ]));
}

function getDiaryFieldLabel(key, fieldLabels = DIARY_FIELD_LABELS) {
  return fieldLabels[key] || DIARY_FIELD_LABELS[key] || "記録欄";
}

function buildStorageMeta() {
  return {
    persistence: STUDENT_PROCESS_META_CONTRACT.persistence,
    serverPersistence: STUDENT_PROCESS_META_CONTRACT.serverPersistence,
    payload: STUDENT_PROCESS_META_CONTRACT.payload,
    bodyStorage: STUDENT_PROCESS_META_CONTRACT.bodyStorage,
    studentIdentity: STUDENT_PROCESS_META_CONTRACT.studentIdentity,
    teacherUse: STUDENT_PROCESS_META_CONTRACT.teacherUse,
    retention: STUDENT_PROCESS_META_CONTRACT.retention,
  };
}

function buildInputScope() {
  return {
    diaryBodyStored: false,
    finalDraftStored: false,
    studentNameStored: false,
    childNameStored: false,
    schoolNameStored: false,
    emailStored: false,
    scoringStored: false,
  };
}

function normalizeEpisodes(diary = {}) {
  const episodes = safeRecordList(diary.episodes);
  if (episodes.length > 0) return episodes;
  return [{ memo: diary.memo, insight: diary.reflection }];
}

function normalizeProcessDate(value, fallbackTimestamp = "") {
  const explicitDate = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
    const parsed = new Date(`${explicitDate}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === explicitDate) return explicitDate;
  }
  return toJapanDateKey(fallbackTimestamp) || toJapanDateKey(new Date().toISOString());
}

function toJapanDateKey(value) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "";
  return new Date(timestamp.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildWritingCoachMissingFields(writingCoach) {
  if (!writingCoach || typeof writingCoach !== "object" || !Array.isArray(writingCoach.formatMissingItems)) return null;
  return normalizeDiaryFieldKeys(writingCoach.formatMissingItems.map((item) => WRITING_COACH_TARGET_FIELD_KEYS[item?.target] || ""));
}

function buildDiaryMeta(diary = {}, feedback = {}, finalDraft = "", writingCoach = null) {
  const episodes = normalizeEpisodes(diary);
  const coachItems = safeRecordList(writingCoach?.items);
  const coachDone = (target, fallback) => {
    const item = coachItems.find((candidate) => candidate.target === target);
    return item ? item.done === true : fallback;
  };
  const rawHasGoalReflection = hasStudentText(diary.goalReflection);
  const rawEpisodeMemoCount = episodes.filter((episode) => hasStudentText(episode.memo)).length;
  const rawEpisodeInsightCount = episodes.filter((episode) => hasStudentText(episode.insight)).length;
  const rawCompleteEpisodeCount = episodes.filter((episode) => hasStudentText(episode.memo) && hasStudentText(episode.insight)).length;
  const rawHasOverallLearning = hasStudentText(diary.overallLearning);
  const rawHasNextAction = hasStudentText(diary.nextAction || diary.tomorrowTask);
  const coachEpisodeProgress = writingCoach?.episodeProgress && typeof writingCoach.episodeProgress === "object"
    ? writingCoach.episodeProgress
    : {};
  const hasGoalReflection = coachDone("goalReflection", rawHasGoalReflection);
  const episodeMemoCount = clampCount(coachEpisodeProgress.memoCount ?? rawEpisodeMemoCount, 20);
  const episodeInsightCount = clampCount(coachEpisodeProgress.insightCount ?? rawEpisodeInsightCount, 20);
  const completeEpisodeCount = clampCount(coachEpisodeProgress.completeCount ?? rawCompleteEpisodeCount, 20);
  const hasOverallLearning = coachDone("overallLearning", rawHasOverallLearning);
  const hasNextAction = coachDone("nextAction", rawHasNextAction);
  const feedbackReceivedChars = countMeaningfulChars(feedback.received);
  const feedbackInterpretationChars = countMeaningfulChars(feedback.interpretation);
  const feedbackTomorrowActionChars = countMeaningfulChars(feedback.tomorrowAction);
  const feedbackTeacherQuestionChars = countMeaningfulChars(feedback.teacherQuestion);
  const feedbackFields = [
    feedback.guidanceCategory,
    feedback.received,
    feedback.interpretation,
    feedback.unclear,
    feedback.tomorrowAction,
    feedback.teacherQuestion,
  ];
  const minimumDoneCount = [
    episodeMemoCount > 0,
    episodeInsightCount > 0 || hasOverallLearning,
    hasNextAction,
  ].filter(Boolean).length;
  const fieldStatus = [
    ["goal_reflection", hasGoalReflection],
    ["episode_memo", episodeMemoCount > 0],
    ["episode_insight", episodeInsightCount > 0],
    ["overall_learning", hasOverallLearning],
    ["next_action", hasNextAction],
  ];
  const coachMissingFields = buildWritingCoachMissingFields(writingCoach);
  const missingRequiredFields = coachMissingFields || fieldStatus.filter(([, done]) => !done).map(([key]) => key);

  return {
    goalReflectionChars: hasGoalReflection ? clampCount(countMeaningfulChars(diary.goalReflection)) : 0,
    episodeCount: clampCount(episodes.length, 20),
    episodeMemoCount,
    episodeInsightCount,
    completeEpisodeCount,
    requiredEpisodeCount: clampCount(coachEpisodeProgress.requiredCount, 8) || 1,
    overallLearningChars: hasOverallLearning ? clampCount(countMeaningfulChars(diary.overallLearning)) : 0,
    nextActionChars: hasNextAction ? clampCount(countMeaningfulChars(diary.nextAction || diary.tomorrowTask)) : 0,
    feedbackFieldCount: clampCount(feedbackFields.filter(hasStudentText).length, 6),
    feedbackReceivedChars: clampCount(feedbackReceivedChars),
    feedbackInterpretationChars: clampCount(feedbackInterpretationChars),
    feedbackTomorrowActionChars: clampCount(feedbackTomorrowActionChars),
    feedbackTeacherQuestionChars: clampCount(feedbackTeacherQuestionChars),
    hasFeedback: feedbackFields.some(hasStudentText),
    finalDraftChars: clampCount(countMeaningfulChars(finalDraft)),
    minimumPathDoneCount: minimumDoneCount,
    minimumPathTotalCount: 3,
    missingRequiredFields,
    nextMissingRequiredField: missingRequiredFields[0] || "",
  };
}

function buildReviewMeta(review = null) {
  if (!review || typeof review !== "object") {
    return {
      status: "none",
      blocked: false,
      changed: false,
      findingCount: 0,
      fieldChangeCount: 0,
      contextNoteCount: 0,
      ...buildReviewIssueMeta("none"),
    };
  }

  const status = ["clear", "review", "blocked"].includes(review.status) ? review.status : review.blocked ? "blocked" : "review";
  const reviewIssue = inferReviewIssueFromReview(review, status);
  return {
    status,
    blocked: Boolean(review.blocked),
    changed: Boolean(review.changed),
    findingCount: clampCount(safeList(review.findings).length, 50),
    fieldChangeCount: clampCount(safeList(review.fieldChanges).length, 50),
    contextNoteCount: clampCount(safeList(review.contextNotes).length, 50),
    ...reviewIssue,
  };
}

function buildResultSectionTexts(result = {}) {
  const headings = safeList(result.headings).map((heading) => normalizeText(heading)).filter(Boolean);
  const rawSections = safeList(result.sections);
  const sectionTexts = rawSections.map((section, index) => {
    if (section && typeof section === "object" && !Array.isArray(section)) {
      return normalizeText(`${section.heading || ""} ${section.title || ""} ${section.body || ""}`);
    }
    return normalizeText(`${headings[index] || ""} ${section || ""}`);
  }).filter(Boolean);

  for (let index = rawSections.length; index < headings.length; index += 1) {
    sectionTexts.push(headings[index]);
  }
  return sectionTexts;
}

function buildResultMeta(result = null) {
  if (!result || typeof result !== "object") {
    return {
      sectionCount: 0,
      checkCount: 0,
      hasNextObservation: false,
    };
  }
  const checks = safeList(result.checks);
  const sectionTexts = buildResultSectionTexts(result);
  const signalText = sectionTexts.join(" ");
  const hasNextTiming = /明日|翌日|次/.test(signalText);
  const hasObservationAction = /観察|見る|見たい|見ます|見よう|見て/.test(signalText);
  return {
    sectionCount: clampCount(sectionTexts.length, 20),
    checkCount: clampCount(checks.length, 50),
    hasNextObservation: hasNextTiming && hasObservationAction,
  };
}

function normalizeDiaryMeta(meta = {}) {
  const missingRequiredFields = normalizeDiaryFieldKeys(meta.missingRequiredFields);
  return {
    goalReflectionChars: clampCount(meta.goalReflectionChars),
    episodeCount: clampCount(meta.episodeCount, 20),
    episodeMemoCount: clampCount(meta.episodeMemoCount, 20),
    episodeInsightCount: clampCount(meta.episodeInsightCount, 20),
    completeEpisodeCount: clampCount(meta.completeEpisodeCount, 20),
    requiredEpisodeCount: clampCount(meta.requiredEpisodeCount, 8) || 1,
    overallLearningChars: clampCount(meta.overallLearningChars),
    nextActionChars: clampCount(meta.nextActionChars),
    feedbackFieldCount: clampCount(meta.feedbackFieldCount, 6),
    feedbackReceivedChars: clampCount(meta.feedbackReceivedChars),
    feedbackInterpretationChars: clampCount(meta.feedbackInterpretationChars),
    feedbackTomorrowActionChars: clampCount(meta.feedbackTomorrowActionChars),
    feedbackTeacherQuestionChars: clampCount(meta.feedbackTeacherQuestionChars),
    hasFeedback: Boolean(meta.hasFeedback),
    finalDraftChars: clampCount(meta.finalDraftChars),
    minimumPathDoneCount: clampCount(meta.minimumPathDoneCount, 3),
    minimumPathTotalCount: 3,
    missingRequiredFields,
    nextMissingRequiredField: normalizeDiaryFieldKey(meta.nextMissingRequiredField) || missingRequiredFields[0] || "",
  };
}

function normalizeReviewMeta(meta = {}) {
  const status = ["none", "clear", "review", "blocked"].includes(meta.status) ? meta.status : "none";
  const reviewIssue = inferReviewIssueFromMeta(meta, status);
  return {
    status,
    blocked: Boolean(meta.blocked),
    changed: Boolean(meta.changed),
    findingCount: clampCount(meta.findingCount, 50),
    fieldChangeCount: clampCount(meta.fieldChangeCount, 50),
    contextNoteCount: clampCount(meta.contextNoteCount, 50),
    ...reviewIssue,
  };
}

function normalizeResultMeta(meta = {}) {
  return {
    sectionCount: clampCount(meta.sectionCount, 20),
    checkCount: clampCount(meta.checkCount, 50),
    hasNextObservation: Boolean(meta.hasNextObservation),
    processDateCount: clampCount(meta.processDateCount, 180),
  };
}

function normalizeStudentKey(session = {}) {
  const serverKey = normalizeSafeToken(session.studentKey || session.demoStudentId, "");
  if (/^school-student-[a-f0-9]{32}$/.test(serverKey)) return serverKey;
  const key = normalizeDemoStudentId(session.demoStudentId, "");
  if (/student|demo|public|local/i.test(key)) return key;
  return normalizeSafeToken(session.role, "student") === "teacher" ? "teacher" : "student";
}

export function buildStudentProcessEvent({
  stage,
  diary,
  feedback,
  review,
  result,
  finalCheck,
  finalDraft,
  writingCoach,
  session,
  createdAt = new Date().toISOString(),
} = {}) {
  const normalizedStage = normalizeStage(stage);
  const processDate = normalizeProcessDate(diary?.date, createdAt);
  const reviewMeta = buildReviewMeta(finalCheck || review);
  return {
    id: `${normalizedStage}-${String(createdAt).replace(/[^0-9TZ.-]/g, "").slice(0, 32)}`,
    stage: normalizedStage,
    stageLabel: STUDENT_PROCESS_STAGES[normalizedStage],
    createdAt,
    processDate,
    source: session?.source === "server" ? "server" : session?.source === "demo" ? "demo" : "local",
    studentKey: normalizeStudentKey(session),
    contractVersion: STUDENT_PROCESS_META_CONTRACT.version,
    storageMeta: buildStorageMeta(),
    inputScope: buildInputScope(),
    diaryMeta: buildDiaryMeta(diary, feedback, finalDraft, writingCoach),
    reviewMeta,
    resultMeta: buildResultMeta(result),
  };
}

export function sanitizeStudentProcessEvent(event = {}) {
  if (event.diaryMeta || event.reviewMeta || event.resultMeta) {
    const normalizedStage = normalizeStage(event.stage);
    const isCurrentContract = event.contractVersion === STUDENT_PROCESS_META_CONTRACT.version;
    const createdAt = normalizeSafeToken(event.createdAt, new Date().toISOString());
    return {
      id: normalizeSafeToken(event.id, `${normalizedStage}-${String(event.createdAt || "").slice(0, 32)}`),
      stage: normalizedStage,
      stageLabel: STUDENT_PROCESS_STAGES[normalizedStage],
      createdAt,
      processDate: normalizeProcessDate(event.processDate, createdAt),
      source: event.source === "server" ? "server" : event.source === "demo" ? "demo" : "local",
      studentKey: isCurrentContract ? normalizeStudentKey({ studentKey: event.studentKey, demoStudentId: event.studentKey, role: event.studentKey }) : "student",
      contractVersion: STUDENT_PROCESS_META_CONTRACT.version,
      storageMeta: buildStorageMeta(),
      inputScope: buildInputScope(),
      diaryMeta: normalizeDiaryMeta(event.diaryMeta),
      reviewMeta: normalizeReviewMeta(event.reviewMeta),
      resultMeta: normalizeResultMeta(event.resultMeta),
    };
  }

  return buildStudentProcessEvent(event);
}

export function mergeStudentProcessEvents(existingEvents = [], nextEvent, maxEvents = DEFAULT_STUDENT_PROCESS_EVENT_LIMIT) {
  const events = [
    sanitizeStudentProcessEvent(nextEvent),
    ...safeRecordList(existingEvents).map(sanitizeStudentProcessEvent),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const limit = Math.max(MIN_STUDENT_PROCESS_EVENT_LIMIT, clampCount(maxEvents, 5000) || DEFAULT_STUDENT_PROCESS_EVENT_LIMIT);
  const seen = new Set();
  return events
    .filter((event) => {
      const studentDateStageKey = `${event.studentKey}\u0000${event.processDate}\u0000${event.stage}`;
      if (!event.id || seen.has(studentDateStageKey)) return false;
      seen.add(studentDateStageKey);
      return true;
    })
    .slice(0, limit);
}

export function serializeStudentProcessEventsForStorage(events = [], maxBytes = DEFAULT_STUDENT_PROCESS_STORAGE_BYTES) {
  const cleanEvents = safeRecordList(events)
    .map(sanitizeStudentProcessEvent)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const requestedLimit = Number(maxBytes);
  const byteLimit = Number.isFinite(requestedLimit) && requestedLimit >= 1024
    ? Math.floor(requestedLimit)
    : DEFAULT_STUDENT_PROCESS_STORAGE_BYTES;
  const encoder = new TextEncoder();
  const latestDateByStudent = new Map();
  for (const event of cleanEvents) {
    const current = latestDateByStudent.get(event.studentKey) || "";
    if (event.processDate > current) latestDateByStudent.set(event.studentKey, event.processDate);
  }
  const reservedIndexes = new Set();
  const reservedStages = new Set();
  cleanEvents.forEach((event, index) => {
    if (event.processDate !== latestDateByStudent.get(event.studentKey)) return;
    const stageKey = `${event.studentKey}\u0000${event.stage}`;
    if (reservedStages.has(stageKey)) return;
    reservedStages.add(stageKey);
    reservedIndexes.add(index);
  });
  const storageEvents = [
    ...cleanEvents.filter((_, index) => reservedIndexes.has(index)),
    ...cleanEvents.filter((_, index) => !reservedIndexes.has(index)),
  ];
  let low = 0;
  let high = storageEvents.length;
  let keptCount = 0;
  let json = "[]";

  while (low <= high) {
    const candidateCount = Math.floor((low + high) / 2);
    const candidateJson = JSON.stringify(storageEvents.slice(0, candidateCount));
    if (encoder.encode(candidateJson).length <= byteLimit) {
      keptCount = candidateCount;
      json = candidateJson;
      low = candidateCount + 1;
    } else {
      high = candidateCount - 1;
    }
  }

  return {
    json,
    eventCount: keptCount,
    truncated: keptCount < storageEvents.length,
  };
}

export function buildStudentProcessEventSummary(events = []) {
  const cleanEvents = safeRecordList(events).map(sanitizeStudentProcessEvent);
  const stageCounts = Object.fromEntries(Object.keys(STUDENT_PROCESS_STAGES).map((stage) => [stage, 0]));
  for (const event of cleanEvents) {
    if (Object.hasOwn(stageCounts, event.stage)) stageCounts[event.stage] += 1;
  }
  return {
    eventCount: cleanEvents.length,
    stageCounts,
    latestStage: cleanEvents[0]?.stage || "",
    latestStageLabel: cleanEvents[0]?.stageLabel || "",
    contractVersion: STUDENT_PROCESS_META_CONTRACT.version,
    serverPersistence: STUDENT_PROCESS_META_CONTRACT.serverPersistence,
  };
}

function buildSafeTokenHash(text = "", seed = 2166136261) {
  let hash = seed >>> 0;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function buildAnonymousStudentLabel(studentKey = "") {
  const text = normalizeSafeToken(studentKey, "student");
  const code = buildSafeTokenHash(text).toString(36).toUpperCase().padStart(7, "0");
  return `学生${code}`;
}

function buildSupportStudentId(studentKey = "") {
  const text = normalizeSafeToken(studentKey, "student");
  const primary = buildSafeTokenHash(text).toString(36).padStart(7, "0");
  const secondaryText = Array.from(text).reverse().join("");
  const secondary = buildSafeTokenHash(secondaryText, 2246822519).toString(36).padStart(7, "0");
  return `support-${primary}-${secondary}`;
}

function disambiguateStudentLabels(students = []) {
  const groups = new Map();
  for (const student of students) {
    if (!groups.has(student.studentLabel)) groups.set(student.studentLabel, []);
    groups.get(student.studentLabel).push(student);
  }
  return students.map((student) => {
    const collisionGroup = groups.get(student.studentLabel) || [];
    if (collisionGroup.length < 2) return student;
    const collisionIndex = [...collisionGroup]
      .sort((a, b) => a.supportStudentId.localeCompare(b.supportStudentId))
      .indexOf(student);
    return { ...student, studentLabel: `${student.studentLabel}-${collisionIndex + 1}` };
  });
}

function hasCurrentSafetyReviewNeed(event = {}) {
  return normalizeReviewMeta(event.reviewMeta).needsTeacherCheck;
}

function getCurrentReviewIssue(event = {}) {
  return normalizeReviewMeta(event.reviewMeta);
}

function hasCurrentReviewIssue(event = {}) {
  return getCurrentReviewIssue(event).primaryIssueKey !== "none";
}

function hasCurrentNextObservationSignal(event = {}) {
  const diary = normalizeDiaryMeta(event.diaryMeta);
  const result = normalizeResultMeta(event.resultMeta);
  return diary.nextActionChars > 0 || result.hasNextObservation;
}

function buildFeedbackSupport(diary = {}) {
  const meta = normalizeDiaryMeta(diary);
  if (!meta.hasFeedback) return null;
  const hasTomorrowAction = meta.feedbackTomorrowActionChars > 0;
  const hasTeacherQuestion = meta.feedbackTeacherQuestionChars > 0;
  const fieldCountLabel = `${meta.feedbackFieldCount}/6欄`;
  if (hasTeacherQuestion) {
    return {
      key: "feedback_teacher_question",
      routeKey: "teacher_check",
      route: "教員が先に見る",
      label: "学校教員への相談点あり",
      body: "学生が学校の担当教員へ確認したい点を残しています。本文ではなく、相談欄があることだけを使います。",
      teacherMove: "相談欄がある学生だけ、返す前に学校教員の確認へ回す。",
      studentPrompt: "その相談は、見た事実、迷っている判断、明日試したい行動のどれですか。",
      classUse: "個別の相談として扱い、授業共有へは回さない。",
      boundary: "相談文の本文は扱わず、相談欄があることだけを支援材料にする。",
      fieldCountLabel,
      needsAttention: true,
    };
  }
  if (!hasTomorrowAction) {
    return {
      key: "feedback_without_next_action",
      routeKey: "student_return",
      route: "学生本人へ戻す",
      label: "助言を翌日の観察へ戻す",
      body: "実習先で受けた助言を、翌日に見る場面や自分の行動へ戻せているかを確認します。",
      teacherMove: "助言を丸写しで終わらせず、次に見る場面か行動へ戻す問いにする。",
      studentPrompt: "その助言を受けて、明日はどの場面を見ますか。",
      classUse: "同じ止まり方が多い場合だけ、助言を行動へ戻す練習に抽象化する。",
      boundary: "実習先で受けた助言を、次の観察へ戻す範囲で扱う。",
      fieldCountLabel,
      needsAttention: true,
    };
  }
  return {
    key: "feedback_connected",
    routeKey: "post_practicum_review",
    route: "実習後確認で使う",
    label: "助言と翌日の観察を見る",
    body: "実習先で受けた助言が、翌日に見る場面や自分の行動へつながっているかを見返します。",
    teacherMove: "助言をどう理解し、次の観察へ戻したかを学生本人に説明してもらう。",
    studentPrompt: "その助言を、次の実習でどの場面に生かしますか。",
    classUse: "個別内容ではなく、助言の受け止め方だけを必要時に扱う。",
    boundary: "実習先や学生を決めつける用途では使わない。",
    fieldCountLabel,
    needsAttention: false,
  };
}

function uniqueStageLabels(events = []) {
  const stageKeys = new Set(safeRecordList(events).map((event) => normalizeStage(event.stage)));
  return Object.keys(STUDENT_PROCESS_STAGES)
    .filter((stage) => stageKeys.has(stage))
    .map((stage) => STUDENT_PROCESS_STAGES[stage]);
}

function getLatestProcessDate(events = []) {
  return safeRecordList(events)
    .map((event) => normalizeProcessDate(event.processDate, event.createdAt))
    .sort((left, right) => right.localeCompare(left))[0] || "";
}

function getCurrentMissingFields(event = {}) {
  return normalizeDiaryMeta(event.diaryMeta).missingRequiredFields;
}

function buildSupportFocus({ missingFields = [], reviewIssue = buildReviewIssueMeta("none"), feedbackSupport = null, hasNextObservation = false, stageLabels = [], fieldLabels = DIARY_FIELD_LABELS } = {}) {
  const firstMissing = missingFields[0] || "";
  if (reviewIssue.primaryIssueKey === "privacy_required") {
    return {
      key: "safety_review",
      label: "提出前確認を見直す",
      body: "個人情報、強い断定、入力外の補完など、提出前に止まった確認だけを見ます。",
    };
  }
  if (reviewIssue.primaryIssueKey === "context_expression") {
    return {
      key: "context_expression_review",
      label: "文脈だけ確認する",
      body: "園や子どもへの断定に見えないかだけを確認し、本文全体の添削には入らない。",
    };
  }
  if (reviewIssue.primaryIssueKey === "safe_text_apply") {
    return {
      key: "safe_text_apply",
      label: "安全化した文を反映する",
      body: "置換後の文を学生本人が確認し、自分の記録として説明できる形へ戻します。",
    };
  }
  if (reviewIssue.primaryIssueKey === "review_question") {
    return {
      key: "review_question",
      label: "確認候補を整理する",
      body: "残った確認候補を、学生本人へ返す問いに分けます。",
    };
  }
  if (feedbackSupport?.key === "feedback_teacher_question") {
    return {
      key: "feedback_teacher_question",
      label: "学校教員への相談点を見る",
      body: "学生が学校の担当教員へ確認したい点を残しています。相談欄があることだけを見て、本文全体の添削には入らない。",
    };
  }
  if (firstMissing) {
    return {
      key: `missing_${firstMissing}`,
      label: `${getDiaryFieldLabel(firstMissing, fieldLabels)}を整理する`,
      body: "本文を見ずに、不足している欄だけを実習後の確認観点として扱います。",
    };
  }
  if (feedbackSupport?.key === "feedback_without_next_action") {
    return {
      key: "feedback_without_next_action",
      label: "助言を翌日の観察へ戻す",
      body: "実習先で受けた助言を、翌日に見る場面や自分の行動へ戻せているかを確認します。",
    };
  }
  if (!hasNextObservation) {
    return {
      key: "next_observation",
      label: "翌日の観察へ戻す",
      body: "気づきが、翌日に見る場面や保育者の関わりへ戻っているかを確認します。",
    };
  }
  if (!stageLabels.includes(STUDENT_PROCESS_STAGES.final_check_completed)) {
    return {
      key: "final_check",
      label: "提出前チェックへ進める",
      body: "学生本人が整えた記録を、提出前の安全確認へ戻します。",
    };
  }
  return {
    key: "post_practicum_review",
    label: "実習後の振り返りに使う",
    body: "記録、確認、次の観察の流れを、学生に返す問いの材料として見ます。",
  };
}

function buildSupportActionPlan({ supportFocus = {}, missingFields = [], reviewIssue = buildReviewIssueMeta("none"), feedbackSupport = null, hasNextObservation = false, fieldLabels = DIARY_FIELD_LABELS } = {}) {
  const firstMissing = missingFields[0] || "";
  const missingLabel = getDiaryFieldLabel(firstMissing, fieldLabels);
  if (reviewIssue.primaryIssueKey === "privacy_required") {
    return {
      key: "review_safety_point",
      route: "提出前確認を見る",
      nextAction: "残っている確認候補だけを見て、学生本人へ返すか学校教員が先に確認するかを分ける。",
      returnQuestion: "この表現は、学生本人の見直しで足りますか。それとも学校教員が先に確認しますか。",
    };
  }
  if (reviewIssue.primaryIssueKey === "context_expression") {
    return {
      key: "review_context_point",
      route: "文脈だけ確認する",
      nextAction: "園や子どもへの断定に見える表現だけを見て、学校教員が先に確認するかを決める。",
      returnQuestion: "この表現は、見た事実として言えますか。それとも文脈を学校教員が先に確認しますか。",
    };
  }
  if (reviewIssue.primaryIssueKey === "safe_text_apply") {
    return {
      key: "apply_safe_text_before_recheck",
      route: "学生本人へ戻す",
      nextAction: "安全化した文の反映と再チェックだけを学生本人へ戻す。",
      returnQuestion: "置換後の文を、自分が見た事実として説明できますか。",
    };
  }
  if (reviewIssue.primaryIssueKey === "review_question") {
    return {
      key: "return_review_question",
      route: "学生本人へ戻す",
      nextAction: "残った確認候補を一つに絞り、学生本人の見直しへ戻す。",
      returnQuestion: "この確認候補は、自分で事実と考えを分ければ直せますか。",
    };
  }
  if (feedbackSupport?.key === "feedback_teacher_question") {
    return {
      key: "review_feedback_question",
      route: "教員が先に見る",
      nextAction: "学生が学校教員へ確認したい点だけを見て、次に返す問いを一つに絞る。",
      returnQuestion: feedbackSupport.studentPrompt,
    };
  }
  if (firstMissing === "next_action") {
    return {
      key: "connect_next_observation",
      route: "翌日の観察へ戻す",
      nextAction: "今日の気づきから、明日見る場面と保育者の関わりを一つずつ決める。",
      returnQuestion: "その気づきは、次の実習でどの場面を見ることにつながりますか。",
    };
  }
  if (firstMissing) {
    return {
      key: "return_missing_field",
      route: "学生本人へ戻す",
      nextAction: `${missingLabel}だけを追記してから、提出前確認へ戻す。`,
      returnQuestion: "その欄に必要なのは、見た場面、感じたこと、次に見ることのどれですか。",
    };
  }
  if (feedbackSupport?.key === "feedback_without_next_action") {
    return {
      key: "connect_feedback_to_next_observation",
      route: "学生本人へ戻す",
      nextAction: "実習先で受けた助言を、明日見る場面か自分の行動へ戻す。",
      returnQuestion: feedbackSupport.studentPrompt,
    };
  }
  if (!hasNextObservation) {
    return {
      key: "connect_next_observation",
      route: "翌日の観察へ戻す",
      nextAction: "今日の気づきから、明日見る場面と保育者の関わりを一つずつ決める。",
      returnQuestion: "その気づきは、次の実習でどの場面を見ることにつながりますか。",
    };
  }
  if (supportFocus.key === "final_check") {
    return {
      key: "run_final_check",
      route: "提出前チェックへ進める",
      nextAction: "学生が自分で整えた記録を、提出前の確認へもう一度通す。",
      returnQuestion: "見た事実、考えたこと、次に見ることは分かれて書けていますか。",
    };
  }
  return {
    key: "use_in_post_practicum_review",
    route: "実習後確認で使う",
    nextAction: "記録、見直し、翌日の観察につながった流れを学生と一緒に振り返る。",
    returnQuestion: "次の実習で、同じ観点をどの場面でもう一度見ますか。",
  };
}

function buildReturnPreparation({ supportAction = {}, missingFields = [], reviewIssue = buildReviewIssueMeta("none"), feedbackSupport = null, hasNextObservation = false, fieldLabels = DIARY_FIELD_LABELS } = {}) {
  const firstMissing = missingFields[0] || "";
  if (reviewIssue.primaryIssueKey === "privacy_required") {
    return {
      routeKey: "teacher_check",
      route: "教員が先に見る",
      teacherCheck: "個人情報、強い断定、入力外の補完に当たる確認候補だけを先に見る。",
      studentPrompt: "この表現は、見た事実として書けますか。迷う場合は、提出前に学校教員へ相談してください。",
      classUse: "個別情報を含む可能性があるため、授業共有へは回さない。",
    };
  }
  if (reviewIssue.primaryIssueKey === "context_expression") {
    return {
      routeKey: "teacher_check",
      route: "教員が先に見る",
      teacherCheck: "園や子どもへの断定に見える箇所だけを先に見る。",
      studentPrompt: supportAction.returnQuestion || "この表現は、見た事実として言えますか。",
      classUse: "個別の文脈が必要なため、授業共有へは回さない。",
    };
  }
  if (reviewIssue.primaryIssueKey === "safe_text_apply") {
    return {
      routeKey: "student_return",
      route: "学生本人へ戻す",
      teacherCheck: "安全化した文の反映だけを返し、本文全体の添削には入らない。",
      studentPrompt: supportAction.returnQuestion || "置換後の文を、自分が見た事実として説明できますか。",
      classUse: "同じ置換が多い場合だけ、個人が分かる表現を避ける練習に抽象化する。",
    };
  }
  if (reviewIssue.primaryIssueKey === "review_question") {
    return {
      routeKey: "student_return",
      route: "学生本人へ戻す",
      teacherCheck: "残った確認候補だけを返し、完成文の提示には入らない。",
      studentPrompt: supportAction.returnQuestion || "自分で事実と考えを分ければ直せますか。",
      classUse: "同じ確認候補が複数学生に出る場合だけ、書き方の練習に抽象化する。",
    };
  }
  if (feedbackSupport?.key === "feedback_teacher_question") {
    return {
      routeKey: "teacher_check",
      route: "教員が先に見る",
      teacherCheck: feedbackSupport.teacherMove,
      studentPrompt: feedbackSupport.studentPrompt,
      classUse: feedbackSupport.classUse,
    };
  }
  if (firstMissing) {
    return {
      routeKey: "student_return",
      route: "学生本人へ戻す",
      teacherCheck: `${getDiaryFieldLabel(firstMissing, fieldLabels)}だけが不足している前提で、本文全体の添削には入らない。`,
      studentPrompt: supportAction.returnQuestion || "見た事実、感じたこと、次に見ることを一つずつ分けられますか。",
      classUse: "同じ不足が複数学生に出る場合だけ、授業内の短い練習に回す。",
    };
  }
  if (feedbackSupport?.key === "feedback_without_next_action") {
    return {
      routeKey: "student_return",
      route: "学生本人へ戻す",
      teacherCheck: feedbackSupport.teacherMove,
      studentPrompt: feedbackSupport.studentPrompt,
      classUse: feedbackSupport.classUse,
    };
  }
  if (!hasNextObservation) {
    return {
      routeKey: "next_observation",
      route: "翌日の観察へ戻す",
      teacherCheck: "気づきが翌日に見る場面や保育者の関わりへ戻っているかだけを見る。",
      studentPrompt: supportAction.returnQuestion || "その気づきは、次の実習でどの場面を見ることにつながりますか。",
      classUse: "次回授業では、気づきを次の観察へ変換する練習として扱える。",
    };
  }
  return {
    routeKey: "post_practicum_review",
    route: "実習後確認で使う",
    teacherCheck: "記録、提出前確認、翌日の観察がつながった流れを本人に説明してもらう。",
    studentPrompt: supportAction.returnQuestion || "次の実習で、同じ観点をどの場面でもう一度見ますか。",
    classUse: "個別事例の断定にせず、記録から観察を深める例として抽象化して扱う。",
  };
}

function buildReturnRouteSummary(students = [], classwideLessonBacklog = []) {
  const routeCounts = {
    teacher_check: 0,
    student_return: 0,
    next_observation: 0,
    post_practicum_review: 0,
  };
  for (const student of safeRecordList(students)) {
    const routeKey = student.returnPreparation?.routeKey;
    if (Object.hasOwn(routeCounts, routeKey)) routeCounts[routeKey] += 1;
  }
  const routeItems = [
    {
      key: "teacher_check",
      label: "教員が先に見る",
      countLabel: `${routeCounts.teacher_check}名`,
      teacherMove: "確認候補だけを見てから、学生へ返すか学校内で確認するかを決める。",
      boundary: "個別情報を含みうるため、授業共有へは回さない。",
    },
    {
      key: "student_return",
      label: "学生本人へ戻す",
      countLabel: `${routeCounts.student_return}名`,
      teacherMove: "不足欄だけを返し、本文全体の添削や完成文の提示には入らない。",
      boundary: "同じ不足が複数学生に出た時だけ、書き方の練習へ抽象化する。",
    },
    {
      key: "next_observation",
      label: "翌日の観察へ戻す",
      countLabel: `${routeCounts.next_observation}名`,
      teacherMove: "気づきを、次に見る場面と保育者の関わりへ戻す問いにする。",
      boundary: "振り返りを、次の観察先へつなげるために使う。",
    },
    {
      key: "post_practicum_review",
      label: "実習後確認で使う",
      countLabel: `${routeCounts.post_practicum_review}名`,
      teacherMove: "記録、見直し、次の観察がつながった流れを本人に説明してもらう。",
      boundary: "学生自身の振り返りを深めるための確認材料として扱う。",
    },
  ].filter((item) => item.countLabel !== "0名");

  const classroomStudentCount = safeRecordList(classwideLessonBacklog).reduce((total, item) => total + clampCount(item.studentCount, 100), 0);
  if (classroomStudentCount > 0) {
    routeItems.push({
      key: "class_activity",
      label: "授業で扱う",
      countLabel: `${classroomStudentCount}件`,
      teacherMove: "複数学生に共通する欄だけを、次回授業の問いと短い練習へ回す。",
      boundary: "個別の記録内容は扱わず、共通する書き方や観察の戻し方だけを扱う。",
    });
  }
  return routeItems;
}

function buildClasswideProcessBottlenecks({
  fieldMissingCounts = {},
  reviewIssueCounts = {},
  nextObservationMissingCount = 0,
  fieldLabels = DIARY_FIELD_LABELS,
} = {}) {
  const items = [];
  for (const key of DIARY_FIELD_KEYS) {
    const count = clampCount(fieldMissingCounts[key], 100);
    if (count <= 0) continue;
    const practice = getClassroomPracticeForField(key);
    items.push({
      key: `missing_${key}`,
      route: count >= 2 ? "授業で扱う" : "学生本人へ戻す",
      label: `${getDiaryFieldLabel(key, fieldLabels)}で止まる`,
      count,
      countLabel: `${count}名`,
      teacherMove: count >= 2 ? practice.miniTask : `${getDiaryFieldLabel(key, fieldLabels)}だけを追記する問いへ戻す。`,
      classQuestion: practice.classQuestion,
      boundary: count >= 2
        ? "個別の記録内容は扱わず、共通する書き方の練習として扱う。"
        : "本文全体の添削や完成文の提示には入らない。",
    });
  }

  const privacyReviewStudentCount = clampCount(reviewIssueCounts.privacy_required, 100);
  if (privacyReviewStudentCount > 0) {
    items.push({
      key: "safety_review",
      route: "教員が先に見る",
      label: "個人が分かる表現の確認が残る",
      count: privacyReviewStudentCount,
      countLabel: `${privacyReviewStudentCount}名`,
      teacherMove: "確認候補だけを先に見て、学生本人へ返すか学校内で確認するかを分ける。",
      classQuestion: "授業共有ではなく、個別に確認すべき表現が混ざっていませんか。",
      boundary: "個別情報を含みうるため、授業共有へは回さない。",
    });
  }

  const contextReviewStudentCount = clampCount(reviewIssueCounts.context_expression, 100);
  if (contextReviewStudentCount > 0) {
    items.push({
      key: "context_expression_review",
      route: "教員が先に見る",
      label: "文脈確認が残る",
      count: contextReviewStudentCount,
      countLabel: `${contextReviewStudentCount}名`,
      teacherMove: "園や子どもへの断定に見える箇所だけを先に見る。",
      classQuestion: "見た事実として言える表現と、文脈確認が必要な表現を分けられますか。",
      boundary: "個別の文脈が必要なため、授業共有へは回さない。",
    });
  }

  const safeTextApplyStudentCount = clampCount(reviewIssueCounts.safe_text_apply, 100);
  if (safeTextApplyStudentCount > 0) {
    items.push({
      key: "safe_text_apply",
      route: "学生本人へ戻す",
      label: "安全化した文の反映で止まる",
      count: safeTextApplyStudentCount,
      countLabel: `${safeTextApplyStudentCount}名`,
      teacherMove: "安全化した文の反映と再チェックだけを学生本人へ戻す。",
      classQuestion: "個人が分かる表現を、見た事実として言い換えられますか。",
      boundary: "本文全体の添削や完成文の提示には入らない。",
    });
  }

  const reviewQuestionStudentCount = clampCount(reviewIssueCounts.review_question, 100);
  if (reviewQuestionStudentCount > 0) {
    items.push({
      key: "review_question",
      route: "学生本人へ戻す",
      label: "確認候補の整理で止まる",
      count: reviewQuestionStudentCount,
      countLabel: `${reviewQuestionStudentCount}名`,
      teacherMove: "残った確認候補を一つに絞り、学生本人の見直しへ戻す。",
      classQuestion: "自分で事実と考えを分ければ直せる確認候補ですか。",
      boundary: "本文全体の添削や完成文の提示には入らない。",
    });
  }

  if (nextObservationMissingCount > 0) {
    items.push({
      key: "next_observation",
      route: nextObservationMissingCount >= 2 ? "授業で扱う" : "学生本人へ戻す",
      label: "翌日の観察へ戻っていない",
      count: clampCount(nextObservationMissingCount, 100),
      countLabel: `${clampCount(nextObservationMissingCount, 100)}名`,
      teacherMove: nextObservationMissingCount >= 2
        ? "気づきを、次に見る場面と保育者の関わりへ戻す短い練習にする。"
        : "次に見る場面を一つに絞る問いへ戻す。",
      classQuestion: "今日の気づきは、明日のどの場面を見ることにつながりますか。",
      boundary: "反省で終えず、次の観察対象へ変換するために使う。",
    });
  }

  return items
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      const routePriority = getReturnRoutePriority(a.route === "教員が先に見る" ? "teacher_check" : a.route === "授業で扱う" ? "class_activity" : "student_return")
        - getReturnRoutePriority(b.route === "教員が先に見る" ? "teacher_check" : b.route === "授業で扱う" ? "class_activity" : "student_return");
      if (routePriority !== 0) return routePriority;
      if (b.count !== a.count) return b.count - a.count;
      const keyPriority = [
        "safety_review",
        "context_expression_review",
        "missing_goal_reflection",
        "missing_next_action",
        "next_observation",
        "missing_episode_memo",
        "missing_episode_insight",
        "missing_overall_learning",
      ];
      const aKeyOrder = keyPriority.indexOf(a.key);
      const bKeyOrder = keyPriority.indexOf(b.key);
      const keyOrder = (aKeyOrder < 0 ? keyPriority.length : aKeyOrder) - (bKeyOrder < 0 ? keyPriority.length : bKeyOrder);
      if (keyOrder !== 0) return keyOrder;
      return a.label.localeCompare(b.label, "ja");
    })
    .slice(0, 5)
    .map(({ count, ...item }) => item);
}

function getTeachingPromptForField(fieldKey) {
  if (fieldKey === "goal_reflection") {
    return "その日の実習目標に対して、見た場面と迷った判断を一つずつ分けて書く。";
  }
  if (fieldKey === "episode_memo") {
    return "場面、子どもの姿、自分の関わりを本文引用なしで分ける練習をする。";
  }
  if (fieldKey === "episode_insight") {
    return "気づきを一般論で終えず、根拠になった場面とつなげる。";
  }
  if (fieldKey === "overall_learning") {
    return "複数の場面に共通する気づきを、保育者として大切にしたいことへまとめる。";
  }
  if (fieldKey === "next_action") {
    return "今日の気づきを、明日見る場面と保育者の関わりへ一つ戻す。";
  }
  return "見た事実、考えたこと、次に見ることを分ける。";
}

function getClassroomPracticeForField(fieldKey) {
  if (fieldKey === "goal_reflection") {
    return {
      classQuestion: "今日の目標に対して、見た場面と自分が迷った判断を分けられていますか。",
      miniTask: "一つの場面を選び、目標、実際に見たこと、迷ったことを三行で分ける。",
      teacherNote: "目標の達成/未達ではなく、観察した場面と判断の根拠へ戻す。",
    };
  }
  if (fieldKey === "episode_memo") {
    return {
      classQuestion: "場面、子どもの姿、自分の関わりが一つの文章に混ざっていませんか。",
      miniTask: "同じ場面を、場面、子どもの姿、自分の関わりの三つへ分ける。",
      teacherNote: "うまく書けた学生の文を引用せず、記録の分け方だけを扱う。",
    };
  }
  if (fieldKey === "episode_insight") {
    return {
      classQuestion: "気づきは、実際に見た場面とつながっていますか。",
      miniTask: "気づきの一文に、根拠になった場面を一つ添える。",
      teacherNote: "一般論の正しさではなく、見た事実から考えた流れを扱う。",
    };
  }
  if (fieldKey === "overall_learning") {
    return {
      classQuestion: "複数の場面に共通していた、保育者として大切にしたいことは何ですか。",
      miniTask: "二つの場面から共通する気づきを一つ選び、その根拠を一行ずつ書く。",
      teacherNote: "正解を決めず、場面を横断して本人が見つけた共通点を扱う。",
    };
  }
  if (fieldKey === "next_action") {
    return {
      classQuestion: "今日の気づきは、次に見る場面や保育者の関わりへ戻っていますか。",
      miniTask: "気づき一つを選び、次に見る場面と保育者の関わりを一つずつ決める。",
      teacherNote: "反省で終えず、次の観察対象へ変換する練習にする。",
    };
  }
  return {
    classQuestion: "見た事実、考えたこと、次に見ることは分けられていますか。",
    miniTask: "一つの記録を、事実、考え、次に見ることの三つへ分ける。",
    teacherNote: "個別の記録内容ではなく、分け方の練習として扱う。",
  };
}

function buildClasswideLessonBacklog(classwideSignals = []) {
  return safeRecordList(classwideSignals)
    .slice()
    .sort((left, right) => clampCount(right.studentCount, 100) - clampCount(left.studentCount, 100))
    .map((signal) => {
    const practice = getClassroomPracticeForField(signal.key);
    return {
      key: `classroom_${normalizeDiaryFieldKey(signal.key) || "practice"}`,
      label: signal.label || "共通テーマ",
      studentCount: clampCount(signal.studentCount, 100),
      classQuestion: practice.classQuestion,
      miniTask: practice.miniTask,
      teacherNote: practice.teacherNote,
      avoidUse: "個別の記録内容は取り上げず、共通する書き方の練習として扱う。",
      };
    });
}

function getReturnRoutePriority(routeKey) {
  if (routeKey === "teacher_check") return 0;
  if (routeKey === "student_return") return 1;
  if (routeKey === "next_observation") return 2;
  if (routeKey === "post_practicum_review") return 3;
  if (routeKey === "class_activity") return 4;
  return 5;
}

function isPlainRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizePolicyEnum(value = "") {
  return normalizeSafeToken(value, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
}

function normalizeRetentionDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days)) return 0;
  return Math.floor(days);
}

function getStudentIdentityModeLabel(mode = "") {
  if (mode === "school_approved_student_label") return "学校承認学生表示名";
  return "未合意";
}

function getTeacherAccessScopeLabel(scope = "") {
  if (scope === SERVER_PERSISTENCE_POLICY.teacherAccessScope) return "実習後支援に関わる学校教員だけ";
  return "未合意";
}

function getClassShareGrainLabel(grain = "") {
  if (grain === SERVER_PERSISTENCE_POLICY.classShareGrain) return "複数学生に共通する書き方だけ";
  return "未合意";
}

function buildServerPolicyRequirement({ key, label, approved, currentLabel, requiredLabel, reason }) {
  return {
    key,
    label,
    approved: Boolean(approved),
    status: approved ? "合意済み" : "未合意",
    current: currentLabel || "未合意",
    required: requiredLabel,
    reason,
  };
}

export function buildStudentProcessServerPersistenceGate(policy = {}, events = [], options = {}) {
  const cleanEvents = safeRecordList(events).map(sanitizeStudentProcessEvent);
  const studentKeys = new Set(cleanEvents.map((event) => normalizeSafeToken(event.studentKey, "student")));
  const policyRecord = isPlainRecord(policy) ? policy : {};
  const payload = normalizePolicyEnum(policyRecord.payload);
  const bodyStorage = normalizePolicyEnum(policyRecord.bodyStorage);
  const studentIdentityMode = normalizePolicyEnum(policyRecord.studentIdentityMode);
  const teacherAccessScope = normalizePolicyEnum(policyRecord.teacherAccessScope);
  const retentionDays = normalizeRetentionDays(policyRecord.retentionDays);
  const classShareGrain = normalizePolicyEnum(policyRecord.classShareGrain);
  const deleteRouteApproved = policyRecord.deleteRouteApproved === true;
  const retentionCleanupReady = policyRecord.retentionCleanupReady === true;
  const serverSaveApproved = policyRecord.serverSaveApproved === true;
  const runtimeEnabled = options.runtimeEnabled === true;
  const writeCodeEnabled = options.writeCodeEnabled === true;

  const retentionApproved = retentionDays >= SERVER_PERSISTENCE_POLICY.retentionMinDays
    && retentionDays <= SERVER_PERSISTENCE_POLICY.retentionMaxDays;
  const requirements = [
    buildServerPolicyRequirement({
      key: "payload_scope",
      label: "保存する中身",
      approved: payload === SERVER_PERSISTENCE_POLICY.payload,
      currentLabel: payload === SERVER_PERSISTENCE_POLICY.payload ? "メタ情報のみ" : "未合意",
      requiredLabel: "メタ情報のみ",
      reason: "本文やAI出力を保存対象にしないため。",
    }),
    buildServerPolicyRequirement({
      key: "body_storage",
      label: "本文保存",
      approved: bodyStorage === SERVER_PERSISTENCE_POLICY.bodyStorage,
      currentLabel: bodyStorage === SERVER_PERSISTENCE_POLICY.bodyStorage ? "保存しない" : "未合意",
      requiredLabel: "保存しない",
      reason: "学生本人が書いた実習記録を合意前に残さないため。",
    }),
    buildServerPolicyRequirement({
      key: "student_identifier",
      label: "学生の識別方法",
      approved: SERVER_PERSISTENCE_POLICY.studentIdentityModes.includes(studentIdentityMode),
      currentLabel: getStudentIdentityModeLabel(studentIdentityMode),
      requiredLabel: "既存プロフィールの学校承認学生表示名",
      reason: "未実装の匿名化を約束せず、学校が管理する既存プロフィール表示名で支援材料をつなぐため。",
    }),
    buildServerPolicyRequirement({
      key: "teacher_access",
      label: "閲覧できる役割",
      approved: teacherAccessScope === SERVER_PERSISTENCE_POLICY.teacherAccessScope,
      currentLabel: getTeacherAccessScopeLabel(teacherAccessScope),
      requiredLabel: "実習後支援に関わる学校教員だけ",
      reason: "支援のための確認範囲を、実習後支援に関わる学校教員へ絞るため。",
    }),
    buildServerPolicyRequirement({
      key: "retention_and_delete",
      label: "保存期間と削除方法",
      approved: retentionApproved && deleteRouteApproved && retentionCleanupReady,
      currentLabel: retentionApproved && deleteRouteApproved && retentionCleanupReady ? `${retentionDays}日 / 削除方法・期限切れ削除準備済み` : "未合意",
      requiredLabel: `${SERVER_PERSISTENCE_POLICY.retentionMinDays}日から${SERVER_PERSISTENCE_POLICY.retentionMaxDays}日の範囲で、削除方法と期限切れ削除運用も合意`,
      reason: "PoC終了後や保存期限後に残り続けるデータを作らないため。",
    }),
    buildServerPolicyRequirement({
      key: "class_share_grain",
      label: "授業で扱う粒度",
      approved: classShareGrain === SERVER_PERSISTENCE_POLICY.classShareGrain,
      currentLabel: getClassShareGrainLabel(classShareGrain),
      requiredLabel: "複数学生に共通する書き方だけ",
      reason: "個別記録ではなく、授業で扱える共通テーマへ抽象化するため。",
    }),
    buildServerPolicyRequirement({
      key: "server_save_gate",
      label: "サーバー保存の開始",
      approved: serverSaveApproved,
      currentLabel: serverSaveApproved ? "学校承認済み" : "未許可",
      requiredLabel: "学校側の明示承認",
      reason: "学校方針の合意前にDBやAPI保存へ進まないため。",
    }),
  ];
  const policyRequirementsSatisfied = requirements.every((item) => item.approved);
  const canServerPersistNow = policyRequirementsSatisfied && runtimeEnabled && writeCodeEnabled;

  return {
    contractVersion: STUDENT_PROCESS_META_CONTRACT.version,
    purpose: "policy_gated_metadata_persistence",
    decisionLabel: canServerPersistNow
      ? "学校合意と実行設定が揃ったためメタのみ保存可能"
      : policyRequirementsSatisfied
        ? "学校合意済みだが実行設定が無効"
        : "学校方針未合意のためサーバー保存不可",
    policyRequirementsSatisfied,
    runtimeEnabled,
    writeCodeEnabled,
    canServerPersistNow,
    implementationGate: canServerPersistNow ? "policy_and_runtime_enabled" : "policy_and_runtime_required",
    approvedRequirementCount: requirements.filter((item) => item.approved).length,
    totalRequirementCount: requirements.length,
    eventCount: cleanEvents.length,
    studentCount: studentKeys.size,
    requirements,
    requiredPolicyKeys: requirements.map((item) => item.key),
    disallowedAlways: [
      "本文そのもの",
      "AI出力本文",
      "氏名・メール・実習先名",
      "支援用途を超える判断情報",
    ],
  };
}

const SCHOOL_POLICY_NEXT_DECISIONS = Object.freeze({
  payload_scope: "本文ではなく、段階・件数・分類だけを保存対象にするかを決める。",
  body_storage: "学生が書いた本文やAI出力本文を保存しない方針を確認する。",
  student_identifier: "既存プロフィールのどの学校承認表示名で学生をつなぐかを決める。",
  teacher_access: "実習後支援に関わる学校教員だけが見られる範囲にするかを決める。",
  retention_and_delete: "保存期間と、PoC終了後の削除方法を決める。",
  class_share_grain: "授業で扱う時は、個別記録ではなく共通する書き方へ抽象化するかを決める。",
  server_save_gate: "学校側の明示承認が出るまでDB/API保存を始めないことを確認する。",
});

const SCHOOL_POLICY_UNRESOLVED_ORDER = Object.freeze([
  "server_save_gate",
  "payload_scope",
  "body_storage",
  "student_identifier",
  "teacher_access",
  "retention_and_delete",
  "class_share_grain",
]);

function compareSchoolPolicyUnresolvedItems(left = {}, right = {}) {
  const leftIndex = SCHOOL_POLICY_UNRESOLVED_ORDER.indexOf(left.key);
  const rightIndex = SCHOOL_POLICY_UNRESOLVED_ORDER.indexOf(right.key);
  const leftRank = leftIndex >= 0 ? leftIndex : SCHOOL_POLICY_UNRESOLVED_ORDER.length;
  const rightRank = rightIndex >= 0 ? rightIndex : SCHOOL_POLICY_UNRESOLVED_ORDER.length;
  return leftRank - rightRank;
}

function buildSchoolPolicyDecisionStatus({ checklist = [], serverSaveGate = {} } = {}) {
  const requirements = safeRecordList(serverSaveGate.requirements);
  const checklistByKey = new Map(safeRecordList(checklist).map((item) => [item.key, item]));
  const unresolved = requirements
    .filter((item) => !item.approved)
    .map((item) => {
      const checklistItem = checklistByKey.get(item.key) || {};
      const isHardGate = item.key === "server_save_gate" || item.key === "payload_scope" || item.key === "body_storage";
      return {
        key: item.key,
        label: item.label,
        status: item.key === "server_save_gate" ? "未許可" : "未合意",
        priority: isHardGate ? "先に決める" : "続けて決める",
        nextDecision: SCHOOL_POLICY_NEXT_DECISIONS[item.key] || item.required,
        owner: checklistItem.confirmWith || "実習担当教員 / 情報管理担当",
        current: item.current,
        required: item.required,
        reason: item.reason,
        risk: checklistItem.risk || "学校方針が曖昧だと、実用段階で説明しにくくなります。",
      };
    })
    .sort(compareSchoolPolicyUnresolvedItems);
  const policyRequirementsSatisfied = Boolean(serverSaveGate.policyRequirementsSatisfied);
  const canServerPersistNow = Boolean(serverSaveGate.canServerPersistNow);

  return {
    status: canServerPersistNow
      ? "policy_and_runtime_enabled"
      : policyRequirementsSatisfied
        ? "policy_requirements_satisfied_but_runtime_disabled"
        : "blocked_until_school_policy",
    statusLabel: canServerPersistNow ? "合意済みメタ保存を有効化" : policyRequirementsSatisfied ? "学校合意済み・実行設定は無効" : "保存前に学校合意が必要",
    guidance: canServerPersistNow
      ? "本文を含まない固定メタだけを、合意済みの保存期間で扱います。"
      : policyRequirementsSatisfied
        ? "DB/APIの実装はありますが、環境設定を有効にするまで保存しません。"
      : "10月の学内共有までに、ID、閲覧範囲、保存期間、授業共有の粒度、保存開始条件を学校側と決めます。",
    policyRequirementsSatisfied,
    canProceedToImplementation: policyRequirementsSatisfied,
    canServerPersistNow,
    implementationGate: serverSaveGate.implementationGate || "policy_and_runtime_required",
    unresolvedCount: unresolved.length,
    totalCount: requirements.length,
    nextOwner: "実習担当教員 / 情報管理担当",
    unresolved,
    fixedBoundaries: [
      "本文そのものは保存対象にしない",
      "AI出力本文を提出物として扱わない",
      "氏名・メール・実習先名を保存対象にしない",
      "支援目的から外れる用途にしない",
    ],
  };
}

export function buildStudentProcessPersistenceReadiness(events = [], options = {}) {
  const cleanEvents = safeRecordList(events)
    .map(sanitizeStudentProcessEvent)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const fieldLabels = buildPostPracticumDiaryFieldLabels(options);
  const latestByStudent = new Map();
  for (const event of cleanEvents) {
    const key = normalizeSafeToken(event.studentKey, "student");
    const current = latestByStudent.get(key);
    if (
      !current
      || event.processDate > current.processDate
      || (event.processDate === current.processDate && event.createdAt > current.createdAt)
    ) {
      latestByStudent.set(key, event);
    }
  }
  const latestEvents = Array.from(latestByStudent.values());
  const summary = buildStudentProcessEventSummary(cleanEvents);
  const missingFieldStudentCounts = Object.fromEntries(DIARY_FIELD_KEYS.map((key) => [key, 0]));
  let safetyReviewStudentCount = 0;
  let reviewIssueStudentCount = 0;
  let nextObservationReadyStudentCount = 0;
  let readyForPostPracticumStudentCount = 0;

  for (const event of latestEvents) {
    const missingFields = getCurrentMissingFields(event);
    const reviewIssueNeeded = hasCurrentReviewIssue(event);
    const feedbackSupport = buildFeedbackSupport(event.diaryMeta);
    for (const key of missingFields) missingFieldStudentCounts[key] += 1;
    if (reviewIssueNeeded) reviewIssueStudentCount += 1;
    if (hasCurrentSafetyReviewNeed(event)) safetyReviewStudentCount += 1;
    if (hasCurrentNextObservationSignal(event)) nextObservationReadyStudentCount += 1;
    if (missingFields.length === 0 && !reviewIssueNeeded && !feedbackSupport?.needsAttention && hasCurrentNextObservationSignal(event)) {
      readyForPostPracticumStudentCount += 1;
    }
  }

  const missingFieldSummary = DIARY_FIELD_KEYS
    .filter((key) => missingFieldStudentCounts[key] > 0)
    .map((key) => `${getDiaryFieldLabel(key, fieldLabels)} ${missingFieldStudentCounts[key]}名`)
    .join(" / ");
  const candidates = [
    {
      key: "process_stage_meta",
      label: "記録プロセス段階",
      status: "保存候補",
      evidence: `${summary.eventCount}件 / ${latestEvents.length}名`,
      saveAs: "段階、時刻、契約バージョン",
      reason: "本文を見ずに、記録から提出前確認までの流れだけを実習後の支援材料にできます。",
    },
    {
      key: "diary_field_status",
      label: "入力済み欄と不足欄",
      status: "保存候補",
      evidence: missingFieldSummary || "不足欄なし",
      saveAs: "入力済み件数、不足欄キー、次の不足欄",
      reason: "学校フォーマットのどこで止まりやすいかを、本文なしで授業内の練習へ戻せます。",
    },
    {
      key: "safety_review_meta",
      label: "提出前確認の理由",
      status: "保存候補",
      evidence: `${reviewIssueStudentCount}名 / 教員先確認 ${safetyReviewStudentCount}名`,
      saveAs: "確認状態、固定分類、確認件数、学生が反映したかどうか",
      reason: "個別の表現を引用せず、学生本人へ戻すものと学校教員が先に見るものを分けられます。",
    },
    {
      key: "next_observation_signal",
      label: "翌日の観察への接続",
      status: "保存候補",
      evidence: `${nextObservationReadyStudentCount}名`,
      saveAs: "翌日の観察に戻っているかどうか",
      reason: "振り返りで終わらず、次に見る場面へ戻せたかを実習後に確認できます。",
    },
    {
      key: "student_link_key",
      label: "学生別の内部キー",
      status: "学校確認",
      evidence: `${latestEvents.length}名`,
      saveAs: "本文なし内部キーと既存プロフィールの学校承認表示名",
      reason: "イベントには氏名を保存せず、教員表示では既存プロフィールの学校承認表示名へ接続します。",
    },
  ];
  const deferredItems = [
    {
      key: "raw_diary_body",
      label: "本文そのもの",
      reason: "保存期間、閲覧できる役割、削除方法を学校と決めるまで保存候補にしません。",
    },
    {
      key: "ai_output_body",
      label: "AI出力本文",
      reason: "学生本人の確認前の文章を提出物や記録として扱わないため、合意前は保存しません。",
    },
    {
      key: "direct_identity",
      label: "実名・連絡先・実習先名",
      reason: "イベントへ新たに保存せず、教員が既に利用する学校管理プロフィールから表示します。",
    },
    {
      key: "beyond_support_judgment",
      label: "支援用途を超える判断情報",
      reason: "Manalioは学生の記録プロセスを支援するための道具として扱います。",
    },
  ];
  const schoolPolicyChecklist = [
    {
      key: "student_identifier",
      label: "学生をどう見分けるか",
      status: "要合意",
      defaultPosition: "イベントには直接識別情報を保存せず、既存プロフィールの学校承認学生表示名へ接続します。",
      confirmWith: "実習担当教員 / 情報管理担当",
      risk: "IDが曖昧だと、別学生の支援材料が混ざります。",
    },
    {
      key: "teacher_access",
      label: "誰が見られるか",
      status: "要合意",
      defaultPosition: "実習後の支援に関わる学校教員だけに絞ります。",
      confirmWith: "実習担当教員 / 学科内の確認者",
      risk: "閲覧範囲が広がると、学生への支援目的から外れます。",
    },
    {
      key: "retention_and_delete",
      label: "いつまで残すか",
      status: "要合意",
      defaultPosition: "PoCでは期間を短く区切り、終了後の削除方法を先に決めます。",
      confirmWith: "学校管理者 / 情報管理担当",
      risk: "保存期間が曖昧だと、学内共有で止まりやすくなります。",
    },
    {
      key: "class_share_grain",
      label: "授業で扱う粒度",
      status: "要合意",
      defaultPosition: "個別記録ではなく、複数学生に共通する書き方の練習だけを残します。",
      confirmWith: "実習担当教員",
      risk: "個別の記録内容を授業に出すと、支援の範囲を超えて見えます。",
    },
    {
      key: "server_save_gate",
      label: "サーバー保存を始める条件",
      status: "未許可",
      defaultPosition: "学校方針が合意されるまで、DBやAPIへの保存へ進めません。",
      confirmWith: "実習担当教員 / 情報管理担当",
      risk: "合意前に保存すると、安全説明が弱くなります。",
    },
  ];
  const serverSaveGate = buildStudentProcessServerPersistenceGate(options.schoolPolicy, cleanEvents, {
    runtimeEnabled: options.runtimeEnabled === true,
    writeCodeEnabled: true,
  });
  const schoolPolicyDecisionStatus = buildSchoolPolicyDecisionStatus({
    checklist: schoolPolicyChecklist,
    serverSaveGate,
  });

  return {
    contractVersion: STUDENT_PROCESS_META_CONTRACT.version,
    status: "school_policy_needed_before_server_save",
    modeLabel: "現在はローカルブラウザ内だけ",
    serverPersistence: STUDENT_PROCESS_META_CONTRACT.serverPersistence,
    payload: STUDENT_PROCESS_META_CONTRACT.payload,
    bodyStorage: STUDENT_PROCESS_META_CONTRACT.bodyStorage,
    canServerPersistNow: serverSaveGate.canServerPersistNow,
    eventCount: cleanEvents.length,
    studentCount: latestEvents.length,
    readyForPostPracticumStudentCount,
    candidates,
    deferredItems,
    schoolPolicyChecklist,
    schoolPolicyDecisionStatus,
    serverSaveGate,
    schoolPolicyQuestions: [
      "学生別に見るためのIDを、学校内のどのIDへひもづけるか。",
      "実習後、どの役割の教員がどの期間まで確認できるか。",
      "学校フォーマットのどの欄を、本文なしメタとして残してよいか。",
      "授業内で扱う共通テーマを、個別学生と切り離してどの粒度で残すか。",
    ],
  };
}

export function buildPostPracticumSupportPackage(events = [], options = {}) {
  const cleanEvents = safeRecordList(events)
    .map(sanitizeStudentProcessEvent)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const fieldLabels = buildPostPracticumDiaryFieldLabels(options);
  const studentLabelsByKey = isPlainRecord(options.studentLabelsByKey) ? options.studentLabelsByKey : {};
  const groups = new Map();
  for (const event of cleanEvents) {
    const key = normalizeSafeToken(event.studentKey, "student");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }

  const fieldMissingCounts = Object.fromEntries(DIARY_FIELD_KEYS.map((key) => [key, 0]));
  const reviewIssueCounts = Object.fromEntries(Object.keys(REVIEW_ISSUE_DEFINITIONS).map((key) => [key, 0]));
  let safetyReviewStudentCount = 0;
  let reviewIssueStudentCount = 0;
  let nextObservationMissingCount = 0;
  let postPracticumReadyCount = 0;

  const students = disambiguateStudentLabels(Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, "ja"))
    .map(([studentKey, studentEvents]) => {
      const processDate = getLatestProcessDate(studentEvents);
      const currentProcessEvents = studentEvents.filter((event) => event.processDate === processDate);
      const latestEvent = currentProcessEvents[0] || {};
      const processDateCount = Math.max(
        new Set(studentEvents.map((event) => event.processDate)).size,
        ...studentEvents.map((event) => clampCount(event.resultMeta?.processDateCount, 180)),
      );
      const latestDiaryMeta = normalizeDiaryMeta(latestEvent.diaryMeta);
      const stageLabels = uniqueStageLabels(currentProcessEvents);
      const missingRequiredFields = getCurrentMissingFields(latestEvent);
      const reviewIssue = getCurrentReviewIssue(latestEvent);
      const reviewIssueNeeded = hasCurrentReviewIssue(latestEvent);
      const safetyReviewNeeded = hasCurrentSafetyReviewNeed(latestEvent);
      const hasNextObservation = hasCurrentNextObservationSignal(latestEvent);
      const feedbackSupport = buildFeedbackSupport(latestDiaryMeta);
      const supportFocus = buildSupportFocus({
        missingFields: missingRequiredFields,
        reviewIssue,
        feedbackSupport,
        safetyReviewNeeded,
        hasNextObservation,
        stageLabels,
        fieldLabels,
      });
      const supportAction = buildSupportActionPlan({
        supportFocus,
        missingFields: missingRequiredFields,
        reviewIssue,
        feedbackSupport,
        safetyReviewNeeded,
        hasNextObservation,
        fieldLabels,
      });
      const returnPreparation = buildReturnPreparation({
        supportAction,
        missingFields: missingRequiredFields,
        reviewIssue,
        feedbackSupport,
        safetyReviewNeeded,
        hasNextObservation,
        fieldLabels,
      });

      for (const key of missingRequiredFields) {
        fieldMissingCounts[key] += 1;
      }
      if (reviewIssueNeeded) {
        reviewIssueCounts[reviewIssue.primaryIssueKey] += 1;
        reviewIssueStudentCount += 1;
      }
      if (safetyReviewNeeded) safetyReviewStudentCount += 1;
      if (!hasNextObservation) nextObservationMissingCount += 1;
      if (!missingRequiredFields.length && !reviewIssueNeeded && !feedbackSupport?.needsAttention && hasNextObservation) postPracticumReadyCount += 1;

      return {
        supportStudentId: buildSupportStudentId(studentKey),
        processStudentKey: /^school-student-[a-f0-9]{32}$/.test(studentKey) ? studentKey : "",
        studentLabel: normalizeSafeToken(studentLabelsByKey[studentKey], "") || buildAnonymousStudentLabel(studentKey),
        processDate,
        processDateCount,
        latestStage: normalizeStage(latestEvent.stage),
        latestStageLabel: STUDENT_PROCESS_STAGES[normalizeStage(latestEvent.stage)],
        recordedStageLabels: stageLabels,
        missingRequiredFields,
        missingRequiredFieldLabels: missingRequiredFields.map((key) => getDiaryFieldLabel(key, fieldLabels)),
        reviewIssue,
        feedbackSupport,
        safetyReviewNeeded,
        hasNextObservation,
        supportFocus,
        supportAction,
        returnPreparation,
      };
    }));

  const classwideSignals = DIARY_FIELD_KEYS
    .map((key) => ({
      key,
      label: getDiaryFieldLabel(key, fieldLabels),
      studentCount: fieldMissingCounts[key],
      teachingPrompt: getTeachingPromptForField(key),
    }))
    .filter((signal) => signal.studentCount >= 2);
  const classwideLessonBacklog = buildClasswideLessonBacklog(classwideSignals);
  const classwideProcessBottlenecks = buildClasswideProcessBottlenecks({
    fieldMissingCounts,
    reviewIssueCounts,
    nextObservationMissingCount,
    fieldLabels,
  });
  const returnRouteSummary = buildReturnRouteSummary(students, classwideLessonBacklog);
  const persistenceReadiness = buildStudentProcessPersistenceReadiness(cleanEvents, options);

  return {
    contractVersion: STUDENT_PROCESS_META_CONTRACT.version,
    serverPersistence: STUDENT_PROCESS_META_CONTRACT.serverPersistence,
    payload: STUDENT_PROCESS_META_CONTRACT.payload,
    teacherUse: STUDENT_PROCESS_META_CONTRACT.teacherUse,
    bodyStorage: STUDENT_PROCESS_META_CONTRACT.bodyStorage,
    eventCount: cleanEvents.length,
    studentCount: students.length,
    students,
    classwideSignals,
    classwideLessonBacklog,
    classwideProcessBottlenecks,
    returnRouteSummary,
    persistenceReadiness,
    supportCounts: {
      safetyReviewStudentCount,
      reviewIssueStudentCount,
      reviewIssueCounts,
      nextObservationMissingCount,
      postPracticumReadyCount,
    },
  };
}
