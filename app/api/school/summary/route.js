import { getServerSessionContext, isRestConfigured, shouldFailClosedWhenRestMissing, supabaseRestFetch } from "../../_supabase.js";
import { enforceRateLimit } from "../../_rateLimit.js";
import { enforceSameOriginRequest } from "../../_requestSecurity.js";
import { redactSensitiveTextForPreview } from "../../_privacy.js";

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

export async function GET(request) {
  if (isPublicDemoOnly()) return publicDemoApiDisabledResponse();

  const sameOriginResponse = enforceSameOriginRequest(request);
  if (sameOriginResponse) return sameOriginResponse;

  const rateLimitResponse = enforceRateLimit(request, {
    namespace: "school-summary",
    limit: 90,
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
      metrics: { students: 0, teachers: 0, generations: 0, feedback: 0 },
      reviewQueue: [],
      recentLogs: [],
    });
  }

  const context = await getServerSessionContext(request);
  if (!context.user?.id) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }
  if (!["teacher", "admin"].includes(context.session?.role)) {
    return Response.json({ error: "教員向け画面は教員・管理者のみ利用できます。" }, { status: 403 });
  }
  if (!context.session?.schoolId) {
    return Response.json({ error: "学校プロフィールが未設定です。" }, { status: 403 });
  }

  try {
    const schoolId = encodeURIComponent(context.session.schoolId);
    const [profiles, generations, feedback] = await Promise.all([
      supabaseRestFetch(`/profiles?select=id,role,display_name,class_id&school_id=eq.${schoolId}&order=created_at.desc&limit=500`),
      supabaseRestFetch(`/generation_logs?select=id,kind,input,output,checks,session,status,created_at,user_id&school_id=eq.${schoolId}&order=created_at.desc&limit=80`),
      supabaseRestFetch(`/feedback_logs?select=id,created_at,user_id,kind,feedback&school_id=eq.${schoolId}&order=created_at.desc&limit=200`),
    ]);
    const reviewQueue = buildReviewQueue(generations);
    const workloadPlan = buildTeacherWorkloadPlan(reviewQueue);
    const recentLogs = generations.slice(0, 12).map(formatLog);

    return Response.json({
      configured: true,
      school: {
        id: context.session.schoolId,
        name: context.session.schoolName,
        className: context.session.className,
      },
      profiles: profiles.map(formatProfile),
      metrics: {
        students: profiles.filter((profile) => profile.role === "student").length,
        teachers: profiles.filter((profile) => ["teacher", "admin"].includes(profile.role)).length,
        generations: generations.length,
        feedback: feedback.length,
        reviewCandidates: reviewQueue.length,
        reviewNowCandidates: workloadPlan.reviewNowCount,
        classShareCandidates: workloadPlan.classShareCount,
        studentSelfCheckCandidates: workloadPlan.studentSelfCheckCount,
        activeStudents: countActiveStudents(generations),
      },
      pocMetrics: buildPocMetrics(generations, feedback, reviewQueue, workloadPlan),
      workloadPlan,
      checkSummary: buildCheckSummary(generations),
      studentUsage: buildStudentUsage(profiles, generations),
      reviewQueue: reviewQueue.slice(0, 12),
      recentLogs,
    });
  } catch (error) {
    console.error("School summary failed:", error.details || error.message);
    return Response.json(
      {
        error: "学校データを取得できませんでした。",
      },
      { status: 500 },
    );
  }
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

