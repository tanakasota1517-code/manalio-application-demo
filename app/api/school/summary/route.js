import { createHash } from "node:crypto";
import { getServerSessionContext, isRestConfigured, shouldFailClosedWhenRestMissing, supabaseRestFetch } from "../../_supabase.js";
import { enforceRateLimit, enforceScopedRateLimit } from "../../_rateLimit.js";
import { enforceSameOriginRequest } from "../../_requestSecurity.js";
import { buildSchoolSummaryInputPreview } from "../../_schoolSummaryPreview.mjs";
import {
  buildStableStudentKey,
  loadTeacherStudentProcessPayload,
} from "../../_studentProcessPersistence.js";
import { logSafeApiError, logSafeApiWarning } from "../../_safeErrorLog.js";

export const runtime = "nodejs";

const RISK_TERMS = [
  "落ち着きがない",
  "協調性がない",
  "理解が遅い",
  "できない",
  "わがまま",
  "乱暴",
  "発達が気になる",
  "障害",
];

const GUIDELINE_TERMS = ["保育所保育指針", "5領域", "五領域", "指針"];
const POSSIBLE_COMPLETION_TERMS = [
  "楽しそう",
  "集中",
  "達成感",
  "満足感",
  "意欲的",
  "主体的",
  "協力",
  "手指",
  "空間認識",
  "創造性",
  "社会性",
  "発達を促",
  "育ま",
  "友だちと",
  "高い塔",
];
const TEACHER_DISPLAY_EVALUATION_WORD = ["評価", "語"].join("");
const TEACHER_DISPLAY_EVALUATION_DIAGNOSIS = ["評価", "・診断"].join("");

