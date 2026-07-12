import { createHash } from "node:crypto";
import {
  buildStudentProcessServerPersistenceGate,
  isStudentProcessStage,
  sanitizeStudentProcessEvent,
  STUDENT_PROCESS_META_CONTRACT,
} from "../student-process-events.mjs";
import { supabaseRestFetch } from "./_supabase.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIARY_FIELD_KEYS = new Set(["goal_reflection", "episode_memo", "episode_insight", "overall_learning", "next_action"]);
const REVIEW_STATUSES = new Set(["none", "clear", "review", "blocked"]);
const REVIEW_ISSUES = new Set(["none", "privacy_required", "context_expression", "safe_text_apply", "review_question"]);
const FEEDBACK_STATES = new Set(["none", "needs_next_action", "connected", "teacher_question"]);
const STUDENT_PROCESS_STAGES_PER_DAY = 4;

export const STUDENT_PROCESS_POLICY_SELECT = [
  "student_process_persistence_enabled",
  "student_process_identity_mode",
  "student_process_retention_days",
  "student_process_policy_version",
  "student_process_policy_approved_at",
  "student_process_delete_approved_at",
  "student_process_cleanup_ready_at",
].join(",");

export function isStudentProcessServerPersistenceEnabled() {
  return process.env.MANABI_STUDENT_PROCESS_SERVER_PERSISTENCE === "true"
    && process.env.NEXT_PUBLIC_MANABI_ENABLE_STUDENT_PROCESS_PERSISTENCE === "true"
    && process.env.MANABI_PUBLIC_DEMO_ONLY !== "true";
}

export function buildStudentProcessPolicyFromSchool(row = {}, options = {}) {
  const retentionDays = normalizeRetentionDays(row.student_process_retention_days);
  const identityMode = normalizeIdentityMode(row.student_process_identity_mode);
  const policyVersionMatches = row.student_process_policy_version === STUDENT_PROCESS_META_CONTRACT.version;
  const now = normalizeTimestamp(options.now || new Date().toISOString());
  const policyApproved = isApprovedTimestamp(row.student_process_policy_approved_at, now);

  return {
    payload: "metadata_only",
    bodyStorage: "never",
    studentIdentityMode: identityMode,
    teacherAccessScope: "practicum_support_teachers_only",
    retentionDays,
    deleteRouteApproved: isApprovedTimestamp(row.student_process_delete_approved_at, now),
    retentionCleanupReady: isApprovedTimestamp(row.student_process_cleanup_ready_at, now),
    classShareGrain: "classwide_pattern_only",
    serverSaveApproved: row.student_process_persistence_enabled === true && policyVersionMatches && policyApproved,
  };
}

export async function loadStudentProcessPersistenceState(schoolId, options = {}) {
  const runtimeEnabled = options.runtimeEnabled ?? isStudentProcessServerPersistenceEnabled();
  if (!runtimeEnabled || !isUuid(schoolId)) {
    const policy = buildStudentProcessPolicyFromSchool({}, options);
    return {
      runtimeEnabled,
      policy,
      gate: buildStudentProcessServerPersistenceGate(policy, [], { runtimeEnabled, writeCodeEnabled: true }),
    };
  }

  const rows = await supabaseRestFetch(
    `/schools?select=${STUDENT_PROCESS_POLICY_SELECT}&id=eq.${encodeURIComponent(schoolId)}&limit=1`,
  );
  const policy = buildStudentProcessPolicyFromSchool(rows?.[0], options);
  return {
    runtimeEnabled,
    policy,
    gate: buildStudentProcessServerPersistenceGate(policy, [], { runtimeEnabled, writeCodeEnabled: true }),
  };
}