function buildPocMetrics(generations = [], feedback = [], reviewQueue = [], workloadPlan = {}) {
  const actionableFeedback = feedback.filter((item) => {
    const data = item.feedback || {};
    return Boolean(
      data.tomorrowAction ||
      data.nextObservationPlan?.focus ||
      (Array.isArray(data.nextObservationPlan?.observationPoints) && data.nextObservationPlan.observationPoints.length > 0),
    );
  }).length;
  const reviewTotal = reviewQueue.length;
  const reviewNow = workloadPlan.reviewNowCount || 0;
  const studentCount = countActiveStudents(generations);
  return [
    {
      label: "翌日行動化",
      value: feedback.length ? `${actionableFeedback}/${feedback.length}件` : "未集計",
      detail: "実習先で受けた指導を、翌日の観察や行動に置き換えられた件数",
    },
    {
      label: "教員確認負担",
      value: reviewTotal ? `${reviewNow}/${reviewTotal}件` : "未集計",
      detail: "教員が当日確認する候補を、高優先に絞った件数",
    },
    {
      label: "学生の負担感確認",
      value: studentCount ? "アンケート対象" : "未集計",
      detail: "学生に何が見えるかを説明し、負担感・抵抗感をアンケートで確認",
    },
  ];
}

function formatProfile(profile) {
  return {
    id: profile.id,
    role: profile.role,
    roleLabel: profile.role === "teacher" ? "教員" : profile.role === "admin" ? "管理者" : "学生",
    name: safeStudentDisplayName(profile.display_name),
    classId: profile.class_id,
  };
}

function safeStudentDisplayName(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return "学生";
  return text.slice(0, 80);
}

function buildReviewQueue(logs) {
  const items = [];
  for (const log of logs) {
    const checks = Array.isArray(log.checks) ? log.checks : Array.isArray(log.output?.checks) ? log.output.checks : [];
    const reviewTags = getReviewTags(log);

    if (reviewTags.includes("追記促し")) items.push(formatReviewItem(log, "追記促し", "入力が薄い記録", "観察事実が少ないため、学生本人への提出前の自己確認で追記を促す候補です。"));
    if (reviewTags.includes("補完疑い")) items.push(formatReviewItem(log, "補完疑い", "入力内容から確認できない事実の確認", "学生メモに根拠がない発達効果や場面描写が含まれていないか確認する候補です。"));
    if (reviewTags.includes("表現確認")) items.push(formatReviewItem(log, "表現確認", "評価語を含むメモ", "子どもへの評価・診断に近い表現が入力に含まれていた可能性があります。"));
    if (reviewTags.includes("匿名化") || reviewTags.includes("置換確認")) items.push(formatReviewItem(log, "置換確認", "個人情報の確認", "子ども名・職員名など、置き換え確認が必要な情報が含まれていた可能性があります。"));
    if (reviewTags.includes("指針確認")) items.push(formatReviewItem(log, "指針確認", "指針とのつながり確認", "保育所保育指針や5領域とのつながりを、学生本人への問いに返しつつ、授業内で共有しやすい候補です。"));
    if (reviewTags.includes("確認多め") || checks.length >= 4) items.push(formatReviewItem(log, "確認多め", "提出前の自己確認が多い出力", "未入力項目や確認点が多く、学生本人の見直しに返す候補です。"));
  }
  return dedupeByIdAndTag(items).sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function formatReviewItem(log, tag, title, detail) {
  const logPreview = formatLog(log);
  const priority = getReviewPriorityLabel({ tag, title, detail });
  const handling = getReviewHandling(priority);
  return {
    id: `${log.id}-${tag}`,
    generationId: log.id,
    title,
    tag,
    priority,
    priorityRank: getReviewPriorityRank(priority),
    handling: handling.id,
    handlingLabel: handling.label,
    handlingDetail: handling.detail,
    detail,
    kind: log.kind,
    createdAt: log.created_at,
    studentName: safeStudentDisplayName(log.session?.userName || log.session?.name),
    log: logPreview,
  };
}

function buildTeacherWorkloadPlan(reviewQueue = []) {
  const counts = reviewQueue.reduce((acc, item) => {
    const label = item.priority || getReviewPriorityLabel(item);
    acc[label] += 1;
    return acc;
  }, { 高: 0, 中: 0, 低: 0 });
  return {
    highCount: counts.高,
    mediumCount: counts.中,
    lowCount: counts.低,
    reviewNowCount: counts.高,
    classShareCount: counts.中,
    studentSelfCheckCount: counts.低,
  };
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
      detail: "個人情報や重大な表現リスクとして、当日中に教員が見る候補です。",
    };
  }
  if (priority === "中") {
    return {
      id: "class_share",
      label: "授業内共有",
      detail: "個別添削ではなく、授業内で共有し、学生本人への問いにも返せる候補です。",
    };
  }
  return {
    id: "student_self",
    label: "学生本人",
    detail: "教員の個別確認ではなく、学生本人への提出前の自己確認で返す候補です。",
  };
}