export async function GET(request) {
  if (isPublicDemoOnly()) return publicDemoApiDisabledResponse();

  const sameOriginResponse = enforceSameOriginRequest(request);
  if (sameOriginResponse) return sameOriginResponse;

  const rateLimitResponse = enforceRateLimit(request, {
    namespace: "school-summary-ip",
    limit: 1000,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  if (shouldFailClosedWhenRestMissing()) {
    return Response.json(
      {
        configured: false,
        code: "rest_not_configured",
        error: "学校データ取得設定が未完了のため、教員向け集計を停止しています。",
      },
      { status: 503 },
    );
  }

  if (!isRestConfigured()) {
    return Response.json({
      configured: false,
      school: { name: "" },
      reviewQueue: [],
      recentLogs: [],
      checkSummary: [],
      studentUsage: [],
      studentProcess: {
        enabled: false,
        truncated: false,
        contractVersion: "student-process-meta-v1",
        implementationGate: "policy_and_runtime_required",
        events: [],
        studentLabelsByKey: {},
      },
    });
  }

  try {
    const context = await getServerSessionContext(request);
    if (!context.user?.id) {
      return Response.json({ error: "ログインが必要です。" }, { status: 401 });
    }
    const userRateLimitResponse = enforceScopedRateLimit(context.user.id, {
      namespace: "school-summary-user",
      limit: 90,
      windowMs: 10 * 60 * 1000,
    });
    if (userRateLimitResponse) return userRateLimitResponse;
    if (!["teacher", "admin"].includes(context.session?.role)) {
      return Response.json({ error: "教員向け画面は教員・管理者のみ利用できます。" }, { status: 403 });
    }
    if (!context.session?.schoolId) {
      return Response.json({ error: "学校プロフィールが未設定です。" }, { status: 403 });
    }
    const classScope = buildClassScope(context.session);
    if (classScope instanceof Response) return classScope;

    const schoolId = encodeURIComponent(context.session.schoolId);
    const classFilter = classScope ? `&class_id=eq.${encodeURIComponent(classScope)}` : "";
    const classQueryFilter = classScope ? `&id=eq.${encodeURIComponent(classScope)}` : "";
    const [profileResult, classResult] = await Promise.all([
      fetchSchoolRows(`/profiles?select=id,school_id,role,display_name,class_id&school_id=eq.${schoolId}${classFilter}`),
      fetchSchoolRows(`/classes?select=id,name,starts_on,ends_on&school_id=eq.${schoolId}${classQueryFilter}`),
    ]);
    const profiles = profileResult.rows;
    const classes = classResult.rows;
    const classNamesById = new Map(classes.map((item) => [item.id, safeClassName(item.name)]));
    const postPracticumClassIds = new Set(
      classes.filter((item) => isPostPracticumClass(item)).map((item) => item.id),
    );
    const studentProfiles = profiles.filter((profile) => (
      profile.role === "student" && postPracticumClassIds.has(profile.class_id)
    ));
    const classIdsByStudentId = new Map(studentProfiles.map((profile) => [profile.id, profile.class_id]));
    const generations = await loadStudentGenerationLogs({ schoolId, postPracticumClassIds, studentProfiles });
    const studentGenerations = generations.filter((log) => {
      const studentId = log.user_id || log.session?.userId;
      return postPracticumClassIds.has(log.class_id) && classIdsByStudentId.get(studentId) === log.class_id;
    });
    const reviewQueue = buildReviewQueue(studentGenerations, context.session.schoolId);
    const recentLogs = studentGenerations.map((log) => formatLog(
      log,
      classNamesById.get(log.class_id),
      context.session.schoolId,
    ));
    const studentProcess = postPracticumClassIds.size > 0
      ? await loadOptionalTeacherStudentProcessPayload(
        context.session,
        studentProfiles,
        profileResult.truncated || classResult.truncated,
      )
      : buildPracticumInProgressPayload();

    return Response.json({
      configured: true,
      school: {
        name: context.session.schoolName,
      },
      checkSummary: buildCheckSummary(studentGenerations),
      studentUsage: buildStudentUsage(studentProfiles, studentGenerations, context.session.schoolId, classNamesById),
      reviewQueue,
      recentLogs,
      studentProcess,
    });
  } catch (error) {
    logSafeApiError(error, "school_summary_failed");
    return Response.json(
      {
        error: "学校データを取得できませんでした。",
      },
      { status: 500 },
    );
  }
}

function buildPracticumInProgressPayload() {
  return {
    enabled: false,
    unavailable: false,
    truncated: false,
    contractVersion: "student-process-meta-v1",
    implementationGate: "practicum_in_progress",
    events: [],
    studentLabelsByKey: {},
  };
}

function isPostPracticumClass(value, today = getJstDateKey()) {
  const endsOn = normalizeDateKey(value?.ends_on);
  const currentDate = normalizeDateKey(today);
  return Boolean(endsOn && currentDate && endsOn < currentDate);
}

function getJstDateKey(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return "";
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeDateKey(value) {
  const dateKey = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateKey ? dateKey : "";
}

async function loadOptionalTeacherStudentProcessPayload(session, profiles, rosterTruncated = false) {
  try {
    const payload = await loadTeacherStudentProcessPayload({ session, profiles });
    return rosterTruncated
      ? { ...payload, truncated: true, events: [], studentLabelsByKey: {} }
      : payload;
  } catch {
    logSafeApiWarning(null, "student_process_summary_unavailable");
    return {
      enabled: false,
      unavailable: true,
      contractVersion: "student-process-meta-v1",
      implementationGate: "temporarily_unavailable",
      events: [],
      studentLabelsByKey: {},
    };
  }
}

async function loadStudentGenerationLogs({ schoolId, postPracticumClassIds, studentProfiles }) {
  const students = studentProfiles.filter((profile) => (
    typeof profile.id === "string"
    && profile.id
    && postPracticumClassIds.has(profile.class_id)
  ));
  if (students.length === 0) return [];

  const studentsByClassId = new Map();
  for (const student of students) {
    const classStudents = studentsByClassId.get(student.class_id) || [];
    classStudents.push(student);
    studentsByClassId.set(student.class_id, classStudents);
  }

  const chunks = [];
  for (const [classId, classStudents] of studentsByClassId) {
    for (let index = 0; index < classStudents.length; index += 50) {
      chunks.push({ classId, students: classStudents.slice(index, index + 50) });
    }
  }
  const pages = await Promise.all(chunks.map(({ classId, students: classStudents }) => {
    const studentIdFilter = classStudents.map((item) => encodeURIComponent(item.id)).join(",");
    return supabaseRestFetch(`/generation_logs?select=id,kind,input,output,checks,session,status,created_at,user_id,class_id&school_id=eq.${schoolId}&class_id=eq.${encodeURIComponent(classId)}&user_id=in.(${studentIdFilter})&order=created_at.desc&limit=80`);
  }));
  return pages
    .flat()
    .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))
    .slice(0, 80);
}

async function fetchSchoolRows(path) {
  const rows = [];
  const pageSize = 500;
  const maxRows = 5000;
  const separator = path.includes("?") ? "&" : "?";
  let cursor = "";

  while (rows.length < maxRows) {
    const cursorFilter = cursor ? `&id=gt.${encodeURIComponent(cursor)}` : "";
    const page = await supabaseRestFetch(`${path}${separator}order=id.asc&limit=${pageSize}${cursorFilter}`);
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page.slice(0, maxRows - rows.length));
    if (page.length < pageSize) break;
    const nextCursor = typeof page.at(-1)?.id === "string" ? page.at(-1).id : "";
    if (!nextCursor || nextCursor === cursor) throw new Error("School roster pagination returned an invalid id.");
    cursor = nextCursor;
  }

  const overflow = rows.length >= maxRows && cursor
    ? await supabaseRestFetch(`${path}${separator}order=id.asc&limit=1&id=gt.${encodeURIComponent(cursor)}`)
    : [];
  return { rows, truncated: Array.isArray(overflow) && overflow.length > 0 };
}

