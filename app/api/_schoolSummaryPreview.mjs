export function buildSchoolSummaryInputPreview(input = {}) {
  const memoLength = getInputTextLength(input);
  const chatStage = input.stage === "episode"
    ? "会話: 出来事"
    : input.stage === "organize"
      ? "会話: 整理案"
      : "";
  const scene = input.scene ? "場面: メタあり" : "";
  const age = input.age ? "年齢: メタあり" : "";
  const flags =
    input.privacyFlags && typeof input.privacyFlags === "object"
      ? Object.entries(input.privacyFlags).filter(([, value]) => value)
      : [];
  return [chatStage, age, scene, `入力文字数: ${memoLength}`, flags.length ? `要確認: ${flags.length}件` : ""]
    .filter(Boolean)
    .join(" / ");
}

function getInputTextLength(input = {}) {
  const mainLength = firstNonNegativeNumber(input.memoLength, input.planMemoLength);
  if (mainLength !== null) return mainLength;

  const otherLength = sumNonNegativeNumbers(
    input.goalLength,
    input.reflectionLength,
    input.tomorrowTaskLength,
    input.feedbackReceivedLength,
    input.feedbackTomorrowActionLength,
    input.practiceGoalLength,
    input.episodeMemoLength,
    input.answerLength,
  );
  if (otherLength > 0) return otherLength;

  return [
    input.memo,
    input.planMemo,
    input.goal,
    input.reflection,
    input.tomorrowTask,
    input.feedbackReceived,
    input.feedbackTomorrowAction,
  ].reduce((total, value) => total + String(value || "").trim().length, 0);
}

function firstNonNegativeNumber(...values) {
  for (const value of values) {
    const number = toNonNegativeNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function sumNonNegativeNumbers(...values) {
  return values.reduce((total, value) => total + (toNonNegativeNumber(value) ?? 0), 0);
}

function toNonNegativeNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}
