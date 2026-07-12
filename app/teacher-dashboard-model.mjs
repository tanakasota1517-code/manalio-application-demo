function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function safeRecordList(value) {
  return safeList(value).filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

function safeCopyText(value, maxLength = 280) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeTeacherDisplayText(value, maxLength = 280) {
  return redactTeacherSensitiveText(safeCopyText(value, maxLength))
    .replaceAll("評価語", "断定表現")
    .replaceAll("評価・診断", "決めつけや診断")
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

function hasSensitiveDisplayToken(value) {
  return /https?:\/\/|ログイン|パスワード|password|cookie|token|secret|園児|実名|メール|@|日誌本文|raw|[0-9０-９]{2,4}[-ー−]?[0-9０-９]{2,4}[-ー−]?[0-9０-９]{3,4}|保育園|保育所|幼稚園|こども園|園名|実習先名|住所|所在地|診断|ADHD|ASD|自閉|家庭事情|保護者|[一-龯ぁ-んァ-ンA-Za-z]{1,12}(くん|ちゃん|先生)/i.test(String(value || ""));
}

function redactTeacherSensitiveText(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "〈メール〉")
    .replace(/[0-9０-９]{2,4}[-ー−]?[0-9０-９]{2,4}[-ー−]?[0-9０-９]{3,4}/g, "〈連絡先〉")
    .replace(/(東京都|北海道|大阪府|京都府|[一-龯]{2,3}県)[^、。]{0,40}/g, "〈住所等〉")
    .replace(/([一-龯ぁ-んァ-ンA-Za-z0-9０-９〇○々ヶヵー・]{1,30})(保育園|保育所|幼稚園|認定こども園|こども園)/g, "〈園名〉")
    .replace(/([一-龯ぁ-んァ-ンA-Za-z]{1,12})(くん|ちゃん|君)/g, "A児")
    .replace(/([一-龯ぁ-んァ-ンA-Za-z]{1,12})(先生)/g, "担任職員")
    .replace(/(ADHD|ASD|自閉スペクトラム|診断名|発達障害|家庭事情|虐待|ネグレクト)/gi, "〈要配慮情報〉");
}

function toCount(value) {
  const count = Number(value) || 0;
  return count > 0 ? count : 0;
}

function buildAnonymousStudentLabel(index = 0) {
  const normalized = Math.max(0, Number(index) || 0);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (normalized < alphabet.length) return `学生${alphabet[normalized]}`;
  return `学生${normalized + 1}`;
}

function isAnonymousStudentLabel(value) {
  return /^学生[A-ZＡ-Ｚ0-9０-９]+$/.test(safeCopyText(value, 80));
}

function normalizeStudentName(rawName, fallbackIndex = 0, revealStudentNames = false) {
  const name = safeCopyText(rawName, 80);
  if (isAnonymousStudentLabel(name)) return name;
  if (revealStudentNames && name && !name.includes("@") && !hasSensitiveDisplayToken(name)) return name;
  return buildAnonymousStudentLabel(fallbackIndex);
}

function normalizeStudentId(rawId) {
  return safeCopyText(rawId, 120);
}

function normalizeProcessStudentKey(value) {
  const key = safeCopyText(value, 120);
  if (/^school-student-[a-f0-9]{32}$/.test(key)) return key;
  if (/^local-demo-student-[A-Za-z0-9_-]{6,80}$/.test(key) || key === "public-demo-student") return key;
  return "";
}

function getThemeStudentId(item = {}) {
  return normalizeStudentId(item.studentId || item.userId);
}

export function getKindLabel(kind) {
  if (kind === "student_chat") return "記録整理";
  if (kind === "plan") return "指導案";
  return "日誌";
}

function getSafeReviewTitle(item = {}, fallback = "確認候補") {
  const title = normalizeTeacherDisplayText(item.title || item.tag, 80);
  if (!title || hasSensitiveDisplayToken(title)) return fallback;
  return title;
}

function extractSafeInputPreviewParts(inputPreview) {
  const parts = safeCopyText(inputPreview, 180)
    .split(/[\/｜|]/)
    .map((part) => safeCopyText(part, 60))
    .filter((part) => /^(年齢|場面|入力文字数|メモ文字数|振り返り文字数|目標文字数|エピソード|要確認|フィードバック)[:：\s]/.test(part))
    .map((part) => normalizeInputPreviewMetadataPart(part));
  const primary = parts.slice(0, 3);
  const reviewFlag = parts.find((part) => part.startsWith("要確認 "));
  return reviewFlag && !primary.includes(reviewFlag) ? [...primary, reviewFlag] : primary;
}

function normalizeInputPreviewMetadataPart(part) {
  const match = /^(年齢|場面|入力文字数|メモ文字数|振り返り文字数|目標文字数|エピソード|要確認|フィードバック)[:：\s]*(.*)$/.exec(part);
  if (!match) return "";
  const label = match[1];
  const value = match[2] || "";
  const count = value.match(/[0-9０-９]+/)?.[0] || "";
  if (["入力文字数", "メモ文字数", "振り返り文字数", "目標文字数"].includes(label)) {
    return count ? `${label} ${count}` : `${label}あり`;
  }
  if (label === "要確認") return count ? `要確認 ${count}件` : "要確認メタあり";
  if (label === "エピソード") return count ? `エピソード ${count}件` : "エピソードメタあり";
  if (label === "フィードバック") return "実習先助言メタあり";
  return `${label}メタあり`;
}

function buildSafeTeacherLogDisplay(log = {}, fallbackIndex = 0) {
  const checks = safeList(log.checks);
  const sections = safeRecordList(log.sections);
  const metadata = extractSafeInputPreviewParts(log.inputPreview);
  const parts = [
    ...metadata,
    checks.length ? `提出前確認 ${checks.length}件` : "",
    sections.length ? `比較材料 ${sections.length}項目` : "",
  ].filter(Boolean);

  return {
    id: safeCopyText(log.id || log.generationId || `log-${fallbackIndex + 1}`, 120),
    kind: log.kind,
    createdAt: log.createdAt,
    className: safeCopyText(log.className || "", 120),
    studentName: normalizeStudentName(log.studentName, fallbackIndex),
    checkCount: toCount(log.checkCount) || checks.length,
    displaySummary: parts.length ? parts.join(" / ") : `${getKindLabel(log.kind)}の確認メタ情報`,
  };
}

export function buildSafeTeacherLogDisplays(logs = []) {
  const studentOrder = new Map();
  return safeRecordList(logs).map((log, index) => {
    const key = normalizeStudentId(log.studentId || log.userId) || safeCopyText(log.studentName, 80) || `student-${index + 1}`;
    if (!studentOrder.has(key)) studentOrder.set(key, studentOrder.size);
    return buildSafeTeacherLogDisplay(log, studentOrder.get(key));
  });
}

function buildSafeTeacherReviewItemDisplay(item = {}, fallbackIndex = 0) {
  return {
    id: safeCopyText(item.id || item.generationId || `review-${fallbackIndex + 1}`, 120),
    generationId: safeCopyText(item.generationId || "", 120),
    studentId: normalizeStudentId(item.studentId || item.userId),
    studentName: normalizeStudentName(item.studentName, fallbackIndex),
    title: getSafeReviewTitle(item),
    tag: normalizeTeacherDisplayText(item.tag, 80),
    priority: getReviewPriorityLabel(item),
    handling: safeCopyText(item.handling, 80),
    handlingLabel: getReviewHandlingLabel(item),
    detail: hasSensitiveDisplayToken(item.detail) ? "確認が必要な候補です。" : normalizeTeacherDisplayText(item.detail, 180),
    kind: item.kind,
    createdAt: item.createdAt,
  };
}

export function getReviewPriorityLabel(item = {}) {
  if (["高", "中", "低"].includes(item.priority)) return item.priority;
  if (item.handling === "teacher_now" || item.handlingLabel === "教員確認") return "高";
  if (item.handling === "class_share" || item.handlingLabel === "授業共有") return "中";
  if (item.handling === "student_self" || item.handlingLabel === "学生本人") return "低";
  const text = `${item.tag || ""} ${item.title || ""} ${item.detail || ""}`;
  if (/個人情報|匿名化|置換確認|実名|園名|診断|家庭|補完疑い|入力外情報/.test(text)) return "高";
  if (/表現|評価|安全|指針|5領域|五領域|考察|感想/.test(text)) return "中";
  return "低";
}

export function getReviewPriorityRank(item) {
  return { 高: 0, 中: 1, 低: 2 }[getReviewPriorityLabel(item)] ?? 3;
}

export function getReviewHandlingLabel(item = {}) {
  if (item.handlingLabel) return item.handlingLabel;
  const priority = getReviewPriorityLabel(item);
  if (priority === "高") return "教員確認";
  if (priority === "中") return "授業共有";
  return "学生本人";
}

export function buildTeacherStudentSummaries(studentUsage = [], recentLogs = [], reviewQueue = [], options = {}) {
  const students = new Map();
  const revealStudentNames = options?.revealStudentNames === true;

  function ensureStudent({ rawName, studentId, fallbackId }) {
    const name = normalizeStudentName(rawName, students.size, revealStudentNames);
    const stableId = normalizeStudentId(studentId);
    const fallback = normalizeStudentId(fallbackId);
    const key = stableId || fallback || `student-${students.size + 1}`;
    if (!students.has(key)) {
      students.set(key, {
        id: key,
        name,
        processStudentKey: "",
        className: "",
        latestAt: "",
        diaryCount: 0,
        generationCount: 0,
        reviewCount: 0,
        teacherCheckCount: 0,
        classShareCount: 0,
        selfCheckCount: 0,
        hasUsage: false,
        reviewItems: [],
        recentLogs: [],
      });
    }
    const summary = students.get(key);
    if (isAnonymousStudentLabel(summary.name) && !isAnonymousStudentLabel(name)) summary.name = name;
    return summary;
  }

  for (const student of safeRecordList(studentUsage)) {
    const summary = ensureStudent({
      rawName: student.name || student.email,
      studentId: student.id,
      fallbackId: student.id,
    });
    summary.className = safeCopyText(student.className || summary.className, 120);
    summary.processStudentKey = normalizeProcessStudentKey(student.processStudentKey) || summary.processStudentKey;
    summary.latestAt = latestTimestamp(summary.latestAt, student.latestAt);
    summary.diaryCount = Math.max(summary.diaryCount, Number(student.diary) || 0);
    summary.generationCount = Math.max(summary.generationCount, Number(student.generations) || 0);
    summary.reviewCount = Math.max(summary.reviewCount, Number(student.reviewCandidates) || 0);
    summary.hasUsage = true;
  }

  for (const log of safeRecordList(recentLogs)) {
    const summary = students.get(normalizeStudentId(log.studentId || log.userId));
    if (!summary) continue;
    summary.className = safeCopyText(log.className || summary.className, 120);
    summary.latestAt = latestTimestamp(summary.latestAt, log.createdAt);
    summary.recentLogs.push(log);
  }

  for (const item of safeRecordList(reviewQueue)) {
    const summary = students.get(normalizeStudentId(item.studentId || item.userId));
    if (!summary) continue;
    const priority = getReviewPriorityLabel(item);
    summary.reviewItems.push(item);
    if (priority === "高") summary.teacherCheckCount += 1;
    else if (priority === "中") summary.classShareCount += 1;
    else summary.selfCheckCount += 1;
    summary.latestAt = latestTimestamp(summary.latestAt, item.createdAt);
  }

  return Array.from(students.values())
    .map((student) => {
      const reviewItems = student.reviewItems
        .slice()
        .sort((a, b) => getReviewPriorityRank(a) - getReviewPriorityRank(b));
      const recent = student.recentLogs
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const latestLog = recent[0];
      const logCheckCount = safeList(latestLog?.checks).length;
      const checkpoints = [
        ...reviewItems.slice(0, 3).map((item) => `${getReviewHandlingLabel(item)}: ${getSafeReviewTitle(item)}`),
        ...(logCheckCount ? [`提出前確認: ${logCheckCount}件の問いを確認する。`] : []),
      ].filter(Boolean).slice(0, 4);

      const processModel = buildStudentProcessModel(student, recent, reviewItems);
      const supportPlan = buildTeacherSupportPlan(student, reviewItems, recent);

      return {
        ...student,
        reviewCount: Math.max(student.reviewCount, reviewItems.length),
        recentLogs: buildSafeTeacherLogDisplays(recent),
        reviewItems: reviewItems.map((item, index) => buildSafeTeacherReviewItemDisplay(item, index)),
        checkpoints: checkpoints.length ? checkpoints : [
          "観察事実、考えたこと、翌日に見る点が分かれているか確認する。",
          "個人情報や強い断定が提出前チェックで止まっているか確認する。",
          "実習先で受けた助言が、翌日の観察へ戻っているか確認する。",
        ],
        processSteps: processModel.steps,
        processProgress: processModel.progress,
        supportPlan,
        nextCheckReason: buildTeacherStudentNextCheckReason(supportPlan, checkpoints, processModel.progress),
      };
    })
    .sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0));
}