function buildClassScope(session = {}) {
  if (session.role === "admin") return "";
  if (session.role === "teacher" && session.classId) return session.classId;
  if (session.role === "teacher") {
    return Response.json(
      {
        error: "担当クラスが未設定のため、教員向け集計を表示できません。",
      },
      { status: 403 },
    );
  }
  return "";
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

function safeClassName(value) {
  const text = typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)
    : "";
  if (!text || /https?:\/\/|@|password|パスワード|cookie|token|secret|ログイン/i.test(text)) return "";
  return text;
}

function safeStudentDisplayName(value) {
  const text = typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)
    : "";
  if (!text || /https?:\/\/|@|password|パスワード|cookie|token|secret|ログイン/i.test(text)) return "学生";
  return text;
}

function buildReviewQueue(logs, schoolId = "") {
  const items = [];
  for (const log of logs) {
    const checks = Array.isArray(log.checks) ? log.checks : Array.isArray(log.output?.checks) ? log.output.checks : [];
    const reviewTags = getReviewTags(log);

    if (reviewTags.includes("追記促し")) items.push(formatReviewItem(log, "追記促し", "入力が薄い記録", "観察事実が少ないため、学生本人への提出前の自己確認で追記を促す候補です。", schoolId));
    if (reviewTags.includes("補完疑い")) items.push(formatReviewItem(log, "補完疑い", "入力内容から確認できない事実の確認", "学生メモに根拠がない発達効果や場面描写が含まれていないか確認する候補です。", schoolId));
    if (reviewTags.includes("表現確認")) items.push(formatReviewItem(log, "表現確認", "断定表現を含むメモ", "子どもへの決めつけや診断に近い表現が入力に含まれていた可能性があります。", schoolId));
    if (reviewTags.includes("匿名化") || reviewTags.includes("置換確認")) items.push(formatReviewItem(log, "置換確認", "個人情報の確認", "子ども名・職員名など、置き換え確認が必要な情報が含まれていた可能性があります。", schoolId));
    if (reviewTags.includes("指針確認")) items.push(formatReviewItem(log, "指針確認", "指針とのつながり確認", "保育所保育指針や5領域とのつながりを、学生本人への問いに返しつつ、授業内で共有しやすい候補です。", schoolId));
    if (reviewTags.includes("確認多め") || checks.length >= 4) items.push(formatReviewItem(log, "確認多め", "提出前の自己確認が多い出力", "未入力項目や確認点が多く、学生本人の見直しに返す候補です。", schoolId));
  }
  return dedupeByIdAndTag(items).sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function formatReviewItem(log, tag, title, detail, schoolId = "") {
  const logPreview = formatLog(log, "", schoolId);
  const priority = getReviewPriorityLabel({ tag, title, detail });
  const handling = getReviewHandling(priority);
  return {
    id: `${logPreview.id}-${tag}`,
    generationId: logPreview.id,
    title: normalizeReviewDisplayText(title, 100),
    tag: normalizeReviewDisplayText(tag, 80),
    priority,
    priorityRank: getReviewPriorityRank(priority),
    handling: handling.id,
    handlingLabel: handling.label,
    handlingDetail: handling.detail,
    detail: normalizeReviewDisplayText(detail, 220),
    kind: log.kind,
    createdAt: log.created_at,
    studentId: logPreview.studentId,
    studentName: "",
    log: logPreview,
  };
}

function normalizeReviewDisplayText(value, maxLength = 280) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .replaceAll(TEACHER_DISPLAY_EVALUATION_WORD, "断定表現")
    .replaceAll(TEACHER_DISPLAY_EVALUATION_DIAGNOSIS, "決めつけや診断")
    .replaceAll("評価点", "確認観点")
    .replaceAll("自動評価", "確認観点")
    .replaceAll("自動判断", "確認観点")
    .replaceAll("学生比較", "個別支援の確認")
    .replaceAll("ランキング", "一覧")
    .replaceAll("採点", "学習支援の確認")
    .replaceAll("成績", "学習支援")
    .replaceAll("合否", "支援観点")
    .replaceAll("可否", "支援観点")
    .replaceAll("優劣", "個別支援の確認")
    .replaceAll("個別差", "個別支援の確認")
    .replaceAll("評価", "決めつけ");
}