function formatLog(log) {
  const checks = Array.isArray(log.checks) ? log.checks : Array.isArray(log.output?.checks) ? log.output.checks : [];
  const headings = Array.isArray(log.output?.headings) ? log.output.headings : [];
  const reviewTags = getReviewTags(log);
  return {
    id: log.id,
    kind: log.kind,
    status: log.status,
    createdAt: log.created_at,
    studentName: safeStudentDisplayName(log.session?.userName || log.session?.name),
    className: log.session?.className || "",
    inputPreview: buildInputPreview(log.input),
    outputPreview: checks[0] || headings.join(" / "),
    sections: headings.map((heading, index) => ({
      heading: heading || `項目${index + 1}`,
      body: "本文は個人情報保護と代筆防止のため保存・表示対象外です。提出前の自己確認とレビュー分類を確認してください。",
    })),
    checks,
    checkCount: checks.length,
    reviewTags,
    needsReview: reviewTags.length > 0,
  };
}

function isThinInput(input = {}) {
  const text = [input.memo, input.planMemo, input.goal, input.activity].filter(Boolean).join("\n");
  return text.trim().length > 0 && text.trim().length < 90;
}

function getReviewTags(log) {
  const inputText = JSON.stringify(log.input || {});
  const outputText = JSON.stringify(log.output || {});
  const checks = Array.isArray(log.checks) ? log.checks : Array.isArray(log.output?.checks) ? log.output.checks : [];
  const tags = [];

  if (isThinInput(log.input)) tags.push("追記促し");
  if (hasPossibleUnsupportedCompletion(inputText, outputText)) tags.push("補完疑い");
  if (RISK_TERMS.some((term) => inputText.includes(term))) tags.push("表現確認");
  if (hasNameLikeText(inputText) || /匿名|置換|個人名|実名|愛称/.test(outputText)) tags.push("置換確認");
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

function buildInputPreview(input = {}) {
  const memoLength = String(input.memo || input.planMemo || "").trim().length;
  const scene = input.scene ? `場面: ${redactPreviewText(input.scene).slice(0, 60)}` : "";
  const age = input.age ? `年齢: ${redactPreviewText(input.age).slice(0, 30)}` : "";
  const flags = input.privacyFlags && typeof input.privacyFlags === "object"
    ? Object.entries(input.privacyFlags).filter(([, value]) => value).map(([key]) => key)
    : [];
  return [age, scene, `入力文字数: ${memoLength}`, flags.length ? `要確認: ${flags.length}件` : ""].filter(Boolean).join(" / ");
}

function redactPreviewText(value) {
  return redactSensitiveTextForPreview(value);
}

function countActiveStudents(logs) {
  return new Set(logs.map((log) => log.user_id).filter(Boolean)).size;
}

function buildCheckSummary(logs) {
  const counts = new Map();
  for (const log of logs) {
    for (const tag of getReviewTags(log)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

function buildStudentUsage(profiles, logs) {
  const studentProfiles = profiles.filter((profile) => profile.role === "student");
  const byUser = new Map(
    studentProfiles.map((profile) => [
      profile.id,
      {
        id: profile.id,
        name: safeStudentDisplayName(profile.display_name),
        generations: 0,
        diary: 0,
        plan: 0,
        reviewCandidates: 0,
        latestAt: null,
      },
    ]),
  );

  for (const log of logs) {
    const id = log.user_id || log.session?.userId || log.id;
    if (!byUser.has(id)) {
      byUser.set(id, {
        id,
        name: safeStudentDisplayName(log.session?.userName || log.session?.name),
        generations: 0,
        diary: 0,
        plan: 0,
        reviewCandidates: 0,
        latestAt: null,
      });
    }
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