export function mergeTeacherStudentsWithProcessSupport(students = [], supportPackage = {}, options = {}) {
  const roster = safeRecordList(students).map((student) => ({ ...student }));
  const processStudents = safeRecordList(supportPackage?.students);
  const rosterByProcessKey = new Map(
    roster
      .map((student, index) => [normalizeProcessStudentKey(student.processStudentKey), index])
      .filter(([key]) => key),
  );
  for (const support of processStudents) {
    const processKey = normalizeProcessStudentKey(support.processStudentKey);
    const rosterIndex = processKey ? rosterByProcessKey.get(processKey) : undefined;
    if (rosterIndex === undefined) {
      if (options.includeUnmatchedProcessStudents === true) {
        roster.push(mergeStudentWithProcessSupport(buildProcessOnlyStudent(support, roster.length), support));
      }
      continue;
    }
    roster[rosterIndex] = mergeStudentWithProcessSupport(roster[rosterIndex], support);
  }

  return roster;
}

function buildProcessOnlyStudent(support = {}, fallbackIndex = 0) {
  return {
    id: safeCopyText(support.supportStudentId, 120) || `process-student-${fallbackIndex + 1}`,
    name: normalizeStudentName(support.studentLabel, fallbackIndex, true),
    processStudentKey: normalizeProcessStudentKey(support.processStudentKey),
    className: "",
    latestAt: safeCopyText(support.latestAt || support.processDate, 40),
    diaryCount: toCount(support.processDateCount),
    generationCount: 0,
    reviewCount: 0,
    teacherCheckCount: 0,
    classShareCount: 0,
    selfCheckCount: 0,
    hasUsage: true,
    reviewItems: [],
    recentLogs: [],
    checkpoints: [],
    processSteps: [],
    processProgress: null,
    supportPlan: null,
    nextCheckReason: "個人のチェックポイントを見る。",
  };
}