export function buildStudentProcessEventWriteRow({ context = {}, event = {}, policy = {}, now = new Date().toISOString() } = {}) {
  const session = context.session || {};
  const userId = normalizeUuid(context.user?.id);
  const schoolId = normalizeUuid(session.schoolId);
  const classId = normalizeUuid(session.classId);
  const receivedAt = normalizeTimestamp(now);
  const createdAt = normalizeTimestamp(event.createdAt);
  const processDate = normalizeProcessDate(event.processDate);
  const retentionDays = normalizeRetentionDays(policy.retentionDays);
  const recordedAt = normalizeEventRecordedAt(createdAt, receivedAt, processDate);
  const currentProcessDate = receivedAt ? toJapanDateKey(receivedAt) : "";
  const oldestProcessDate = currentProcessDate && retentionDays
    ? shiftDateKey(currentProcessDate, -(retentionDays - 1))
    : "";
  const expiresAt = recordedAt && retentionDays ? addDays(recordedAt, retentionDays) : "";
  const gate = buildStudentProcessServerPersistenceGate(policy, [], { runtimeEnabled: true, writeCodeEnabled: true });

  if (
    !gate.canServerPersistNow
    || session.source !== "supabase"
    || session.role !== "student"
    || !userId
    || !schoolId
    || !classId
    || !recordedAt
    || !processDate
    || !retentionDays
    || !expiresAt
    || expiresAt <= receivedAt
    || processDate > currentProcessDate
    || processDate < oldestProcessDate
    || (session.userId && session.userId !== userId)
    || !isStudentProcessStage(event.stage)
  ) {
    return null;
  }

  const cleanEvent = sanitizeStudentProcessEvent({
    ...event,
    source: "server",
    contractVersion: STUDENT_PROCESS_META_CONTRACT.version,
  });
  const diaryMeta = cleanEvent.diaryMeta || {};
  const reviewMeta = cleanEvent.reviewMeta || {};
  const resultMeta = cleanEvent.resultMeta || {};
  const requiredEpisodeCount = normalizeEpisodeCount(diaryMeta.requiredEpisodeCount) || 1;
  const episodeMemoCount = normalizeEpisodeCount(diaryMeta.episodeMemoCount);
  const episodeInsightCount = normalizeEpisodeCount(diaryMeta.episodeInsightCount);
  const completeEpisodeCount = Math.min(
    normalizeEpisodeCount(diaryMeta.completeEpisodeCount),
    episodeMemoCount,
    episodeInsightCount,
  );

  return {
    school_id: schoolId,
    class_id: classId,
    user_id: userId,
    process_date: processDate,
    stage: cleanEvent.stage,
    contract_version: STUDENT_PROCESS_META_CONTRACT.version,
    missing_required_fields: normalizeMissingFields(diaryMeta.missingRequiredFields),
    required_episode_count: requiredEpisodeCount,
    episode_memo_count: episodeMemoCount,
    episode_insight_count: episodeInsightCount,
    complete_episode_count: completeEpisodeCount,
    review_status: normalizeReviewStatus(reviewMeta.status),
    review_issue: normalizeReviewIssue(reviewMeta.primaryIssueKey),
    feedback_field_count: normalizeFeedbackFieldCount(diaryMeta.feedbackFieldCount),
    feedback_state: buildFeedbackState(diaryMeta),
    has_next_observation: Boolean(diaryMeta.nextActionChars || resultMeta.hasNextObservation),
    recorded_at: recordedAt,
    updated_at: recordedAt,
    expires_at: expiresAt,
  };
}