function getReviewPriorityLabel(item = {}) {
  const text = `${item.tag || ""} ${item.title || ""} ${item.detail || ""}`;
  if (/個人情報|匿名化|置換確認|実名|園名|診断|家庭|補完疑い|入力外情報/.test(text)) return "高";
  if (/表現|評価|安全|指針|5領域|五領域|考察|感想/.test(text)) return "中";
  return "低";
}

function getReviewPriorityRank(priority) {
  return { 高: 0, 中: 1, 低: 2 }[priority] ?? 3;
}

function getReviewHandling(priority) {
  if (priority === "高") {
    return {
      id: "teacher_now",
      label: "教員確認",
      detail: "個人情報や重大な表現リスクとして、学校教員が提出後に確認する候補です。",
    };
  }
  if (priority === "中") {
    return {
      id: "class_share",
      label: "授業共有",
      detail: "個別添削ではなく、実習後の授業で共有し、学生本人への問いにも返せる候補です。",
    };
  }
  return {
    id: "student_self",
    label: "学生本人",
    detail: "教員の個別確認ではなく、学生本人への提出前の自己確認で返す候補です。",
  };
}

function formatLog(log, className = "", schoolId = "") {
  const checks = Array.isArray(log.checks) ? log.checks : Array.isArray(log.output?.checks) ? log.output.checks : [];
  const headings = Array.isArray(log.output?.headings) ? log.output.headings : [];
  const reviewTags = getReviewTags(log);
  const rawStudentId = log.user_id || log.session?.userId || "";
  const studentId = buildStableStudentKey(schoolId, rawStudentId);
  const generationId = buildOpaqueSummaryKey("generation", schoolId, log.id);
  const sectionCount = Math.min(headings.length, 5);
  return {
    id: generationId,
    generationId,
    kind: log.kind,
    status: log.status,
    createdAt: log.created_at,
    studentId,
    studentName: "",
    className: safeClassName(className),
    inputPreview: buildSchoolSummaryInputPreview(log.input),
    outputPreview: [sectionCount ? `整理項目 ${sectionCount}件` : "", checks.length ? `提出前確認 ${checks.length}件` : ""].filter(Boolean).join(" / "),
    sections: Array.from({ length: sectionCount }, (_, index) => ({
      heading: `整理項目 ${index + 1}`,
      body: "本文は個人情報保護と代筆防止のため保存・表示対象外です。提出前の自己確認とレビュー分類を確認してください。",
    })),
    checks: reviewTags.map((tag) => `確認分類: ${tag}`),
    checkCount: checks.length,
    reviewTags,
    needsReview: reviewTags.length > 0,
    hasNextObservation: hasNextObservationSignal(log),
  };
}

function buildOpaqueSummaryKey(prefix, scopeId, value) {
  if (!scopeId || !value) return "";
  const digest = createHash("sha256")
    .update(`${prefix}\u0000${scopeId}\u0000${value}`)
    .digest("hex")
    .slice(0, 24);
  return `${prefix}-${digest}`;
}

function hasNextObservationSignal(log = {}) {
  const text = JSON.stringify({ input: log.input || {}, output: log.output || {}, checks: log.checks || [] });
  return /明日|翌日|次/.test(text) && /観察|見る|見たい|見ます|見よう|見て/.test(text);
}