function mergeStudentWithProcessSupport(student = {}, support = {}) {
  const routeKey = safeCopyText(support.returnPreparation?.routeKey || support.supportAction?.routeKey, 40);
  const stageLabels = safeList(support.recordedStageLabels).map((label) => normalizeTeacherDisplayText(label, 40)).filter(Boolean);
  const processCheckpoints = [
    support.supportFocus?.label,
    ...safeList(support.missingRequiredFieldLabels).map((label) => `${label}を確認する。`),
  ].map((item) => normalizeTeacherDisplayText(item, 120)).filter(Boolean);
  const checkpoints = [...new Set([...processCheckpoints, ...safeList(student.checkpoints)])].slice(0, 4);
  const hasSafetyCheck = stageLabels.includes("提出前確認");
  const hasDraftAvailable = stageLabels.includes("問い返し");
  const hasDraftCompare = stageLabels.includes("再確認") || stageLabels.includes("記録コピー");
  const processSteps = [
    ["提出前確認", hasSafetyCheck, "個人情報や強い断定を提出前に確認した記録です。"],
    ["問い返し", hasDraftAvailable, "学生の記録を起点に、見直す問いを受け取った記録です。"],
    ["再確認", hasDraftCompare, "学生が自分で整えた後に再確認した記録です。"],
    ["記録コピー", stageLabels.includes("記録コピー"), "学生が確認後の記録を使った段階です。"],
  ].map(([label, done, body]) => ({
    label,
    value: done ? "記録あり" : "未記録",
    status: done ? "complete" : "pending",
    body,
  }));
  const supportPlan = buildProcessSupportPlan(support, routeKey);

  return {
    ...student,
    processStudentKey: normalizeProcessStudentKey(student.processStudentKey || support.processStudentKey),
    latestAt: latestTimestamp(student.latestAt, support.latestAt || `${support.processDate || ""}T00:00:00.000Z`),
    diaryCount: Math.max(toCount(student.diaryCount), toCount(support.processDateCount), support.processDate ? 1 : 0),
    teacherCheckCount: Math.max(toCount(student.teacherCheckCount), routeKey === "teacher_check" ? 1 : 0),
    classShareCount: Math.max(toCount(student.classShareCount), routeKey === "class_activity" ? 1 : 0),
    selfCheckCount: Math.max(toCount(student.selfCheckCount), routeKey === "student_return" ? 1 : 0),
    hasUsage: true,
    checkpoints: checkpoints.length ? checkpoints : safeList(student.checkpoints),
    processSteps,
    processProgress: {
      completedCount: processSteps.filter((step) => step.status === "complete").length,
      totalCount: processSteps.length,
      nextMissingLabel: normalizeTeacherDisplayText(support.supportFocus?.label, 80) || "実習後の確認材料",
      hasRecord: true,
      hasSafetyCheck,
      hasDraftAvailable,
      hasDraftCompare,
      hasNextObservation: support.hasNextObservation === true,
      hasTeacherReview: false,
    },
    supportPlan,
    nextCheckReason: supportPlan.nextActions[0],
    processSupport: support,
  };
}