export function buildTeacherStudentProcessPayload({
  rows = [],
  profiles = [],
  session = {},
  policy = {},
  now = new Date().toISOString(),
  runtimeEnabled = false,
  truncated = false,
} = {}) {
  const gate = buildStudentProcessServerPersistenceGate(policy, [], { runtimeEnabled, writeCodeEnabled: true });
  const schoolId = normalizeUuid(session.schoolId);
  const classId = normalizeUuid(session.classId);
  const isTeacher = session.role === "teacher";
  const isAdmin = session.role === "admin";
  const nowTimestamp = normalizeTimestamp(now);
  if (
    !gate.canServerPersistNow
    || session.source !== "supabase"
    || (!isTeacher && !isAdmin)
    || !schoolId
    || !nowTimestamp
    || (isTeacher && !classId)
  ) {
    return emptyTeacherPayload(gate);
  }
  if (truncated) {
    return {
      enabled: true,
      truncated: true,
      contractVersion: STUDENT_PROCESS_META_CONTRACT.version,
      events: [],
      studentLabelsByKey: {},
    };
  }

  const profilesById = new Map(
    safeRecords(profiles)
      .filter((profile) => profile.role === "student" && profile.school_id === schoolId)
      .map((profile) => [profile.id, profile]),
  );
  const retentionDays = normalizeRetentionDays(policy.retentionDays);
  const currentProcessDate = toJapanDateKey(nowTimestamp);
  const oldestProcessDate = currentProcessDate && retentionDays
    ? shiftDateKey(currentProcessDate, -(retentionDays - 1))
    : "";
  const candidates = [];
  for (const row of safeRecords(rows)) {
    const rowSchoolId = normalizeUuid(row.school_id);
    const rowClassId = normalizeUuid(row.class_id);
    const rowUserId = normalizeUuid(row.user_id);
    const processDate = normalizeProcessDate(row.process_date);
    const recordedAt = normalizeTimestamp(row.recorded_at);
    const expiresAt = normalizeTimestamp(row.expires_at);
    const policyExpiresAt = recordedAt && retentionDays ? addDays(recordedAt, retentionDays) : "";
    const effectiveExpiresAt = expiresAt && policyExpiresAt && expiresAt < policyExpiresAt ? expiresAt : policyExpiresAt;
    const profile = profilesById.get(rowUserId);
    if (
      rowSchoolId !== schoolId
      || !rowClassId
      || (isTeacher && rowClassId !== classId)
      || !rowUserId
      || !processDate
      || !oldestProcessDate
      || processDate > currentProcessDate
      || processDate < oldestProcessDate
      || !profile
      || profile.class_id !== rowClassId
      || !recordedAt
      || !expiresAt
      || !effectiveExpiresAt
      || effectiveExpiresAt <= nowTimestamp
      || !isStudentProcessStage(row.stage)
      || row.contract_version !== STUDENT_PROCESS_META_CONTRACT.version
    ) {
      continue;
    }

    candidates.push({ row, rowUserId, processDate, recordedAt, profile });
  }

  const latestProcessDateByStudentId = new Map();
  for (const candidate of candidates) {
    const current = latestProcessDateByStudentId.get(candidate.rowUserId) || "";
    if (candidate.processDate > current) latestProcessDateByStudentId.set(candidate.rowUserId, candidate.processDate);
  }

  const events = [];
  const studentLabelsByKey = {};
  const seen = new Set();
  candidates.sort((left, right) => new Date(right.recordedAt) - new Date(left.recordedAt));
  for (const { row, rowUserId, processDate, profile } of candidates) {
    if (latestProcessDateByStudentId.get(rowUserId) !== processDate) continue;

    const dedupeKey = `${rowUserId}\u0000${row.stage}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const studentKey = buildStableStudentKey(schoolId, rowUserId);
    events.push(buildEventFromRow(row, studentKey));
    if (policy.studentIdentityMode === "school_approved_student_label") {
      const label = normalizeApprovedStudentLabel(profile.display_name);
      if (label) studentLabelsByKey[studentKey] = label;
    }
  }

  return {
    enabled: true,
    truncated: truncated === true,
    contractVersion: STUDENT_PROCESS_META_CONTRACT.version,
    events,
    studentLabelsByKey,
  };
}

export async function loadTeacherStudentProcessPayload({ session = {}, profiles = [], now = new Date().toISOString() } = {}) {
  const schoolId = normalizeUuid(session.schoolId);
  const classId = normalizeUuid(session.classId);
  const isTeacher = session.role === "teacher";
  const isAdmin = session.role === "admin";
  if (
    session.source !== "supabase"
    || (!isTeacher && !isAdmin)
    || !schoolId
    || (isTeacher && !classId)
  ) {
    return emptyTeacherPayload({ implementationGate: "authorized_staff_required" });
  }

  const runtimeEnabled = isStudentProcessServerPersistenceEnabled();
  const state = await loadStudentProcessPersistenceState(schoolId, { runtimeEnabled, now });
  if (!state.gate.canServerPersistNow) return emptyTeacherPayload(state.gate);

  const rowLimit = calculateStudentProcessSnapshotRowLimit({ profiles, session });
  if (rowLimit === 0) return emptyTeacherPayload(state.gate);
  const scopedClassIds = [...new Set(
    safeRecords(profiles)
      .filter((profile) => (
        profile.role === "student"
        && normalizeUuid(profile.school_id) === schoolId
        && (!isTeacher || normalizeUuid(profile.class_id) === classId)
      ))
      .map((profile) => normalizeUuid(profile.class_id))
      .filter(Boolean),
  )];
  if (scopedClassIds.length === 0) return emptyTeacherPayload(state.gate);
  const rowPages = await Promise.all(scopedClassIds.map((scopedClassId) => (
    supabaseRestFetch("/rpc/read_teacher_student_process_snapshot", {
      method: "POST",
      body: {
        p_school_id: schoolId,
        p_class_id: scopedClassId,
        p_now: normalizeTimestamp(now),
      },
    })
  )));
  const rows = rowPages.flatMap((page) => safeRecords(page));
  const payload = buildTeacherStudentProcessPayload({
    rows,
    profiles,
    session,
    policy: state.policy,
    now,
    runtimeEnabled,
  });
  return payload.events.length > rowLimit
    ? { ...payload, truncated: true, events: [], studentLabelsByKey: {} }
    : payload;
}

export function calculateStudentProcessSnapshotRowLimit({ profiles = [], session = {} } = {}) {
  const schoolId = normalizeUuid(session.schoolId);
  const classId = normalizeUuid(session.classId);
  const isTeacher = session.role === "teacher";
  const isAdmin = session.role === "admin";
  if (!schoolId || (!isTeacher && !isAdmin) || (isTeacher && !classId)) return 0;

  const studentIds = new Set(
    safeRecords(profiles)
      .filter((profile) => (
        profile.role === "student"
        && normalizeUuid(profile.school_id) === schoolId
        && (!isTeacher || normalizeUuid(profile.class_id) === classId)
      ))
      .map((profile) => normalizeUuid(profile.id))
      .filter(Boolean),
  );
  return studentIds.size * STUDENT_PROCESS_STAGES_PER_DAY;
}

function buildEventFromRow(row, studentKey) {
  const feedbackState = normalizeFeedbackState(row.feedback_state);
  const hasNextObservation = Boolean(row.has_next_observation);
  const reviewIssue = normalizeReviewIssue(row.review_issue);
  return sanitizeStudentProcessEvent({
    id: buildStableProcessEventId(row, studentKey),
    stage: row.stage,
    processDate: normalizeProcessDate(row.process_date),
    createdAt: normalizeTimestamp(row.recorded_at),
    source: "server",
    studentKey,
    contractVersion: STUDENT_PROCESS_META_CONTRACT.version,
    diaryMeta: {
      missingRequiredFields: normalizeMissingFields(row.missing_required_fields),
      nextMissingRequiredField: normalizeMissingFields(row.missing_required_fields)[0] || "",
      requiredEpisodeCount: normalizeEpisodeCount(row.required_episode_count, 8) || 1,
      episodeMemoCount: normalizeEpisodeCount(row.episode_memo_count),
      episodeInsightCount: normalizeEpisodeCount(row.episode_insight_count),
      completeEpisodeCount: normalizeEpisodeCount(row.complete_episode_count),
      nextActionChars: hasNextObservation ? 1 : 0,
      hasFeedback: feedbackState !== "none",
      feedbackFieldCount: normalizeFeedbackFieldCount(row.feedback_field_count),
      feedbackReceivedChars: feedbackState === "none" ? 0 : 1,
      feedbackTomorrowActionChars: feedbackState === "connected" ? 1 : 0,
      feedbackTeacherQuestionChars: feedbackState === "teacher_question" ? 1 : 0,
    },
    reviewMeta: {
      status: normalizeReviewStatus(row.review_status),
      primaryIssueKey: reviewIssue,
      blocked: row.review_status === "blocked",
      needsTeacherCheck: ["privacy_required", "context_expression"].includes(reviewIssue),
    },
    resultMeta: {
      hasNextObservation,
      processDateCount: normalizeProcessDateCount(row.process_date_count),
    },
  });
}

function buildStableProcessEventId(row, studentKey) {
  const digest = createHash("sha256")
    .update([
      STUDENT_PROCESS_META_CONTRACT.version,
      studentKey,
      normalizeProcessDate(row.process_date),
      isStudentProcessStage(row.stage) ? row.stage : "",
      normalizeTimestamp(row.recorded_at),
      normalizeUuid(row.id),
    ].join("\u0000"))
    .digest("hex")
    .slice(0, 32);
  return `process-event-${digest}`;
}

function buildFeedbackState(meta = {}) {
  const hasFeedback = Boolean(
    meta.hasFeedback
    || Number(meta.feedbackFieldCount) > 0
    || Number(meta.feedbackReceivedChars) > 0
    || Number(meta.feedbackInterpretationChars) > 0
    || Number(meta.feedbackTomorrowActionChars) > 0
    || Number(meta.feedbackTeacherQuestionChars) > 0
  );
  if (!hasFeedback) return "none";
  if (Number(meta.feedbackTeacherQuestionChars) > 0) return "teacher_question";
  if (Number(meta.feedbackTomorrowActionChars) > 0) return "connected";
  return "needs_next_action";
}

function emptyTeacherPayload(gate = {}) {
  return {
    enabled: false,
    truncated: false,
    contractVersion: STUDENT_PROCESS_META_CONTRACT.version,
    implementationGate: gate.implementationGate || "policy_and_runtime_required",
    events: [],
    studentLabelsByKey: {},
  };
}

export function buildStableStudentKey(schoolId, userId) {
  const safeSchoolId = normalizeUuid(schoolId);
  const safeUserId = normalizeUuid(userId);
  if (!safeSchoolId || !safeUserId) return "";
  const digest = createHash("sha256")
    .update(`${STUDENT_PROCESS_META_CONTRACT.version}\u0000${safeSchoolId}\u0000${safeUserId}`)
    .digest("hex")
    .slice(0, 32);
  return `school-student-${digest}`;
}

function normalizeApprovedStudentLabel(value) {
  const text = String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!text || /https?:\/\/|@|password|パスワード|cookie|token|secret|ログイン/i.test(text)) return "";
  return text;
}

function normalizeMissingFields(value) {
  return [...new Set((Array.isArray(value) ? value : []).flatMap((key) => (
    key === "episode_insight_or_overall"
      ? ["episode_insight", "overall_learning"]
      : DIARY_FIELD_KEYS.has(key) ? [key] : []
  )))];
}

function normalizeEpisodeCount(value, max = 8) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) return 0;
  return Math.min(count, max);
}

function toJapanDateKey(timestamp) {
  return new Date(new Date(timestamp).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeReviewStatus(value) {
  return REVIEW_STATUSES.has(value) ? value : "none";
}

function normalizeReviewIssue(value) {
  return REVIEW_ISSUES.has(value) ? value : "none";
}

function normalizeFeedbackState(value) {
  return FEEDBACK_STATES.has(value) ? value : "none";
}

function normalizeFeedbackFieldCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) return 0;
  return Math.min(count, 6);
}

function normalizeIdentityMode(value) {
  return value === "school_approved_student_label" ? value : "";
}

function normalizeRetentionDays(value) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 180) return 0;
  return days;
}

function normalizeProcessDateCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) return 0;
  return Math.min(count, 180);
}

function addDays(timestamp, days) {
  return new Date(new Date(timestamp).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeEventRecordedAt(createdAt, receivedAt, processDate) {
  if (!createdAt || !receivedAt || !processDate) return "";
  const createdTime = new Date(createdAt).getTime();
  const receivedTime = new Date(receivedAt).getTime();
  if (createdTime > receivedTime + 5 * 60 * 1000) return "";
  const recordedAt = createdTime > receivedTime ? receivedAt : createdAt;
  if (processDate <= toJapanDateKey(recordedAt)) return recordedAt;
  if (receivedTime - createdTime <= 5 * 60 * 1000 && processDate <= toJapanDateKey(receivedAt)) return receivedAt;
  return "";
}

function shiftDateKey(dateKey, days) {
  if (!dateKey || !Number.isInteger(days)) return "";
  return new Date(new Date(`${dateKey}T00:00:00.000Z`).getTime() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function normalizeTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : "";
}

function normalizeProcessDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

function isApprovedTimestamp(value, now) {
  const timestamp = normalizeTimestamp(value);
  return Boolean(timestamp && now && timestamp <= now);
}

function normalizeUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value.toLowerCase() : "";
}

function isUuid(value) {
  return Boolean(normalizeUuid(value));
}

function safeRecords(value) {
  return (Array.isArray(value) ? value : []).filter((item) => item && typeof item === "object" && !Array.isArray(item));
}