function isThinInput(input = {}) {
  const text = [input.memo, input.planMemo, input.goal, input.activity].filter(Boolean).join("\n");
  return text.trim().length > 0 && text.trim().length < 90;
}

function getReviewTags(log) {
  const inputText = JSON.stringify(log.input || {});
  const outputText = JSON.stringify(log.output || {});
  const checks = Array.isArray(log.checks) ? log.checks : Array.isArray(log.output?.checks) ? log.output.checks : [];
  const privacyFlags = log.input?.privacyFlags || {};
  const tags = [];

  if (isThinInput(log.input)) tags.push("追記促し");
  if (hasPossibleUnsupportedCompletion(inputText, outputText)) tags.push("補完疑い");
  if (RISK_TERMS.some((term) => inputText.includes(term))) tags.push("表現確認");
  if (privacyFlags.hasSchoolNameLikeText || hasNameLikeText(inputText) || /匿名|置換|個人名|実名|愛称/.test(outputText)) tags.push("置換確認");
  if (checks.some((check) => GUIDELINE_TERMS.some((term) => String(check || "").includes(term)))) tags.push("指針確認");
  if (checks.length >= 4 || checks.some((check) => /未入力|追記|確認|相談/.test(check))) tags.push("確認多め");
  if (log.kind === "plan") tags.push("指導案");

  return [...new Set(tags)];
}

function hasNameLikeText(text) {
  const riskText = removeAllowedAnonymizedTerms(text);
  return /(くん|ちゃん|先生|氏名|園名|担任|主任)/.test(riskText);
}

function removeAllowedAnonymizedTerms(text) {
  return String(text || "").replace(
    /[A-EＡ-Ｅa-eａ-ｅ](児|くん|君|ちゃん|先生)|園[A-EＡ-Ｅa-eａ-ｅ]|実習先園|担任の先生|主任の先生|学校の先生|実習先の先生|担任職員|主任職員|実習先指導員/g,
    "",
  );
}

function hasPossibleUnsupportedCompletion(inputText, outputText) {
  return POSSIBLE_COMPLETION_TERMS.some((term) => outputText.includes(term) && !inputText.includes(term));
}

function buildCheckSummary(logs) {
  const counts = new Map();
  for (const log of logs) {
    const studentId = log.user_id || log.session?.userId || "";
    for (const tag of getReviewTags(log)) {
      if (!counts.has(tag)) counts.set(tag, { tag, count: 0, studentIds: new Set() });
      const summary = counts.get(tag);
      summary.count += 1;
      if (studentId) summary.studentIds.add(studentId);
    }
  }
  return [...counts.values()]
    .map((item) => ({ tag: item.tag, count: item.count, studentCount: item.studentIds.size }))
    .sort((a, b) => b.count - a.count);
}

function buildStudentUsage(profiles, logs, schoolId = "", classNamesById = new Map()) {
  const studentProfiles = profiles.filter((profile) => profile.role === "student");
  const byUser = new Map(
    studentProfiles.map((profile, index) => {
      const processStudentKey = buildStableStudentKey(schoolId, profile.id);
      return [
        profile.id,
        {
        id: processStudentKey || `student-${index + 1}`,
        name: safeStudentDisplayName(profile.display_name),
        processStudentKey,
        className: classNamesById.get(profile.class_id) || "",
        generations: 0,
        diary: 0,
        plan: 0,
        reviewCandidates: 0,
        latestAt: null,
        },
      ];
    }),
  );

  for (const log of logs) {
    const id = log.user_id || log.session?.userId || log.id;
    if (!byUser.has(id)) continue;
    const item = byUser.get(id);
    item.generations += 1;
    if (log.kind === "diary") item.diary += 1;
    if (log.kind === "plan") item.plan += 1;
    if (getReviewTags(log).length > 0) item.reviewCandidates += 1;
    if (!item.latestAt || new Date(log.created_at) > new Date(item.latestAt)) item.latestAt = log.created_at;
  }

  return [...byUser.values()].sort((a, b) => {
    if (b.reviewCandidates !== a.reviewCandidates) return b.reviewCandidates - a.reviewCandidates;
    return b.generations - a.generations;
  });
}

function dedupeByIdAndTag(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.generationId}-${item.tag}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