function buildProcessSupportPlan(support = {}, routeKey = "") {
  const focusLabel = normalizeTeacherDisplayText(support.supportFocus?.label, 100) || "実習後の支援材料を見る";
  const focusBody = normalizeTeacherDisplayText(support.supportFocus?.body, 180) || "本文を見ずに、記録プロセスの確認点だけを扱います。";
  const nextAction = normalizeTeacherDisplayText(support.supportAction?.nextAction, 160) || `${focusLabel}。`;
  const returnQuestion = normalizeTeacherDisplayText(support.supportAction?.returnQuestion, 160) || "次に見たい場面を一つ選べますか。";
  const preparation = support.returnPreparation || {};
  const route = normalizeTeacherDisplayText(preparation.route, 60) || "実習後確認で使う";
  return {
    label: route,
    tone: routeKey === "teacher_check" ? "teacher" : routeKey === "class_activity" ? "classroom" : "student",
    title: focusLabel,
    body: focusBody,
    reviewCount: 0,
    nextActions: [nextAction],
    returnQuestions: [returnQuestion],
    returnPreparation: {
      route,
      focus: focusBody,
      teacherCheck: normalizeTeacherDisplayText(preparation.teacherCheck, 160) || "不足欄と確認状態だけを見る。",
      studentPrompt: normalizeTeacherDisplayText(preparation.studentPrompt, 160) || returnQuestion,
      classUse: normalizeTeacherDisplayText(preparation.classUse, 160) || "複数学生に共通する時だけ授業の問いへ変える。",
      boundary: normalizeTeacherDisplayText(preparation.boundary, 160) || "本文全体の添削には入らない。",
    },
  };
}

