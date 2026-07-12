import { normalizePrivacyScanText } from "./privacyPatterns.js";

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function safeCopyText(value, maxLength = 420) {
  return normalizePrivacyScanText(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeMultilineText(value) {
  return normalizePrivacyScanText(value).replace(/\r\n/g, "\n").trim().replace(/\n{3,}/g, "\n\n");
}

const MEANINGFUL_CHAR_PATTERN = /[一-龯ぁ-んァ-ンA-Za-z0-9０-９]/g;
const MEANINGFUL_TEXT_ONLY_PATTERN = /[^一-龯ぁ-んァ-ンA-Za-z0-9０-９]/g;
const MIN_DRAFT_EDIT_CHARS = 12;
const MIN_DRAFT_EDIT_CHARS_WITH_RATIO = 6;
const MIN_DRAFT_EDIT_RATIO = 0.2;
const MIN_DRAFT_NEW_CHARS = 8;
const MIN_STUDENT_AUTHORED_CHARS = 8;
const MIN_STUDENT_AUTHORED_CHARS_WITH_SCAFFOLD = 16;
const MIN_EPISODE_MEMO_CHARS = 12;
const MIN_UNREPLACED_SCAFFOLD_COPY_CHARS = 16;
const MAX_UNREPLACED_SCAFFOLD_RETENTION_RATIO = 0.9;
const DEFAULT_STUDENT_DIARY_FIELD_LABELS = Object.freeze({
  goalReflection: "その日の実習目標に対する振り返り",
  episodeMemo: "エピソード",
  episodeInsight: "エピソードから得た気づき",
  overallLearning: "保育者として大切にしなければならないことの気づき",
  nextAction: "次の日取り組みたいこと",
});
const STUDENT_DIARY_FIELD_KEYS = Object.freeze([
  "goalReflection",
  "episodeMemo",
  "episodeInsight",
  "overallLearning",
  "nextAction",
]);
const DEFAULT_STUDENT_DIARY_REQUIREMENTS = Object.freeze({
  requiredFields: STUDENT_DIARY_FIELD_KEYS,
  episodes: Object.freeze({
    initialCount: 2,
    requiredCount: 1,
    minCount: 1,
    maxCount: 4,
  }),
});
const STUDENT_CHAT_STARTER_FALLBACKS = Object.freeze({
  goalReflection: "実習目標と【目標につながった場面】を見比べ、【自分が考えたこと】を足す。",
  episodeInsight: "この場面で見た【観察した事実】から、【自分の気づき】を考える。",
  overallLearning: "今日の場面を通して、【共通して気づいたこと】を【保育者として大切にしたいこと】へつなげる。",
  nextAction: "明日は【見る場面】で、【確認したい姿や関わり】を一つ見る。",
});
const STUDENT_COACH_STARTERS = Object.freeze({
  goalReflection: "今日の目標は「...」だった。実際には、...の場面で...を見ることができた。一方で、...の判断に迷った。",
  episodeMemo: "場面：...\n子どもの姿：...\n自分の関わり：...\nその後の反応：...",
  episodeInsight: "この場面から、保育者は...を大切にする必要があると感じた。理由は、...",
  overallLearning: "今日のエピソードを通して、保育者として大切にしなければならないことは...だと感じた。特に、...",
  nextAction: "明日は、...の場面で、子どもの...を見たい。必要なら、...について学校の担当教員に確認したい。",
  feedbackReceived: "実習先で受けた助言：...\n自分の理解：...\n明日変えたい行動：...",
});
const STUDENT_SCAFFOLD_MIN_ADDED_CHARS = new Map([
  [STUDENT_CHAT_STARTER_FALLBACKS.goalReflection, MIN_STUDENT_AUTHORED_CHARS_WITH_SCAFFOLD],
  [STUDENT_CHAT_STARTER_FALLBACKS.episodeInsight, MIN_STUDENT_AUTHORED_CHARS_WITH_SCAFFOLD],
  [STUDENT_CHAT_STARTER_FALLBACKS.overallLearning, MIN_STUDENT_AUTHORED_CHARS_WITH_SCAFFOLD],
  [STUDENT_CHAT_STARTER_FALLBACKS.nextAction, MIN_STUDENT_AUTHORED_CHARS_WITH_SCAFFOLD],
  [STUDENT_COACH_STARTERS.goalReflection, MIN_STUDENT_AUTHORED_CHARS_WITH_SCAFFOLD],
  [STUDENT_COACH_STARTERS.episodeMemo, MIN_STUDENT_AUTHORED_CHARS_WITH_SCAFFOLD],
  [STUDENT_COACH_STARTERS.episodeInsight, MIN_STUDENT_AUTHORED_CHARS_WITH_SCAFFOLD],
  [STUDENT_COACH_STARTERS.overallLearning, MIN_STUDENT_AUTHORED_CHARS_WITH_SCAFFOLD],
  [STUDENT_COACH_STARTERS.nextAction, MIN_STUDENT_AUTHORED_CHARS_WITH_SCAFFOLD],
  [STUDENT_COACH_STARTERS.feedbackReceived, MIN_STUDENT_AUTHORED_CHARS],
]);

function normalizeFormatLabel(value, fallback) {
  return safeCopyText(value, 80) || fallback;
}

export function buildStudentDiaryFieldLabels(schoolFormat = {}) {
  const fieldLabels = schoolFormat?.studentDiaryFieldLabels || schoolFormat?.diaryFieldLabels || {};
  return {
    goalReflection: normalizeFormatLabel(fieldLabels.goalReflection, DEFAULT_STUDENT_DIARY_FIELD_LABELS.goalReflection),
    episodeMemo: normalizeFormatLabel(fieldLabels.episodeMemo, DEFAULT_STUDENT_DIARY_FIELD_LABELS.episodeMemo),
    episodeInsight: normalizeFormatLabel(fieldLabels.episodeInsight, DEFAULT_STUDENT_DIARY_FIELD_LABELS.episodeInsight),
    overallLearning: normalizeFormatLabel(fieldLabels.overallLearning, DEFAULT_STUDENT_DIARY_FIELD_LABELS.overallLearning),
    nextAction: normalizeFormatLabel(fieldLabels.nextAction, DEFAULT_STUDENT_DIARY_FIELD_LABELS.nextAction),
  };
}

export function buildStudentDiaryRequirements(schoolFormat = {}) {
  const source = schoolFormat?.studentDiaryRequirements || schoolFormat?.diaryRequirements || {};
  const requiredFields = Array.isArray(source.requiredFields)
    ? [...new Set(source.requiredFields.filter((field) => STUDENT_DIARY_FIELD_KEYS.includes(field)))]
    : [];
  const episodes = source.episodes && typeof source.episodes === "object" && !Array.isArray(source.episodes)
    ? source.episodes
    : {};
  const values = {
    initialCount: episodes.initialCount,
    requiredCount: episodes.requiredCount,
    minCount: episodes.minCount,
    maxCount: episodes.maxCount,
  };
  const validEpisodes = Object.values(values).every(Number.isInteger)
    && values.minCount >= 1
    && values.minCount <= values.initialCount
    && values.initialCount <= values.maxCount
    && values.maxCount <= 8
    && values.requiredCount >= 1
    && values.requiredCount <= values.maxCount;
  if (Object.hasOwn(source, "episodes") && !validEpisodes) {
    return {
      requiredFields: [...DEFAULT_STUDENT_DIARY_REQUIREMENTS.requiredFields],
      episodes: { ...DEFAULT_STUDENT_DIARY_REQUIREMENTS.episodes },
    };
  }

  return {
    requiredFields: requiredFields.length
      ? requiredFields
      : [...DEFAULT_STUDENT_DIARY_REQUIREMENTS.requiredFields],
    episodes: validEpisodes
      ? values
      : { ...DEFAULT_STUDENT_DIARY_REQUIREMENTS.episodes },
  };
}

export function buildStudentChatDiaryStarterPatch({ source = {} } = {}) {
  const episodeIndex = Number.isInteger(source.episodeIndex) && source.episodeIndex >= 0 && source.episodeIndex < 8
    ? source.episodeIndex
    : 0;

  return {
    episodeIndex,
    goalReflection: STUDENT_CHAT_STARTER_FALLBACKS.goalReflection,
    episodeMemo: safeCopyText(source.episodeMemo, 3000),
    episodeInsight: STUDENT_CHAT_STARTER_FALLBACKS.episodeInsight,
    overallLearning: STUDENT_CHAT_STARTER_FALLBACKS.overallLearning,
    nextAction: STUDENT_CHAT_STARTER_FALLBACKS.nextAction,
  };
}

function getStudentChatDiaryEpisodes(diary = {}) {
  if (Array.isArray(diary.episodes) && diary.episodes.length > 0) return diary.episodes;
  return [{ memo: diary.memo || "", insight: diary.reflection || "" }];
}

function normalizeStudentScaffold(value) {
  return typeof value === "string" && STUDENT_SCAFFOLD_MIN_ADDED_CHARS.has(value) ? value : "";
}

function normalizeStudentScaffoldState(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const episodes = source.episodes && typeof source.episodes === "object" && !Array.isArray(source.episodes)
    ? source.episodes
    : {};
  return {
    goalReflection: normalizeStudentScaffold(source.goalReflection),
    overallLearning: normalizeStudentScaffold(source.overallLearning),
    nextAction: normalizeStudentScaffold(source.nextAction),
    episodes: Object.fromEntries(Object.entries(episodes).flatMap(([episodeId, fields]) => {
      if (!fields || typeof fields !== "object" || Array.isArray(fields)) return [];
      const memo = normalizeStudentScaffold(fields.memo);
      const insight = normalizeStudentScaffold(fields.insight);
      return memo || insight ? [[String(episodeId), { memo, insight }]] : [];
    })),
  };
}

function hasStudentScaffoldState(value) {
  return Boolean(value.goalReflection || value.overallLearning || value.nextAction || Object.keys(value.episodes).length);
}

export function setStudentFieldScaffold(diary = {}, { target = "", episodeId = "", scaffold = "" } = {}) {
  const nextScaffold = normalizeStudentScaffold(scaffold);
  const state = normalizeStudentScaffoldState(diary.studentScaffolds);
  if (["goalReflection", "overallLearning", "nextAction"].includes(target)) {
    state[target] = nextScaffold;
  } else if (["episodeMemo", "episodeInsight"].includes(target) && episodeId) {
    const field = target === "episodeMemo" ? "memo" : "insight";
    const episodeState = { ...(state.episodes[episodeId] || { memo: "", insight: "" }), [field]: nextScaffold };
    if (episodeState.memo || episodeState.insight) state.episodes[episodeId] = episodeState;
    else delete state.episodes[episodeId];
  } else {
    return diary;
  }
  if (hasStudentScaffoldState(state)) return { ...diary, studentScaffolds: state };
  const { studentScaffolds: _studentScaffolds, ...withoutScaffolds } = diary;
  return withoutScaffolds;
}

export function mergeStudentChatDiaryStarterPatch(diary = {}, patch = {}) {
  const episodes = getStudentChatDiaryEpisodes(diary);
  const episodeIndex = Number.isInteger(patch.episodeIndex) && patch.episodeIndex >= 0 && patch.episodeIndex < episodes.length
    ? patch.episodeIndex
    : 0;
  const targetEpisodeId = String(episodes[episodeIndex]?.id || `episode-${episodeIndex + 1}`);
  const shouldSetEpisodeInsightScaffold = !normalizeMultilineText(episodes[episodeIndex]?.insight);
  const shouldSetGoalScaffold = !normalizeMultilineText(diary.goalReflection);
  const shouldSetOverallScaffold = !normalizeMultilineText(diary.overallLearning);
  const shouldSetNextActionScaffold = !normalizeMultilineText(diary.nextAction);
  const nextEpisodes = episodes.map((episode, index) => {
    if (index !== episodeIndex) return episode;
    return {
      ...episode,
      memo: normalizeMultilineText(episode.memo) ? episode.memo : safeCopyText(patch.episodeMemo, 3000),
      insight: normalizeMultilineText(episode.insight) ? episode.insight : STUDENT_CHAT_STARTER_FALLBACKS.episodeInsight,
    };
  });
  let nextDiary = {
    ...diary,
    goalReflection: normalizeMultilineText(diary.goalReflection)
      ? diary.goalReflection
      : STUDENT_CHAT_STARTER_FALLBACKS.goalReflection,
    episodes: nextEpisodes,
    overallLearning: normalizeMultilineText(diary.overallLearning)
      ? diary.overallLearning
      : STUDENT_CHAT_STARTER_FALLBACKS.overallLearning,
    nextAction: normalizeMultilineText(diary.nextAction)
      ? diary.nextAction
      : STUDENT_CHAT_STARTER_FALLBACKS.nextAction,
  };
  if (shouldSetGoalScaffold) {
    nextDiary = setStudentFieldScaffold(nextDiary, { target: "goalReflection", scaffold: STUDENT_CHAT_STARTER_FALLBACKS.goalReflection });
  }
  if (shouldSetEpisodeInsightScaffold) {
    nextDiary = setStudentFieldScaffold(nextDiary, { target: "episodeInsight", episodeId: targetEpisodeId, scaffold: STUDENT_CHAT_STARTER_FALLBACKS.episodeInsight });
  }
  if (shouldSetOverallScaffold) {
    nextDiary = setStudentFieldScaffold(nextDiary, { target: "overallLearning", scaffold: STUDENT_CHAT_STARTER_FALLBACKS.overallLearning });
  }
  if (shouldSetNextActionScaffold) {
    nextDiary = setStudentFieldScaffold(nextDiary, { target: "nextAction", scaffold: STUDENT_CHAT_STARTER_FALLBACKS.nextAction });
  }
  return nextDiary;
}

export function isStudentChatSourceCurrent({ source, diary } = {}) {
  if (!source || !diary) return false;
  const episodes = getStudentChatDiaryEpisodes(diary);
  const episodeIndex = Number.isInteger(source.episodeIndex) && source.episodeIndex >= 0 && source.episodeIndex < episodes.length
    ? source.episodeIndex
    : 0;
  return normalizeMultilineText(source.practiceGoal) === normalizeMultilineText(diary.goal)
    && normalizeMultilineText(source.episodeMemo) === normalizeMultilineText(episodes[episodeIndex]?.memo);
}

export function getStudentChatOrganizationForComparison(stage, apiReply) {
  const organization = stage === "review" ? apiReply?.organization : null;
  return organization && typeof organization === "object" && !Array.isArray(organization)
    ? organization
    : null;
}

export function hasStudentDiaryEpisodeContent(episode = {}) {
  return Boolean(normalizeMultilineText(episode.memo) || normalizeMultilineText(episode.insight));
}

function normalizeDraftComparisonText(value) {
  return normalizePrivacyScanText(value).replace(MEANINGFUL_TEXT_ONLY_PATTERN, "");
}

function countStudentAuthoredChars(value) {
  return (normalizePrivacyScanText(value).match(MEANINGFUL_CHAR_PATTERN) || []).length;
}

function normalizeScaffoldComparisonText(value) {
  return normalizePrivacyScanText(value).replace(MEANINGFUL_TEXT_ONLY_PATTERN, "");
}

function countAddedScaffoldChars(value, scaffold) {
  let studentText = normalizeScaffoldComparisonText(value);
  for (const match of scaffold.matchAll(/【([^】]+)】/g)) {
    const slotLabel = normalizeScaffoldComparisonText(match[1]);
    if (slotLabel) studentText = studentText.split(slotLabel).join("");
  }
  const fixedScaffold = normalizeScaffoldComparisonText(
    scaffold.replace(/【[^】]*】/g, "").replace(/\.{2,}|…|＿+|_+/g, ""),
  );
  return countCharsNotInSource(studentText, fixedScaffold);
}

function hasStarterGap(value) {
  const text = normalizePrivacyScanText(value);
  return text.includes("...") || text.includes("…");
}

function hasStarterTemplateResidue(value, scaffold = "") {
  const text = normalizePrivacyScanText(value);
  if (/【[^】]{1,40}】/.test(text)) return true;
  const normalizedScaffold = normalizeStudentScaffold(scaffold);
  if (!normalizedScaffold) return false;
  return hasStarterGap(text)
    || countAddedScaffoldChars(text, normalizedScaffold) < STUDENT_SCAFFOLD_MIN_ADDED_CHARS.get(normalizedScaffold);
}

function hasStudentText(value, scaffold = "") {
  return hasStudentWrittenText(value, { scaffold });
}

export function hasStudentWrittenText(value, { scaffold = "" } = {}) {
  return hasStudentFieldText(value, MIN_STUDENT_AUTHORED_CHARS, scaffold);
}

export function buildStudentFieldInputState(value, { minChars = MIN_STUDENT_AUTHORED_CHARS, done = false, scaffold = "" } = {}) {
  const text = normalizeMultilineText(value);
  const authoredChars = countStudentAuthoredChars(text);
  if (!text) {
    return {
      level: "empty",
      label: "まだ空欄",
      help: "まず一文だけ、今日見た場面や明日見る一点を書きます。",
    };
  }
  if (hasStarterTemplateResidue(text, scaffold)) {
    return {
      level: "template",
      label: "穴埋め型が残っています",
      help: "穴埋め部分を、今日見た場面や自分の関わりに置き換えます。",
    };
  }
  if (authoredChars < minChars) {
    return {
      level: "thin",
      label: "もう一文足す",
      help: "場面、子どもの姿、自分の関わり、明日見る一点のどれかを足します。",
    };
  }
  if (done) {
    return {
      level: "ready",
      label: "入力あり",
      help: "提出前に、元の場面と違う言い方になっていないか見直します。",
    };
  }
  return {
    level: "ready",
    label: "入力あり",
    help: "提出前に、元の場面と違う言い方になっていないか見直します。",
  };
}

function hasStudentFieldText(value, minChars = MIN_STUDENT_AUTHORED_CHARS, scaffold = "") {
  return countStudentAuthoredChars(value) >= minChars && !hasStarterTemplateResidue(value, scaffold);
}

function getBoundedEditDistance(sourceText, targetText, limit) {
  if (sourceText === targetText) return 0;
  if (Math.abs(sourceText.length - targetText.length) >= limit) return limit;

  let previous = Array.from({ length: targetText.length + 1 }, (_, index) => Math.min(index, limit));
  for (let sourceIndex = 1; sourceIndex <= sourceText.length; sourceIndex += 1) {
    const current = [Math.min(sourceIndex, limit)];
    let rowMinimum = current[0];
    for (let targetIndex = 1; targetIndex <= targetText.length; targetIndex += 1) {
      const substitutionCost = sourceText[sourceIndex - 1] === targetText[targetIndex - 1] ? 0 : 1;
      const value = Math.min(
        previous[targetIndex] + 1,
        current[targetIndex - 1] + 1,
        previous[targetIndex - 1] + substitutionCost,
        limit,
      );
      current[targetIndex] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }
    previous = current;
  }
  return Math.min(previous[targetText.length], limit);
}

function countScaffoldCharsRetained(scaffoldText, finalText) {
  const finalCharCounts = new Map();
  for (const char of finalText) {
    finalCharCounts.set(char, (finalCharCounts.get(char) || 0) + 1);
  }

  let retainedChars = 0;
  for (const scaffoldChar of scaffoldText) {
    const remaining = finalCharCounts.get(scaffoldChar) || 0;
    if (remaining <= 0) continue;
    retainedChars += 1;
    finalCharCounts.set(scaffoldChar, remaining - 1);
  }
  return retainedChars;
}

function hasMostlyUnreplacedScaffoldCopy(finalText, scaffoldText) {
  if (scaffoldText.length < MIN_UNREPLACED_SCAFFOLD_COPY_CHARS) return false;
  const retainedRatio = countScaffoldCharsRetained(scaffoldText, finalText) / scaffoldText.length;
  return retainedRatio >= MAX_UNREPLACED_SCAFFOLD_RETENTION_RATIO;
}

function countCharsNotInSource(finalText, scaffoldText) {
  const scaffoldCharCounts = new Map();
  for (const char of scaffoldText) {
    scaffoldCharCounts.set(char, (scaffoldCharCounts.get(char) || 0) + 1);
  }

  let newChars = 0;
  for (const char of finalText) {
    const remaining = scaffoldCharCounts.get(char) || 0;
    if (remaining > 0) {
      scaffoldCharCounts.set(char, remaining - 1);
      continue;
    }
    newChars += 1;
  }
  return newChars;
}

function isDeletionOnlyEdit(finalText, scaffoldText) {
  if (finalText.length >= scaffoldText.length) return false;
  let finalIndex = 0;
  for (const char of scaffoldText) {
    if (char === finalText[finalIndex]) finalIndex += 1;
    if (finalIndex >= finalText.length) return true;
  }
  return finalIndex >= finalText.length;
}

function normalizeEpisodes(episodes = [], fallbackMemo = "", fallbackInsight = "") {
  const normalized = safeList(episodes)
    .map((episode, index) => ({
      id: String(episode?.id || `episode-${index + 1}`),
      title: safeCopyText(episode?.title || `エピソード${index + 1}`, 80),
      memo: normalizeMultilineText(episode?.memo),
      insight: normalizeMultilineText(episode?.insight),
    }))
    .filter((episode) => episode.title || episode.memo || episode.insight);

  if (normalized.length > 0) return normalized;

  return [
    {
      id: "episode-1",
      title: "エピソード1",
      memo: normalizeMultilineText(fallbackMemo),
      insight: normalizeMultilineText(fallbackInsight),
    },
  ];
}

function buildCoachItem({
  id,
  label,
  formatLabel,
  target,
  done,
  title,
  body,
  question,
  microStep,
  lens,
  nudge,
  starter,
  replaceTargets = [],
  inputState,
  actionLabel = "この一文から始める",
  required = true,
}) {
  return {
    id,
    label,
    formatLabel,
    target,
    done: Boolean(done),
    required: Boolean(required),
    status: done ? "done" : required ? "next" : "optional",
    title,
    body,
    question,
    microStep,
    lens,
    nudge,
    starter,
    replaceTargets: safeList(replaceTargets).filter(Boolean),
    inputState,
    actionLabel,
  };
}

function buildMissingCoachItem(item, reason) {
  return {
    id: item.id,
    label: item.label,
    formatLabel: item.formatLabel,
    target: item.target,
    title: item.title,
    reason,
    question: item.question,
    microStep: item.microStep,
    lens: item.lens,
    nudge: item.nudge,
    starter: item.starter,
    replaceTargets: item.replaceTargets,
    inputState: item.inputState,
    actionLabel: item.actionLabel,
  };
}

function getFormatMissingReason(item) {
  if (item.target === "goalReflection") return "今日の目標に対して、見た場面か迷った判断がまだありません。";
  if (item.target === "episodeMemo") return "場面、子どもの姿、自分の関わりがまだありません。";
  if (item.target === "episodeInsight") return "その場面から感じたこと、考えたことがまだありません。";
  if (item.target === "overallLearning") return "複数の場面を通しての総合的な気づきがまだありません。";
  if (item.target === "nextAction") return "明日見ること、試すことがまだありません。";
  return "学校フォーマットの入力がまだ不足しています。";
}

function pickEpisodeFieldInput(episodes, field, minChars, getScaffold) {
  const firstReady = episodes.find((episode) => hasStudentFieldText(episode?.[field], minChars, getScaffold(episode)));
  if (firstReady) return firstReady;
  return episodes.find((episode) => normalizePrivacyScanText(episode?.[field]).trim()) || episodes[0] || {};
}

export function buildStudentWritingCoach(diary = {}, feedback = {}, schoolFormat = {}) {
  const episodes = normalizeEpisodes(diary.episodes, diary.memo, diary.reflection);
  const scaffoldState = normalizeStudentScaffoldState(diary.studentScaffolds);
  const episodeScaffold = (episode, field) => scaffoldState.episodes[String(episode?.id || "")]?.[field] || "";
  const fieldLabels = buildStudentDiaryFieldLabels(schoolFormat);
  const requirements = buildStudentDiaryRequirements(schoolFormat);
  const requiredFieldSet = new Set(requirements.requiredFields);
  const hasGoalReflection = hasStudentText(diary.goalReflection, scaffoldState.goalReflection);
  const episodeMemoCount = episodes.filter((episode) => hasStudentFieldText(
    episode.memo,
    MIN_EPISODE_MEMO_CHARS,
    episodeScaffold(episode, "memo"),
  )).length;
  const episodeInsightCount = episodes.filter((episode) => hasStudentText(
    episode.insight,
    episodeScaffold(episode, "insight"),
  )).length;
  const hasEpisodeMemo = episodeMemoCount > 0;
  const hasEpisodeInsight = episodeInsightCount > 0;
  const hasOverallLearning = hasStudentText(diary.overallLearning, scaffoldState.overallLearning);
  const hasNextAction = hasStudentText(diary.nextAction, scaffoldState.nextAction);
  const requiredEpisodeCount = requirements.episodes.requiredCount;
  const requiresEpisodeMemo = requiredFieldSet.has("episodeMemo");
  const requiresEpisodeInsight = requiredFieldSet.has("episodeInsight");
  const requiresCompleteEpisode = requiresEpisodeMemo && requiresEpisodeInsight;
  const completeEpisodeCount = episodes.filter((episode) => (
    hasStudentFieldText(episode.memo, MIN_EPISODE_MEMO_CHARS, episodeScaffold(episode, "memo"))
    && hasStudentText(episode.insight, episodeScaffold(episode, "insight"))
  )).length;
  const episodeMemoComplete = requiresEpisodeMemo
    ? episodeMemoCount >= requiredEpisodeCount
    : hasEpisodeMemo;
  const episodeInsightComplete = requiresEpisodeInsight
    ? episodeInsightCount >= requiredEpisodeCount
    : hasEpisodeInsight;
  const feedbackText = [
    feedback.guidanceCategory,
    feedback.received,
    feedback.interpretation,
    feedback.tomorrowAction,
    feedback.teacherQuestion,
  ].filter(Boolean).join("\n");
  const hasFeedbackText = hasStudentText(feedbackText);
  const episodeMemoInput = pickEpisodeFieldInput(
    episodes,
    "memo",
    MIN_EPISODE_MEMO_CHARS,
    (episode) => episodeScaffold(episode, "memo"),
  );
  const episodeInsightInput = pickEpisodeFieldInput(
    episodes,
    "insight",
    MIN_STUDENT_AUTHORED_CHARS,
    (episode) => episodeScaffold(episode, "insight"),
  );
  const inputStates = {
    goalReflection: buildStudentFieldInputState(diary.goalReflection, { done: hasGoalReflection, scaffold: scaffoldState.goalReflection }),
    episodeMemo: buildStudentFieldInputState(episodeMemoInput.memo, {
      minChars: MIN_EPISODE_MEMO_CHARS,
      done: hasEpisodeMemo,
      scaffold: episodeScaffold(episodeMemoInput, "memo"),
    }),
    episodeInsight: buildStudentFieldInputState(episodeInsightInput.insight, {
      done: hasEpisodeInsight,
      scaffold: episodeScaffold(episodeInsightInput, "insight"),
    }),
    overallLearning: buildStudentFieldInputState(diary.overallLearning, { done: hasOverallLearning, scaffold: scaffoldState.overallLearning }),
    nextAction: buildStudentFieldInputState(diary.nextAction, { done: hasNextAction, scaffold: scaffoldState.nextAction }),
    feedbackReceived: buildStudentFieldInputState(feedbackText, { done: hasFeedbackText }),
  };

  const items = [
    buildCoachItem({
      id: "goal-reflection",
      label: "目標",
      formatLabel: fieldLabels.goalReflection,
      target: "goalReflection",
      done: hasGoalReflection,
      title: "今日の目標に戻す",
      body: "何を見ようとしたか、実際に何が難しかったかを一文ずつ分けます。",
      question: "今日のねらいに対して、見られた場面と迷った場面はどこですか。",
      microStep: {
        prompt: "1分で、目標に対して見た場面か迷った場面を一つだけ置く。",
        hint: "目標の説明だけで終わらせず、実際の場面を一文で足します。",
      },
      lens: {
        look: "目標に関係した一場面",
        write: "見られたこと、迷ったこと",
        avoid: "目標の説明だけで終わること",
      },
      nudge: "目標に対して、できたことか迷ったことを一つ足す。",
      starter: STUDENT_COACH_STARTERS.goalReflection,
      replaceTargets: [
        "「...」= 今日の実習目標",
        "...の場面 = 実際に見た場面",
        "...を見ること = 見られた子どもの姿",
        "...の判断 = 迷った関わり",
      ],
      inputState: inputStates.goalReflection,
      required: requiredFieldSet.has("goalReflection"),
    }),
    buildCoachItem({
      id: "episode-memo",
      label: "場面",
      formatLabel: fieldLabels.episodeMemo,
      target: "episodeMemo",
      done: episodeMemoComplete,
      title: "一場面だけ選ぶ",
      body: "場面、子どもの姿、自分の関わり、反応の順に置きます。",
      question: "今日いちばん覚えている場面で、実際に見た行動や言葉は何ですか。",
      microStep: {
        prompt: "1分で、子どもの姿と自分の関わりを一場面だけ箇条書きにする。",
        hint: "名前や園名ではなく、姿、言葉、動き、自分の関わりに分けます。",
      },
      lens: {
        look: "子どもの言葉、動き、表情",
        write: "場面、姿、自分の関わり、反応",
        avoid: "名前、園名、性格の決めつけ",
      },
      nudge: "名前や園名を避けて、場面・子どもの姿・自分の関わりを一つ足す。",
      starter: STUDENT_COACH_STARTERS.episodeMemo,
      replaceTargets: [
        "場面 = いつ、どんな活動だったか",
        "子どもの姿 = 言葉、動き、表情",
        "自分の関わり = 自分がした声かけや動き",
        "その後の反応 = 子どもや周囲の変化",
      ],
      inputState: inputStates.episodeMemo,
      required: requiredFieldSet.has("episodeMemo"),
    }),
    buildCoachItem({
      id: "episode-insight",
      label: "気づき",
      formatLabel: fieldLabels.episodeInsight,
      target: "episodeInsight",
      done: episodeInsightComplete,
      title: "その場面から考えたこと",
      body: "よかった/悪かったで止めず、なぜそう感じたかを残します。",
      question: "その場面から、保育者として何を大切にしたいと感じましたか。",
      microStep: {
        prompt: "1分で、その場面を見て自分が感じたことを一つ書く。",
        hint: "結果の良し悪しではなく、次に見る視点へつながる言葉にします。",
      },
      lens: {
        look: "自分が感じた迷い",
        write: "なぜそう感じたか、次に見る視点",
        avoid: "よかった/悪かっただけで止めること",
      },
      nudge: "その場面で自分が感じたことを一つ足す。",
      starter: STUDENT_COACH_STARTERS.episodeInsight,
      replaceTargets: [
        "...を大切にする = その場面から見えた関わりの視点",
        "理由 = そう感じた根拠になる子どもの姿",
      ],
      inputState: inputStates.episodeInsight,
      required: requiredFieldSet.has("episodeInsight"),
    }),
    buildCoachItem({
      id: "overall-learning",
      label: "まとめ",
      formatLabel: fieldLabels.overallLearning,
      target: "overallLearning",
      done: hasOverallLearning,
      title: "エピソードをまとめる",
      body: "複数の気づきを、保育者として大切にしたいことへつなげます。",
      question: "今日の複数の場面に共通して、自分が学んだことは何ですか。",
      microStep: {
        prompt: "1分で、複数の場面に共通していた気づきを一つ選ぶ。",
        hint: "場面を並べ直すより、保育者として大切にしたい視点へまとめます。",
      },
      lens: {
        look: "複数の場面で共通した点",
        write: "保育者として大切にしたい視点",
        avoid: "場面を並べるだけで終わること",
      },
      nudge: "複数の場面から大切だと思った関わりを一つ足す。",
      starter: STUDENT_COACH_STARTERS.overallLearning,
      replaceTargets: [
        "...だと感じた = 複数の場面に共通する気づき",
        "特に = その気づきにつながった一場面",
      ],
      inputState: inputStates.overallLearning,
      required: requiredFieldSet.has("overallLearning"),
    }),
    buildCoachItem({
      id: "next-action",
      label: "明日",
      formatLabel: fieldLabels.nextAction,
      target: "nextAction",
      done: hasNextAction,
      title: "明日見る一点に絞る",
      body: "反省で止めず、明日見ることや試すことへ戻します。",
      question: "明日、同じような場面で何を一つ観察しますか。",
      microStep: {
        prompt: "1分で、明日見ること、試すこと、確認したいことを一つ選ぶ。",
        hint: "全部直そうとせず、次の日に見られる一点へ絞ります。",
      },
      lens: {
        look: "明日また見られる場面",
        write: "見ること、試すこと、確認したいこと",
        avoid: "全部直す計画に広げること",
      },
      nudge: "明日もう一度見る子どもの姿か関わりを一つ足す。",
      starter: STUDENT_COACH_STARTERS.nextAction,
      replaceTargets: [
        "...の場面 = 明日また見られそうな場面",
        "子どもの... = 観察したい姿、言葉、動き",
        "...について = 学校の担当教員に確認したい一点",
      ],
      inputState: inputStates.nextAction,
      required: requiredFieldSet.has("nextAction"),
    }),
    buildCoachItem({
      id: "feedback",
      label: "助言",
      target: "feedbackReceived",
      done: hasFeedbackText,
      required: false,
      title: "実習先で受けた助言を戻す",
      body: "助言がある時だけ、自分の理解と明日の観察に分けます。",
      question: "実習先から受けた助言を、明日どの行動や観察へ戻しますか。",
      microStep: {
        prompt: "1分で、受けた助言を自分の理解と明日の行動に分ける。",
        hint: "助言の原文をそのまま残すより、明日見ることへ戻します。",
      },
      lens: {
        look: "実習先で受けた助言",
        write: "自分の理解と明日変える行動",
        avoid: "助言の丸写しで終わること",
      },
      nudge: "受けた助言を、明日変える行動へ一つ戻す。",
      starter: STUDENT_COACH_STARTERS.feedbackReceived,
      replaceTargets: [
        "実習先で受けた助言 = 実習先から言われた内容",
        "自分の理解 = 自分の言葉で捉え直したこと",
        "明日変えたい行動 = 次の日に試す一点",
      ],
      inputState: inputStates.feedbackReceived,
      actionLabel: "助言欄の書き方を見る",
    }),
  ];

  const itemByTarget = new Map(items.map((item) => [item.target, item]));
  const requiredItems = items.filter((item) => item.required);
  const doneCount = requiredItems.filter((item) => item.done).length;
  const nextItem = requiredItems.find((item) => !item.done) || items.find((item) => !item.done) || requiredItems[requiredItems.length - 1];
  const findItem = (target) => itemByTarget.get(target);
  const safetyCheckBlockers = [
    !hasEpisodeMemo && buildMissingCoachItem(
      findItem("episodeMemo"),
      "一つだけでよいので、実際に見た場面を書いてください。",
    ),
    !(hasEpisodeInsight || hasOverallLearning) && buildMissingCoachItem(
      findItem("episodeInsight"),
      "エピソードの気づきか、総合的な気づきを一つ書いてください。",
    ),
    !hasNextAction && buildMissingCoachItem(
      findItem("nextAction"),
      "明日見ること、試すことを一つ書いてください。",
    ),
  ].filter(Boolean);
  const formatMissingItems = requiredItems
    .filter((item) => !item.done)
    .map((item) => {
      if (item.target === "episodeMemo") {
        return buildMissingCoachItem(item, `${requiredEpisodeCount}件のうち、場面まで書けたエピソードは${episodeMemoCount}件です。`);
      }
      if (item.target === "episodeInsight") {
        return buildMissingCoachItem(item, `${requiredEpisodeCount}件のうち、気づきまで書けたエピソードは${episodeInsightCount}件です。`);
      }
      return buildMissingCoachItem(item, getFormatMissingReason(item));
    });
  if (
    requiresCompleteEpisode
    && episodeMemoComplete
    && episodeInsightComplete
    && completeEpisodeCount < requiredEpisodeCount
  ) {
    formatMissingItems.push(buildMissingCoachItem(
      findItem("episodeMemo"),
      `${requiredEpisodeCount}件のうち、同じエピソード内で場面と気づきが揃ったものは${completeEpisodeCount}件です。`,
    ));
  }
  const firstEpisode = episodes[0] || {};
  const previewInsight = firstEpisode.insight || diary.overallLearning;
  const previewInsightScaffold = firstEpisode.insight
    ? episodeScaffold(firstEpisode, "insight")
    : scaffoldState.overallLearning;

  return {
    doneCount,
    totalCount: requiredItems.length,
    readyForSafetyCheck: safetyCheckBlockers.length === 0,
    safetyCheckBlockers,
    formatMissingItems,
    nextItem,
    items,
    requirements,
    episodeProgress: {
      memoCount: episodeMemoCount,
      insightCount: episodeInsightCount,
      completeCount: completeEpisodeCount,
      requiredCount: requiredEpisodeCount,
    },
    preview: [
      ["目標", diary.goalReflection, scaffoldState.goalReflection],
      ["場面", firstEpisode.memo, episodeScaffold(firstEpisode, "memo")],
      ["気づき", previewInsight, previewInsightScaffold],
      ["明日", diary.nextAction, scaffoldState.nextAction],
    ].filter(([, value, scaffold]) => hasStudentText(value, scaffold)).map(([label, value]) => `${label}: ${safeCopyText(value, 120)}`),
  };
}

function buildSelfReviewPrompt({
  id,
  label,
  formatLabel,
  target,
  title,
  body,
  question,
  actionLabel = "この欄を見直す",
}) {
  return {
    id,
    label,
    formatLabel,
    target,
    title,
    body,
    question,
    actionLabel,
  };
}

export function buildStudentSelfReviewPrompts(diary = {}, feedback = {}, schoolFormat = {}) {
  const episodes = normalizeEpisodes(diary.episodes, diary.memo, diary.reflection);
  const scaffoldState = normalizeStudentScaffoldState(diary.studentScaffolds);
  const episodeScaffold = (episode, field) => scaffoldState.episodes[String(episode?.id || "")]?.[field] || "";
  const fieldLabels = buildStudentDiaryFieldLabels(schoolFormat);
  const hasEpisodeMemo = episodes.some((episode) => hasStudentFieldText(
    episode.memo,
    MIN_EPISODE_MEMO_CHARS,
    episodeScaffold(episode, "memo"),
  ));
  const hasEpisodeInsight = episodes.some((episode) => hasStudentText(episode.insight, episodeScaffold(episode, "insight")));
  const feedbackText = [
    feedback.received,
    feedback.interpretation,
    feedback.unclear,
    feedback.tomorrowAction,
    feedback.teacherQuestion,
  ].filter(Boolean).join("\n");

  return [
    hasStudentText(diary.goalReflection, scaffoldState.goalReflection) && buildSelfReviewPrompt({
      id: "review-goal-reflection",
      label: "目標",
      formatLabel: fieldLabels.goalReflection,
      target: "goalReflection",
      title: "目標と実際の場面がつながっているか",
      body: "目標の説明だけで終わらず、見た場面や迷った判断が入っているかを見ます。",
      question: "今日の目標に対して、実際に見た場面は一つ入っていますか。",
    }),
    hasEpisodeMemo && buildSelfReviewPrompt({
      id: "review-episode-memo",
      label: "場面",
      formatLabel: fieldLabels.episodeMemo,
      target: "episodeMemo",
      title: "場面、子どもの姿、自分の関わりを分ける",
      body: "印象だけでまとめず、見たことと自分の関わりを分けて残します。",
      question: "その場面で、子どもの姿と自分の関わりは別々に読めますか。",
    }),
    hasEpisodeInsight && buildSelfReviewPrompt({
      id: "review-episode-insight",
      label: "気づき",
      formatLabel: fieldLabels.episodeInsight,
      target: "episodeInsight",
      title: "気づきの根拠になる場面があるか",
      body: "感じたことだけで止めず、なぜそう考えたかを場面に戻して見ます。",
      question: "その気づきは、前の場面から言える内容になっていますか。",
    }),
    hasStudentText(diary.overallLearning, scaffoldState.overallLearning) && buildSelfReviewPrompt({
      id: "review-overall-learning",
      label: "まとめ",
      formatLabel: fieldLabels.overallLearning,
      target: "overallLearning",
      title: "一日の総合的な気づきになっているか",
      body: "反省の羅列ではなく、保育者として大切にしたい視点へまとめます。",
      question: "複数の場面に共通する学びとして読めますか。",
    }),
    hasStudentText(diary.nextAction, scaffoldState.nextAction) && buildSelfReviewPrompt({
      id: "review-next-action",
      label: "明日",
      formatLabel: fieldLabels.nextAction,
      target: "nextAction",
      title: "明日できる一点に絞る",
      body: "大きな反省や宣言ではなく、次の日に見られる場面や試せる関わりへ戻します。",
      question: "明日まず見ること、試すことは一つに絞れていますか。",
    }),
    hasStudentText(feedbackText) && buildSelfReviewPrompt({
      id: "review-feedback",
      label: "助言",
      target: "feedbackReceived",
      title: "実習先の助言を明日の観察へ戻す",
      body: "助言を本文の飾りにせず、自分の理解と次に見る点へ分けます。",
      question: "受けた助言は、明日の観察や相談したい点につながっていますか。",
      actionLabel: "助言欄を見直す",
    }),
  ].filter(Boolean).slice(0, 6);
}

export function buildStudentRevisionChecklist(payload = {}, result = {}, feedbackNextSteps = {}) {
  const checks = safeList(result?.checks).map((check) => safeCopyText(check, 120)).filter(Boolean);
  const hasFeedback = Boolean(feedbackNextSteps?.hasContent);
  return [
    {
      label: "元の記録",
      title: "見ていない事実を増やしていないか",
      body: "整理案にある表現でも、自分が見ていない姿や一般論は消します。",
    },
    {
      label: "根拠",
      title: "気づきの根拠になる姿があるか",
      body: safeCopyText(payload.reflection, 140)
        ? "考えたことと、根拠になる場面が対応しているかを見ます。"
        : "気づきを書く前に、根拠になる場面を一つ足します。",
    },
    {
      label: "明日",
      title: "次の日の観察に戻っているか",
      body: safeCopyText(payload.tomorrowTask, 140)
        ? "明日見ることが一つに絞れているかを確認します。"
        : "明日見ること、試すこと、確認したいことのどれか一つを入れます。",
    },
    {
      label: hasFeedback ? "助言" : "安全",
      title: hasFeedback ? "実習先の助言を翌日の観察に戻す" : "個人が分かる表現を残していないか",
      body: hasFeedback
        ? `${feedbackNextSteps.focus}を、記録本文ではなく明日の観察に戻します。`
        : "名前、園名、家庭事情、診断名は提出前に置き換えます。",
    },
    ...checks.slice(0, 2).map((check) => ({
      label: "問い",
      title: "Manalioからの確認",
      body: check,
    })),
  ].slice(0, 6);
}

export function buildStudentRevisionOrder(payload = {}, result = {}, feedbackNextSteps = {}) {
  const checks = safeList(result?.checks).map((check) => safeCopyText(check, 120)).filter(Boolean);
  const hasMemo = hasStudentText(payload.memo);
  const hasReflection = hasStudentText(payload.reflection);
  const hasTomorrowTask = hasStudentText(payload.tomorrowTask);
  const hasFeedback = Boolean(feedbackNextSteps?.hasContent);

  const steps = [
    {
      id: "remove-unseen",
      label: "最初",
      title: "元の記録にないことを削る",
      body: "整理案の表現でも、自分が見ていない出来事、気持ち、理由は残しません。",
      prompt: "この一文は、元の記録にある場面から言えますか。",
    },
    {
      id: "connect-evidence",
      label: "次",
      title: hasMemo && hasReflection ? "気づきと場面をつなぐ" : "根拠になる場面を一つ足す",
      body: hasMemo && hasReflection
        ? "気づきの一文が、実際に見た場面や子どもの姿と対応しているかを見ます。"
        : "気づきだけで終わる場合は、根拠になる場面や子どもの姿を一つに絞ります。",
      prompt: "その気づきの根拠になった場面はどこですか。",
    },
  ];

  if (hasFeedback) {
    steps.push({
      id: "connect-feedback",
      label: "助言",
      title: "実習先の助言を明日の観察へ戻す",
      body: `${safeCopyText(feedbackNextSteps.focus, 80) || "受けた助言"}を、記録本文の飾りではなく次に見る点へ変えます。`,
      prompt: "その助言を受けて、明日どの場面を見ますか。",
    });
  }

  steps.push({
    id: "next-observation",
    label: "最後",
    title: hasTomorrowTask ? "明日の一点を短くする" : "明日見る一点を足す",
    body: hasTomorrowTask
      ? "明日見ることが複数ある場合は、一つの場面と一つの関わりへ絞ります。"
      : "反省で終わらせず、次の日に見る場面や試す関わりを一つ入れます。",
    prompt: "明日まず見る場面は一つに絞れていますか。",
  });

  if (checks.length > 0) {
    steps.push({
      id: "final-safety",
      label: "確認",
      title: "提出前チェックの問いだけ見直す",
      body: checks[0],
      prompt: "この確認は、学生本人の見直しで直せますか。",
    });
  }

  return steps.slice(0, 5);
}

function buildFinalRecoveryItem({
  id,
  label,
  title,
  body,
  action,
  actionLabel,
}) {
  return {
    id,
    label,
    title: safeCopyText(title, 120),
    body: safeCopyText(body, 180),
    action,
    actionLabel,
  };
}

export function buildStudentFinalCheckRecoveryGuide(review = {}, checkedText = "", sanitizedText = "") {
  if (!review) return [];

  const findings = safeList(review.findings);
  const fieldChanges = safeList(review.fieldChanges);
  const contextNotes = safeList(review.contextNotes);
  const currentText = normalizeMultilineText(checkedText);
  const safeText = normalizeMultilineText(sanitizedText);
  const hasUnresolvedFinalCheckIssue = review.blocked
    || contextNotes.some((note) => note?.severity === "context");
  const needsSafeTextApply = Boolean(review.changed && safeText && currentText !== safeText);
  const needsRecheckAfterSafeTextApply = Boolean(review.changed && safeText && currentText === safeText && !hasUnresolvedFinalCheckIssue);
  const needsRecheckAfterClearEdit = Boolean(review.status === "clear" && safeText && currentText !== safeText);
  const steps = [];

  if (needsRecheckAfterSafeTextApply) {
    steps.push(buildFinalRecoveryItem({
      id: "review-applied-safe-text",
      label: "最初",
      title: "安全化後の意味を確認する",
      body: "置き換えた表現で、元の場面や自分の気づきの意味が変わっていないかを確認します。",
      action: "focus_final_draft",
      actionLabel: "記録欄を見る",
    }));
  }

  if (!needsRecheckAfterSafeTextApply && (findings.length > 0 || review.blocked)) {
    const firstFinding = findings[0] || {};
    steps.push(buildFinalRecoveryItem({
      id: "remove-identifying-expression",
      label: "最初",
      title: "個人が分かる表現を減らす",
      body: firstFinding.message || "名前、園名、連絡先、家庭事情など、提出前の記録に残せない表現を減らします。",
      action: "focus_final_draft",
      actionLabel: "記録欄で直す",
    }));
  }

  if (needsSafeTextApply) {
    const firstChange = fieldChanges[0] || {};
    steps.push(buildFinalRecoveryItem({
      id: "apply-safe-text",
      label: steps.length ? "次" : "最初",
      title: firstChange.label ? `${firstChange.label}の置き換えを反映する` : "安全な表現へ置き換える",
      body: "置き換え後に、意味が変わっていないかだけを自分で確認します。",
      action: "apply_sanitized",
      actionLabel: "安全化した文を反映",
    }));
  }

  const contextNote = contextNotes.find((note) => note.severity === "context")
    || (review.status !== "clear" ? contextNotes[0] : null);
  if (!needsRecheckAfterSafeTextApply && contextNote) {
    steps.push(buildFinalRecoveryItem({
      id: "separate-context-expression",
      label: steps.length ? "次" : "最初",
      title: contextNote.label || "提出前に見ておく表現を分ける",
      body: contextNote.message || "見た事実、自分が受け止めたこと、明日見る一点に分けます。",
      action: "focus_final_draft",
      actionLabel: "記録欄で直す",
    }));
  }

  if (!steps.length && review.status !== "clear") {
    steps.push(buildFinalRecoveryItem({
      id: "review-final-question",
      label: "最初",
      title: "提出前チェックの問いだけ直す",
      body: "追加の文章を増やす前に、チェックで残った一点だけを自分の記録に戻します。",
      action: "focus_final_draft",
      actionLabel: "記録欄で直す",
    }));
  }

  if (!steps.length && needsRecheckAfterClearEdit) {
    steps.push(buildFinalRecoveryItem({
      id: "review-edited-final-draft",
      label: "最初",
      title: "チェック後に直した本文を見直す",
      body: "提出前チェック後に本文が変わっています。追加した表現に個人が分かる情報などが残っていないか確認します。",
      action: "focus_final_draft",
      actionLabel: "記録欄を見る",
    }));
  }

  if (!steps.length) return [];

  steps.push(buildFinalRecoveryItem({
    id: "run-final-check-again",
    label: "最後",
    title: "再チェックしてからコピーする",
    body: "直した後、もう一度提出前チェックを通してからコピーします。",
    action: "run_final_check",
    actionLabel: "再チェック",
  }));

  return steps.slice(0, 4);
}

export function hasStudentEditedDraft(finalDraft = "", scaffoldDraft = "") {
  return getStudentDraftEditReadiness(finalDraft, scaffoldDraft).ready;
}

export function getStudentDraftEditReadiness(finalDraft = "", scaffoldDraft = "") {
  const finalText = normalizeDraftComparisonText(finalDraft);
  const scaffoldText = normalizeDraftComparisonText(scaffoldDraft);
  if (!finalText) {
    return {
      ready: false,
      reason: "empty",
      title: "まだ記録がありません",
      body: "整理案を貼るだけでなく、今日見た場面、気づき、明日の一点を自分の言葉で書きます。",
      actionLabel: "記録を入力すると進めます",
    };
  }
  if (!scaffoldText) {
    if (finalText.length >= MIN_DRAFT_EDIT_CHARS) {
      return {
        ready: true,
        reason: "ready_without_scaffold",
        title: "提出前チェックへ進めます",
        body: "記録として扱える長さがあります。次に個人情報や要配慮情報が残っていないか確認します。",
        actionLabel: "提出前チェックへ進む",
      };
    }
    return {
      ready: false,
      reason: "short_without_scaffold",
      title: "もう一文足します",
      body: "今日見た場面、子どもの姿、自分の関わり、明日見る一点のどれかを一文だけ足します。",
      actionLabel: "もう一文足すと進めます",
    };
  }
  if (hasMostlyUnreplacedScaffoldCopy(finalText, scaffoldText)) {
    return {
      ready: false,
      reason: "mostly_scaffold",
      title: "整理案が多く残っています",
      body: "元の記録に戻し、見た事実、自分の関わり、明日の一点のどれかを自分の言葉へ置き換えます。",
      actionLabel: "自分の言葉で直すと進めます",
    };
  }
  if (isDeletionOnlyEdit(finalText, scaffoldText)) {
    return {
      ready: false,
      reason: "deletion_only",
      title: "削っただけになっています",
      body: "短くするだけではなく、見た場面や考えた理由を自分の言葉で一文足します。",
      actionLabel: "一文足すと進めます",
    };
  }
  const newChars = countCharsNotInSource(finalText, scaffoldText);
  const changedChars = getBoundedEditDistance(finalText, scaffoldText, MIN_DRAFT_EDIT_CHARS);
  if (changedChars >= MIN_DRAFT_EDIT_CHARS) {
    return {
      ready: true,
      reason: "ready",
      title: "提出前チェックへ進めます",
      body: "整理案をもとに、自分の観察や気づきとして直されています。",
      actionLabel: "提出前チェックへ進む",
    };
  }
  const changedRatio = changedChars / Math.max(scaffoldText.length, 1);
  if (newChars >= MIN_DRAFT_NEW_CHARS && changedChars >= MIN_DRAFT_EDIT_CHARS_WITH_RATIO && changedRatio >= MIN_DRAFT_EDIT_RATIO) {
    return {
      ready: true,
      reason: "ready_with_added_words",
      title: "提出前チェックへ進めます",
      body: "整理案に、自分の観察や明日見る一点が足されています。",
      actionLabel: "提出前チェックへ進む",
    };
  }
  if (newChars < MIN_DRAFT_NEW_CHARS) {
    return {
      ready: false,
      reason: "few_new_words",
      title: "自分の言葉がまだ少ないです",
      body: "句読点や語尾だけではなく、今日見た場面、気づき、明日見る一点のどれかを一文で足します。",
      actionLabel: "一文足すと進めます",
    };
  }
  return {
    ready: false,
    reason: "small_edit",
    title: "直した量がまだ少ないです",
    body: "整理案の言い換えだけで止めず、元の記録にある場面や自分の関わりへ戻して直します。",
    actionLabel: "もう少し直すと進めます",
  };
}