function buildTeacherStudentNextCheckReason(supportPlan = {}, checkpoints = [], processProgress = {}) {
  const candidates = [
    safeList(supportPlan.nextActions)[0],
    safeList(checkpoints)[0],
    processProgress?.nextMissingLabel ? `${processProgress.nextMissingLabel}を見る。` : "",
    "個人のチェックポイントを見る。",
  ];
  for (const candidate of candidates) {
    const text = normalizeTeacherDisplayText(candidate, 120);
    if (text && !hasSensitiveDisplayToken(text)) return text;
  }
  return "個人のチェックポイントを見る。";
}

function buildTeacherReviewActionLabel(item = {}) {
  const routeLabel = getReviewHandlingLabel(item);
  const title = normalizeTeacherDisplayText(getSafeReviewTitle(item), 80).replace(/[。.!！?？]+$/g, "");
  if (!title) return `${routeLabel}: 確認材料を先に見る。`;
  const suffix = title.endsWith("確認") ? "を先に見る。" : "を確認する。";
  return `${routeLabel}: ${title}${suffix}`;
}

function buildTeacherReturnPreparation({
  route = {},
  topItem = null,
  teacherCheckCount = 0,
  classShareCount = 0,
  latestCheckCount = 0,
} = {}) {
  const topTitle = topItem ? getSafeReviewTitle(topItem) : "";
  const focusSource = topTitle
    ? `${topTitle}を材料に、返す問いを一つに絞る。`
    : "入力済み欄と提出前確認を材料に、返す問いを一つに絞る。";
  const teacherCheck = teacherCheckCount > 0
    ? "個人が分かる表現や強い断定だけを、学校教員が先に確認する。"
    : "学生本人へ戻せる内容か、授業で扱う共通テーマかを先に分ける。";
  const studentPrompt = teacherCheckCount > 0
    ? "この表現について、実際に見た事実として追記できることはありますか。"
    : latestCheckCount
      ? `提出前チェックで出た${latestCheckCount}件から、明日見る場面を一つ選べますか。`
      : "この記録から、明日もう一度見たい場面を一つ選べますか。";
  const classUse = classShareCount > 0
    ? "複数学生に共通する時だけ、個別の記録内容を出さず授業の短い練習へ移す。"
    : "授業で扱う時は、個人の記録ではなく書き方の型だけを取り出す。";

  return {
    route: normalizeTeacherDisplayText(route.label || "本人確認中心", 40),
    focus: normalizeTeacherDisplayText(focusSource, 140),
    teacherCheck: normalizeTeacherDisplayText(teacherCheck, 140),
    studentPrompt: normalizeTeacherDisplayText(studentPrompt, 140),
    classUse: normalizeTeacherDisplayText(classUse, 140),
    boundary: "本文引用、個人が分かる表現、実習先が分かる表現は扱わない。",
  };
}

export function buildTeacherSupportPlan(student = {}, reviewItems = [], recentLogs = []) {
  const sortedReviews = safeRecordList(reviewItems)
    .slice()
    .sort((a, b) => getReviewPriorityRank(a) - getReviewPriorityRank(b));
  const topItem = sortedReviews[0];
  const teacherCheckCount = Number(student.teacherCheckCount) || 0;
  const classShareCount = Number(student.classShareCount) || 0;
  const selfCheckCount = Number(student.selfCheckCount) || 0;
  const latestLog = safeRecordList(recentLogs)[0] || null;
  const latestCheckCount = safeList(latestLog?.checks).length;

  let route = {
    label: "本人確認中心",
    tone: "student",
    title: "学生本人の見直しに戻す",
    body: "入力不足や表現の確認は、提出前の自己確認として学生本人へ返します。",
  };

  if (teacherCheckCount > 0) {
    route = {
      label: "教員確認",
      tone: "teacher",
      title: "学校教員が先に確認する",
      body: "個人情報、強い断定、入力外の補完など、提出後に学校教員が見る候補があります。",
    };
  } else if (classShareCount > 0) {
    route = {
      label: "授業共有",
      tone: "classroom",
      title: "授業で扱う問いにする",
      body: "個別添削ではなく、複数学生に共通しやすい観察・表現のつまずきとして扱います。",
    };
  } else if (selfCheckCount === 0 && latestLog) {
    route = {
      label: "確認材料あり",
      tone: "neutral",
      title: "記録プロセスを確認する",
      body: "直近の記録と提出前チェックの流れを、実習後の振り返り材料として確認できます。",
    };
  }

  const nextActions = [
    topItem
      ? buildTeacherReviewActionLabel(topItem)
      : "記録、気づき、明日の観察が分かれているかだけ確認する。",
    classShareCount > 0
      ? "授業で扱う場合は、個人名ではなく共通する問いへ置き換える。"
      : "学生本人へ返す場合は、追記する観察事実を一つに絞る。",
    latestCheckCount
      ? `提出前チェックの問い: ${latestCheckCount}件の確認材料があります。`
      : "本文全体の添削ではなく、必要な確認点だけを見る。",
  ];

  const returnQuestions = [
    teacherCheckCount > 0
      ? "この表現は学校教員が確認してから提出させる必要がありますか。"
      : "この確認は学生本人の提出前チェックで足りますか。",
    classShareCount > 0
      ? "同じつまずきを、授業でどの問いとして扱いますか。"
      : "この学生に次回見てほしい場面は一つに絞れますか。",
  ];

  return {
    ...route,
    reviewCount: sortedReviews.length,
    nextActions,
    returnQuestions,
    returnPreparation: buildTeacherReturnPreparation({
      route,
      topItem,
      teacherCheckCount,
      classShareCount,
      latestCheckCount,
    }),
  };
}

function hasNextObservationSignal(records = []) {
  return safeRecordList(records).some((record) => {
    if (record.hasNextObservation === true) return true;
    const checks = safeList(record.checks).join(" ");
    const sections = safeRecordList(record.sections)
      .map((section) => `${section.heading || ""} ${section.title || ""}`)
      .join(" ");
    const text = `${record.inputPreview || ""} ${record.outputPreview || ""} ${checks} ${sections}`;
    return /明日|翌日|次/.test(text) && /観察|見る|見たい|見ます|見よう|見て/.test(text);
  });
}

export function buildStudentProcessModel(student = {}, recentLogs = [], reviewItems = []) {
  const logs = safeRecordList(recentLogs);
  const reviews = safeRecordList(reviewItems);
  const diaryLogCount = logs.filter((log) => log.kind === "diary").length;
  const diaryCount = Math.max(toCount(student.diaryCount), diaryLogCount);
  const recordLogCount = logs.filter((log) => log.kind === "diary" || log.kind === "student_chat").length;
  const recordCount = Math.max(diaryCount, recordLogCount, logs.length === 0 ? toCount(student.generationCount) : 0);
  const checkCountFromLogs = logs.reduce((total, log) => total + Math.max(toCount(log.checkCount), safeList(log.checks).length), 0);
  const reviewCount = Math.max(toCount(student.reviewCount), reviews.length, checkCountFromLogs);
  const teacherRouteCount = toCount(student.teacherCheckCount) + toCount(student.classShareCount) + toCount(student.selfCheckCount);
  const hasRecord = recordCount > 0;
  const hasSafetyCheck = reviewCount > 0;
  const hasDraftAvailable = logs.some((log) =>
    log.kind === "diary" && (safeCopyText(log.outputPreview, 20) || safeRecordList(log.sections).length > 0)
  );
  const hasDraftCompare = logs.some((log) => log.comparisonCompleted === true);
  const hasNextObservation = hasNextObservationSignal(logs);
  const hasTeacherReview = student.teacherReviewCompleted === true;
  const teacherReviewCandidateCount = teacherRouteCount || reviews.length;

  const steps = [
    {
      label: "記録",
      value: hasRecord ? `${recordCount}件` : "未記録",
      status: hasRecord ? "complete" : "pending",
      body: hasRecord
        ? "学生が先に書いた記録を、実習後の確認材料として扱います。"
        : "学生本人が書いた記録が入ると、確認の起点になります。",
    },
    {
      label: "提出前確認",
      value: hasSafetyCheck ? `${reviewCount}件` : "未確認",
      status: hasSafetyCheck ? "complete" : "pending",
      body: "個人情報、強い断定、入力外の補完を提出前に確認した跡を見ます。",
    },
    {
      label: "比較修正",
      value: hasDraftCompare ? "あり" : hasDraftAvailable ? "確認記録なし" : "未記録",
      status: hasDraftCompare ? "complete" : "pending",
      body: hasDraftCompare
        ? "学生が元の記録と問い返しを見比べて直した流れを見ます。"
        : hasDraftAvailable
          ? "整理案は作成されていますが、学生が見比べて直したかは記録されていません。"
          : "学生が元の記録と整理案を見比べた記録はまだありません。",
    },
    {
      label: "次の観察",
      value: hasNextObservation ? "あり" : "未整理",
      status: hasNextObservation ? "complete" : "attention",
      body: hasNextObservation
        ? "翌日に見る場面や保育者の関わりへ戻す材料があります。"
        : "気づきが翌日の観察に戻っているか、実習後に確認します。",
    },
    {
      label: "実習後確認",
      value: hasTeacherReview ? "確認済み" : teacherReviewCandidateCount > 0 ? `${teacherReviewCandidateCount}件の候補` : "未確認",
      status: hasTeacherReview ? "complete" : teacherReviewCandidateCount > 0 ? "attention" : "pending",
      body: "学校教員が必要時だけ見る個別チェックポイントです。学習支援の材料として扱います。",
    },
  ];

  const markers = [
    { key: "record", label: "記録", done: hasRecord },
    { key: "safety", label: "提出前確認", done: hasSafetyCheck },
    { key: "compare", label: "比較修正", done: hasDraftCompare },
    { key: "nextObservation", label: "次の観察", done: hasNextObservation },
    { key: "teacherReview", label: "実習後確認", done: hasTeacherReview },
  ];
  const nextMissing = markers.find((marker) => !marker.done);

  return {
    steps,
    progress: {
      completedCount: markers.filter((marker) => marker.done).length,
      totalCount: markers.length,
      nextMissingLabel: nextMissing ? nextMissing.label : "実習後の確認材料",
      hasRecord,
      hasSafetyCheck,
      hasDraftCompare,
      hasDraftAvailable,
      hasNextObservation,
      hasTeacherReview,
    },
  };
}

export function buildClassShareThemes(checkSummary = [], reviewQueue = []) {
  const themes = new Map();

  function ensureTheme(rawLabel) {
    const label = normalizeTeacherDisplayText(rawLabel || "共通テーマ", 80);
    if (!label) return null;
    const themeKey = `label:${label}`;
    if (!themes.has(themeKey)) {
      themes.set(themeKey, {
        themeKey,
        label,
        count: 0,
        studentIds: new Set(),
        reportedStudentCount: 0,
      });
    }
    return themes.get(themeKey);
  }

  for (const item of safeRecordList(reviewQueue)) {
    if (getReviewPriorityLabel(item) !== "中") continue;
    const theme = ensureTheme(item.tag || item.title);
    if (!theme) continue;
    theme.count += 1;
    const studentId = getThemeStudentId(item);
    if (studentId) theme.studentIds.add(studentId);
  }

  for (const item of safeRecordList(checkSummary)) {
    if (getReviewPriorityLabel({ ...item, title: item.label || item.tag }) !== "中") continue;
    const theme = ensureTheme(item.tag || item.label);
    if (!theme) continue;
    theme.count = Math.max(theme.count, Number(item.count) || 0);
    theme.reportedStudentCount = Math.max(theme.reportedStudentCount, Number(item.studentCount) || 0);
  }

  return Array.from(themes.values())
    .map((theme) => {
      const studentCount = Math.max(theme.studentIds.size, theme.reportedStudentCount);
      return {
        themeKey: theme.themeKey,
        label: theme.label,
        count: theme.count,
        studentCount,
        detail: `${studentCount}名以上の学生に出た観察・表現のつまずきとして、個別支援とは別に授業で扱います。`,
      };
    })
    .filter((theme) => theme.label && theme.studentCount >= 2)
    .sort((a, b) => {
      if (b.studentCount !== a.studentCount) return b.studentCount - a.studentCount;
      return b.count - a.count;
    })
    .slice(0, 3);
}

export function mergeClassShareThemes(primaryThemes = [], secondaryThemes = []) {
  const themes = new Map();
  for (const item of [...safeRecordList(primaryThemes), ...safeRecordList(secondaryThemes)]) {
    const label = normalizeTeacherDisplayText(item.label, 80);
    if (!label || hasSensitiveDisplayToken(label)) continue;
    const suppliedKey = safeCopyText(item.themeKey, 120);
    const themeKey = /^[a-z0-9_:-]+$/i.test(suppliedKey) ? suppliedKey : `label:${label}`;
    const current = themes.get(themeKey) || { ...item, themeKey, label, count: 0, studentCount: 0 };
    current.count += toCount(item.count);
    current.studentCount = Math.max(current.studentCount, toCount(item.studentCount));
    if (!current.detail && item.detail) current.detail = normalizeTeacherDisplayText(item.detail, 180);
    themes.set(themeKey, current);
  }
  return Array.from(themes.values())
    .filter((theme) => theme.studentCount >= 2)
    .sort((left, right) => (
      right.studentCount - left.studentCount
      || right.count - left.count
      || left.label.localeCompare(right.label, "ja")
    ))
    .slice(0, 3);
}

function getClassShareLessonTemplate(label) {
  const text = safeCopyText(label, 80);
  if (/指針|5領域|五領域|ねらい/.test(text)) {
    return {
      focusLabel: "指針へ急がず観察に戻す",
      classQuestion: "この場面の子どもの姿を、指針の言葉に結びつける前に、まず何として観察できますか。",
      miniTask: "同じ場面を、観察事実、学生の解釈、次に見ることの三つへ分け直す。",
    };
  }
  if (/表現|評価|断定|安全|言い換え/.test(text)) {
    return {
      focusLabel: "断定を観察表現へ戻す",
      classQuestion: "その表現は、実際に見た事実ですか。それとも学生の解釈や決めつけが混ざっていますか。",
      miniTask: "断定的な表現を一つ選び、子どもの具体的な姿や保育者の関わりに言い換える。",
    };
  }
  if (/考察|感想|気づき|学び/.test(text)) {
    return {
      focusLabel: "気づきを次の観察へつなげる",
      classQuestion: "今日の気づきは、明日のどの場面を見ることにつながりますか。",
      miniTask: "気づきを一文で書いた後、明日見る場面と保育者の関わりを一つずつ足す。",
    };
  }
  if (/助言|フィードバック|実習先/.test(text)) {
    return {
      focusLabel: "助言を翌日の行動へ戻す",
      classQuestion: "実習先で受けた助言を、明日の観察や関わり方にどう戻せますか。",
      miniTask: "助言の内容、なぜ大切か、明日試すことを三行で分ける。",
    };
  }
  return {
    focusLabel: "観察を具体化する",
    classQuestion: "この記録は、見た事実、考えたこと、次に見ることが分かれていますか。",
    miniTask: "一つの場面を選び、子どもの姿、保育者の関わり、自分の気づきへ分ける。",
  };
}

export function buildClassShareLessonPlans(classShareThemes = [], reviewQueue = []) {
  const reviews = safeRecordList(reviewQueue);
  return safeRecordList(classShareThemes).slice(0, 3).map((theme, index) => {
    const rawLabel = normalizeTeacherDisplayText(theme.label, 80);
    const label = rawLabel && !hasSensitiveDisplayToken(rawLabel) ? rawLabel : "共通テーマ";
    const template = getClassShareLessonTemplate(label);
    const relatedTitles = reviews
      .filter((item) => getReviewPriorityLabel(item) === "中")
      .filter((item) => safeCopyText(item.tag || item.title, 80) === rawLabel)
      .map((item) => getSafeReviewTitle(item, "確認候補"))
      .filter((title) => title && !hasSensitiveDisplayToken(title))
      .slice(0, 2);

    return {
      id: `class-share-plan-${index + 1}`,
      themeKey: safeCopyText(theme.themeKey, 120) || `label:${label}`,
      label,
      studentCount: toCount(theme.studentCount),
      count: toCount(theme.count),
      focusLabel: template.focusLabel,
      classQuestion: template.classQuestion,
      miniTask: template.miniTask,
      sourceSignals: relatedTitles.length ? relatedTitles : [`${toCount(theme.studentCount)}名以上に出た確認候補`],
      avoidText: "個別の記録内容は取り上げず、共通する書き方の練習として扱う。",
    };
  });
}

function latestTimestamp(a, b) {
  const first = a ? new Date(a).getTime() : 0;
  const second = b ? new Date(b).getTime() : 0;
  if (!first && !second) return "";
  return second > first ? b : a;
}
