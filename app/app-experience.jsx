"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collectPrivacyScanTextValues,
  createContactLabelPattern,
  createFamilyInfoPattern,
  createGuardianNamePattern,
  createJapaneseAddressPattern,
  createLikelyFullNamePattern,
  createMedicalInfoPattern,
  createPhonePattern,
  normalizePrivacyScanText,
} from "./privacyPatterns.js";
import {
  buildClassShareLessonPlans,
  buildClassShareThemes,
  buildSafeTeacherLogDisplays,
  buildTeacherStudentSummaries,
  getKindLabel,
  mergeClassShareThemes,
  mergeTeacherStudentsWithProcessSupport,
} from "./teacher-dashboard-model.mjs";
import {
  buildStudentChatDiaryStarterPatch,
  buildStudentDiaryFieldLabels,
  buildStudentDiaryRequirements,
  buildStudentFinalCheckRecoveryGuide,
  buildStudentRevisionChecklist,
  buildStudentRevisionOrder,
  buildStudentSelfReviewPrompts,
  buildStudentWritingCoach,
  getStudentChatOrganizationForComparison,
  getStudentDraftEditReadiness,
  hasStudentDiaryEpisodeContent,
  hasStudentWrittenText,
  isStudentChatSourceCurrent,
  mergeStudentChatDiaryStarterPatch,
  setStudentFieldScaffold,
} from "./student-diary-support.mjs";
import {
  buildPostPracticumSupportPackage,
  buildDemoContextKey,
  buildStudentProcessSwitchMarker,
  buildStudentProcessEvent,
  createDemoStudentId,
  isExpectedStudentProcessPersistenceSkipCode,
  mergeStudentProcessEvents,
  normalizeDemoStudentId,
  serializeStudentProcessEventsForStorage,
  STUDENT_PROCESS_EVENT_STORAGE_KEY,
  STUDENT_PROCESS_SWITCH_STORAGE_KEY,
} from "./student-process-events.mjs";

const ENABLE_LOG_EXPORTS = process.env.NEXT_PUBLIC_MANABI_ENABLE_LOG_EXPORTS === "true";
const ENABLE_STUDENT_PROCESS_PERSISTENCE = process.env.NEXT_PUBLIC_MANABI_ENABLE_STUDENT_PROCESS_PERSISTENCE === "true";
const ALLOW_STORED_DEMO_SESSION = process.env.NEXT_PUBLIC_MANABI_SHOW_DEMO_SHORTCUTS === "true";
const ACCESS_LOG_SURFACE = "teacher_preview";

const initialDiary = {
  date: "",
  weather: "晴れ",
  age: "3歳児クラス",
  scene: "朝の自由遊び",
  goal: "",
  goalReflection: "",
  episodes: [
    { id: "episode-1", title: "エピソード1", memo: "", insight: "" },
    { id: "episode-2", title: "エピソード2", memo: "", insight: "" },
  ],
  memo: "",
  reflection: "",
  overallLearning: "",
  tomorrowTask: "",
  nextAction: "",
};

const initialFeedback = {
  guidanceCategory: "",
  received: "",
  interpretation: "",
  unclear: "",
  tomorrowAction: "",
  teacherQuestion: "",
};

const COMMON_FULL_NAME_REDACTION_PATTERN = createLikelyFullNamePattern("g");
const COMMON_FULL_NAME_DETECTION_PATTERN = createLikelyFullNamePattern();
const PHONE_DETECTION_PATTERN = createPhonePattern();
const PHONE_REDACTION_PATTERN = createPhonePattern("g");
const CONTACT_LABEL_DETECTION_PATTERN = createContactLabelPattern("i");
const CONTACT_LABEL_REDACTION_PATTERN = createContactLabelPattern("gi");
const JAPANESE_ADDRESS_DETECTION_PATTERN = createJapaneseAddressPattern();
const JAPANESE_ADDRESS_REDACTION_PATTERN = createJapaneseAddressPattern("g");
const MEDICAL_INFO_DETECTION_PATTERN = createMedicalInfoPattern("i");
const MEDICAL_INFO_REDACTION_PATTERN = createMedicalInfoPattern("gi");
const FAMILY_INFO_DETECTION_PATTERN = createFamilyInfoPattern("i");
const FAMILY_INFO_REDACTION_PATTERN = createFamilyInfoPattern("gi");
const GUARDIAN_NAME_DETECTION_PATTERN = createGuardianNamePattern();
const GUARDIAN_NAME_REDACTION_PATTERN = createGuardianNamePattern("g");
const FACILITY_LABEL_SOURCE =
  "認定こども園名|こども園名|保育園名|保育所名|幼稚園名|ナーサリー名|キッズ園名|園名|実習先名|施設名";
const FACILITY_LABEL_PREFIX_SOURCE =
  "(?:実習先の|施設の|学校の|学校が指定する|学校指定の|指定する|各|該当の|対象の|日誌の|様式の|記入欄の|入力欄の|この|その|当該)?";
const FACILITY_LABEL_TOKEN_SOURCE = `${FACILITY_LABEL_PREFIX_SOURCE}(?:${FACILITY_LABEL_SOURCE})`;
const FACILITY_LABEL_QUALIFIER_SOURCE = "(?:(?:の)?(?:欄|項目)|の場合|場合)?";
const FACILITY_LABEL_PARTICLE_SOURCE = "(?:には|では|として|は|へ|に|を)";
const FACILITY_LABEL_SEPARATOR_SOURCE = "[:：=＝>＞→⇒\\-ー−–—・/／、,，;；|｜（(【「『\\[［《〈〔<＜{｛]";
const FACILITY_LABEL_BRACKET_OPEN_SOURCE = "[（(【「『\\[［《〈〔<＜{｛]";
const FACILITY_LABEL_BRACKET_CLOSE_SOURCE = "[）)】」』\\]］》〉〕>＞}｝]";
const FACILITY_LABELS = new Set(FACILITY_LABEL_SOURCE.split("|"));
const FACILITY_LABEL_PATTERN = new RegExp(`(?:${FACILITY_LABEL_SOURCE})`, "g");
const FACILITY_NAME_LIKE_PATTERN =
  /([一-龯ぁ-んァ-ンA-Za-z0-9０-９〇○々ヶヵー・]{1,30})[\s　\-ー−–—・/／]*(認定こども園|こども園|保育園|保育所|幼稚園|ナーサリー|キッズ園)名?/;
const FACILITY_NAME_REDACTION_PATTERN =
  /([一-龯ぁ-んァ-ンA-Za-z0-9０-９〇○々ヶヵー・]{1,30})[\s　\-ー−–—・/／]*(認定こども園|こども園|保育園|保育所|幼稚園|ナーサリー|キッズ園)名?/g;
const FACILITY_LABEL_VALUE_REDACTION_PATTERN = new RegExp(
  `(^|[\\s　、。,.：:【（(「『])(${FACILITY_LABEL_TOKEN_SOURCE})(?:${FACILITY_LABEL_QUALIFIER_SOURCE})(?:\\s*${FACILITY_LABEL_SEPARATOR_SOURCE}\\s*|\\s+)(?!(?:${FACILITY_LABEL_TOKEN_SOURCE})|(?:には|では|として|は|へ|を|に|と|や|及び|並びに|または|又は))([^、。\\n\\r】）)」』]{1,80})`,
  "g",
);
const FACILITY_LABEL_BRACKET_VALUE_REDACTION_PATTERN = new RegExp(
  `(^|[\\s　、。,.：:【（(「『])(${FACILITY_LABEL_TOKEN_SOURCE})(?:${FACILITY_LABEL_QUALIFIER_SOURCE})\\s*${FACILITY_LABEL_BRACKET_OPEN_SOURCE}\\s*([^）)】」』\\]］》〉〕>＞}｝\\n\\r]{1,40})\\s*${FACILITY_LABEL_BRACKET_CLOSE_SOURCE}[^。\\n\\r]{0,40}`,
  "g",
);
const FACILITY_LABEL_HA_VALUE_REDACTION_PATTERN = new RegExp(
  `(^|[\\s　、。,.：:【（(「『・/／\\-ー−–—])(${FACILITY_LABEL_TOKEN_SOURCE})(?:${FACILITY_LABEL_QUALIFIER_SOURCE})\\s*${FACILITY_LABEL_PARTICLE_SOURCE}\\s*([^。\\n\\r】）)」』]{1,80})`,
  "g",
);
const SAFE_FACILITY_LABEL_TAIL_PATTERN =
  /^(?:(?:入力しない|記入しない|記入不要|書かない|記載しない|載せない)(?:こと|でください|ようにする|してください|ようにしてください|ようお願いします|ようお願いいたします)?|避け(?:る|てください|ること|るようにする|るようにしてください|るようお願いします|るようお願いいたします)?|(?:確認|削除|省略|マスキング|匿名化)(?:する|してください|できている|できています|するようにしてください|するようお願いします|するようお願いいたします)?|(?:置き換え|置換)(?:る|する|てください)?|伏せ字(?:にする|で扱う|で残す)?|(?:安全な表現|安全な形|別の表現|匿名表現|置換済み表現|実習先園|担任職員|主任職員|学校の教員|A児|B児|C児|D児|E児)(?:(?:に|へ)(?:置き換え(?:る)?|置換する?|する|してください)|として(?:扱う|使う|残す)|で(?:扱う|使う|残す))?)(?:[、,]\s*(?:学生本人の言葉を残す|入力にない事実を補わない|記録にない事実を補わない|安全な表現に整える))*$/;
const SCHOOL_NAME_FLAG_PATTERN = /(保育園|保育所|幼稚園|認定こども園|こども園|ナーサリー|キッズ園|園名|実習先名|施設名)/;
const TEACHER_DISPLAY_EVALUATION_WORD = ["評価", "語"].join("");
const TEACHER_DISPLAY_EVALUATION_DIAGNOSIS = ["評価", "・診断"].join("");

const defaultSchoolFormat = {
  diaryHeadings: ["エピソードの整理", "気づきの確認", "表現の確認", "明日の観察", "教員への相談"],
  studentDiaryFieldLabels: {
    goalReflection: "その日の実習目標に対する振り返り",
    episodeMemo: "エピソード",
    episodeInsight: "エピソードから得た気づき",
    overallLearning: "保育者として大切にしなければならないことの気づき",
    nextAction: "次の日取り組みたいこと",
  },
  studentDiaryRequirements: {
    requiredFields: ["goalReflection", "episodeMemo", "episodeInsight", "overallLearning", "nextAction"],
    episodes: { initialCount: 2, requiredCount: 1, minCount: 1, maxCount: 4 },
  },
  planHeadings: ["活動概要", "ねらい", "環境構成", "展開と援助", "相談ポイント"],
  checkRules: ["個人名の置換・マスキング", "断定表現の確認", "未入力項目の明示", "保育所保育指針の観点", "学校の担当教員への相談点"],
  writingStyle: "学生が自分で書いた記録に対して、完成文ではなく問い返し・安全確認・相談点として返す。",
};

const STUDENT_NAV_ITEMS = [
  ["diary", "記録を書く"],
];

const STUDENT_FLOW_STEPS = [
  ["input", "記入", "学校フォーマット"],
  ["confirm", "安全確認", "表現を確認"],
  ["revise", "比較", "整理案と直す"],
  ["final", "提出前", "記録を確認"],
];

const FINAL_DRAFT_PLACEHOLDER = [
  "問い返しを見ながら、自分の言葉で提出前の記録を整えます。",
  "例：A児がブロックで電車を作っていた場面で、B児が近くで見ている姿があった。私は...",
].join("\n");

const CLIENT_FIELD_LABELS = {
  goal: "今日のねらい",
  memo: "学校フォーマット本文",
  reflection: "総合的な気づき",
  tomorrowTask: "次の日取り組みたいこと",
  feedbackReceived: "実習先で受けた助言",
  feedbackInterpretation: "助言への自分の理解",
  feedbackUnclear: "まだ分からないこと",
  feedbackTomorrowAction: "明日変えたい行動",
  feedbackTeacherQuestion: "学校の担当教員に相談したいこと",
};

const STAFF_NAV_ITEMS = [
  ["school", "実習後支援"],
];
const STAFF_VIEW_IDS = STAFF_NAV_ITEMS.map(([view]) => view);

const diarySamples = [
  {
    id: "thin-note",
    title: "自由遊びでの関わり",
    description: "子ども同士のやり取りと見守りを整理する",
    tags: ["安全な架空例", "自由遊び"],
    tone: "balanced",
    values: {
      weather: "晴れ",
      age: "3歳児クラス",
      scene: "朝の自由遊び",
      goal: "",
      memo: "自由遊びの時間に、A児がブロックで線路を作っていた。B児が近づいて同じブロックを使おうとすると、A児は「まだ使っている」と言ってブロックを手で押さえた。B児は少し離れて様子を見ていた。しばらくして、A児が余っているブロックをB児の近くに置くと、B児も線路の続きを作り始めた。",
      reflection: "最初は取り合いになると思ったが、A児は自分の遊びを守りながら、少しずつB児が入れる余地を作っていたように見えた。すぐに大人が間に入るより、子ども同士のやり取りを少し待つことも大切だと感じた。",
      tomorrowTask: "A児が他の子どもと遊びを共有するとき、どのようなタイミングで受け入れているかを見たい。大人が声をかける場合、どの場面まで待つとよいか教員に相談したい。",
    },
    feedback: {
      guidanceCategory: "見守り",
      received: "子どもが困っているように見えても、すぐに解決するのではなく、子ども同士でどう調整しているかを見る時間も大切と助言を受けた。",
      interpretation: "困りごとに見える場面でも、子ども同士で関係を調整している途中かもしれないと理解した。",
      unclear: "どの場面まで待ち、どの場面から声をかけるとよいかがまだ難しい。",
      tomorrowAction: "自由遊びで子ども同士のやり取りが起きた時、すぐに入らず、言葉、視線、物の渡し方を少し観察する。",
      teacherQuestion: "見守る時間と声をかけるタイミングを、実習中にどう判断すればよいか確認したい。",
    },
  },
  {
    id: "evaluation-words",
    title: "製作活動での声かけ",
    description: "手が止まった場面の見方を整理する",
    tags: ["安全な架空例", "製作"],
    tone: "deep",
    values: {
      weather: "くもり",
      age: "4歳児クラス",
      scene: "製作活動",
      goal: "道具を使って作る楽しさを味わう",
      memo: "製作活動で、A児が紙を丸く切ろうとしていた。はさみの向きを変えるところで手が止まり、何度か紙を持ち替えていた。近くの子どもが先に切り終えると、A児は少し焦った様子で紙を強く握った。声をかけると、A児は「丸くならない」と言っていた。",
      reflection: "できていない部分だけを見ると声をかけたくなるが、A児は自分で紙の向きを変えながら試していた。完成の形だけでなく、どこを工夫しようとしているかを見る必要があると思った。",
      tomorrowTask: "製作中に手が止まったとき、子どもが自分で試している時間なのか、助けを求めている時間なのかを見分けたい。声をかける前に見るポイントを教員に相談したい。",
    },
    feedback: {
      guidanceCategory: "観察",
      received: "うまくできたかだけでなく、どこを考えて手を動かしていたかを見ると、次の声かけが変わると助言を受けた。",
      interpretation: "完成したかどうかではなく、途中で試していたことを見る必要があると理解した。",
      unclear: "手が止まった時に、見守る方がよいのか、声をかける方がよいのか判断に迷う。",
      tomorrowAction: "製作中に手が止まった場面では、子どもの手の動き、表情、周りを見ている様子を先に記録する。",
      teacherQuestion: "声をかける前に見るポイントと、援助に入るタイミングを確認したい。",
    },
  },
  {
    id: "privacy-check",
    title: "名前を置き換える練習",
    description: "実名や愛称を安全な表現へ整える",
    tags: ["安全確認", "個人情報"],
    tone: "balanced",
    values: {
      weather: "雨",
      age: "2歳児クラス",
      scene: "食事",
      goal: "食事場面での子どもの姿と保育者の援助を観察する",
      memo: "子ども名1くんがスプーンを持ったまましばらく皿を見ていた。子ども名2ちゃんが隣から「これおいしいよ」と言った。私が「一口食べてみる？」と声をかけると、子ども名1くんは少し口に入れた。担任教員名1は近くで様子を見ていた。",
      reflection: "子ども名や職員名をそのまま書いてしまっているため、A児・B児・実習先の担任職員に置き換えてから記録したい。",
      tomorrowTask: "明日は、個人名を書かずに、食事場面での子どもの手の動き、言葉、保育者の見守りを記録する。",
    },
    feedback: {
      guidanceCategory: "安全配慮",
      received: "実習先指導員から、個人名や職員名は記録に残さず、A児・B児・担任職員のように置き換えるよう助言を受けた。",
      interpretation: "具体的な場面は書いてよいが、誰のことか分かる情報は残さない必要があると理解した。",
      unclear: "どこまで具体的に書くと個人が分かる情報になるのか、判断に迷う。",
      tomorrowAction: "食事場面では、名前ではなくA児・B児で記録し、場所や家庭事情につながる内容は書かない。",
      teacherQuestion: "A児・B児のような置き換えで十分な場面と、記録しない方がよい場面の違いを確認したい。",
    },
  },
  {
    id: "outdoor-play",
    title: "戸外遊びでの順番待ち",
    description: "言葉以外の伝え方と順番待ちを見る",
    tags: ["安全な架空例", "戸外"],
    tone: "balanced",
    values: {
      weather: "晴れ",
      age: "4歳児クラス",
      scene: "戸外遊び",
      goal: "戸外遊びでの友だち同士の関わりを観察する",
      memo: "戸外遊びで、砂場の道具を使っていたA児のそばにB児が来て、同じ道具を使いたいと言った。A児は道具を持ったまま黙っていた。B児は別の道具を探しに行ったが、何度かA児の方を見ていた。その後、A児が作っていた山が完成すると、A児は道具をB児の近くに置いた。",
      reflection: "A児は言葉では返していなかったが、遊びが終わった後に道具を渡す行動があった。B児もすぐに諦めたのではなく、様子を見ながら待っていた。順番を守る場面でも、子どもごとの待ち方や伝え方が違うと感じた。",
      tomorrowTask: "子どもが言葉で伝えない場面でも、表情や道具の置き方にどのような意味があるかを見たい。順番待ちの場面で、大人がどこまで言葉を補うとよいか教員に相談したい。",
    },
    feedback: {
      guidanceCategory: "声かけ",
      received: "言葉で言えていないから関われていない、と決めつけず、行動や視線から子どもなりの伝え方を見てみると助言を受けた。",
      interpretation: "言葉がない場面でも、視線や道具の置き方で伝えていることがあると理解した。",
      unclear: "順番待ちの場面で、どこまで子ども同士のやり取りを見守るか判断が難しい。",
      tomorrowAction: "戸外遊びでは、子どもの言葉だけでなく、視線、距離、道具の渡し方を記録する。",
      teacherQuestion: "順番待ちの場面で、大人が言葉を補うタイミングを確認したい。",
    },
  },
];

const demoReviewQueue = [
  {
    id: "thin-demo",
    generationId: "demo-log-1",
    title: "観察事実が少ない記録",
    tag: "追記促し",
    detail: "観察事実が少なく、学生本人への提出前の自己確認で追記を促す候補です。",
    handling: "student_self",
    handlingLabel: "学生本人",
    handlingDetail: "教員の個別確認ではなく、学生本人への提出前の自己確認で返す候補です。",
    studentId: "demo-student-1",
    studentName: "学生A",
    placementId: "demo-placement-a",
    createdAt: new Date().toISOString(),
  },
  {
    id: "risky-demo",
    generationId: "demo-log-2",
    title: "断定表現を含むメモ",
    tag: "表現確認",
    detail: "子どもへの決めつけや診断に近い表現が入力に含まれていた可能性があります。",
    handling: "class_share",
    handlingLabel: "授業共有",
    handlingDetail: "個別添削ではなく、授業内でまとめて扱う候補です。",
    studentId: "demo-student-2",
    studentName: "学生B",
    placementId: "demo-placement-b",
    createdAt: new Date().toISOString(),
  },
  {
    id: "completion-demo",
    generationId: "demo-log-2",
    title: "入力内容から確認できない事実の確認",
    tag: "補完疑い",
    detail: "学生メモに根拠がない発達効果や場面描写が含まれていないか確認する候補です。",
    handling: "teacher_now",
    handlingLabel: "教員確認",
    handlingDetail: "個人情報や重大な表現リスクとして、学校教員が提出後に確認する候補です。",
    studentId: "demo-student-2",
    studentName: "学生B",
    placementId: "demo-placement-b",
    createdAt: new Date().toISOString(),
  },
  {
    id: "privacy-demo",
    generationId: "demo-log-3",
    title: "個人情報の確認",
    tag: "置換確認",
    detail: "子ども名・職員名など、置き換え確認が必要な情報が含まれていた可能性があります。",
    handling: "teacher_now",
    handlingLabel: "教員確認",
    handlingDetail: "個人情報や重大な表現リスクとして、学校教員が提出後に確認する候補です。",
    studentId: "demo-student-3",
    studentName: "学生C",
    placementId: "demo-placement-b",
    createdAt: new Date().toISOString(),
  },
  {
    id: "guideline-demo",
    generationId: "demo-log-4",
    title: "指針とのつながり確認",
    tag: "指針確認",
    detail: "保育所保育指針や5領域とのつながりを、学生本人への問いに返しつつ、授業内で共有しやすい候補です。",
    handling: "class_share",
    handlingLabel: "授業共有",
    handlingDetail: "個別添削ではなく、授業内で観察を見直す観点として扱う候補です。",
    studentId: "demo-student-4",
    studentName: "学生D",
    placementId: "demo-placement-a",
    createdAt: new Date().toISOString(),
  },
];

const demoRecentLogs = [
  {
    id: "demo-log-1",
    kind: "diary",
    provider: "claude",
    model: "demo",
    createdAt: new Date().toISOString(),
    studentId: "demo-student-1",
    studentName: "学生A",
    className: "保育実習I / 2年A組",
    placementId: "demo-placement-a",
    inputPreview: "ブロックで遊んでいた子がいた。私も一緒に遊んだ。",
    outputPreview: "入力された範囲で分かる事実と、学生本人が追記すべき問いを分ける。",
    sections: [
      { heading: "子どもの姿", body: "ブロックで遊ぶ子どもの姿が記録されている。具体的に何を作っていたか、周囲の子どもとの関わりは未記入である。" },
      { heading: "明日に向けて", body: "明日は遊びの内容や子どもの言葉を記録し、関わりの前後でどのような姿が見られたかを確認したい。" },
    ],
    checks: ["遊びの具体的な様子は記録できていますか。", "実習生がどのように関わったか追記できますか。"],
    checkCount: 2,
    reviewTags: ["追記促し"],
  },
  {
    id: "demo-log-2",
    kind: "diary",
    provider: "claude",
    model: "demo",
    createdAt: new Date().toISOString(),
    studentId: "demo-student-2",
    studentName: "学生B",
    className: "保育実習I / 2年A組",
    placementId: "demo-placement-b",
    inputPreview: "片付けの時間に席を立つ子がいて、声をかけた。うまくいったと思う。",
    outputPreview: "実習生の関わりの意図と、実際に見られた子どもの姿を分けて問い返す。",
    sections: [
      { heading: "援助の振り返り", body: "声をかけたことは記録されているが、声かけの内容や、その後に見られた子どもの姿は未記入である。" },
      { heading: "明日に向けて", body: "切り替え場面で、子どもが見通しをもてる関わりになっていたかを学校の担当教員に確認したい。" },
    ],
    checks: ["声かけの具体的な内容は記録できていますか。", "子どもの反応を断定せず、姿として書けていますか。", "保育所保育指針や5領域の観点と、実際に見た姿はつながっていますか。"],
    checkCount: 3,
    reviewTags: ["確認多め", "指針確認"],
  },
  {
    id: "demo-log-3",
    kind: "diary",
    provider: "claude",
    model: "demo",
    createdAt: new Date().toISOString(),
    studentId: "demo-student-3",
    studentName: "学生C",
    className: "保育実習I / 2年A組",
    placementId: "demo-placement-b",
    inputPreview: "子ども名1くんがスプーンを持ったまま皿を見ていた。担任教員名1は近くで様子を見ていた。",
    outputPreview: "個人名をA児・実習先の担任教員へ置き換えた上で、食事場面の観察事実と確認点を分ける。",
    sections: [
      { heading: "子どもの姿", body: "A児がスプーンを持ったまま皿を見ていた姿が記録されている。食べた量や表情、周囲の声かけは入力にないため、本文では補わない。" },
      { heading: "提出前確認", body: "子ども名と職員名はA児・実習先の担任教員へ置換し、食事場面で実習先の担任教員がどのように見守っていたかは、記録できた範囲で追記したい。" },
    ],
    checks: ["子ども名・職員名はA児・実習先の担任教員などへ置換できていますか。", "食事量や子どもの気持ちを入力にないまま補っていませんか。"],
    checkCount: 2,
    reviewTags: ["置換確認"],
  },
  {
    id: "demo-log-4",
    kind: "diary",
    provider: "claude",
    model: "demo",
    createdAt: new Date().toISOString(),
    studentId: "demo-student-4",
    studentName: "学生D",
    className: "保育実習I / 2年A組",
    placementId: "demo-placement-a",
    inputPreview: "戸外で友だちの使っていた縄跳びを見ていた子がいた。私は『やってみる？』と声をかけた。",
    outputPreview: "見た姿と声かけを分け、5領域とのつながりは本文の水増しではなく提出前の問いとして残す。",
    sections: [
      { heading: "子どもの姿", body: "戸外で友だちが使っていた縄跳びを見る子どもの姿が記録されている。実際に跳んだか、友だちとのやりとりがあったかは未記入である。" },
      { heading: "考察", body: "運動への関心や友だちの姿への気づきと関係する可能性はあるが、入力だけでは断定できない。健康や人間関係の観点で、明日どの姿を観察するか考えたい。" },
    ],
    checks: ["5領域に結びつける根拠となる姿は記録できていますか。", "『興味をもった』など内面の断定になっていないか確認しましょう。"],
    checkCount: 2,
    reviewTags: ["指針確認"],
  },
];

const demoCheckSummary = [
  { tag: "追記促し", count: 4 },
  { tag: "確認多め", count: 3 },
  { tag: "表現確認", count: 2, studentCount: 1 },
  { tag: "置換確認", count: 1 },
  { tag: "補完疑い", count: 1 },
  { tag: "指針確認", count: 2, studentCount: 2 },
];

const demoStudentUsage = [
  { id: "demo-student-1", name: "学生A", email: "student@example.ac.jp", generations: 4, diary: 4, plan: 0, reviewCandidates: 2, latestAt: new Date().toISOString() },
  { id: "demo-student-2", name: "学生B", email: "student2@example.ac.jp", generations: 2, diary: 2, plan: 0, reviewCandidates: 1, latestAt: new Date().toISOString() },
  { id: "demo-student-3", name: "学生C", email: "student3@example.ac.jp", generations: 1, diary: 1, plan: 0, reviewCandidates: 1, latestAt: new Date().toISOString() },
  { id: "demo-student-4", name: "学生D", email: "student4@example.ac.jp", generations: 1, diary: 1, plan: 0, reviewCandidates: 1, latestAt: new Date().toISOString() },
];

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeMultiline(value) {
  return normalizePrivacyScanText(value).replace(/\r\n/g, "\n").trim().replace(/\n{3,}/g, "\n\n");
}

function createInitialDiary(date = "", schoolFormat = defaultSchoolFormat) {
  const { initialCount } = buildStudentDiaryRequirements(schoolFormat).episodes;
  return {
    ...initialDiary,
    date,
    episodes: Array.from({ length: initialCount }, (_, index) => (
      initialDiary.episodes[index]
        ? { ...initialDiary.episodes[index] }
        : createDiaryEpisode(index + 1)
    )),
  };
}

function createDiaryEpisode(index, overrides = {}) {
  const safeIndex = Math.max(1, Number(index) || 1);
  return {
    id: overrides.id || `episode-${safeIndex}`,
    title: overrides.title || `エピソード${safeIndex}`,
    memo: overrides.memo || "",
    insight: overrides.insight || "",
  };
}

function normalizeDiaryEpisodes(episodes, fallbackMemo = "", fallbackInsight = "", fallbackCount = 2) {
  const source = Array.isArray(episodes) ? episodes : [];
  const normalized = source
    .map((episode, index) => createDiaryEpisode(index + 1, {
      id: String(episode?.id || `episode-${index + 1}`),
      title: normalizePrivacyScanText(episode?.title || `エピソード${index + 1}`).trim(),
      memo: normalizeMultiline(episode?.memo),
      insight: normalizeMultiline(episode?.insight),
    }))
    .filter((episode) => episode.title || episode.memo || episode.insight);

  if (normalized.length > 0) return normalized;

  const safeFallbackCount = Math.max(1, Math.min(8, Number(fallbackCount) || 2));
  return Array.from({ length: safeFallbackCount }, (_, index) => createDiaryEpisode(index + 1, {
    memo: index === 0 ? normalizeMultiline(fallbackMemo) : "",
    insight: index === 0 ? normalizeMultiline(fallbackInsight) : "",
  }));
}

function buildDiaryMemoText(diary = {}, schoolFormat = defaultSchoolFormat) {
  const episodes = normalizeDiaryEpisodes(diary.episodes, diary.memo, diary.reflection);
  const fieldLabels = buildStudentDiaryFieldLabels(schoolFormat);
  const blocks = [];
  const goalReflection = normalizeMultiline(diary.goalReflection);
  const overallLearning = normalizeMultiline(diary.overallLearning);
  const nextAction = normalizeMultiline(diary.nextAction);

  if (goalReflection) {
    blocks.push(`【${fieldLabels.goalReflection}】\n${goalReflection}`);
  }

  for (const [index, episode] of episodes.entries()) {
    const memo = normalizeMultiline(episode.memo);
    const insight = normalizeMultiline(episode.insight);
    if (!memo && !insight) continue;
    blocks.push([
      `【${fieldLabels.episodeMemo}${index + 1}】`,
      memo,
      insight ? `${fieldLabels.episodeInsight}: ${insight}` : "",
    ].filter(Boolean).join("\n"));
  }

  if (overallLearning) {
    blocks.push(`【${fieldLabels.overallLearning}】\n${overallLearning}`);
  }

  if (nextAction) {
    blocks.push(`【${fieldLabels.nextAction}】\n${nextAction}`);
  }

  return blocks.join("\n\n").trim() || normalizeMultiline(diary.memo);
}

function buildDiaryReflectionText(diary = {}) {
  return normalizeMultiline(diary.overallLearning) || normalizeMultiline(diary.reflection);
}

function buildDiaryTomorrowText(diary = {}) {
  return normalizeMultiline(diary.nextAction) || normalizeMultiline(diary.tomorrowTask);
}

function hasMeaningfulText(value) {
  const signalChars = normalizePrivacyScanText(value).match(/[一-龯ぁ-んァ-ンA-Za-z0-9０-９]/g) || [];
  return signalChars.length >= 2;
}

function hasStudentAuthoredText(value) {
  return hasStudentWrittenText(value);
}

function buildStudentMinimumPathItems(diary = {}, schoolFormat = {}) {
  const coach = buildStudentWritingCoach(diary, {}, schoolFormat);
  const missingTargets = new Set(safeRecordList(coach.safetyCheckBlockers).map((item) => item.target));
  const coachItems = safeRecordList(coach.items);
  const episodeMemoItem = coachItems.find((item) => item.id === "episode-memo");
  const insightItem = coachItems.find((item) => item.id === "episode-insight");
  const overallLearningItem = coachItems.find((item) => item.id === "overall-learning");
  const nextActionItem = coachItems.find((item) => item.id === "next-action");
  const insightDoneByEpisode = Boolean(insightItem?.done);
  const insightDoneByOverall = !insightDoneByEpisode && Boolean(overallLearningItem?.done);
  const insightTarget = insightDoneByOverall ? overallLearningItem.target : insightItem?.target || "episodeInsight";
  const insightFormatLabel = insightDoneByOverall ? overallLearningItem?.formatLabel : insightItem?.formatLabel;
  const insightBody = insightDoneByOverall
    ? "総合的な気づきに書いたことを確認する"
    : insightDoneByEpisode
      ? "その場面から感じたことを確認する"
      : "その場面から感じたことを一つ書く";
  return [
    {
      label: "一場面",
      title: "見たこと",
      body: "子どもの姿と自分の関わりを一つ書く",
      formatLabel: episodeMemoItem?.formatLabel,
      target: "episodeMemo",
      done: !missingTargets.has("episodeMemo"),
    },
    {
      label: "一つの気づき",
      title: "考えたこと",
      body: insightBody,
      formatLabel: insightFormatLabel,
      target: insightTarget,
      done: !missingTargets.has("episodeInsight"),
    },
    {
      label: "明日の一点",
      title: "次に見ること",
      body: "明日見ること、試すことを一つ書く",
      formatLabel: nextActionItem?.formatLabel,
      target: "nextAction",
      done: !missingTargets.has("nextAction"),
    },
  ];
}

function hasMinimumStudentDiaryInput(diary = {}, feedback = {}, schoolFormat = {}) {
  return buildStudentWritingCoach(diary, feedback, schoolFormat).readyForSafetyCheck;
}

function buildDiaryGenerationPayload(diary, feedback, tone, schoolFormat = defaultSchoolFormat) {
  const fieldLabels = buildStudentDiaryFieldLabels(schoolFormat);
  const memo = buildDiaryMemoText(diary, schoolFormat);
  const reflection = buildDiaryReflectionText(diary);
  const tomorrowTask = buildDiaryTomorrowText(diary);
  return {
    ...diary,
    goal: normalizeMultiline(diary.goal),
    memo,
    reflection,
    tomorrowTask,
    feedbackGuidanceCategory: normalizeMultiline(feedback.guidanceCategory),
    feedbackReceived: normalizeMultiline(feedback.received),
    feedbackInterpretation: normalizeMultiline(feedback.interpretation),
    feedbackUnclear: normalizeMultiline(feedback.unclear),
    feedbackTomorrowAction: normalizeMultiline(feedback.tomorrowAction),
    feedbackTeacherQuestion: normalizeMultiline(feedback.teacherQuestion),
    studentDiaryFieldLabels: fieldLabels,
    tone,
  };
}

function getSavedFeedbackRecords(key) {
  try {
    const records = JSON.parse(localStorage.getItem(key) || "[]");
    return safeRecordList(records);
  } catch {
    return [];
  }
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

const APP_LOCAL_STORAGE_KEYS = [
  "manabi-session",
  "manabi-demo-session",
  "manabi-diary-feedback",
  "manabi-generation-logs",
  STUDENT_PROCESS_EVENT_STORAGE_KEY,
  STUDENT_PROCESS_SWITCH_STORAGE_KEY,
];

function clearAppLocalStorage({ preserveStudentProcessEvents = false } = {}) {
  try {
    for (const key of APP_LOCAL_STORAGE_KEYS) {
      if (preserveStudentProcessEvents && key === STUDENT_PROCESS_EVENT_STORAGE_KEY) continue;
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage may be unavailable in hardened browser settings.
  }
}

function saveStudentProcessSwitch(session) {
  const marker = buildStudentProcessSwitchMarker(session);
  if (!marker) return;
  safeSetLocalStorage(STUDENT_PROCESS_SWITCH_STORAGE_KEY, JSON.stringify(marker));
}

function csvCell(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const neutralized = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

function removeInternalAiFields(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(removeInternalAiFields);

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["provider", "model", "source", "subscription"].includes(key))
      .map(([key, item]) => [key, removeInternalAiFields(item)]),
  );
}

function safeExportSession(session) {
  if (!session || typeof session !== "object") return {};
  return {
    role: safeCopyText(session.role, 40),
    roleLabel: safeCopyText(session.roleLabel, 40),
  };
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function safeRecordList(value) {
  return safeList(value).filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

function buildPublicDemoSession(role = "student") {
  const safeRole = role === "teacher" ? "teacher" : "student";
  return {
    source: "demo",
    role: safeRole,
    roleLabel: safeRole === "teacher" ? "教員" : "学生",
    name: safeRole === "teacher" ? "実習担当教員" : "実習生",
    email: safeRole === "teacher" ? "teacher@example.ac.jp" : "student@example.ac.jp",
    demoStudentId: safeRole === "student" ? "public-demo-student" : "",
    schoolName: "さくら保育者養成校",
    className: "保育実習I / 2年A組",
    schoolFormat: defaultSchoolFormat,
    signedInAt: new Date().toISOString(),
  };
}

function normalizePublicDemoReturnHref(value) {
  const text = String(value || "").trim();
  if (text === "/demo" || text.startsWith("/demo/")) return text;
  return "/demo";
}

function normalizeStoredDemoSession(session) {
  if (!session || typeof session !== "object" || Array.isArray(session)) return null;
  if (session.source !== "demo") return null;
  const role = session.role === "teacher" ? "teacher" : session.role === "student" ? "student" : null;
  if (!role) return null;
  const demoStudentId = role === "student"
    ? normalizeDemoStudentId(session.demoStudentId, createDemoStudentId())
    : "";
  return {
    source: "demo",
    role,
    roleLabel: role === "teacher" ? "教員" : "学生",
    name: safeCopyText(session.name || (role === "teacher" ? "実習担当教員" : "実習生"), 80),
    email: safeCopyText(session.email || "", 120),
    demoStudentId: safeCopyText(demoStudentId, 120),
    studentProcessContextKey: buildDemoContextKey(session),
    schoolName: safeCopyText(session.schoolName || "", 120),
    className: safeCopyText(session.className || "", 120),
    schoolFormat: normalizeClientTemplate(session.schoolFormat || defaultSchoolFormat),
    signedInAt: safeCopyText(session.signedInAt || "", 80),
  };
}

function buildInputSummary(input = {}, existingSummary = {}) {
  const safeExisting = safeExistingInputSummary(existingSummary);
  if (!input || typeof input !== "object" || Array.isArray(input)) return safeExisting;
  return {
    ...safeExisting,
    preview: safeExisting.preview,
    date: safeCopyText(input.date, 30),
    age: safeCopyText(input.age, 40),
    scene: safeCopyText(input.scene, 80),
    tone: safeCopyText(input.tone, 30),
    goalLength: textLength(input.goal),
    memoLength: textLength(input.memo),
    reflectionLength: textLength(input.reflection),
    tomorrowTaskLength: textLength(input.tomorrowTask),
    feedbackReceivedLength: textLength(input.feedbackReceived),
    feedbackTomorrowActionLength: textLength(input.feedbackTomorrowAction),
    privacyFlags: buildClientPrivacyFlags(input),
  };
}

function safeExistingInputSummary(summary = {}) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return {};
  return {
    preview: safeCopyText(summary.preview, 180),
    date: safeCopyText(summary.date, 30),
    age: safeCopyText(summary.age, 40),
    scene: safeCopyText(summary.scene, 80),
    tone: safeCopyText(summary.tone, 30),
    goalLength: Number.isFinite(summary.goalLength) ? summary.goalLength : 0,
    memoLength: Number.isFinite(summary.memoLength) ? summary.memoLength : 0,
    reflectionLength: Number.isFinite(summary.reflectionLength) ? summary.reflectionLength : 0,
    tomorrowTaskLength: Number.isFinite(summary.tomorrowTaskLength) ? summary.tomorrowTaskLength : 0,
    feedbackReceivedLength: Number.isFinite(summary.feedbackReceivedLength) ? summary.feedbackReceivedLength : 0,
    feedbackTomorrowActionLength: Number.isFinite(summary.feedbackTomorrowActionLength) ? summary.feedbackTomorrowActionLength : 0,
    privacyFlags: sanitizePrivacyFlags(summary.privacyFlags),
  };
}

function sanitizePrivacyFlags(flags = {}) {
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) return {};
  return {
    hasChildNameLikeText: Boolean(flags.hasChildNameLikeText),
    hasSchoolNameLikeText: Boolean(flags.hasSchoolNameLikeText),
    hasMedicalOrFamilyInfo: Boolean(flags.hasMedicalOrFamilyInfo),
    hasContactInfo: Boolean(flags.hasContactInfo),
    hasPromptInstructionLikeText: Boolean(flags.hasPromptInstructionLikeText),
    hasLikelyFullName: Boolean(flags.hasLikelyFullName),
    hasPhoneLikeText: Boolean(flags.hasPhoneLikeText),
    hasEmailLikeText: Boolean(flags.hasEmailLikeText),
    hasIdentifierLikeText: Boolean(flags.hasIdentifierLikeText),
    hasSensitiveContext: Boolean(flags.hasSensitiveContext),
    hasAllowedAnonymizedText: Boolean(flags.hasAllowedAnonymizedText),
  };
}

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

function redactFacilityName(raw, name, facility) {
  const compact = `${name}${facility}${raw.endsWith("名") ? "名" : ""}`;
  return FACILITY_LABELS.has(compact) || isAbstractFacilityReference(raw) ? raw : "〈園名〉";
}

function redactFacilityLabelValue(raw, prefix = "", _label = "", tail = "") {
  return isSafeAbstractFacilityLabelRule(tail) ? raw : `${prefix}〈園名〉`;
}

function isAbstractFacilityReference(value) {
  const remainder = String(value || "")
    .replace(FACILITY_LABEL_PATTERN, "")
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
    .replace(FACILITY_LABEL_PATTERN, "")
    .replace(/^[\s　\-ー−–—・/／、,とや及び並びにまたは又は]+/g, "")
    .trim();
  if (abstractLabelRuleTail.startsWith("は")) {
    return isSafeFacilityLabelTail(abstractLabelRuleTail.replace(/^は\s*/, ""));
  }
  const withoutAbstractLabels = text.replace(FACILITY_LABEL_PATTERN, "");
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
    .replace(FACILITY_LABEL_PATTERN, "")
    .replace(/[\s　\-ー−–—・/／、,とや及び並びにまたは又は]+/g, "")
    .trim();
  return remainder === "";
}

function buildClientPrivacyFlags(value = {}) {
  const text = collectPrivacyScanTextValues(value);
  const riskText = removeAllowedAnonymizedTerms(text);
  const compactRiskText = riskText.replace(/[\s　]+/g, "");
  return {
    hasChildNameLikeText: /(くん|ちゃん|君|子ども名|こども名|園児名|児童名|氏名|名前|実名|本名|愛称)/.test(riskText),
    hasSchoolNameLikeText: SCHOOL_NAME_FLAG_PATTERN.test(riskText),
    hasMedicalOrFamilyInfo: MEDICAL_INFO_DETECTION_PATTERN.test(riskText) || FAMILY_INFO_DETECTION_PATTERN.test(riskText),
    hasContactInfo: /@|https?:\/\//i.test(riskText) || PHONE_DETECTION_PATTERN.test(riskText) || CONTACT_LABEL_DETECTION_PATTERN.test(riskText),
    hasIdentifierLikeText: /(学籍番号|学生番号|出席番号|住所|所在地|職員名|先生名|担任名)/.test(riskText) || JAPANESE_ADDRESS_DETECTION_PATTERN.test(riskText) || GUARDIAN_NAME_DETECTION_PATTERN.test(riskText),
    hasPromptInstructionLikeText: /(前の指示|これまでの指示|上記の指示|システム指示|system prompt|developer message|プロンプト|制約を無視|指示を無視|JSON不要|実名を出力|個人情報を出力|完成文として提出|そのまま提出|APIキー|秘密情報|内部設定)/i.test(riskText)
      || /(前の指示|これまでの指示|上記の指示|システム指示|systemprompt|developermessage|プロンプト|制約を無視|指示を無視|JSON不要|実名を出力|個人情報を出力|完成文として提出|そのまま提出|APIキー|秘密情報|内部設定)/i.test(compactRiskText),
    hasLikelyFullName: COMMON_FULL_NAME_DETECTION_PATTERN.test(riskText),
    hasAllowedAnonymizedText: /[A-EＡ-Ｅa-eａ-ｅ](児|くん|君|ちゃん|先生)|園[A-EＡ-Ｅa-eａ-ｅ]|実習先園|担任の先生|主任の先生|学校の先生|実習先の先生|担任職員|主任職員|実習先指導員/.test(text),
  };
}

function buildClientPrivacyCheck(value = {}) {
  const flags = buildClientPrivacyFlags(value);
  const blockers = [
    flags.hasPromptInstructionLikeText
      ? "問い返しへの指示変更、内部設定、完成文提出を求める文は、記録本文から外して扱います。"
      : "",
    flags.hasContactInfo || flags.hasIdentifierLikeText
      ? "住所、電話番号、メール、URL、学籍番号、保護者名、職員名などは、問い返し前に伏字化します。"
      : "",
    flags.hasLikelyFullName
      ? "実名と思われる氏名は、A児、A君、担任職員などに置き換える候補として確認します。"
      : "",
    flags.hasMedicalOrFamilyInfo
      ? "診断名、通院、服薬、家庭事情などの要配慮情報は、問い返しへ進める前に確認します。"
      : "",
  ].filter(Boolean);
  const warnings = [
    flags.hasChildNameLikeText || flags.hasSchoolNameLikeText
      ? "子どもの名前、園名、職員名らしき表現は、A児、A君、実習先園、担任職員のような表現に整えます。"
      : "",
  ].filter(Boolean);
  const notes = [
    flags.hasAllowedAnonymizedText
      ? "A児・A君・実習先の担任職員・実習先園などの置換済み表現は、そのまま使えます。"
      : "",
  ].filter(Boolean);
  return { flags, blockers, warnings, notes };
}

function safeCopyText(value, maxLength = 280) {
  const text = normalizePrivacyScanText(value).replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  return redactSensitiveText(text).slice(0, maxLength);
}

function normalizeTeacherVisibleText(value, maxLength = 280) {
  return safeCopyText(value, maxLength)
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

function isTeacherAnonymousStudentLabel(value) {
  return /^学生[A-ZＡ-Ｚ0-9０-９]+$/.test(safeCopyText(value, 80));
}

function buildTeacherAnonymousStudentLabel(seed = "", fallbackIndex = 0) {
  const text = safeCopyText(seed, 120);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (!text) return `学生${alphabet[Math.max(0, fallbackIndex) % alphabet.length]}`;
  const hash = Array.from(text).reduce((total, char) => total + char.charCodeAt(0), 0);
  const index = Math.abs(hash) % alphabet.length;
  return `学生${alphabet[index]}`;
}

function normalizeTeacherStudentDisplayName(rawName, seed = "", fallbackIndex = 0) {
  const name = safeCopyText(rawName, 80);
  if (isTeacherAnonymousStudentLabel(name)) return name;
  return buildTeacherAnonymousStudentLabel(seed || rawName, fallbackIndex);
}

function normalizeTeacherReviewQueueItem(item = {}) {
  return {
    ...item,
    title: normalizeTeacherVisibleText(item.title || item.tag || "確認候補", 100),
    tag: normalizeTeacherVisibleText(item.tag || "", 80),
    detail: normalizeTeacherVisibleText(item.detail || "", 240),
    handlingDetail: normalizeTeacherVisibleText(item.handlingDetail || "", 220),
    studentName: normalizeTeacherStudentDisplayName(
      item.studentName,
      item.studentId || item.userId || item.generationId || item.id,
    ),
  };
}

function normalizeDisplayList(value, fallback = [], count = null, maxLength = 420) {
  const list = safeList(value);
  const size = count ?? Math.max(list.length, fallback.length);
  return Array.from({ length: size }, (_, index) => {
    const primary = safeCopyText(list[index] ?? "", maxLength);
    return primary || safeCopyText(fallback[index] ?? "", maxLength);
  }).filter(Boolean);
}

function normalizeResultSections(result = {}) {
  const fallbackSections = Array(5).fill("入力内容を確認し、実際の記録に合わせて追記してください。");
  const headings = normalizeDisplayList(result?.headings, defaultSchoolFormat.diaryHeadings, 5, 80);
  const sections = normalizeDisplayList(result?.sections, fallbackSections, 5, 520);
  return sections.map((body, index) => ({
    heading: headings[index] || defaultSchoolFormat.diaryHeadings[index] || "確認",
    body,
  }));
}

function normalizeResultChecks(result = {}) {
  const fallback = ["入力にない事実を補っていないか確認しましょう。", "個人名や特定につながる情報が残っていないか確認しましょう。", "担当の教員に確認したい点を整理できていますか。"];
  return normalizeDisplayList(result?.checks, fallback, null, 220).slice(0, 5);
}

function canUseFinalDraftAfterCheck(review, checkedText, sanitizedText) {
  if (!review || review.blocked) return false;
  if (review.status !== "clear") return false;
  if (safeRecordList(review.findings).length > 0) return false;
  if (review.changed) return false;
  return checkedText === sanitizedText;
}

function summarizeForDraft(value, maxLength = 260, preferredHeading = "") {
  const text = safeCopyText(value, Math.max(maxLength * 3, maxLength)).replace(/\n{2,}/g, "\n");
  if (!text) return "";
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const isHeadingLine = (line) => /^【[^】]+】$/.test(line);
  if (preferredHeading) {
    const headingIndex = lines.findIndex((line) => line.startsWith(`【${preferredHeading}`));
    const preferredLine = headingIndex >= 0
      ? lines.slice(headingIndex + 1).find((line) => !isHeadingLine(line))
      : "";
    if (preferredLine) return preferredLine.slice(0, maxLength);
  }
  const firstContentLine = lines.find((line) => !isHeadingLine(line));
  return (firstContentLine || lines[0] || text).slice(0, maxLength);
}

function buildDiarySourceText(payload = {}) {
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const rows = [
    ["今日のねらい", source.goal],
    ["記録本文", source.memo],
    ["自分で考えたこと", source.reflection],
    ["明日見たいこと・相談したいこと", source.tomorrowTask],
  ].filter(([, value]) => typeof value === "string" && value.trim());

  if (!rows.length) return "";
  return rows.map(([label, value]) => `【${label}】\n${safeCopyText(value, 1600)}`).join("\n\n");
}

function buildDiaryScaffoldDraft(payload = {}, result = {}, feedbackNextSteps = {}) {
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const episodes = Array.isArray(source.episodes) ? normalizeDiaryEpisodes(source.episodes) : [];
  const goal = summarizeForDraft(source.goal, 220);
  const goalReflection = summarizeForDraft(source.goalReflection, 360);
  const episodeMemo = episodes
    .map((episode, index) => {
      const memo = summarizeForDraft(episode.memo, 360);
      const insight = summarizeForDraft(episode.insight, 260);
      if (!memo && !insight) return "";
      return [
        `エピソード${index + 1}`,
        memo,
        insight ? `気づき: ${insight}` : "",
      ].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n") || summarizeForDraft(source.memo, 520, "エピソード");
  const reflection = summarizeForDraft(source.overallLearning, 420) || summarizeForDraft(source.reflection, 420);
  const tomorrowTask = summarizeForDraft(source.nextAction, 360) || summarizeForDraft(source.tomorrowTask, 360);
  const resultChecks = normalizeResultChecks(result).slice(0, 3);
  const feedbackFocus = feedbackNextSteps?.hasContent ? feedbackNextSteps.focus : "";
  const fieldLabels = buildStudentDiaryFieldLabels({ studentDiaryFieldLabels: source.studentDiaryFieldLabels });

  return [
    `【${fieldLabels.goalReflection}】`,
    goalReflection
      ? goalReflection
      : goal
      ? `今日の実習目標「${goal}」について、実際に見た子どもの姿と自分の関わりを照らして振り返る。`
      : "今日の実習目標に対して、どの場面を見て何を学んだのかを一文で入れる。",
    "",
    `【${fieldLabels.episodeMemo}】`,
    episodeMemo || "見た場面、子どもの言葉や行動、自分の関わりをここに入れる。",
    reflection
      ? `${reflection}\nその根拠になる姿を、もう一つ具体的に追記する。`
      : "この場面から何を感じたか、なぜそう考えたかを自分の言葉で追記する。",
    "",
    `【${fieldLabels.overallLearning}】`,
    reflection
      ? `${reflection}\n保育者の関わりや環境構成とのつながりを、自分の言葉で整理する。`
      : "複数のエピソードを通して、保育者として大切だと感じたことをまとめる。",
    "",
    `【${fieldLabels.nextAction}】`,
    tomorrowTask || "明日、何を見たいか、どの関わりを試したいか、担当教員に相談したいことを一つに絞る。",
    feedbackFocus ? `実習先で受けた助言は「${feedbackFocus}」として、翌日の観察に戻す。` : "",
    "",
    "【提出前に自分で直すこと】",
    ...(resultChecks.length ? resultChecks.map((check) => `・${check}`) : ["・入力にない事実を足していないか確認する。"]),
  ].filter((line) => line !== null && line !== undefined).join("\n");
}

function redactSensitiveText(text) {
  let next = normalizePrivacyScanText(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "〈メールアドレス〉")
    .replace(PHONE_REDACTION_PATTERN, "〈電話番号〉")
    .replace(CONTACT_LABEL_REDACTION_PATTERN, "〈連絡先〉")
    .replace(/https?:\/\/[^\s]+/g, "〈URL〉")
    .replace(JAPANESE_ADDRESS_REDACTION_PATTERN, "〈住所等〉")
    .replace(/(氏名|名前|実名|本名|園児名|児童名|保護者名)[:：]\s*[^\s、。]{1,30}/g, "〈氏名〉")
    .replace(GUARDIAN_NAME_REDACTION_PATTERN, "〈保護者名〉")
    .replace(/(学籍番号|学生番号|出席番号)[:：]?\s*[A-Za-z0-9\-ー−]{2,40}/g, "〈識別番号〉")
    .replace(FACILITY_NAME_REDACTION_PATTERN, redactFacilityName)
    .replace(FACILITY_LABEL_BRACKET_VALUE_REDACTION_PATTERN, redactFacilityLabelValue)
    .replace(FACILITY_LABEL_VALUE_REDACTION_PATTERN, redactFacilityLabelValue)
    .replace(FACILITY_LABEL_HA_VALUE_REDACTION_PATTERN, redactFacilityLabelValue)
    .replace(MEDICAL_INFO_REDACTION_PATTERN, "〈診断名等〉")
    .replace(FAMILY_INFO_REDACTION_PATTERN, "〈配慮情報〉")
    .replace(/(担任教員名|担任名|職員名|保育者名|先生名)[:：]?\s*[^\s、。]{0,30}/g, "担任職員");
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
  return next.replace(/([一-龯ぁ-んァ-ンA-Za-z0-9０-９]{1,18})(先生)/g, (raw, name) => {
    const normalizedAnonymous = normalizePossiblyAnonymizedTeacherReference(raw, name);
    if (normalizedAnonymous) return normalizedAnonymous;
    return "担任職員";
  }).replace(/\s{3,}/g, " ");
}

function textLength(value) {
  return String(value || "").trim().length;
}

function sanitizeGenerationLogForExport(record) {
  const sanitized = removeInternalAiFields(record);
  return {
    createdAt: sanitized?.createdAt,
    kind: sanitized?.kind,
    session: safeExportSession(sanitized?.session),
    inputSummary: buildInputSummary(sanitized?.input, sanitized?.inputSummary),
    output: {
      headings: sanitized?.output?.headings,
      checks: sanitized?.output?.checks,
    },
  };
}

function buildSafeGenerationLogExport(records) {
  return safeRecordList(records).map((record, index) => ({
    recordNo: index + 1,
    createdAt: safeCopyText(record?.createdAt, 80),
    kind: safeCopyText(record?.kind, 40),
    session: safeExportSession(record?.session),
    inputSummary: record?.inputSummary || {},
    output: {
      headings: safeList(record?.output?.headings).map((heading) => safeCopyText(heading, 80)),
      checks: safeList(record?.output?.checks).map((check) => safeCopyText(check, 160)),
    },
  }));
}

function buildFeedbackNextSteps(feedback = {}) {
  const guidanceCategory = String(feedback.guidanceCategory || "");
  const received = String(feedback.received || "");
  const interpretation = String(feedback.interpretation || "");
  const unclear = String(feedback.unclear || "");
  const tomorrowAction = String(feedback.tomorrowAction || "");
  const teacherQuestion = String(feedback.teacherQuestion || "");
  const text = [received, interpretation, unclear, tomorrowAction, teacherQuestion].join("\n");
  const hasContent = text.trim().length > 0;
  const categoryFocus = {
    観察: "観察事実の具体化",
    声かけ: "保育者の関わり",
    記録: "観察事実の具体化",
    安全配慮: "安全面の確認",
    子ども理解: "子どもの姿の見直し",
    "5領域": "考察の根拠",
  }[guidanceCategory];
  const focus = categoryFocus || (/保育者|先生|声かけ|関わり|援助|意図/.test(text)
    ? "保育者の関わり"
    : /考察|ねらい|5領域|五領域|指針|根拠/.test(text)
      ? "考察の根拠"
      : /具体|詳しく|事実|姿|様子|場面/.test(text)
        ? "観察事実の具体化"
        : "指導内容の整理");

  const focusPoints = {
    "保育者の関わり": [
      "声かけや援助の前後で、子どもの姿がどう変わったかを記録する。",
      "保育者がすぐ援助したのか、見守ったのかなど、見聞きした関わりだけを事実として残す。",
      "保育者の意図は断定せず、分からない点は学校の担当教員への相談に回す。",
    ],
    "考察の根拠": [
      "考察に入れたい内容と、根拠になる観察事実を分けて記録する。",
      "5領域や保育所保育指針は、領域名の追加ではなく、見た姿を見直す問いとして扱う。",
      "入力にない発達効果や活動の一般論で文章を補わない。",
    ],
    "観察事実の具体化": [
      "場面、使っていた物、関わった人数、やりとりの流れを、見た範囲で追記する。",
      "子どもの気持ちは断定せず、実際に見た行動や発話として記録する。",
      "自分の関わりは、行ったこと、意図、見られた反応を分けて残す。",
    ],
    "安全面の確認": [
      "危険が起きそうだった場面、物の位置、子どもの動きなど、見た事実を分けて記録する。",
      "安全面で保育者がどのように見守ったか、実際に見聞きした範囲で残す。",
      "自分が次に確認したい安全配慮を一つに絞り、実習先や学校の担当教員に相談する。",
    ],
    "子どもの姿の見直し": [
      "子どもの性格や気持ちを決めつけず、行動、言葉、表情、周囲との関わりに分けて記録する。",
      "一つの理由に決めず、別の見方もあり得ることを明日の観察で確かめる。",
      "関わりの前後で子どもの姿がどう変わったかを、見た範囲で残す。",
    ],
    "指導内容の整理": [
      "指導で受けた観点に関係する場面を、事実と自分の考えに分けて記録する。",
      "明日意識することを一つに絞り、日誌の最後に振り返れる形で残す。",
      "まだ分からない点は、自己判断で補わず学校の担当教員への相談に回す。",
    ],
  };

  return {
    hasContent,
    focus,
    observationPoints: focusPoints[focus],
    diaryChecks: [
      "指導で受けたことと、自分の理解を分けて書けていますか。",
      tomorrowAction ? "明日変えたい行動を、実習後に振り返れる形で具体化できていますか。" : "明日変えたい行動は一つでも具体化できていますか。",
      unclear ? "まだ分からない点を、提出文で断定せず相談事項に回せていますか。" : "判断に迷う点を、自己判断だけで書いていませんか。",
    ],
    consultQuestions: [
      teacherQuestion || unclear || "今日の指導内容について、自分の理解で合っているか確認したい。",
    ],
  };
}

function buildFeedbackActionItems(feedback = {}) {
  return [
    {
      target: "feedbackReceived",
      label: "助言",
      title: "受けた助言",
      body: "要点だけを自分の言葉で残す。",
      done: hasStudentAuthoredText(feedback.received),
    },
    {
      target: "feedbackInterpretation",
      label: "理解",
      title: "自分の理解",
      body: "助言をどう受け止めたかを書く。",
      done: hasStudentAuthoredText(feedback.interpretation),
    },
    {
      target: "feedbackTomorrowAction",
      label: "明日",
      title: "明日の行動",
      body: "見ること・試すことを一つに絞る。",
      done: hasStudentAuthoredText(feedback.tomorrowAction),
    },
    {
      target: "feedbackTeacherQuestion",
      label: "相談",
      title: "教員への相談",
      body: "判断に迷う点だけを残す。",
      done: hasStudentAuthoredText(feedback.teacherQuestion),
    },
  ];
}

function buildClientDemoGeneration(payload = {}) {
  const scene = safeCopyText(payload.scene || "実習場面", 80);
  const memo = safeCopyText(payload.memo || "", 180);
  const reflection = safeCopyText(payload.reflection || "", 180);
  const tomorrowTask = safeCopyText(payload.tomorrowTask || "", 180);
  return {
    headings: [
      "観察した事実",
      "考え直す問い",
      "安全な表現",
      "明日の観察",
      "教員に相談する点",
    ],
    sections: [
      memo
        ? `${scene}で見たことを、できた/できないで決めず、行動ややりとりとして整理できています。`
        : "まず見たことを一つ選び、行動、言葉、周囲の状況に分けて書いてみましょう。",
      reflection
        ? "この考えの根拠になる子どもの姿をもう一つ探してみましょう。"
        : "自分がなぜそう考えたのか、見た事実と考えたことを分けて確認しましょう。",
      "個人や実習先を特定できる情報、要配慮情報、気持ちの断定が入る場合は、A児、実習先、見られた行動のような表現へ戻します。",
      tomorrowTask
        ? "次に見る場面では、保育者の関わりや環境の変化も合わせて見てみましょう。"
        : "明日は、同じ場面で子どもの表情、手の動き、周囲との関わりを一つ選んで観察しましょう。",
      "迷った表現や実習先で受けた助言の解釈は、提出前に学校の担当教員へ確認する相談点として残しましょう。",
    ],
    checks: [
      "入力にない事実を足していませんか。",
      "子どもの気持ちや性格を決めつけず、見た行動として書けていますか。",
      "個人や実習先を特定できる情報、要配慮情報を避けていますか。",
      "実習先で受けた助言を、明日の観察に戻せていますか。",
    ],
  };
}

function buildClientDemoStudentChatGeneration(payload = {}) {
  const stage = payload.stage || "legacy";
  const target = payload.target || "";
  const formatLabel = safeCopyText(payload.formatLabel || "", 80);
  return {
    kind: "student_chat",
    stage,
    target,
    acknowledgement: "一言を欄に保存しました。",
    nextQuestion: getClientDemoStudentChatQuestion(target, stage),
    fieldHint: formatLabel
      ? `${formatLabel}へつながる一言です。次の画面で自分の言葉に直します。`
      : "学校フォーマットの該当欄へ入ります。",
    safetyNote: "実名や園名が入っていないかだけ確認します。",
    organization: stage === "organize"
      ? buildClientDemoStudentChatOrganization(payload)
      : createEmptyStudentChatOrganization(),
  };
}

function getClientDemoStudentChatQuestion(target, stage = "legacy") {
  if (stage === "episode") return "その時、自分はどのように関わり、その後どのような姿が見られましたか。";
  if (stage === "organize") return "整理案と元メモを見比べ、事実と違う部分がないか確認してください。";
  if (target === "episodeMemo") return "その場面を見て、保育者として何が大切だと感じましたか。";
  if (target === "episodeInsight") return "明日、同じような場面で何を一つ見ますか。";
  if (target === "goalReflection") return "目標とつながった場面を、一つだけ具体的にするとどうなりますか。";
  if (target === "overallLearning") return "その気づきを、明日の行動に一つつなげるなら何を見ますか。";
  if (target === "nextAction") return "学校フォーマットで、今の一言を自分の言葉に直してみましょう。";
  if (String(target).startsWith("feedback")) return "受けた助言を、明日見る子どもの姿に戻すと何を見ますか。";
  return "次に、実際に見たことを一つだけ足すなら何ですか。";
}

function createEmptyStudentChatOrganization() {
  return {
    factSummary: "",
    goalConnection: "",
    professionalReview: {
      focusText: "",
      reason: "",
      revisionPrompt: "",
    },
    reflectionStarter: "",
    fieldStarters: {
      goalReflection: "",
      episodeInsight: "",
      overallLearning: "",
      nextAction: "",
    },
    missingInformation: "",
  };
}

function buildClientDemoStudentChatOrganization(payload = {}) {
  const practiceGoal = safeCopyText(payload.practiceGoal || "", 120);
  const episodeMemo = safeCopyText(
    [payload.episodeMemo, payload.answer].filter(Boolean).join(" "),
    260,
  );
  const reflectionStarter = "この場面で見た【観察した事実】から、私は【自分の気づき】と考えた。";
  return {
    factSummary: episodeMemo,
    goalConnection: practiceGoal
      ? `実習目標「${practiceGoal}」と、この出来事のどの部分がつながるかを、見た事実から確認します。`
      : "実習目標が未入力のため、出来事とのつながりはまだ決めません。",
    professionalReview: buildClientDemoProfessionalReview(episodeMemo),
    reflectionStarter,
    fieldStarters: {
      goalReflection: practiceGoal
        ? `実習目標「${practiceGoal.slice(0, 60)}」と【目標につながった場面】を見比べ、【自分が考えたこと】を足す。`
        : "実習目標と【目標につながった場面】を見比べ、【自分が考えたこと】を足す。",
      episodeInsight: reflectionStarter,
      overallLearning: "今日の場面を通して、【共通して気づいたこと】を【保育者として大切にしたいこと】へつなげる。",
      nextAction: "明日は【見る場面】で、【確認したい姿や関わり】を一つ見る。",
    },
    missingInformation: "記録した内容と違う部分や、まだ書けていない子どもの姿はありますか。",
  };
}

function buildClientDemoProfessionalReview(episodeMemo) {
  const focusText = episodeMemo.slice(0, 60);
  if (/友だち|一緒|やりとり|順番|貸|渡/.test(episodeMemo)) {
    return {
      focusText,
      reason: "子ども同士の関わりは、関係性を評価せず、実際のやり取りと援助を分けて捉える必要があります。5領域の「人間関係」も、この姿を振り返る補助的な観点になります。",
      revisionPrompt: "やり取りの前後に見た子どもの姿と、自分がした関わりを分けて追記できますか。",
    };
  }
  if (/話|言葉|声|伝え|聞/.test(episodeMemo)) {
    return {
      focusText,
      reason: "発話そのものと、そこから考えたことを分けると、伝え合う姿を具体的な事実から捉えられます。",
      revisionPrompt: "実際に聞いた言葉と、その前後に見た姿を分けて追記できますか。",
    };
  }
  if (/玩具|道具|素材|場所|環境|ブロック/.test(episodeMemo)) {
    return {
      focusText,
      reason: "環境を通して行う保育では、物・空間・時間と子どもの活動の関係を、見た事実から捉えることが重要です。",
      revisionPrompt: "道具の配置や使い方と、その後に見られた子どもの姿を追記できますか。",
    };
  }
  return {
    focusText,
    reason: "観察した事実と自分の解釈を区別すると、省察の根拠が明確になります。",
    revisionPrompt: "どこまでが見た事実で、どこからが自分の考えかを確認できますか。",
  };
}

const CLIENT_PRIVACY_FIELD_LABELS = {
  date: "日付",
  weather: "天気",
  age: "クラス・年齢",
  scene: "場面",
  goal: "今日のねらい",
  memo: "学校フォーマット本文",
  reflection: "総合的な気づき",
  tomorrowTask: "次の日取り組みたいこと",
  feedbackGuidanceCategory: "受け止めた観点",
  feedbackReceived: "実習先で受けた助言",
  feedbackInterpretation: "助言への自分の理解",
  feedbackUnclear: "まだ分からないこと",
  feedbackTomorrowAction: "明日変えたい行動",
  feedbackTeacherQuestion: "学校の担当教員に相談したいこと",
  finalDraft: "提出前の記録",
};

function buildClientPrivacyReview(kind, payload = {}, phase = "pre_ai") {
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const sanitizedPayload = Object.fromEntries(
    Object.entries(source)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, redactSensitiveText(value)]),
  );
  const check = buildClientPrivacyCheck(source);
  const changed = Object.entries(sanitizedPayload).some(([key, value]) => source[key] !== value);
  const fieldChanges = Object.entries(sanitizedPayload)
    .filter(([key, value]) => source[key] !== value)
    .map(([key, value]) => ({
      field: key,
      label: CLIENT_PRIVACY_FIELD_LABELS[key] || key,
      action: "auto_redacted",
      severity: "suggestion",
      actionLabel: "別の言い方",
      title: "自然に伝わる表現案があります",
      after: safeCopyText(value, 160),
    }));
  const findings = [
    ...check.blockers.map((message, index) => ({
      code: `local_blocker_${index + 1}`,
      label: "個人が分かるかも",
      severity: "must_fix",
      actionLabel: "個人が分かるかも",
      message,
    })),
    ...check.warnings.map((message, index) => ({
      code: `local_warning_${index + 1}`,
      label: "記録前の確認",
      severity: "suggestion",
      actionLabel: "記録前の確認",
      message,
    })),
  ];
  const contextNotes = check.notes.map((message, index) => ({
    code: `local_note_${index + 1}`,
    label: "置き換え済み表現",
    severity: "suggestion",
    actionLabel: "別の言い方",
    message,
  }));
  const blocked = check.blockers.length > 0;
  return {
    kind,
    phase,
    status: blocked ? "blocked" : changed || findings.length > 0 ? "review" : "clear",
    changed,
    blocked,
    payload: sanitizedPayload,
    fieldChanges,
    findings,
    contextNotes,
    summary: blocked
      ? "公開デモ内で安全化だけでは扱いにくい表現があります。入力に戻って架空データへ整えてください。"
      : changed
        ? "公開デモ内で、特定につながる可能性がある表現を置き換えました。"
        : "公開デモ内で安全確認を行いました。目立つ個人情報候補は見つかっていません。",
    guardrail: {
      local: "checked",
      bedrockMode: "off",
    },
  };
}

function readStoredSession() {
  if (!ALLOW_STORED_DEMO_SESSION) {
    clearAppLocalStorage();
    return null;
  }
  try {
    const demoSession = normalizeStoredDemoSession(JSON.parse(localStorage.getItem("manabi-demo-session") || "null"));
    if (demoSession) return demoSession;

    const legacySession = normalizeStoredDemoSession(JSON.parse(localStorage.getItem("manabi-session") || "null"));
    localStorage.removeItem("manabi-session");
    if (legacySession) {
      safeSetLocalStorage("manabi-demo-session", JSON.stringify(legacySession));
      return legacySession;
    }
    return null;
  } catch {
    return null;
  }
}

export function AppExperience({ publicDemoRole = "", publicDemoReturnHref = "/demo" } = {}) {
  const todayKey = useMemo(() => getLocalDateKey(), []);
  const generationLogKey = "manabi-generation-logs";
  const studentProcessEventKey = STUDENT_PROCESS_EVENT_STORAGE_KEY;

  const [activeView, setActiveView] = useState("diary");
  const [tone, setTone] = useState("balanced");
  const [diary, setDiary] = useState(() => createInitialDiary(todayKey));
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [resultMeta, setResultMeta] = useState(null);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [studentFlowStep, setStudentFlowStep] = useState("input");
  const [selectedSampleId, setSelectedSampleId] = useState("");
  const [privacyReview, setPrivacyReview] = useState(null);
  const [checkedPayload, setCheckedPayload] = useState(null);
  const [finalDraft, setFinalDraft] = useState("");
  const [finalCheck, setFinalCheck] = useState(null);
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionRestoreError, setSessionRestoreError] = useState("");
  const [sessionRestoreAttempt, setSessionRestoreAttempt] = useState(0);
  const [schoolSummary, setSchoolSummary] = useState(null);
  const [schoolSummaryStatus, setSchoolSummaryStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const trackedAppOpenRef = useRef(false);
  const lastTrackedViewRef = useRef("");
  const studentProcessDemoIdRef = useRef("");

  const role = session?.role || "student";
  const isStudent = role === "student";
  const isDemoSession = session?.source === "demo";
  const isPublicDemoSession = publicDemoRole === "student" || publicDemoRole === "teacher";
  const visibleNavItems = isStudent ? STUDENT_NAV_ITEMS : STAFF_NAV_ITEMS;
  const currentView = isStudent
    ? "diary"
    : (STAFF_VIEW_IDS.includes(activeView) ? activeView : "school");
  const shouldTrackAccess = sessionChecked && session?.source === "supabase";

  const activeSchoolFormat = useMemo(
    () => normalizeClientTemplate(session?.schoolFormat || defaultSchoolFormat),
    [session?.schoolFormat],
  );
  const activeDiaryRequirements = useMemo(
    () => buildStudentDiaryRequirements(activeSchoolFormat),
    [activeSchoolFormat],
  );

  useEffect(() => {
    if (!isStudent) return;
    setDiary((current) => {
      const { initialCount, minCount } = activeDiaryRequirements.episodes;
      const episodes = normalizeDiaryEpisodes(current.episodes, current.memo, current.reflection, initialCount);
      const hasContent = episodes.some((episode) => normalizeMultiline(episode.memo) || normalizeMultiline(episode.insight));
      const targetCount = hasContent ? Math.max(episodes.length, minCount) : initialCount;
      if (episodes.length === targetCount) return current;
      const nextEpisodes = episodes.length > targetCount
        ? episodes.slice(0, targetCount)
        : [...episodes, ...Array.from({ length: targetCount - episodes.length }, (_, index) => createDiaryEpisode(episodes.length + index + 1))];
      return { ...current, episodes: nextEpisodes };
    });
  }, [activeDiaryRequirements, isStudent]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      let nextSession = null;
      let nextSessionRestoreError = "";
      if (isPublicDemoSession) {
        clearAppLocalStorage();
        nextSession = buildPublicDemoSession(publicDemoRole);
      } else {
        nextSession = readStoredSession();
      }
      if (!isPublicDemoSession) {
        try {
          const response = await fetch("/api/auth", { cache: "no-store" });
          const auth = await response.json().catch(() => ({}));
          if (!response.ok) {
            nextSession = null;
            nextSessionRestoreError = "ログイン状態と学校フォーマットを確認できませんでした。入力し直さず、少し時間を置いて再試行してください。";
          } else {
            if (auth.session) {
              nextSession = auth.session;
              clearAppLocalStorage();
            } else if (auth.configured) {
              nextSession = null;
              clearAppLocalStorage();
            }
          }
        } catch {
          nextSession = null;
          nextSessionRestoreError = "ログイン状態と学校フォーマットを確認できませんでした。入力し直さず、少し時間を置いて再試行してください。";
          console.warn("Auth session restore temporarily unavailable.");
        }
      }

      if (!cancelled) {
        setSession(nextSession);
        setSessionRestoreError(nextSessionRestoreError);
        if (nextSession?.source === "demo") {
          if (isPublicDemoSession) {
            setStatus("公開デモ用の架空セッションです。実名や実習先名は入れず、架空の場面で試してください。");
            setSessionChecked(true);
            return;
          }
        }
        setSessionChecked(true);
      }
    }

    loadInitialState();
    return () => {
      cancelled = true;
    };
  }, [isPublicDemoSession, publicDemoRole, sessionRestoreAttempt]);

  useEffect(() => {
    if (!sessionChecked || !isStudent) return;
    if (activeView !== "diary") {
      setActiveView("diary");
    }
  }, [activeView, isStudent, sessionChecked]);

  useEffect(() => {
    if (!sessionChecked || isStudent) return;
    if (!STAFF_VIEW_IDS.includes(activeView)) {
      setActiveView("school");
    }
  }, [activeView, isStudent, sessionChecked]);

  useEffect(() => {
    if (!shouldTrackAccess || trackedAppOpenRef.current) return;
    trackedAppOpenRef.current = true;
    trackAccessEvent("app_open", {
      view: currentView,
      flowStep: isStudent ? studentFlowStep : "",
      status: "completed",
    });
  }, [currentView, isStudent, shouldTrackAccess, studentFlowStep]);

  useEffect(() => {
    if (!shouldTrackAccess) return;
    const key = `${role}:${currentView}:${isStudent ? studentFlowStep : ""}`;
    if (lastTrackedViewRef.current === key) return;
    lastTrackedViewRef.current = key;
    trackAccessEvent("view_open", {
      view: currentView,
      flowStep: isStudent ? studentFlowStep : "",
    });
  }, [currentView, isStudent, role, shouldTrackAccess, studentFlowStep]);

  useEffect(() => {
    if (!sessionChecked || isStudent || currentView !== "school") return;
    let cancelled = false;

    async function loadSchoolSummary() {
      if (isPublicDemoSession) {
        setSchoolSummary({ configured: false });
        setSchoolSummaryStatus("公開デモ用の架空データを表示しています。");
        return;
      }
      setSchoolSummaryStatus("学校データを読み込んでいます。");
      try {
        const response = await fetch("/api/school/summary", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "学校データを取得できませんでした。");
        }
        if (!cancelled) {
          setSchoolSummary(body);
          setSchoolSummaryStatus(
            body.configured
              ? "教員確認用の記録を表示しています。"
              : session?.source === "demo"
                ? "参考データを表示しています。"
                : "学校データの接続を確認しています。",
          );
        }
      } catch (error) {
        if (!cancelled) {
          setSchoolSummary(null);
          setSchoolSummaryStatus(error.message);
        }
      }
    }

    loadSchoolSummary();
    return () => {
      cancelled = true;
    };
  }, [currentView, isPublicDemoSession, isStudent, session?.source, sessionChecked]);

  function getSessionContext() {
    return {
      schoolName: session?.schoolName || "",
      schoolId: session?.schoolId || "",
      className: session?.className || "",
      classId: session?.classId || "",
      schoolPlan: session?.schoolPlan || "",
      contractStatus: session?.contractStatus || "",
      userId: session?.source === "demo" ? "" : session?.userId || "",
      demoStudentId: session?.demoStudentId || "",
      role: session?.role || "",
      roleLabel: session?.roleLabel || "",
      userName: session?.name || "",
      email: session?.email || "",
      source: session?.source || "",
    };
  }

  function getStudentProcessSessionContext() {
    return {
      source: session?.source === "demo" ? "demo" : "",
      role: session?.role === "teacher" ? "teacher" : "student",
      demoStudentId: ensureStudentProcessDemoStudentId(),
    };
  }

  function ensureStudentProcessDemoStudentId() {
    if (!isStudent || !isDemoSession || isPublicDemoSession) return "";
    const sessionDemoStudentId = normalizeDemoStudentId(session?.demoStudentId, "");
    if (sessionDemoStudentId) {
      studentProcessDemoIdRef.current = sessionDemoStudentId;
      return sessionDemoStudentId;
    }
    const existingDemoStudentId = normalizeDemoStudentId(studentProcessDemoIdRef.current, "");
    if (existingDemoStudentId) return existingDemoStudentId;
    const nextDemoStudentId = createDemoStudentId();
    studentProcessDemoIdRef.current = nextDemoStudentId;
    const nextSession = {
      ...session,
      source: "demo",
      role: "student",
      demoStudentId: nextDemoStudentId,
    };
    safeSetLocalStorage("manabi-demo-session", JSON.stringify(nextSession));
    setSession(nextSession);
    return nextDemoStudentId;
  }

  async function trackAccessEvent(event, metadata = {}) {
    if (!sessionChecked || session?.source !== "supabase") return;
    try {
      await fetch("/api/demo/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        keepalive: true,
        body: JSON.stringify({
          event,
          metadata: {
            surface: ACCESS_LOG_SURFACE,
            view: metadata.view || currentView,
            flowStep: metadata.flowStep || (isStudent ? studentFlowStep : ""),
            sampleId: metadata.sampleId || "",
            status: metadata.status || "",
          },
        }),
      });
    } catch (error) {
      console.warn("Access tracking skipped:", error.message);
    }
  }

  function saveGenerationLog(record) {
    if (isPublicDemoSession) return;
    if (isDemoSession) {
      const saved = getSavedFeedbackRecords(generationLogKey);
      const nextRecords = [sanitizeGenerationLogForExport(record), ...saved].slice(0, 100);
      safeSetLocalStorage(generationLogKey, JSON.stringify(nextRecords));
    }
    if (!record.serverPersisted && !isDemoSession) {
      persistServerLog("generation", record);
    }
  }

  function saveStudentProcessEvent(stage, context = {}) {
    if (!isStudent || isPublicDemoSession) return;
    const eventDiary = context.diary || diary;
    const eventFeedback = context.feedback || feedback;
    const event = buildStudentProcessEvent({
      stage,
      diary: eventDiary,
      feedback: eventFeedback,
      review: context.review,
      result: context.result,
      finalCheck: context.finalCheck,
      finalDraft: context.finalDraft,
      writingCoach: buildStudentWritingCoach(eventDiary, eventFeedback, activeSchoolFormat),
      session: getStudentProcessSessionContext(),
      createdAt: new Date().toISOString(),
    });
    if (isDemoSession) {
      const saved = getSavedFeedbackRecords(studentProcessEventKey);
      const nextRecords = mergeStudentProcessEvents(saved, event);
      const storagePayload = serializeStudentProcessEventsForStorage(nextRecords);
      if (!safeSetLocalStorage(studentProcessEventKey, storagePayload.json)) {
        setStatus("学習プロセスを端末に保存できませんでした。入力内容は残っています。");
      } else if (storagePayload.truncated) {
        setStatus("端末の保存容量に合わせて、古い学習プロセスを整理しました。");
      }
      return;
    }
    if (ENABLE_STUDENT_PROCESS_PERSISTENCE) void persistStudentProcessEvent(event);
  }

  async function persistStudentProcessEvent(event) {
    try {
      const response = await fetch("/api/student-process/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (isExpectedStudentProcessPersistenceSkipCode(body.code)) return;
        throw new Error(body.error || "student process persistence failed");
      }
      setStatus((current) => current.startsWith("学習プロセスを保存できませんでした。") ? "" : current);
    } catch (error) {
      console.warn("Student process persistence skipped:", error.message);
      setStatus("学習プロセスを保存できませんでした。入力は残っているため、そのまま作業を続けられます。");
    }
  }

  async function persistServerLog(type, record) {
    try {
      const response = await fetch("/api/logs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, record }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || "server log failed");
      }
    } catch (error) {
      console.warn("Server log persistence skipped:", error.message);
    }
  }

  function resetFeedback() {
    setFeedback(initialFeedback);
  }

  function resetStudentFlow({ keepInput = true } = {}) {
    setStudentFlowStep("input");
    setPrivacyReview(null);
    setCheckedPayload(null);
    setFinalDraft("");
    setFinalCheck(null);
    setResult(null);
    setResultMeta(null);
    if (!keepInput) {
      setDiary(createInitialDiary(todayKey, activeSchoolFormat));
      resetFeedback();
      setSelectedSampleId("");
    }
  }

  function updateDiary(field, value, scaffold = "") {
    setDiary((current) => {
      const nextDiary = { ...current, [field]: value };
      return scaffold || !normalizeMultiline(value)
        ? setStudentFieldScaffold(nextDiary, { target: field, scaffold })
        : nextDiary;
    });
    setPrivacyReview(null);
    setCheckedPayload(null);
    setFinalCheck(null);
    if (studentFlowStep !== "input") setStudentFlowStep("input");
  }

  function updateDiaryEpisode(index, field, value, scaffold = "") {
    setDiary((current) => {
      const episodes = normalizeDiaryEpisodes(current.episodes, current.memo, current.reflection).map((episode, episodeIndex) => (
        episodeIndex === index ? { ...episode, [field]: value } : episode
      ));
      const nextDiary = { ...current, episodes };
      const target = field === "memo" ? "episodeMemo" : field === "insight" ? "episodeInsight" : "";
      const episodeId = String(episodes[index]?.id || "");
      return target && (scaffold || !normalizeMultiline(value))
        ? setStudentFieldScaffold(nextDiary, { target, episodeId, scaffold })
        : nextDiary;
    });
    setPrivacyReview(null);
    setCheckedPayload(null);
    setFinalCheck(null);
    if (studentFlowStep !== "input") setStudentFlowStep("input");
  }

  function applyStudentChatStarterPatch(patch) {
    setDiary((current) => mergeStudentChatDiaryStarterPatch(current, patch));
    setPrivacyReview(null);
    setCheckedPayload(null);
    setFinalCheck(null);
    if (studentFlowStep !== "input") setStudentFlowStep("input");
  }

  function addDiaryEpisode() {
    setDiary((current) => {
      const episodes = normalizeDiaryEpisodes(current.episodes, current.memo, current.reflection);
      if (episodes.length >= activeDiaryRequirements.episodes.maxCount) return current;
      const nextIndex = episodes.length + 1;
      return {
        ...current,
        episodes: [
          ...episodes,
          createDiaryEpisode(nextIndex, { id: `episode-${Date.now()}-${nextIndex}` }),
        ],
      };
    });
    setPrivacyReview(null);
    setCheckedPayload(null);
    setFinalCheck(null);
    if (studentFlowStep !== "input") setStudentFlowStep("input");
  }

  function removeDiaryEpisode(index) {
    const currentEpisodes = normalizeDiaryEpisodes(diary.episodes, diary.memo, diary.reflection);
    if (currentEpisodes.length <= activeDiaryRequirements.episodes.minCount) return;
    const targetEpisode = currentEpisodes[index];
    if (!targetEpisode) return;
    if (hasStudentDiaryEpisodeContent(targetEpisode) && !window.confirm("入力済みのエピソードを削除しますか？")) return;
    setDiary((current) => {
      const episodes = normalizeDiaryEpisodes(current.episodes, current.memo, current.reflection);
      if (episodes.length <= activeDiaryRequirements.episodes.minCount) return current;
      return {
        ...current,
        episodes: episodes.filter((_, episodeIndex) => episodeIndex !== index),
      };
    });
    setPrivacyReview(null);
    setCheckedPayload(null);
    setFinalCheck(null);
    if (studentFlowStep !== "input") setStudentFlowStep("input");
  }

  function loadDiarySample(sample) {
    setSelectedSampleId(sample.id);
    const sampleValues = sample.values || {};
    setDiary((current) => {
      const { studentScaffolds: _studentScaffolds, ...currentWithoutScaffolds } = current;
      return {
        ...currentWithoutScaffolds,
        ...sampleValues,
        date: current.date || todayKey,
        goalReflection: sampleValues.goalReflection || sampleValues.reflection || "",
        episodes: normalizeDiaryEpisodes(sampleValues.episodes, sampleValues.memo, ""),
        reflection: sampleValues.reflection || "",
        overallLearning: sampleValues.overallLearning || sampleValues.reflection || "",
        tomorrowTask: sampleValues.tomorrowTask || "",
        nextAction: sampleValues.nextAction || sampleValues.tomorrowTask || "",
      };
    });
    setFeedback({ ...initialFeedback, ...(sample.feedback || {}) });
    setTone(sample.tone);
    setResult(null);
    setResultMeta(null);
    setStudentFlowStep("input");
    setPrivacyReview(null);
    setCheckedPayload(null);
    setFinalDraft("");
    setFinalCheck(null);
    setStatus(`場面例「${sample.title}」と実習先フィードバック例を読み込みました。`);
    trackAccessEvent("student_sample_loaded", {
      flowStep: "input",
      sampleId: sample.id,
    });
  }

  async function generate(kind, payload, options = {}) {
    if (isPublicDemoSession) {
      return kind === "student_chat"
        ? buildClientDemoStudentChatGeneration(payload)
        : buildClientDemoGeneration(payload);
    }
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind,
        payload,
        provider: options.provider,
        fallback: options.fallback,
      }),
    });

    if (!response.ok) {
      let message = "問い返しに失敗しました。少し時間を置いて再試行してください。";
      try {
        const errorBody = await response.json();
        message = errorBody.error || message;
      } catch {
        // Use the fallback message when the server did not return JSON.
      }
      throw new Error(message);
    }

    return response.json();
  }

  async function handleStudentChatAssist(payload) {
    return generate("student_chat", payload);
  }

  async function handleDiarySubmit(event) {
    event.preventDefault();

    if (!hasMinimumStudentDiaryInput(diary, feedback, activeSchoolFormat)) {
      setStatus("一場面、気づき、明日の一点を自分の言葉で入力してください。");
      return;
    }

    setBusy(true);
    try {
      const review = await privacyCheckRequest("diary", buildDiaryGenerationPayload(diary, feedback, tone, activeSchoolFormat), "pre_ai");
      setPrivacyReview(review);
      setCheckedPayload(review.payload);
      setResult(null);
      setResultMeta(null);
      setFinalCheck(null);
      setStudentFlowStep("confirm");
      setStatus(review.summary || "安全確認を表示しました。内容を確認してから問い返しへ進めます。");
      saveStudentProcessEvent("safety_check_completed", {
        diary,
        feedback,
        review,
      });
      trackAccessEvent("student_safety_checked", {
        flowStep: "confirm",
        status: review.blocked ? "blocked" : review.status || "review",
      });
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmedGenerate() {
    if (!privacyReview || privacyReview.blocked) {
      setStudentFlowStep("confirm");
      setStatus("先に入力内容を見直してください。安全化だけでは扱えない表現が残っています。");
      return;
    }
    const payload = checkedPayload || buildDiaryGenerationPayload(diary, feedback, tone, activeSchoolFormat);
    setBusy(true);
    try {
      const content = await generate("diary", payload);
      setResult(content);
      const generationId = content.generationId || crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const input = payload;
      setResultMeta({
        kind: "diary",
        generationId,
        tone,
        input,
        session: getSessionContext(),
        createdAt,
      });
      saveGenerationLog({
        id: generationId,
        kind: "diary",
        input,
        output: content,
        session: getSessionContext(),
        serverPersisted: Boolean(content.generationId),
        createdAt,
      });
      setStudentFlowStep("revise");
      setFinalDraft("");
      setFinalCheck(null);
      setStatus("問い返しと提出前の自己確認を表示しました。最後に自分の言葉で記録を整えてください。");
      saveStudentProcessEvent("question_generated", {
        diary,
        feedback,
        review: privacyReview,
        result: content,
      });
      trackAccessEvent("student_question_generated", {
        flowStep: "revise",
        status: "completed",
      });
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function privacyCheckRequest(kind, payload, phase) {
    if (isPublicDemoSession) {
      return buildClientPrivacyReview(kind, payload, phase);
    }
    const response = await fetch("/api/privacy-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, payload, phase }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "安全確認を完了できませんでした。");
    }
    return body;
  }

  async function handleFinalDraftCheck() {
    const draft = normalizeMultiline(finalDraft);
    if (!hasMeaningfulText(draft)) {
      setStatus("提出前の記録を、言葉で入力してください。");
      return;
    }
    const scaffoldDraft = result
      ? buildDiaryScaffoldDraft(checkedPayload, result, buildFeedbackNextSteps(feedback))
      : "";
    const draftReadiness = getStudentDraftEditReadiness(draft, scaffoldDraft);
    if (!draftReadiness.ready) {
      setStudentFlowStep("final");
      setStatus(`${draftReadiness.title}。${draftReadiness.body}`);
      return;
    }
    setBusy(true);
    try {
      const review = await privacyCheckRequest(
        "diary",
        {
          date: diary.date,
          weather: diary.weather,
          age: diary.age,
          scene: diary.scene,
          memo: draft,
          tone,
        },
        "final",
      );
      setFinalCheck(review);
      setStudentFlowStep("final");
      setStatus(review.summary || "提出前チェックを表示しました。");
      saveStudentProcessEvent("final_check_completed", {
        diary,
        feedback,
        finalCheck: review,
        finalDraft: draft,
        result,
      });
      trackAccessEvent("student_final_checked", {
        flowStep: "final",
        status: review.blocked ? "blocked" : review.status || "review",
      });
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  function useSanitizedFinalDraft() {
    const sanitizedDraft = finalCheck?.payload?.memo;
    if (!sanitizedDraft) return;
    setFinalDraft(sanitizedDraft);
    setStatus("安全な表現を反映しました。意味が変わっていないか確認し、もう一度提出前チェックを通してください。");
  }

  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setStatus(isPublicDemoSession ? "デモを終了しています。" : "ログアウトしています。");
    try {
      const preserveStudentProcessEvents = !isPublicDemoSession && isDemoSession && isStudent;
      clearAppLocalStorage({ preserveStudentProcessEvents });
      if (preserveStudentProcessEvents) saveStudentProcessSwitch(session);
      let redirectHref = "/login";
      if (isPublicDemoSession) {
        setSession(null);
        setSchoolSummary(null);
        redirectHref = normalizePublicDemoReturnHref(publicDemoReturnHref);
      } else {
        const response = await fetch("/api/auth", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ action: "signOut" }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "ログアウトに失敗しました。");
        }
        setSession(null);
        setSchoolSummary(null);
      }
      window.location.replace(redirectHref);
    } catch (error) {
      setStatus(`${error.message} もう一度${isPublicDemoSession ? "デモを終了" : "ログアウト"}を押してください。`);
      setLogoutBusy(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    const headingText = result.headings.map((heading, index) => `${index + 1}. ${heading}`).join("\n");
    const text = [
      "Manalio 問い返しメモ",
      "",
      "確認する観点",
      headingText,
      "",
      "提出前の自己確認",
      result.checks.map((check) => `・${check}`).join("\n"),
      "",
      "このメモをもとに、自分の言葉で日誌本文を書き直してください。",
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function copyFinalDraft() {
    if (!finalDraft.trim()) return;
    const checkedText = normalizeMultiline(finalDraft);
    const sanitizedText = normalizeMultiline(finalCheck?.payload?.memo || "");
    const scaffoldDraft = result
      ? buildDiaryScaffoldDraft(checkedPayload, result, buildFeedbackNextSteps(feedback))
      : "";
    const draftReadiness = getStudentDraftEditReadiness(checkedText, scaffoldDraft);
    if (!draftReadiness.ready) {
      setStudentFlowStep("final");
      setStatus(`${draftReadiness.title}。${draftReadiness.body}`);
      return;
    }
    const canCopyCheckedFinal = canUseFinalDraftAfterCheck(finalCheck, checkedText, sanitizedText);
    if (!canCopyCheckedFinal) {
      setStudentFlowStep("final");
      if (!finalCheck) {
        setStatus("記録をコピーする前に、提出前チェックを行ってください。");
      } else if (finalCheck.blocked) {
        setStatus("記録に扱えない表現が残っています。入力を見直してから再チェックしてください。");
      } else if (finalCheck.status === "review") {
        setStatus("記録前に見直したい内容があります。入力を整えてから再チェックしてください。");
      } else if (finalCheck.status === "clear" && checkedText !== sanitizedText) {
        setStatus("記録を直した後は、もう一度提出前チェックを行ってからコピーしてください。");
      } else {
        setStatus("安全化した文を反映してからコピーしてください。");
      }
      return;
    }
    await navigator.clipboard.writeText(finalDraft.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
    setStatus("記録をコピーしました。");
    saveStudentProcessEvent("final_copied", {
      diary,
      feedback,
      finalCheck,
      finalDraft,
      result,
    });
    trackAccessEvent("student_final_copied", {
      flowStep: "final",
      status: "copied",
    });
  }

  function updateFeedback(field, value) {
    setFeedback((current) => ({ ...current, [field]: value }));
    setPrivacyReview(null);
    setCheckedPayload(null);
    setFinalCheck(null);
    if (studentFlowStep !== "input") setStudentFlowStep("input");
  }

  function downloadTextFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportGenerationLogs(format) {
    if (!ENABLE_LOG_EXPORTS) {
      setStatus("確認記録の書き出しは停止しています。");
      return;
    }

    const localRecords = isDemoSession ? getSavedFeedbackRecords(generationLogKey) : [];
    const serverLogDisplays = buildSafeTeacherLogDisplays(schoolSummary?.recentLogs || []);
    const serverRecords = serverLogDisplays.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      kind: log.kind,
      session: {
        schoolName: schoolSummary?.school?.name || session?.schoolName || "",
        className: log.className || "",
        role: "student",
      },
      input: {},
      inputSummary: { preview: log.displaySummary || "" },
      output: {
        headings: ["確認メタ情報"],
        checks: log.checkCount ? [`提出前確認 ${log.checkCount}件`] : [],
      },
    }));
    const records = buildSafeGenerationLogExport((isDemoSession ? localRecords : serverRecords).map(sanitizeGenerationLogForExport));
    if (records.length === 0) {
      setStatus("保存済みの確認記録はまだありません。");
      return;
    }

    const exportedAt = getLocalDateKey();
    if (format === "json") {
      downloadTextFile(
        `manalio-generation-logs-${exportedAt}.json`,
        JSON.stringify(records, null, 2),
        "application/json;charset=utf-8",
      );
      setStatus("確認記録をJSONで書き出しました。");
      return;
    }

    const header = [
      "recordNo",
      "createdAt",
      "kind",
      "schoolName",
      "className",
      "role",
      "inputSummary",
      "headings",
      "checks",
    ];
    const rows = records.map((record) => [
      record.recordNo,
      record.createdAt,
      record.kind,
      record.session?.schoolName,
      record.session?.className,
      record.session?.role,
      record.inputSummary,
      record.output?.headings,
      record.output?.checks,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    downloadTextFile(`manalio-generation-logs-${exportedAt}.csv`, csv, "text/csv;charset=utf-8");
    setStatus("確認記録をCSVで書き出しました。");
  }

  function retrySessionRestore() {
    setSessionChecked(false);
    setSessionRestoreError("");
    setSessionRestoreAttempt((current) => current + 1);
  }

  if (!sessionChecked) {
    return (
      <AppGateCard
        title={isPublicDemoSession ? "公開デモを準備しています" : "ログイン状態を確認しています"}
        description={isPublicDemoSession ? "架空データを読み込んでいます。" : "学校・クラス・ロール情報を読み込んでいます。"}
      />
    );
  }

  if (sessionRestoreError) {
    return (
      <AppGateCard
        title="サービスに接続できません"
        description={sessionRestoreError}
        actionLabel="再試行"
        onAction={retrySessionRestore}
      />
    );
  }

  if (!session) {
    return (
      <AppGateCard
        title="ログインが必要です"
        description="学校向けサービスとして、学生・教員ロールを選んでから利用する形にしました。"
        actionLabel="ログインへ"
        actionHref="/login"
      />
    );
  }

  return (
    <main id="main-content" className="app-shell app-only">
      <section
        className={`workspace ${isStudent ? "student-workspace" : ""}`}
        id="demo"
        aria-label={isStudent ? "実習記録の問い返しと提出前の自己確認" : "実習後の学生支援確認"}
      >
        <aside className="sidebar">
          <div className="brand">
            <img className="app-brand-icon" src="/images/manalio-logo-icon.svg" alt="" aria-hidden="true" />
            <div>
              <h1>Manalio</h1>
              <p>養成校向けAI実習指導支援</p>
            </div>
          </div>

          {!isStudent && <div className="trust-card" aria-label="サービスの特徴">
            <span className="trust-kicker">学校運用向け</span>
            <strong>学生が自分で書いた記録に、問い返しと安全確認を返す。</strong>
            <div className="trust-tags">
              <span>省察支援</span>
              <span>安全確認</span>
              <span>実習後支援</span>
            </div>
          </div>}

          <div className={`usage-panel ${isStudent ? "student-session-panel" : ""}`}>
            <div>
              <span className="label">{isPublicDemoSession ? "公開デモ" : "ログイン中"}</span>
              <strong className="session-role">{session?.roleLabel || "教員"}</strong>
            </div>
            <div className="session-meta">
              <span>{session?.schoolName || "さくら保育者養成校"}</span>
              <span>{session?.className || "保育実習I / 2年A組"}</span>
            </div>
            <p className="muted">{status || "ロールに応じた画面を表示しています。"}</p>
            <button className="ghost-button" type="button" onClick={logout} disabled={logoutBusy}>
              {logoutBusy ? (isPublicDemoSession ? "終了しています..." : "ログアウト中...") : (isPublicDemoSession ? "デモを終了" : "ログアウト")}
            </button>
          </div>


          {visibleNavItems.length > 1 && (
            <nav className="nav-list" aria-label="機能">
              {visibleNavItems.map(([view, label]) => (
                <button
                  key={view}
                  className={`nav-item ${currentView === view ? "active" : ""}`}
                  type="button"
                  aria-current={currentView === view ? "page" : undefined}
                  onClick={() => setActiveView(view)}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}

          {!isStudent && <div className="note">
            <span className="label">支援方針</span>
            <p>学生が一般AIの出力を十分に見直さずに使うことを防ぎ、授業内で安全な問い返しとして使える形にします。</p>
          </div>}
        </aside>

        <section className="editor">
          {currentView === "diary" && (
            <DiaryView
              diary={diary}
              schoolFormat={activeSchoolFormat}
              tone={tone}
              busy={busy}
              status={status}
              samples={diarySamples}
              selectedSampleId={selectedSampleId}
              feedback={feedback}
              onToneChange={setTone}
              onChange={updateDiary}
              onEpisodeChange={updateDiaryEpisode}
              onApplyStudentChatStarterPatch={applyStudentChatStarterPatch}
              onAddEpisode={addDiaryEpisode}
              onRemoveEpisode={removeDiaryEpisode}
              onFeedbackChange={updateFeedback}
              onSubmit={handleDiarySubmit}
              onSample={loadDiarySample}
              onStudentChatAssist={handleStudentChatAssist}
              flowStep={studentFlowStep}
              privacyReview={privacyReview}
              checkedPayload={checkedPayload}
              result={result}
              finalDraft={finalDraft}
              finalCheck={finalCheck}
              copied={copied}
              onFlowStepChange={setStudentFlowStep}
              onConfirmSend={handleConfirmedGenerate}
              onFinalDraftChange={(value) => {
                setFinalDraft(value);
              }}
              onFinalCheck={handleFinalDraftCheck}
              onUseSanitizedFinal={useSanitizedFinalDraft}
              onCopyResult={copyResult}
              onCopyFinal={copyFinalDraft}
              onReset={() => {
                resetStudentFlow({ keepInput: false });
              }}
            />
          )}

          {currentView === "school" && (
            <SchoolAdminView
              schoolSummary={schoolSummary}
              schoolSummaryStatus={schoolSummaryStatus}
              schoolFormat={activeSchoolFormat}
              session={session}
              isPublicDemoSession={isPublicDemoSession}
            />
          )}
        </section>

        {!isStudent && currentView === "diary" && (
        <section className="output" aria-live="polite">
          <div className="output-header">
            <div>
              <span className="label">問い返し結果</span>
              <h2>問い返しと提出前の自己確認</h2>
            </div>
            <button className="secondary-button compact" type="button" onClick={copyResult} disabled={!result}>
              {copied ? "コピー済み" : "問いをコピー"}
            </button>
          </div>

          {!result ? (
            <div className="empty-state">
              <strong>自分で書いた記録に対して、問い返しと提出前の自己確認が出ます。</strong>
              <p>完成文ではなく、追記すべき点・安全確認・学校の担当教員に相談する問いを返します。</p>
            </div>
          ) : (
            <article className="result">
              {result.sections.map((section, index) => (
                <section className="result-section" key={`${result.headings[index]}-${index}`}>
                  <h3>{result.headings[index]}</h3>
                  <p>{section}</p>
                </section>
              ))}
              {buildFeedbackNextSteps(feedback).hasContent && (
                <section className="result-section feedback-result-section">
                  <h3>実習先フィードバックを踏まえた明日の観察</h3>
                  <p>{buildFeedbackNextSteps(feedback).focus}を意識し、実習先で受けた助言を翌日の具体的な観察に戻します。</p>
                  <ul>
                    {buildFeedbackNextSteps(feedback).observationPoints.map((point, index) => (
                      <li key={`${point}-${index}`}>{point}</li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="result-section">
                <h3>提出前の自己確認</h3>
                <ul>
                  {result.checks.map((check, index) => (
                    <li key={`${check}-${index}`}>{check}</li>
                  ))}
                </ul>
              </section>
            </article>
          )}
        </section>
        )}
      </section>
    </main>
  );
}

function AppGateCard({ title, description, actionLabel, actionHref, onAction }) {
  return (
    <main id="main-content" className="login-shell">
      <section className="login-card" aria-label={title}>
        <a className="lp-brand login-brand" href="/" aria-label="Manalioトップページへ">
          <img className="login-logo-horizontal" src="/images/manalio-logo-horizontal.svg" alt="Manalio" />
        </a>
        <div className="login-copy">
          <span className="lp-eyebrow">サービス画面</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {(actionHref || onAction) && (
          <div className="login-actions single-action">
            {actionHref ? (
              <a className="primary-button login-link" href={actionHref}>{actionLabel}</a>
            ) : (
              <button className="primary-button login-link" type="button" onClick={onAction}>{actionLabel}</button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function FeedbackPanel({
  feedback,
  onChange,
  onFocusFeedbackField,
  receivedRef,
  interpretationRef,
  unclearRef,
  tomorrowActionRef,
  teacherQuestionRef,
}) {
  const nextSteps = buildFeedbackNextSteps(feedback);
  const privacyCheck = buildClientPrivacyCheck(feedback);
  return (
    <section className="feedback-panel" aria-label="実習先指導員からのフィードバック入力">
      <div className="feedback-head">
        <div>
          <span className="label">実習先フィードバック</span>
          <h3>実習先で受けた助言</h3>
        </div>
      </div>
      <p className="feedback-note">
        受けた助言は、要点だけを自分の言葉で整理します。迷う部分は、担当教員への相談に残せます。
      </p>
      <FeedbackActionBridge feedback={feedback} onFocusField={onFocusFeedbackField} />
      <div className="feedback-field-grid">
        <TextAreaField
          label="助言の要点"
          value={feedback.received}
          inputRef={receivedRef}
          placeholder="例：子どもの姿だけでなく、保育者の関わりにも目を向けるとよいと助言を受けた。"
          onChange={(value) => onChange("received", value)}
        />
        <TextAreaField
          label="自分の理解"
          value={feedback.interpretation}
          inputRef={interpretationRef}
          placeholder="例：子どもの行動だけで終わらず、声かけ前後の変化を見る必要があると理解した。"
          onChange={(value) => onChange("interpretation", value)}
        />
        <TextAreaField
          label="まだ迷っていること"
          value={feedback.unclear}
          inputRef={unclearRef}
          placeholder="例：保育者の意図を、どこまで自分の考察として書いてよいか分からない。"
          onChange={(value) => onChange("unclear", value)}
        />
        <TextAreaField
          label="明日、見たいこと・試したいこと"
          value={feedback.tomorrowAction}
          inputRef={tomorrowActionRef}
          placeholder="例：声かけの前後で子どもの姿がどう変わったかをメモする。"
          onChange={(value) => onChange("tomorrowAction", value)}
        />
      </div>
      <label className="feedback-comment">
        学校の担当教員に相談したいこと
        <textarea ref={teacherQuestionRef} value={feedback.teacherQuestion} rows={3} placeholder="例：保育者の関わりを観察するとき、特に見るべき点を確認したい。" onChange={(event) => onChange("teacherQuestion", event.target.value)} />
      </label>
      {(privacyCheck.blockers.length > 0 || privacyCheck.warnings.length > 0 || privacyCheck.notes.length > 0) && (
        <PrivacyCheckPanel check={privacyCheck} mode="compact" />
      )}
      {nextSteps.hasContent && (
        <div className="feedback-next">
          <span className="label">翌日の観察ポイント</span>
          <strong>{nextSteps.focus}</strong>
          <ul>
            {nextSteps.observationPoints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function FeedbackActionBridge({ feedback, onFocusField }) {
  const items = buildFeedbackActionItems(feedback);
  const nextItem = items.find((item) => !item.done) || items[items.length - 1];
  return (
    <div className="feedback-action-bridge" aria-label="実習先フィードバックを翌日の行動へ戻す">
      <div className="feedback-action-head">
        <div>
          <span className="label">助言を明日の行動へ戻す</span>
          <strong>{nextItem.done ? "入力した助言を見直す" : `${nextItem.title}を書く`}</strong>
        </div>
        <em>{nextItem.done ? "書いた欄を見直せます" : `次に書く欄: ${nextItem.title}`}</em>
      </div>
      <div className="feedback-action-steps" aria-label="助言整理の順番">
        {items.map((item, index) => (
          <button
            className={`feedback-action-step ${item.done ? "done" : ""}`}
            type="button"
            key={item.target}
            aria-label={`${item.title}の${item.done ? "欄を確認" : "欄へ移動"}`}
            onClick={() => onFocusField(item.target)}
          >
            <span>{index + 1}</span>
            <strong>{item.title}</strong>
            <small>{item.done ? "書いた欄を見直す" : item.body}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function PrivacyCheckPanel({ check, mode = "default" }) {
  if (!check?.blockers?.length && !check?.warnings?.length && !check?.notes?.length) return null;
  return (
    <section className={`security-precheck ${mode === "compact" ? "compact" : ""}`} aria-live="polite" aria-label="問い返し前の安全確認">
      {check.blockers.length > 0 ? (
        <>
          <strong>個人が分かるかもしれない表現があります</strong>
          <p>名前、園名、連絡先などが伝わりすぎないよう、次の確認画面で安全な表現に整えて見直します。</p>
          <ul>{check.blockers.map((item) => <li key={item}>{item}</li>)}</ul>
        </>
      ) : null}
      {check.warnings.length > 0 ? (
        <>
          <strong>記録前に見ておきたい表現があります</strong>
          <p>診断のように読める表現や、実習先への受け止め方を問い返し前に見ます。</p>
          <ul>{check.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
        </>
      ) : null}
      {check.notes.length > 0 ? (
        <>
          <strong>そのまま使えそうな表現</strong>
          <ul className="privacy-note-list">{check.notes.map((item) => <li key={item}>{item}</li>)}</ul>
        </>
      ) : null}
    </section>
  );
}

function TextAreaField({ label, value, placeholder, onChange, inputRef }) {
  return (
    <label className="feedback-comment compact">
      {label}
      <textarea ref={inputRef} value={value} rows={3} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function DiaryView({
  diary,
  schoolFormat,
  tone,
  busy,
  status,
  samples,
  selectedSampleId,
  feedback,
  flowStep,
  privacyReview,
  checkedPayload,
  result,
  finalDraft,
  finalCheck,
  copied,
  onToneChange,
  onChange,
  onEpisodeChange,
  onApplyStudentChatStarterPatch,
  onAddEpisode,
  onRemoveEpisode,
  onFeedbackChange,
  onSubmit,
  onSample,
  onStudentChatAssist,
  onFlowStepChange,
  onConfirmSend,
  onFinalDraftChange,
  onFinalCheck,
  onUseSanitizedFinal,
  onCopyResult,
  onCopyFinal,
  onReset,
}) {
  const privacyCheck = useMemo(
    () => buildClientPrivacyCheck({
      ...diary,
      feedbackGuidanceCategory: feedback.guidanceCategory,
      feedbackReceived: feedback.received,
      feedbackInterpretation: feedback.interpretation,
      feedbackUnclear: feedback.unclear,
      feedbackTomorrowAction: feedback.tomorrowAction,
      feedbackTeacherQuestion: feedback.teacherQuestion,
    }),
    [diary, feedback],
  );
  const feedbackNextSteps = buildFeedbackNextSteps(feedback);
  const scaffoldDraft = result
    ? buildDiaryScaffoldDraft(checkedPayload, result, feedbackNextSteps)
    : "";
  const canConfirm = Boolean(privacyReview && checkedPayload);
  const canRevise = Boolean(result);
  const canFinal = Boolean(finalCheck);
  const showStepNavigation = flowStep !== "input" || canConfirm || canRevise || canFinal;

  return (
    <div className={`view-panel student-flow-panel step-${flowStep}`}>
      <div className="student-work-header">
        <div>
          <span className="label">今日の実習記録</span>
          <h2>{getStudentFlowTitle(flowStep)}</h2>
          {flowStep !== "input" && <p>{getStudentFlowDescription(flowStep)}</p>}
        </div>
        {showStepNavigation && (
          <StudentFlowTabs
            activeStep={flowStep}
            canConfirm={canConfirm}
            canRevise={canRevise}
            canFinal={canFinal}
            onChange={onFlowStepChange}
          />
        )}
      </div>

      {status && (
        <p className="student-operation-status" role="status" aria-live="polite">{status}</p>
      )}

      {flowStep === "input" && (
        <StudentInputStep
          diary={diary}
          schoolFormat={schoolFormat}
          tone={tone}
          busy={busy}
          samples={samples}
          selectedSampleId={selectedSampleId}
          feedback={feedback}
          privacyCheck={privacyCheck}
          initialInputMode={privacyReview ? "format" : "chat"}
          onToneChange={onToneChange}
          onChange={onChange}
          onEpisodeChange={onEpisodeChange}
          onApplyStudentChatStarterPatch={onApplyStudentChatStarterPatch}
          onAddEpisode={onAddEpisode}
          onRemoveEpisode={onRemoveEpisode}
          onFeedbackChange={onFeedbackChange}
          onSubmit={onSubmit}
          onSample={onSample}
          onStudentChatAssist={onStudentChatAssist}
          onReset={onReset}
        />
      )}

      {flowStep === "confirm" && (
        <StudentConfirmStep
          review={privacyReview}
          checkedPayload={checkedPayload}
          busy={busy}
          onBack={() => onFlowStepChange("input")}
          onConfirm={onConfirmSend}
        />
      )}

      {flowStep === "revise" && (
        <StudentReviseStep
          result={result}
          feedbackNextSteps={feedbackNextSteps}
          checkedPayload={checkedPayload}
          scaffoldDraft={scaffoldDraft}
          finalDraft={finalDraft}
          copied={copied}
          busy={busy}
          onBack={() => onFlowStepChange("confirm")}
          onCopyResult={onCopyResult}
          onFinalDraftChange={onFinalDraftChange}
          onFinalCheck={onFinalCheck}
        />
      )}

      {flowStep === "final" && (
        <StudentFinalStep
          finalDraft={finalDraft}
          scaffoldDraft={scaffoldDraft}
          finalCheck={finalCheck}
          copied={copied}
          busy={busy}
          onFinalDraftChange={onFinalDraftChange}
          onFinalCheck={onFinalCheck}
          onUseSanitizedFinal={onUseSanitizedFinal}
          onCopyFinal={onCopyFinal}
          onBack={() => onFlowStepChange("revise")}
        />
      )}
    </div>
  );
}

function getStudentFlowTitle(step) {
  return {
    input: "今日の実習を一つずつ振り返る",
    confirm: "安全な表現を確認する",
    revise: "元の記録と整理案を比べて直す",
    final: "提出前に記録を確認する",
  }[step] || "今日の実習を一つずつ振り返る";
}

function getStudentFlowDescription(step) {
  return {
    input: "学校の日誌項目に沿って、まず自分の言葉で書きます。エピソード数は学校の型に合わせて増減できます。",
    confirm: "Manalioが安全な表現に整えた内容を確認します。ここで納得してから問い返しへ進みます。",
    revise: "安全確認後の元文章と整理案を横に並べ、足りない根拠や違う表現を自分で直します。",
    final: "提出前に、学生が自分で書いた記録へ個人情報や要配慮情報が残っていないか確認します。",
  }[step] || "";
}

function StudentFlowTabs({ activeStep, canConfirm, canRevise, canFinal, onChange }) {
  const enabledSteps = {
    input: true,
    confirm: canConfirm,
    revise: canRevise,
    final: canFinal || canRevise,
  };
  return (
    <div className="student-flow-tabs" aria-label="処理フロー">
      {STUDENT_FLOW_STEPS.map(([step, label, subLabel], index) => (
        <button
          key={step}
          className={`student-flow-tab ${activeStep === step ? "active" : ""}`}
          type="button"
          disabled={!enabledSteps[step]}
          aria-current={activeStep === step ? "step" : undefined}
          onClick={() => onChange(step)}
        >
          <span>{index + 1}</span>
          <strong>{label}</strong>
          <small>{subLabel}</small>
        </button>
      ))}
    </div>
  );
}

function StudentInputStep({
  diary,
  schoolFormat,
  tone,
  busy,
  samples,
  selectedSampleId,
  feedback,
  privacyCheck,
  initialInputMode,
  onToneChange,
  onChange,
  onEpisodeChange,
  onApplyStudentChatStarterPatch,
  onAddEpisode,
  onRemoveEpisode,
  onFeedbackChange,
  onSubmit,
  onSample,
  onStudentChatAssist,
  onReset,
}) {
  const episodes = normalizeDiaryEpisodes(diary.episodes, diary.memo, diary.reflection);
  const fieldRefs = useRef({});
  const diaryFieldLabels = buildStudentDiaryFieldLabels(schoolFormat);
  const diaryRequirements = buildStudentDiaryRequirements(schoolFormat);
  const minimumPathItems = buildStudentMinimumPathItems(diary, schoolFormat);
  const writingCoach = buildStudentWritingCoach(diary, feedback, schoolFormat);
  const selfReviewPrompts = buildStudentSelfReviewPrompts(diary, feedback, schoolFormat);
  const readyForSafetyCheck = writingCoach.readyForSafetyCheck;
  const supportCount = writingCoach.doneCount;
  const [inputMode, setInputMode] = useState(initialInputMode === "format" ? "format" : "chat");
  const [chatOrganization, setChatOrganization] = useState(null);
  const [chatSource, setChatSource] = useState(null);
  const [chatConversation, setChatConversation] = useState(null);
  const [chatOrganizationError, setChatOrganizationError] = useState("");
  const formatHeadingRef = useRef(null);
  const comparisonRef = useRef(null);

  useEffect(() => {
    if (inputMode === "chat") return;
    window.requestAnimationFrame(() => {
      const target = inputMode === "compare" ? comparisonRef.current : formatHeadingRef.current;
      target?.focus();
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [inputMode]);

  function registerStudentField(key) {
    return (element) => {
      if (element) fieldRefs.current[key] = element;
    };
  }

  function getStudentFieldKey(target, mode = "write") {
    if (target === "episodeMemo") {
      const episodeIndex = mode === "review" ? getEpisodeReviewIndex(episodes, "memo") : getEpisodeStarterIndex(episodes, "memo");
      return `episodeMemo:${episodeIndex}`;
    }
    if (target === "episodeInsight") {
      const episodeIndex = mode === "review" ? getEpisodeReviewIndex(episodes, "insight") : getEpisodeStarterIndex(episodes, "insight");
      return `episodeInsight:${episodeIndex}`;
    }
    if (target === "feedbackReceived") return "feedbackReceived";
    if (target === "feedbackInterpretation") return "feedbackInterpretation";
    if (target === "feedbackUnclear") return "feedbackUnclear";
    if (target === "feedbackTomorrowAction") return "feedbackTomorrowAction";
    if (target === "feedbackTeacherQuestion") return "feedbackTeacherQuestion";
    return target;
  }

  function focusStudentField(target, mode = "write") {
    const element = fieldRefs.current[getStudentFieldKey(target, mode)];
    if (!element) return;
    element.focus();
    element.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function openOrganizationComparison() {
    if (!chatOrganization || !chatSource) return;
    setChatOrganizationError("");
    setInputMode("compare");
  }

  function applyOrganizationToFormat() {
    if (!isStudentChatSourceCurrent({ source: chatSource, diary })) {
      setChatOrganizationError("元メモが変わったため、古い書き出し補助は置きません。現在の学校フォーマットを続けるか、チャットで整理し直してください。");
      setChatOrganization(null);
      setChatSource(null);
      setChatConversation(null);
      setInputMode("format");
      return;
    }
    const starterPatch = buildStudentChatDiaryStarterPatch({ organization: chatOrganization, source: chatSource });
    setChatOrganizationError("");
    onApplyStudentChatStarterPatch(starterPatch);
    setInputMode("format");
  }

  function loadSampleWithoutStaleComparison(sample) {
    setChatOrganization(null);
    setChatSource(null);
    setChatConversation(null);
    setChatOrganizationError("");
    onSample(sample);
  }

  function resetStudentInput() {
    setChatOrganization(null);
    setChatSource(null);
    setChatConversation(null);
    setChatOrganizationError("");
    setInputMode("chat");
    onReset();
  }

  return (
    <div className="student-step-card">
      {inputMode === "chat" ? (
        <StudentChatCaptureStep
          readyForSafetyCheck={readyForSafetyCheck}
          diary={diary}
          episodes={episodes}
          schoolFormat={schoolFormat}
          initialConversation={chatConversation}
          onChange={onChange}
          onEpisodeChange={onEpisodeChange}
          onStudentChatAssist={onStudentChatAssist}
          onOrganizationReady={({ organization, source, conversation }) => {
            setChatOrganization(organization);
            setChatSource(source);
            setChatConversation(conversation);
            setChatOrganizationError("");
          }}
          onUseOrganization={openOrganizationComparison}
          onOpenFormat={() => setInputMode("format")}
        />
      ) : inputMode === "compare" ? (
        <div className="student-chat-compare-step">
          {chatOrganizationError && <p className="student-chat-error" role="alert">{chatOrganizationError}</p>}
          {chatOrganization && chatSource ? (
            <>
              <StudentChatOrganizationCompare
                source={chatSource}
                organization={chatOrganization}
                schoolFormat={schoolFormat}
                focusRef={comparisonRef}
              />
              <div className="student-chat-compare-actions">
                <p>比較を確認してから、学校フォーマットへ進みます。</p>
                <div className="actions">
                  <button className="primary-button" type="button" onClick={applyOrganizationToFormat}>学校フォーマットへ反映して直す</button>
                  <button className="secondary-button" type="button" onClick={() => setInputMode("chat")}>チャットに戻る</button>
                </div>
              </div>
            </>
          ) : (
            <p className="student-chat-error" role="alert">比較する内容がありません。チャットに戻って出来事を整理してください。</p>
          )}
        </div>
      ) : (
        <>
          <div className="student-entry-card" aria-label="入力の入口">
            <div className="student-entry-main">
              <span className="label">次にすること</span>
              <strong>{readyForSafetyCheck ? "安全確認へ進めます" : "学校フォーマットで確認する"}</strong>
              <p>
                {readyForSafetyCheck
                  ? "下のボタンで、問い返し前の本文を確認します。意味が変わっていなければ次へ進みます。"
                  : "チャットで出した一言を、学校フォーマットの欄で直します。迷った時だけ補助を開きます。"}
              </p>
            </div>
            <button
              className="secondary-button compact student-chat-return"
              type="button"
              onClick={() => setInputMode(chatOrganization && chatSource ? "compare" : "chat")}
            >
              {chatOrganization && chatSource ? "比較に戻る" : "チャットに戻る"}
            </button>
            <em className="student-entry-chip">{supportCount >= 3 ? "比較用の整理案を作れます" : "書ける欄から埋めれば進めます"}</em>
          </div>

          {chatOrganizationError && <p className="student-chat-error" role="alert">{chatOrganizationError}</p>}

          <form className="form-grid" onSubmit={onSubmit}>
            <div className="form-section-title wide" ref={formatHeadingRef} tabIndex={-1}>
              <span>1</span>
              <div>
                <strong>学校フォーマット</strong>
                <p>今日見た場面、そこからの気づき、明日見る一点を順番に書きます。</p>
              </div>
            </div>
            {hasMeaningfulText(diary.goal) && (
              <aside className="student-goal-reference wide" aria-label="チャットで答えた実習目標">
                <span>チャットで答えた実習目標</span>
                <p>{diary.goal}</p>
              </aside>
            )}
            <label className="wide">
              {diaryFieldLabels.goalReflection}
              <textarea ref={registerStudentField("goalReflection")} value={diary.goalReflection || ""} rows={4} placeholder={"例：子ども同士の関わりを観察することを目標にしていた。自由遊びでは、A児とB児のやり取りを見たが、どこまで見守るか判断に迷った。"} onChange={(event) => onChange("goalReflection", event.target.value)} />
            </label>
            <div className="episode-editor wide">
              <div className="episode-editor-head">
                <div>
                  <strong>{diaryFieldLabels.episodeMemo}</strong>
                  <p>この学校では{diaryRequirements.episodes.requiredCount}件が必要です。最大{diaryRequirements.episodes.maxCount}件まで追加できます。</p>
                </div>
                <button className="secondary-button compact" type="button" onClick={onAddEpisode} disabled={episodes.length >= diaryRequirements.episodes.maxCount}>エピソードを追加</button>
              </div>
              <div className="episode-list">
                {episodes.map((episode, index) => (
                  <article className="episode-card" key={episode.id || index}>
                    <div className="episode-card-head">
                      <strong>{diaryFieldLabels.episodeMemo}{index + 1}</strong>
                      <button className="secondary-button compact" type="button" onClick={() => onRemoveEpisode(index)} disabled={episodes.length <= diaryRequirements.episodes.minCount}>
                        削除
                      </button>
                    </div>
                    <label>
                      {diaryFieldLabels.episodeMemo}の場面・子どもの姿・自分の関わり
                      <textarea ref={registerStudentField(`episodeMemo:${index}`)} value={episode.memo || ""} rows={5} placeholder={"例：A児がブロックで線路を作っていた。B児が近づくと、A児はブロックを手で押さえた。私は少し見守った。"} onChange={(event) => onEpisodeChange(index, "memo", event.target.value)} />
                    </label>
                    <label>
                      {diaryFieldLabels.episodeInsight}
                      <small>この{diaryFieldLabels.episodeMemo}からの気づき・感じたこと</small>
                      <textarea ref={registerStudentField(`episodeInsight:${index}`)} value={episode.insight || ""} rows={3} placeholder={"例：すぐに間に入る前に、子ども同士で調整する姿を見ることも大切だと感じた。"} onChange={(event) => onEpisodeChange(index, "insight", event.target.value)} />
                    </label>
                  </article>
                ))}
              </div>
            </div>
            <label className="wide">
              {diaryFieldLabels.overallLearning}
              <textarea ref={registerStudentField("overallLearning")} value={diary.overallLearning || ""} rows={5} placeholder={"エピソード全体を通しての総合的な気づき。\n例：子どもの行動だけを見るのではなく、言葉に出ていない気持ちや、友だちとの関係の変化を丁寧に見ることが大切だと感じた。"} onChange={(event) => onChange("overallLearning", event.target.value)} />
            </label>
            <label className="wide">
              {diaryFieldLabels.nextAction}
              <textarea ref={registerStudentField("nextAction")} value={diary.nextAction || ""} rows={4} placeholder={"例：自由遊びで子ども同士のやり取りが起きた時、すぐに声をかけず、言葉・視線・物の渡し方を少し観察する。"} onChange={(event) => onChange("nextAction", event.target.value)} />
            </label>
            <details className="student-feedback-details wide">
              <summary>
                <div>
                  <span className="label">必要な時だけ</span>
                  <strong>実習先で受けた助言を記録する</strong>
                  <p>受けた指導がある時だけ、自分の理解と翌日の観察に戻します。</p>
                </div>
              </summary>
              <FeedbackPanel
                feedback={feedback}
                onChange={onFeedbackChange}
                onFocusFeedbackField={focusStudentField}
                receivedRef={registerStudentField("feedbackReceived")}
                interpretationRef={registerStudentField("feedbackInterpretation")}
                unclearRef={registerStudentField("feedbackUnclear")}
                tomorrowActionRef={registerStudentField("feedbackTomorrowAction")}
                teacherQuestionRef={registerStudentField("feedbackTeacherQuestion")}
              />
            </details>
            <details className="optional-inputs wide">
              <summary>必要な時だけ、日付・年齢・ねらいを直す</summary>
              <div className="optional-input-grid">
                <label>
                  日付
                  <input aria-label="日付" type="date" value={diary.date} onChange={(event) => onChange("date", event.target.value)} />
                </label>
                <label>
                  天気
                  <select aria-label="天気" value={diary.weather} onChange={(event) => onChange("weather", event.target.value)}>
                    {["晴れ", "くもり", "雨", "雪"].map((weather) => <option key={weather}>{weather}</option>)}
                  </select>
                </label>
                <label>
                  クラス・年齢
                  <select aria-label="クラス・年齢" value={diary.age} onChange={(event) => onChange("age", event.target.value)}>
                    {["0歳児クラス", "1歳児クラス", "2歳児クラス", "3歳児クラス", "4歳児クラス", "5歳児クラス", "異年齢保育"].map((age) => <option key={age}>{age}</option>)}
                  </select>
                </label>
                <label>
                  場面
                  <select aria-label="場面" value={diary.scene} onChange={(event) => onChange("scene", event.target.value)}>
                    {["朝の自由遊び", "戸外遊び", "製作活動", "食事", "午睡", "帰りの会", "部分実習"].map((scene) => <option key={scene}>{scene}</option>)}
                  </select>
                </label>
                <label className="wide">
                  今日のねらい
                  <input aria-label="今日のねらい" value={diary.goal} placeholder="例：子ども同士の関わりを観察し、保育者の援助を学ぶ" onChange={(event) => onChange("goal", event.target.value)} />
                </label>
              </div>
            </details>
            <details className="advanced-options wide">
              <summary>必要な時だけ、問い返しの深さを変える</summary>
              <div className="mode-switch" role="group" aria-label="問い返しの深さ">
                {[
                  ["short", "短め"],
                  ["balanced", "標準"],
                  ["deep", "深め"],
                ].map(([value, label]) => (
                  <button key={value} className={`mode ${tone === value ? "active" : ""}`} type="button" aria-label={`問い返しの深さ: ${label}`} onClick={() => onToneChange(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </details>
            {(privacyCheck.blockers.length > 0 || privacyCheck.warnings.length > 0 || privacyCheck.notes.length > 0) && (
              <div className="wide">
                <PrivacyCheckPanel check={privacyCheck} />
              </div>
            )}
            <StudentSubmitReadiness coach={writingCoach} onFocusTarget={focusStudentField} />
            <div className="actions wide">
              <button className="primary-button" type="submit" disabled={busy || !readyForSafetyCheck}>{busy ? "安全確認中..." : readyForSafetyCheck ? "安全な表現を確認" : "必要な欄を先に書く"}</button>
              <button className="secondary-button" type="button" onClick={resetStudentInput}>クリア</button>
            </div>
            <StudentSelfReviewPanel prompts={readyForSafetyCheck || selectedSampleId ? selfReviewPrompts : []} onFocusTarget={focusStudentField} />
          </form>
          <StudentSupportDetails
            minimumPathItems={minimumPathItems}
            writingCoach={writingCoach}
            diary={diary}
            episodes={episodes}
            feedback={feedback}
            diaryFieldLabels={diaryFieldLabels}
            samples={samples}
            selectedSampleId={selectedSampleId}
            onSample={loadSampleWithoutStaleComparison}
            onChange={onChange}
            onEpisodeChange={onEpisodeChange}
            onFeedbackChange={onFeedbackChange}
            onFocusStudentField={focusStudentField}
          />
        </>
      )}
    </div>
  );
}

function StudentChatCaptureStep({
  readyForSafetyCheck,
  diary,
  episodes,
  schoolFormat,
  initialConversation,
  onChange,
  onEpisodeChange,
  onStudentChatAssist,
  onOrganizationReady,
  onUseOrganization,
  onOpenFormat,
}) {
  const diaryFieldLabels = buildStudentDiaryFieldLabels(schoolFormat);
  const initialEpisodeIndex = getStudentChatEpisodeIndex(episodes);
  const initialEpisodeMemo = episodes[initialEpisodeIndex]?.memo || "";
  const restoredConversation = initialConversation?.stage === "review" ? initialConversation : null;
  const [stage, setStage] = useState(() => restoredConversation?.stage || getInitialStudentChatStage(diary, episodes));
  const [episodeIndex, setEpisodeIndex] = useState(initialEpisodeIndex);
  const [answer, setAnswer] = useState("");
  const [apiReply, setApiReply] = useState(() => restoredConversation?.apiReply || null);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiError, setApiError] = useState("");
  const [followUpQuestion, setFollowUpQuestion] = useState(() => restoredConversation?.followUpQuestion || (hasMeaningfulText(initialEpisodeMemo)
    ? "その時、自分はどのように関わり、その後どのような姿が見られましたか。"
    : ""));
  const [chatAnswers, setChatAnswers] = useState(() => restoredConversation?.chatAnswers || ({
    goal: hasMeaningfulText(diary.goal) ? String(diary.goal).trim() : "",
    episode: hasMeaningfulText(initialEpisodeMemo) ? String(initialEpisodeMemo).trim() : "",
    detail: "",
  }));
  const answerInputRef = useRef(null);
  const alertRef = useRef(null);
  const threadRef = useRef(null);
  const requestInFlightRef = useRef(false);
  const guidance = getStudentChatCaptureCopy(stage, apiReply, readyForSafetyCheck);
  const normalizedAnswer = answer.trim();
  const answerReady = hasMeaningfulText(normalizedAnswer);
  const organization = getStudentChatOrganizationForComparison(stage, apiReply);

  useEffect(() => {
    setAnswer("");
    if (stage !== "review") {
      window.requestAnimationFrame(() => {
        answerInputRef.current?.focus();
      });
    }
  }, [stage]);

  useEffect(() => {
    const hasGoal = hasMeaningfulText(diary.goal);
    const hasEpisode = episodes.some((episode) => hasMeaningfulText(episode.memo));
    if (!hasGoal && !hasEpisode) {
      setStage("goal");
      setEpisodeIndex(getStudentChatEpisodeIndex(episodes));
      setChatAnswers({ goal: "", episode: "", detail: "" });
      setFollowUpQuestion("");
      setApiReply(null);
      setApiError("");
      return;
    }
    if (stage === "goal" && hasGoal) {
      setChatAnswers((current) => current.goal
        ? current
        : { ...current, goal: String(diary.goal).trim() });
      setStage(hasEpisode ? "detail" : "episode");
    }
  }, [diary.goal, episodes, stage]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [apiBusy, chatAnswers.detail, chatAnswers.episode, chatAnswers.goal, stage]);

  useEffect(() => {
    if (!apiError) return;
    window.requestAnimationFrame(() => {
      alertRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [apiError]);

  async function applyAnswer(event) {
    event?.preventDefault();
    if (stage === "review" || !answerReady || apiBusy || requestInFlightRef.current) return;
    const answerText = normalizedAnswer;
    if (stage === "goal") {
      const localPrivacyCheck = buildClientPrivacyCheck({ goal: answerText });
      if (localPrivacyCheck.blockers.length > 0 || localPrivacyCheck.warnings.length > 0) {
        setApiError("実習目標に個人や実習先が分かる表現があります。名前や園名を外してから保存してください。");
        return;
      }
      onChange("goal", answerText);
      setChatAnswers((current) => ({ ...current, goal: answerText }));
      setAnswer("");
      setApiReply(null);
      setApiError("");
      setStage("episode");
      return;
    }

    const localPrivacyCheck = buildClientPrivacyCheck({ memo: answerText });
    if (localPrivacyCheck.blockers.length > 0 || localPrivacyCheck.warnings.length > 0) {
      setApiError("個人や実習先が分かる表現があります。名前や園名を外してから送信してください。");
      return;
    }

    const currentEpisodeMemo = episodes[episodeIndex]?.memo || "";
    const requestStage = stage === "episode" ? "episode" : "organize";
    requestInFlightRef.current = true;
    setApiBusy(true);
    setApiError("");
    try {
      const reply = await onStudentChatAssist({
        stage: requestStage,
        target: "episodeMemo",
        practiceGoal: diary.goal,
        episodeMemo: currentEpisodeMemo,
        answer: answerText,
      });
      const nextEpisodeMemo = appendStarterText(currentEpisodeMemo, answerText);
      onEpisodeChange(episodeIndex, "memo", nextEpisodeMemo);
      setAnswer("");
      setApiReply(reply);
      if (requestStage === "organize") {
        const completedChatAnswers = { ...chatAnswers, detail: answerText };
        setChatAnswers(completedChatAnswers);
        const source = {
          practiceGoal: diary.goal,
          episodeMemo: nextEpisodeMemo,
          episodeIndex,
        };
        onOrganizationReady?.({
          organization: reply.organization || createEmptyStudentChatOrganization(),
          source,
          conversation: {
            stage: "review",
            apiReply: reply,
            chatAnswers: completedChatAnswers,
            followUpQuestion,
          },
        });
        setStage("review");
      } else {
        setChatAnswers((current) => ({ ...current, episode: answerText }));
        setFollowUpQuestion(reply.nextQuestion || "その時、自分はどのように関わり、その後どのような姿が見られましたか。");
        setStage("detail");
      }
    } catch (error) {
      setApiError(error?.message || "AIの返答を取得できませんでした。入力は残っているため、そのまま再試行できます。");
    } finally {
      requestInFlightRef.current = false;
      setApiBusy(false);
    }
  }

  function openFormat() {
    if (requestInFlightRef.current) return;
    if (normalizedAnswer.length > 0) {
      const localPrivacyCheck = buildClientPrivacyCheck(
        stage === "goal" ? { goal: normalizedAnswer } : { memo: normalizedAnswer },
      );
      if (localPrivacyCheck.blockers.length > 0 || localPrivacyCheck.warnings.length > 0) {
        setApiError("個人や実習先が分かる表現があります。名前や園名を外してから学校フォーマットへ進んでください。");
        return;
      }
      if (stage === "goal") {
        onChange("goal", normalizedAnswer);
      } else if (stage === "episode" || stage === "detail") {
        onEpisodeChange(episodeIndex, "memo", appendStarterText(episodes[episodeIndex]?.memo, normalizedAnswer));
      }
    }
    onOpenFormat();
  }

  const progressLabel = stage === "goal"
    ? "1 / 3　実習目標"
    : stage === "review"
      ? "3 / 3　整理完了"
      : stage === "detail"
        ? "2 / 3　追加確認"
        : "2 / 3　出来事";
  const messages = [
    {
      id: "goal-question",
      role: "assistant",
      title: "その日の実習目標",
      body: getStudentChatCaptureCopy("goal").question,
    },
  ];

  if (chatAnswers.goal) {
    messages.push(
      { id: "goal-answer", role: "user", body: chatAnswers.goal },
      {
        id: "episode-question",
        role: "assistant",
        title: "印象に残った出来事",
        body: getStudentChatCaptureCopy("episode").question,
      },
    );
  }

  if (chatAnswers.goal && chatAnswers.episode) {
    messages.push(
      { id: "episode-answer", role: "user", body: chatAnswers.episode },
      {
        id: "detail-question",
        role: "assistant",
        title: "もう一つだけ確認",
        body: followUpQuestion || getStudentChatCaptureCopy("detail").question,
      },
    );
  }

  if (chatAnswers.goal && chatAnswers.episode && chatAnswers.detail) {
    messages.push(
      { id: "detail-answer", role: "user", body: chatAnswers.detail },
      {
        id: "review-ready",
        role: "assistant",
        title: "整理できました",
        body: "次の画面で元メモと書き出し補助を見比べ、【 】を今日の事実と自分の考えに直します。",
      },
    );
  }

  if (apiBusy) {
    messages.push(
      { id: "pending-answer", role: "user", body: normalizedAnswer, pending: true },
      {
        id: "pending-reply",
        role: "assistant",
        title: guidance.loadingTitle,
        body: guidance.loadingMessage,
        pending: true,
      },
    );
  }

  return (
    <section className="student-chat-capture" aria-label="Manalioとの会話で実習記録を整理する">
      <div className="student-chat-head">
        <span className="label">Manalioとの会話</span>
        <strong>{progressLabel}</strong>
      </div>
      <div
        className="student-chat-thread"
        ref={threadRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={apiBusy}
      >
        {messages.map((message) => (
          <div className={`student-chat-row ${message.role}`} key={message.id}>
            <div className={`student-chat-bubble ${message.role} ${message.pending ? "loading" : ""}`}>
              <span>{message.role === "assistant" ? "Manalio" : "あなた"}</span>
              {message.title && <strong>{message.title}</strong>}
              <p>{message.body}</p>
            </div>
          </div>
        ))}
      </div>
      {stage !== "review" ? (
        <form className="student-chat-composer" onSubmit={applyAnswer}>
          <label htmlFor="student-chat-answer">{guidance.inputLabel}</label>
          {apiError && (
            <p id="student-chat-error" className="student-chat-error" role="alert" ref={alertRef}>
              {apiError}
            </p>
          )}
          <div className="student-chat-composer-row">
            <textarea
              id="student-chat-answer"
              ref={answerInputRef}
              value={answer}
              rows={3}
              maxLength={1200}
              placeholder={guidance.placeholder}
              disabled={apiBusy}
              aria-invalid={apiError ? "true" : undefined}
              aria-describedby={apiError ? "student-chat-error student-chat-help" : "student-chat-help"}
              onChange={(event) => {
                setAnswer(event.target.value);
                if (apiError) setApiError("");
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                if (answerReady && !apiBusy) event.currentTarget.form?.requestSubmit();
              }}
            />
            <button className="primary-button student-chat-send" type="submit" disabled={!answerReady || apiBusy}>
              {apiBusy ? "確認中..." : "送信"}
            </button>
          </div>
          <div className="student-chat-composer-meta">
            <p id="student-chat-help">{guidance.help}</p>
            <button className="student-chat-format-link" type="button" onClick={openFormat} disabled={apiBusy}>学校フォーマットで書く</button>
          </div>
        </form>
      ) : (
        <div className="student-chat-complete-actions">
          <button className="primary-button" type="button" onClick={onUseOrganization} disabled={!organization}>
            元メモと書き出し補助を見比べる
          </button>
        </div>
      )}
    </section>
  );
}

function getInitialStudentChatStage(diary, episodes) {
  if (!hasMeaningfulText(diary.goal)) return "goal";
  return episodes.some((episode) => hasMeaningfulText(episode.memo)) ? "detail" : "episode";
}

function getStudentChatEpisodeIndex(episodes) {
  const filledIndex = episodes.findIndex((episode) => hasMeaningfulText(episode.memo));
  return filledIndex >= 0 ? filledIndex : getEpisodeStarterIndex(episodes, "memo");
}

function getStudentChatCaptureCopy(stage, apiReply, readyForSafetyCheck) {
  if (stage === "goal") {
    return {
      title: "その日の実習目標",
      question: "今日の実習目標は何ですか。学校から示された文を、そのまま入れても大丈夫です。",
      inputLabel: "実習目標",
      placeholder: "例：子ども同士の関わりを観察し、保育者の援助を学ぶ。",
      loadingTitle: "目標を保存しています",
      loadingMessage: "次に、今日あった出来事を一つ聞きます。",
      help: "学校から示された目標か、自分で決めた目標を入力します。",
    };
  }
  if (stage === "episode") {
    return {
      title: "印象に残った出来事",
      question: "今日いちばん覚えている出来事は何ですか。短いメモで大丈夫です。",
      inputLabel: "出来事メモ",
      placeholder: "例：自由遊びで、A児がブロックを持ってB児の近くにいた。",
      loadingTitle: "追加の問いを作っています",
      loadingMessage: "出来事を日誌に整理するため、足りない事実を一つだけ確認します。",
      help: "名前や園名は入れず、A児、B児、実習先園のように書きます。",
    };
  }
  if (stage === "detail") {
    return {
      title: "もう一つだけ確認",
      question: apiReply?.nextQuestion || "その時、自分はどのように関わり、その後どのような姿が見られましたか。",
      inputLabel: "追加メモ",
      placeholder: "見たこと、自分がしたこと、その後に見られたことを一つだけ。",
      loadingTitle: "整理案を作っています",
      loadingMessage: "実習目標、出来事、追加メモだけを使って、専門的な見方と書き出しを整理します。",
      help: "分からない部分は推測せず、分からないまま残して大丈夫です。",
    };
  }
  return {
    title: "元メモと書き出し補助を比べる",
    question: apiReply?.nextQuestion || "事実と違う部分がないか確認してから、学校フォーマットで自分の文章に直します。",
    inputLabel: "",
    placeholder: "",
    loadingTitle: "整理案を作っています",
    loadingMessage: "",
    help: readyForSafetyCheck
      ? "整理案を置いた後も、提出前に自分の言葉と安全な表現を確認します。"
      : "整理案は完成文ではありません。元メモにないことを削り、自分の言葉へ直します。",
  };
}

function StudentChatOrganizationCompare({ source, organization, schoolFormat, focusRef }) {
  if (!source || !organization) return null;
  const diaryFieldLabels = buildStudentDiaryFieldLabels(schoolFormat);
  const starterPatch = buildStudentChatDiaryStarterPatch({ organization, source });
  const professionalReview = organization.professionalReview || {};
  const organizedItems = [
    { key: "episodeMemo", label: `${diaryFieldLabels.episodeMemo}（比較用の整理）`, value: organization.factSummary },
    { key: "goalReflection", label: diaryFieldLabels.goalReflection, value: starterPatch.goalReflection },
    { key: "episodeInsight", label: diaryFieldLabels.episodeInsight, value: starterPatch.episodeInsight },
    { key: "overallLearning", label: diaryFieldLabels.overallLearning, value: starterPatch.overallLearning },
    { key: "nextAction", label: diaryFieldLabels.nextAction, value: starterPatch.nextAction },
  ].filter((item) => item.value);
  return (
    <section
      className="student-chat-organization"
      aria-label="元メモと書き出し補助の比較"
      ref={focusRef}
      tabIndex={-1}
    >
      <div className="student-chat-organization-head">
        <strong>元メモと書き出し補助</strong>
        <p>左は自分が書いた内容、右は書き始めるための型です。【 】の中を今日の事実と自分の考えに直します。</p>
      </div>
      <div className="student-chat-organization-grid">
        <div className="student-chat-source">
          <span>元メモ</span>
          <dl>
            <div><dt>実習目標</dt><dd>{source.practiceGoal || "未入力"}</dd></div>
            <div><dt>出来事</dt><dd>{source.episodeMemo || "未入力"}</dd></div>
          </dl>
        </div>
        <div className="student-chat-organized">
          <span>書き出し補助</span>
          <dl>
            {organizedItems.map(({ key, label, value }) => (
              <div key={key}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          {(professionalReview.reason || professionalReview.revisionPrompt || organization.missingInformation) && (
            <details className="student-chat-review-details">
              <summary>見直す観点を確認</summary>
              {professionalReview.focusText && <p><strong>見る箇所</strong>{professionalReview.focusText}</p>}
              {professionalReview.reason && <p><strong>理由</strong>{professionalReview.reason}</p>}
              {professionalReview.revisionPrompt && <p><strong>次に直すこと</strong>{professionalReview.revisionPrompt}</p>}
              {organization.missingInformation && <p><strong>まだ確認すること</strong>{organization.missingInformation}</p>}
            </details>
          )}
        </div>
      </div>
    </section>
  );
}

function StudentSupportDetails({
  minimumPathItems,
  writingCoach,
  diary,
  episodes,
  feedback,
  diaryFieldLabels,
  samples,
  selectedSampleId,
  onSample,
  onChange,
  onEpisodeChange,
  onFeedbackChange,
  onFocusStudentField,
}) {
  return (
    <details className="student-support-details">
      <summary className="student-support-summary">
        <div>
          <span className="label">必要な時だけ</span>
          <strong>入力例・書き方補助を開く</strong>
          <p>まずは学校フォーマットへ書きます。詰まった時だけ、最小ルートと30秒入口を使います。</p>
        </div>
        <span className="student-support-summary-action">開く</span>
      </summary>
      <div className="student-support-details-body">
        <StudentMinimumPath items={minimumPathItems} onFocusTarget={onFocusStudentField} />
        <StudentWritingCoachPanel
          coach={writingCoach}
          diary={diary}
          episodes={episodes}
          feedback={feedback}
          onChange={onChange}
          onEpisodeChange={onEpisodeChange}
          onFeedbackChange={onFeedbackChange}
          onFocusTarget={onFocusStudentField}
        />
        <details className="student-support-subdetails">
          <summary>
            <strong>安全な架空入力例を使う</strong>
            <span>入力に迷う時だけ開く</span>
          </summary>
          <SampleLibrary title="安全な架空入力例" description="選ぶと主要な入力欄が入ります。自由入力でもそのまま進めます。" samples={samples} selectedSampleId={selectedSampleId} onSelect={onSample} />
        </details>
        <details className="student-support-subdetails">
          <summary>
            <strong>欄の見方を開く</strong>
            <span>必要な欄だけ選ぶ</span>
          </summary>
          <div className="student-writing-lens" aria-label="入力で分けること">
            <article>
              <span>目標</span>
              <strong>{diaryFieldLabels.goalReflection}</strong>
              <p>その日の実習目標に対して、何を見て何が難しかったかを書きます。</p>
            </article>
            <article>
              <span>場面</span>
              <strong>{diaryFieldLabels.episodeMemo}</strong>
              <p>子どもの姿、自分の関わり、その場面からの気づきを分けます。</p>
            </article>
            <article>
              <span>まとめ</span>
              <strong>{diaryFieldLabels.overallLearning}</strong>
              <p>複数の場面から、保育者として大切にしたいことへつなげます。</p>
            </article>
          </div>
        </details>
      </div>
    </details>
  );
}

function StudentSelfReviewPanel({ prompts, onFocusTarget }) {
  const visiblePrompts = safeRecordList(prompts).slice(0, 6);
  if (!visiblePrompts.length) return null;
  const reviewRouteLabels = visiblePrompts
    .map((item) => item.formatLabel || item.label)
    .slice(0, 6);

  return (
    <section className="student-self-review wide" aria-label="書いた欄の見直し">
      <div className="student-self-review-head">
        <div>
          <span className="label">書いた欄の見直し</span>
          <h3>自分の記録から直す</h3>
        </div>
        <div className="student-self-review-head-copy">
          <p>空欄を埋める前に、すでに書いた欄だけを短く確認します。</p>
          <small className="student-self-review-route">先に見る順: {reviewRouteLabels.join(" / ")}</small>
        </div>
      </div>
      <div className="student-self-review-grid">
        {visiblePrompts.map((item, index) => (
          <article key={item.id}>
            <span>見直し {index + 1}: {item.label}</span>
            <strong>{item.title}</strong>
            {item.formatLabel && <small>学校日誌欄: {item.formatLabel}</small>}
            <p>{item.body}</p>
            <em>{item.question}</em>
            <button
              className="student-field-jump"
              type="button"
              aria-label={`${item.formatLabel || item.label}の欄を見直す`}
              onClick={() => onFocusTarget(item.target, "review")}
            >
              {item.actionLabel || "この欄を見直す"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function StudentSubmitReadiness({ coach, onFocusTarget }) {
  const blockers = safeRecordList(coach?.safetyCheckBlockers).slice(0, 3);
  const formatMissingItems = safeRecordList(coach?.formatMissingItems).slice(0, 5);
  const readyForSafetyCheck = Boolean(coach?.readyForSafetyCheck);
  const actionItems = readyForSafetyCheck ? formatMissingItems : blockers.slice(0, 1);
  const firstFormatGapWithTargets = formatMissingItems.find((item) => safeList(item.replaceTargets).length > 0);

  return (
    <div className={`student-submit-readiness wide ${readyForSafetyCheck ? "ready" : ""}`} aria-live="polite">
      <div>
        <span className="label">安全確認まで</span>
        <strong>{readyForSafetyCheck ? "安全確認へ進めます" : "次に1つだけ書く"}</strong>
        <p>
          {readyForSafetyCheck
            ? "この後、名前や園名などが残っていないかを確認します。"
            : "全部を一度に埋めようとせず、次の欄だけ先に書きます。"}
        </p>
        {readyForSafetyCheck && formatMissingItems.length > 0 && (
          <>
            <small>提出前に残る欄: {formatMissingItems.map((item) => item.formatLabel || item.label).join(" / ")}</small>
            <small>{formatMissingItems.map((item) => item.reason).join(" ")}</small>
          </>
        )}
      </div>
      {readyForSafetyCheck && firstFormatGapWithTargets && (
        <StudentReplaceTargets targets={firstFormatGapWithTargets.replaceTargets} />
      )}
      {actionItems.length > 0 && (
        <div className="student-submit-readiness-actions">
          {actionItems.map((item) => {
            const label = item.formatLabel || item.label;
            const actionLabel = readyForSafetyCheck ? `${label}を見直す` : label;
            const actionAriaLabel = readyForSafetyCheck ? actionLabel : `${label}の欄へ移動`;
            return (
              <button
                key={item.id}
                className="student-field-jump"
                type="button"
                aria-label={actionAriaLabel}
                onClick={() => onFocusTarget(item.target)}
              >
                {actionLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StudentMinimumPath({ items, onFocusTarget }) {
  const doneCount = items.filter((item) => item.done).length;
  const remaining = Math.max(0, items.length - doneCount);
  const nextItem = items.find((item) => !item.done);
  return (
    <section className="student-minimum-path" aria-label="最初に埋める三点">
      <div className="student-minimum-head">
        <div>
          <span className="label">まずここだけ</span>
          <h3>{remaining === 0 ? "安全確認へ進めます" : `次に置く欄: ${nextItem?.label || "場面"}`}</h3>
        </div>
        <p>完璧な日誌にしようとせず、一場面、気づき、明日の一点を先に置きます。</p>
      </div>
      <div className="student-minimum-grid">
        {items.map((item, index) => (
          <article key={item.label} className={item.done ? "done" : ""}>
            <span>{index + 1}</span>
            <div>
              <em>{item.label}</em>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <button
                className="student-minimum-jump"
                type="button"
                aria-label={`${item.formatLabel || item.label}の${item.done ? "欄を確認" : "欄へ移動"}`}
                onClick={() => onFocusTarget(item.target, item.done ? "review" : "write")}
              >
                {item.done ? "欄を確認" : "欄へ移動"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StudentFieldLens({ lens, label }) {
  const rows = [
    ["見る", lens?.look],
    ["書く", lens?.write],
    ["避ける", lens?.avoid],
  ].filter(([, value]) => Boolean(value));
  if (!rows.length) return null;
  return (
    <div className="student-field-lens" aria-label={`${label || "次の欄"}の見方`}>
      {rows.map(([name, value]) => (
        <span key={name}>
          <em>{name}</em>
          {value}
        </span>
      ))}
    </div>
  );
}

function StudentInputState({ state }) {
  if (!state) return null;
  return (
    <div className={`student-input-state ${state.level || "unknown"}`} aria-label="入力欄の状態">
      <span>入力の状態</span>
      <strong>{state.label}</strong>
      <p>{state.help}</p>
    </div>
  );
}

function StudentReplaceTargets({ targets }) {
  const items = safeList(targets).filter(Boolean).slice(0, 4);
  if (!items.length) return null;
  return (
    <div className="student-replace-targets" aria-label="置き換える場所">
      <span>置き換える場所</span>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function StudentWritingCoachPanel({ coach, diary, episodes, feedback, onChange, onEpisodeChange, onFeedbackChange, onFocusTarget }) {
  const nextItem = coach?.nextItem;
  const visibleItems = safeRecordList(coach?.items).filter((item) => item.required).slice(0, 5);
  const preview = Array.isArray(coach?.preview) ? coach.preview : [];
  const safetyCheckBlockers = safeRecordList(coach?.safetyCheckBlockers).slice(0, 3);
  const formatMissingItems = safeRecordList(coach?.formatMissingItems).slice(0, 5);
  const firstFormatGapWithTargets = formatMissingItems.find((item) => safeList(item.replaceTargets).length > 0);
  const hasDetailedSupport = Boolean(
    (!coach.readyForSafetyCheck && (
      nextItem?.replaceTargets
      || nextItem?.inputState
      || nextItem?.microStep
      || nextItem?.lens
      || safetyCheckBlockers.length > 0
      || visibleItems.length > 0
      || preview.length > 0
    ))
    || (coach.readyForSafetyCheck && formatMissingItems.length > 0)
  );

  function applyCoachItem(item) {
    if (!item?.starter) return;
    if (item.target === "episodeMemo") {
      const episodeIndex = getEpisodeStarterIndex(episodes, "memo");
      const insertion = buildStarterInsertion(episodes[episodeIndex]?.memo, item.starter);
      onEpisodeChange(episodeIndex, "memo", insertion.value, insertion.scaffold);
    } else if (item.target === "episodeInsight") {
      const episodeIndex = getEpisodeStarterIndex(episodes, "insight");
      const insertion = buildStarterInsertion(episodes[episodeIndex]?.insight, item.starter);
      onEpisodeChange(episodeIndex, "insight", insertion.value, insertion.scaffold);
    } else if (item.target === "feedbackReceived") {
      onFeedbackChange("received", appendStarterText(feedback.received, item.starter));
    } else {
      const insertion = buildStarterInsertion(diary[item.target], item.starter);
      onChange(item.target, insertion.value, insertion.scaffold);
    }
    onFocusTarget(item.target);
  }

  return (
    <section className="student-writing-coach" aria-label="日誌作成の補助">
      <div className="student-writing-coach-main">
        <span className="label">記録補助</span>
        <h3>{coach.readyForSafetyCheck ? "次は安全確認です" : `次に書く欄: ${nextItem?.label || "場面"}`}</h3>
        {!coach.readyForSafetyCheck && nextItem?.formatLabel && (
          <span className="student-format-label">学校日誌欄: {nextItem.formatLabel}</span>
        )}
        <p>
          {coach.readyForSafetyCheck
            ? "提出前に自分の記録を整える前に、問い返し前の安全確認へ進めます。"
            : nextItem?.question || "今日見た場面を一つ選び、実際に見たことから書き始めます。"}
        </p>
        {!coach.readyForSafetyCheck && nextItem && (
          <div className="student-quick-start" aria-label="30秒で書き始める">
            <div>
              <span>30秒入口</span>
              <strong>{nextItem.formatLabel || nextItem.label}に型だけ置く</strong>
              <p>完成文ではありません。空欄を、今日見た事実・自分の関わり・次に見る一点へ置き換えてから進みます。</p>
            </div>
            <button className="student-quick-start-button" type="button" onClick={() => applyCoachItem(nextItem)}>
              穴埋め型を置いて欄へ移動
            </button>
          </div>
        )}
        {!coach.readyForSafetyCheck && nextItem && (
          <div className="student-coach-actions">
            <button
              className="student-field-jump"
              type="button"
              aria-label={`${nextItem.formatLabel || nextItem.label}の欄へ移動`}
              onClick={() => onFocusTarget(nextItem.target)}
            >
              次に書く欄へ移動
            </button>
          </div>
        )}
      </div>
      {hasDetailedSupport && (
        <details className="student-writing-more">
          <summary>
            <strong>書き方の細かい補助を開く</strong>
            <span>置き換える場所・欄ごとの確認</span>
          </summary>
          <div className="student-writing-more-body">
            {!coach.readyForSafetyCheck && nextItem?.replaceTargets && (
              <StudentReplaceTargets targets={nextItem.replaceTargets} />
            )}
            {!coach.readyForSafetyCheck && nextItem?.inputState && (
              <StudentInputState state={nextItem.inputState} />
            )}
            {!coach.readyForSafetyCheck && nextItem?.microStep && (
              <div className="student-micro-step" aria-label={`${nextItem.label}の1分メモ`}>
                <span>1分メモ</span>
                <strong>{nextItem.microStep.prompt}</strong>
                <p>{nextItem.microStep.hint}</p>
                {nextItem.nudge && <small className="student-next-nudge">次に足す一点: {nextItem.nudge}</small>}
              </div>
            )}
            {!coach.readyForSafetyCheck && nextItem?.lens && (
              <StudentFieldLens lens={nextItem.lens} label={nextItem.formatLabel || nextItem.label} />
            )}
            {!coach.readyForSafetyCheck && safetyCheckBlockers.length > 0 && (
              <div className="student-safety-blockers" aria-label="安全確認へ進む前に必要なこと">
                <span className="label">安全確認へ進む前に</span>
                <strong>{safetyCheckBlockers.length}つだけ先に書く</strong>
                <ul>
                  {safetyCheckBlockers.map((item) => (
                    <li key={item.id}>
                      <span>{item.label}</span>
                      <p>{item.reason}</p>
                      {item.microStep?.prompt && <small>{item.microStep.prompt}</small>}
                      <button
                        className="student-field-jump"
                        type="button"
                        aria-label={`${item.formatLabel || item.label}の欄へ移動`}
                        onClick={() => onFocusTarget(item.target)}
                      >
                        欄へ移動
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {coach.readyForSafetyCheck && formatMissingItems.length > 0 && (
              <div className="student-format-gap" aria-label="提出前に残る欄">
                <span className="label">提出前に残る欄</span>
                <strong>{formatMissingItems.map((item) => item.label).join(" / ")}</strong>
                <small>{formatMissingItems.map((item) => item.formatLabel || item.label).join(" / ")}</small>
                <p>安全確認へは進めます。提出前には、学校フォーマットとして残る欄も見直します。</p>
                {formatMissingItems.map((item) => <p key={`${item.id}-reason`}>{item.reason}</p>)}
                {firstFormatGapWithTargets && (
                  <StudentReplaceTargets targets={firstFormatGapWithTargets.replaceTargets} />
                )}
                <div className="student-format-gap-actions">
                  {formatMissingItems.map((item) => (
                    <button
                      key={item.id}
                      className="student-field-jump"
                      type="button"
                      aria-label={`${item.formatLabel || item.label}の欄へ移動`}
                      onClick={() => onFocusTarget(item.target)}
                    >
                      {item.formatLabel || item.label}へ移動
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="student-writing-progress" aria-label="学校日誌欄ごとの入力状態">
              <div className="student-writing-progress-head">
                <div>
                  <span className="label">今日の欄</span>
                  <strong>{coach.readyForSafetyCheck ? "安全確認へ進める状態" : `次に直す欄: ${nextItem?.label || "場面"}`}</strong>
                </div>
                <p>学校フォーマット全体で、各欄の状態と次に足す一点をここから確認します。</p>
              </div>
              {visibleItems.map((item) => {
                const isCurrentItem = item.id === nextItem?.id;
                return (
                  <article key={item.id} className={item.done ? "done" : ""}>
                    <span>{item.label}</span>
                    <strong>{item.title}</strong>
                    {item.formatLabel && <small>学校日誌欄: {item.formatLabel}</small>}
                    {item.inputState && (
                      <small className={`student-input-status ${item.inputState.level || "unknown"}`}>
                        欄の状態: {item.inputState.label}{isCurrentItem && item.inputState.help ? `。${item.inputState.help}` : ""}
                      </small>
                    )}
                    {isCurrentItem && <p>{item.body}</p>}
                    {!item.done && item.nudge && <em className="student-progress-nudge">足す一点: {item.nudge}</em>}
                    <button
                      className="student-progress-jump"
                      type="button"
                      aria-label={`${item.formatLabel || item.label}の${item.done ? "欄を確認" : "欄へ移動"}`}
                      onClick={() => onFocusTarget(item.target, item.done ? "review" : "write")}
                    >
                      {item.done ? "欄を確認" : "この欄へ移動"}
                    </button>
                  </article>
                );
              })}
            </div>
            {preview.length > 0 && (
              <div className="student-writing-preview" aria-label="ここまでの記録">
                {preview.slice(0, 4).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  );
}

function appendStarterText(currentValue, starterText) {
  return buildStarterInsertion(currentValue, starterText).value;
}

function buildStarterInsertion(currentValue, starterText) {
  const current = String(currentValue || "").trim();
  if (!current) return { value: starterText, scaffold: starterText };
  if (current.includes(starterText)) return { value: current, scaffold: "" };
  return { value: `${current}\n\n${starterText}`, scaffold: starterText };
}

function getEpisodeStarterIndex(episodes, field) {
  const normalized = normalizeDiaryEpisodes(episodes);
  const emptyIndex = normalized.findIndex((episode) => !hasStudentAuthoredText(episode[field]));
  if (emptyIndex >= 0) return emptyIndex;
  return Math.max(0, normalized.length - 1);
}

function getEpisodeReviewIndex(episodes, field) {
  const normalized = normalizeDiaryEpisodes(episodes);
  const writtenIndex = normalized.findIndex((episode) => hasStudentAuthoredText(episode[field]));
  if (writtenIndex >= 0) return writtenIndex;
  return getEpisodeStarterIndex(normalized, field);
}

function StudentConfirmStep({ review, checkedPayload, busy, onBack, onConfirm }) {
  if (!review) {
    return (
      <section className="student-step-card empty-step">
        <strong>まだ安全確認をしていません。</strong>
        <p>入力画面に戻って、安全な表現の確認へ進んでください。</p>
        <button className="secondary-button" type="button" onClick={onBack}>入力に戻る</button>
      </section>
    );
  }
  const canSendToAi = !review.blocked;
  return (
    <section className="student-step-card review-step" aria-label="安全確認結果">
      <ReviewSummary review={review} />
      <SanitizedPreview payload={checkedPayload} />
      <div className="review-confirm-note">
        <strong>確認すること</strong>
        <p>
          {canSendToAi
            ? "意味が変わっていなければ、この整えた本文で問い返しへ進みます。元の入力そのものは使いません。"
            : "実習記録ではない指示に見える表現など、安全化だけでは扱えない内容があります。入力に戻って、必要な内容だけに整えてください。"}
        </p>
      </div>
      <div className="actions">
        <button className="secondary-button" type="button" onClick={onBack}>入力に戻る</button>
        <button className="primary-button" type="button" onClick={onConfirm} disabled={busy || !canSendToAi}>{busy ? "問い返し確認中..." : "問い返しを受ける"}</button>
      </div>
    </section>
  );
}

function StudentReviseStep({ result, feedbackNextSteps, checkedPayload, scaffoldDraft, finalDraft, copied, busy, onBack, onCopyResult, onFinalDraftChange, onFinalCheck }) {
  if (!result) {
    return (
      <section className="student-step-card empty-step">
        <strong>まだ問い返しがありません。</strong>
        <p>確認画面から問い返しへ進んでください。</p>
        <button className="secondary-button" type="button" onClick={onBack}>確認画面に戻る</button>
      </section>
    );
  }
  const resultSections = normalizeResultSections(result);
  const resultChecks = normalizeResultChecks(result);
  const sourceText = buildDiarySourceText(checkedPayload);
  const draftText = scaffoldDraft || buildDiaryScaffoldDraft(checkedPayload, result, feedbackNextSteps);
  const draftReadiness = getStudentDraftEditReadiness(finalDraft, draftText);
  const finalDraftEdited = draftReadiness.ready;
  const revisionChecklist = buildStudentRevisionChecklist(checkedPayload, result, feedbackNextSteps);
  const revisionOrder = buildStudentRevisionOrder(checkedPayload, result, feedbackNextSteps);
  const hasFinalDraftInput = hasMeaningfulText(finalDraft);
  return (
    <section className="student-step-card ai-step" aria-label="問い返し結果と提出前の記録作成">
      <div className="ai-step-head">
        <div>
          <span className="label">比較して直す</span>
          <h3>元の記録と整理案を見比べます</h3>
        </div>
        <button className="secondary-button compact" type="button" onClick={onCopyResult}>
          {copied ? "コピー済み" : "問いをコピー"}
        </button>
      </div>
      <section className="draft-comparison" aria-label="元の記録と整理案の比較">
        <article className="comparison-column source">
          <span className="label">元の記録</span>
          <h4>安全確認後の本文</h4>
          <p>{sourceText || "安全確認後の本文がここに表示されます。"}</p>
        </article>
        <article className="comparison-column draft">
          <span className="label">整理案</span>
          <h4>自分で直すための下書き</h4>
          <p>{draftText}</p>
          <button className="secondary-button compact" type="button" onClick={() => onFinalDraftChange(draftText)}>
            整理案を編集欄に置く
          </button>
        </article>
      </section>
      <div className="review-confirm-note draft-note">
        <strong>ここで見ること</strong>
        <p>元の記録に戻しながら、自分の言葉で整えるための材料です。元の記録にない事実、言いすぎた表現、実習先や教員に確認したい点を直してから提出前チェックへ進みます。</p>
      </div>
      <StudentFeedbackCarryover feedbackNextSteps={feedbackNextSteps} />
      <label className="final-draft-editor">
        自分で整えた記録
        <textarea value={finalDraft} rows={8} placeholder={FINAL_DRAFT_PLACEHOLDER} onChange={(event) => onFinalDraftChange(event.target.value)} />
      </label>
      {hasFinalDraftInput && !finalDraftEdited && (
        <div className="review-confirm-note draft-readiness-note" role="status" aria-live="polite">
          <strong>{draftReadiness.title}</strong>
          <p>{draftReadiness.body}</p>
        </div>
      )}
      <div className="actions">
        <button className="secondary-button" type="button" onClick={onBack}>確認画面に戻る</button>
        <button className="primary-button" type="button" onClick={onFinalCheck} disabled={busy || !hasFinalDraftInput || !finalDraftEdited}>
          {busy ? "確認中..." : finalDraftEdited ? "提出前チェックへ進む" : draftReadiness.actionLabel}
        </button>
      </div>
      <details className="student-revision-help">
        <summary>
          <span className="label">補助</span>
          <strong>直す順番と問いを見る</strong>
        </summary>
        <div className="student-revision-help-body">
          <section className="student-revision-order" aria-label="整理案を直す順番">
            <div>
              <span className="label">直す順番</span>
              <h4>削る、つなぐ、明日の一点に戻す</h4>
            </div>
            <div className="student-revision-order-list">
              {revisionOrder.map((item) => (
                <article key={item.id}>
                  <span>{item.label}</span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <em>{item.prompt}</em>
                </article>
              ))}
            </div>
          </section>
          <section className="student-revision-checklist" aria-label="整理案を直す観点">
            <div>
              <span className="label">直す観点</span>
              <h4>元の記録と違うところを先に見る</h4>
            </div>
            <div className="student-revision-grid">
              {revisionChecklist.map((item, index) => (
                <article key={`${item.label}-${item.title}-${index}`}>
                  <span>{item.label}</span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>
          <article className="result inline-result">
            {resultSections.map((section, index) => (
              <section className="result-section" key={`${section.heading}-${index}`}>
                <h3>{section.heading}</h3>
                <p>{section.body}</p>
              </section>
            ))}
            {feedbackNextSteps.hasContent && (
              <section className="result-section feedback-result-section">
                <h3>実習先フィードバックを踏まえた明日の観察</h3>
                <p>{feedbackNextSteps.focus}を意識し、実習先で受けた助言を翌日の具体的な観察に戻します。</p>
                <ul>
                  {feedbackNextSteps.observationPoints.map((point, index) => (
                    <li key={`${point}-${index}`}>{point}</li>
                  ))}
                </ul>
              </section>
            )}
            <section className="result-section">
              <h3>提出前の自己確認</h3>
              <ul>
                {resultChecks.map((check, index) => (
                  <li key={`${check}-${index}`}>{check}</li>
                ))}
              </ul>
            </section>
          </article>
        </div>
      </details>
    </section>
  );
}

function StudentFeedbackCarryover({ feedbackNextSteps }) {
  if (!feedbackNextSteps?.hasContent) return null;
  return (
    <section className="student-feedback-carryover" aria-label="実習先助言の見直し">
      <div>
        <span className="label">実習先助言</span>
        <h4>本文の飾りにせず、明日見る一点へ戻す</h4>
        <p>{feedbackNextSteps.focus}を、記録本文の説明ではなく、翌日の観察や相談点へ戻します。</p>
      </div>
      <ul>
        {safeList(feedbackNextSteps.observationPoints).slice(0, 2).map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <small>判断に迷う点は、断定して書かず学校の担当教員への相談として残します。</small>
    </section>
  );
}

function StudentFinalStep({ finalDraft, scaffoldDraft, finalCheck, copied, busy, onFinalDraftChange, onFinalCheck, onUseSanitizedFinal, onCopyFinal, onBack }) {
  const checkedText = normalizeMultiline(finalDraft);
  const sanitizedText = normalizeMultiline(finalCheck?.payload?.memo || "");
  const hasFinalDraftText = hasMeaningfulText(finalDraft);
  const draftReadiness = getStudentDraftEditReadiness(checkedText, scaffoldDraft);
  const finalDraftEdited = draftReadiness.ready;
  const canCopyCheckedFinal = finalDraftEdited && canUseFinalDraftAfterCheck(finalCheck, checkedText, sanitizedText);
  const recoveryGuide = buildStudentFinalCheckRecoveryGuide(finalCheck, checkedText, sanitizedText);
  const needsSafeTextApply = Boolean(finalCheck?.changed && sanitizedText && checkedText !== sanitizedText);
  const needsRecheckAfterSafeTextApply = Boolean(finalCheck?.changed && sanitizedText && checkedText === sanitizedText);
  const focusFinalDraftEditor = () => {
    document.getElementById("student-final-draft")?.focus();
  };
  const focusFinalDraftEditorAfterRender = () => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(focusFinalDraftEditor);
  };
  const handleUseSanitizedFinal = () => {
    onUseSanitizedFinal();
    focusFinalDraftEditorAfterRender();
  };
  const handleRecoveryAction = (action) => {
    if (action === "apply_sanitized") {
      handleUseSanitizedFinal();
      return;
    }
    if (action === "run_final_check") {
      onFinalCheck();
      return;
    }
    focusFinalDraftEditor();
  };
  const copyLabel = copied
    ? "コピー済み"
    : !finalDraftEdited
      ? "自分の言葉で直すとコピーできます"
    : !finalCheck
      ? "チェック後にコピーできます"
      : canCopyCheckedFinal
        ? "記録をコピー"
      : finalCheck.blocked
        ? "見直すとコピーできます"
      : needsSafeTextApply
        ? "反映後にコピーできます"
      : needsRecheckAfterSafeTextApply || checkedText !== sanitizedText
        ? "再チェック後にコピーできます"
      : finalCheck.status !== "clear"
        ? "見直すとコピーできます"
      : "記録をコピー";
  return (
    <section className="student-step-card final-step" aria-label="提出前チェック">
      <label className="final-draft-editor">
        自分で整えた記録
        <textarea id="student-final-draft" value={finalDraft} rows={9} placeholder={FINAL_DRAFT_PLACEHOLDER} onChange={(event) => onFinalDraftChange(event.target.value)} />
      </label>
      {finalCheck ? (
        <>
          <ReviewSummary review={finalCheck} compact />
          {finalCheck.changed && (
            <SanitizedPreview payload={finalCheck.payload} fields={["memo"]} title="安全化した提出前の記録" />
          )}
          {recoveryGuide.length > 0 && (
            <section className="student-final-recovery" aria-label="提出前チェック後に直す順番" aria-live="polite">
              <div>
                <span className="label">直す順番</span>
                <h3>コピー前に残った確認</h3>
              </div>
              <ol>
                {recoveryGuide.map((item) => (
                  <li key={item.id}>
                    <span>{item.label}</span>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <button
                      className="student-minimum-jump"
                      type="button"
                      onClick={() => handleRecoveryAction(item.action)}
                      disabled={busy && item.action === "run_final_check"}
                      aria-controls={item.action === "run_final_check" ? undefined : "student-final-draft"}
                      data-recovery-action={item.action}
                    >
                      {busy && item.action === "run_final_check" ? "確認中..." : item.actionLabel}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      ) : (
        <div className="review-confirm-note">
          <strong>最後に見ること</strong>
          <p>ここでは問い返しを増やさず、Manalio内のルールだけで個人情報や要配慮情報が残っていないか確認します。</p>
        </div>
      )}
      {scaffoldDraft && hasFinalDraftText && !finalDraftEdited && (
        <div className="review-confirm-note draft-readiness-note" role="status" aria-live="polite">
          <strong>{draftReadiness.title}</strong>
          <p>{draftReadiness.body}</p>
        </div>
      )}
      <div className="actions">
        <button className="secondary-button" type="button" onClick={onBack}>問い返しに戻る</button>
        <button className="secondary-button" type="button" onClick={onFinalCheck} disabled={busy || !hasFinalDraftText || !finalDraftEdited}>{busy ? "確認中..." : "再チェック"}</button>
        {needsSafeTextApply && (
          <button className="secondary-button" type="button" onClick={handleUseSanitizedFinal} aria-controls="student-final-draft" data-recovery-action="apply_sanitized">安全化した文を反映</button>
        )}
        <button className="primary-button" type="button" onClick={onCopyFinal} disabled={!hasFinalDraftText || !finalDraftEdited || !canCopyCheckedFinal}>
          {copyLabel}
        </button>
      </div>
    </section>
  );
}

function ReviewSummary({ review, compact = false }) {
  const changes = safeRecordList(review?.fieldChanges);
  const findings = safeRecordList(review?.findings);
  const contextNotes = safeRecordList(review?.contextNotes);
  const hasDetails = changes.length > 0 || findings.length > 0 || contextNotes.length > 0;
  return (
    <section className={`review-summary ${compact ? "compact" : ""} status-${review?.status || "clear"}`}>
      <div>
        <span className="label">安全確認</span>
        <h3>{review?.summary || "大きな修正候補は見つかりませんでした。"}</h3>
      </div>
      {!hasDetails ? (
        <p>個人名、連絡先、住所、診断名、家庭事情などの目立つ候補は見つかっていません。</p>
      ) : (
        <div className="review-items">
          {changes.map((item) => (
            <article key={`${item.field}-${item.after}`} className="review-item-card auto">
              <span>{item.actionLabel || "別の言い方"}</span>
              <strong>{item.label}</strong>
              <p>{item.title}</p>
            </article>
          ))}
          {findings.map((item) => (
            <article key={`${item.code}-${item.label}`} className={`review-item-card ${item.severity}`}>
              <span>{item.actionLabel || (item.severity === "must_fix" ? "個人が分かるかも" : "見ておく表現")}</span>
              <strong>{item.label}</strong>
              <p>{item.message}</p>
            </article>
          ))}
          {contextNotes.map((item) => (
            <article key={`${item.code}-${item.label}`} className={`review-item-card ${item.severity}`}>
              <span>{item.actionLabel || (item.severity === "context" ? "記録前の確認" : "別の言い方")}</span>
              <strong>{item.label}</strong>
              <p>{item.message}</p>
            </article>
          ))}
        </div>
      )}
      <p className="guardrail-note">安全確認: 実行済み。個人情報や要配慮情報の候補を確認しています。</p>
    </section>
  );
}

function SanitizedPreview({ payload, fields, title = "問い返し前に確認する本文" }) {
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const visibleFields = fields || Object.keys(CLIENT_FIELD_LABELS);
  const rows = visibleFields
    .map((field) => [field, source[field]])
    .filter(([, value]) => typeof value === "string" && value.trim());
  if (!rows.length) return null;
  return (
    <section className="sanitized-preview" aria-label={title}>
      <div>
        <span className="label">確認プレビュー</span>
        <h3>{title}</h3>
      </div>
      <div className="sanitized-preview-grid">
        {rows.map(([field, value]) => (
          <article key={field}>
            <strong>{CLIENT_FIELD_LABELS[field] || "本文"}</strong>
            <p>{safeCopyText(value, 520)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SampleLibrary({ title, description, samples, selectedSampleId = "", onSelect }) {
  return (
    <section className="sample-library" aria-label={title}>
      <div className="sample-library-head">
        <div>
          <span className="label">すぐ試せる</span>
          <h3>{title}</h3>
        </div>
        <p>{description}</p>
      </div>
      <div className="sample-grid">
        {samples.map((sample) => (
          <button
            className={`sample-card ${selectedSampleId === sample.id ? "selected" : ""}`}
            key={sample.id}
            type="button"
            aria-pressed={selectedSampleId === sample.id}
            onClick={() => onSelect(sample)}
          >
            <span className="sample-card-title-row">
              <strong>{sample.title}</strong>
              {selectedSampleId === sample.id && <em>読み込み済み</em>}
            </span>
            <span>{sample.description}</span>
            <span className="sample-tags">
              {sample.tags.map((tag) => (
                <em key={tag}>{tag}</em>
              ))}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SchoolAdminView({ schoolSummary, schoolSummaryStatus, schoolFormat = defaultSchoolFormat, session, isPublicDemoSession = false }) {
  const usingDemoData = isPublicDemoSession || (session?.source === "demo" && schoolSummary?.configured === false);
  const isLocalDemoStudentProcessSupport = !isPublicDemoSession && session?.source === "demo";
  const practicumReleasePending = !usingDemoData
    && schoolSummary?.studentProcess?.implementationGate === "practicum_in_progress";
  const reviewQueue = (usingDemoData ? demoReviewQueue : safeRecordList(schoolSummary?.reviewQueue))
    .map((item) => normalizeTeacherReviewQueueItem(item));
  const recentLogs = usingDemoData ? demoRecentLogs : safeRecordList(schoolSummary?.recentLogs);
  const checkSummary = usingDemoData ? demoCheckSummary : safeRecordList(schoolSummary?.checkSummary);
  const studentUsage = usingDemoData ? demoStudentUsage : safeRecordList(schoolSummary?.studentUsage);
  const revealRosterNames = !isPublicDemoSession && session?.source !== "demo";
  const teacherStudents = useMemo(
    () => buildTeacherStudentSummaries(studentUsage, recentLogs, reviewQueue, { revealStudentNames: revealRosterNames }),
    [studentUsage, recentLogs, reviewQueue, revealRosterNames],
  );
  const classShareThemes = useMemo(() => buildClassShareThemes(checkSummary, reviewQueue), [checkSummary, reviewQueue]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [localProcessEvents, setLocalProcessEvents] = useState([]);
  useEffect(() => {
    if (!isLocalDemoStudentProcessSupport) {
      setLocalProcessEvents([]);
      return undefined;
    }
    const syncLocalProcessEvents = () => {
      setLocalProcessEvents(getSavedFeedbackRecords(STUDENT_PROCESS_EVENT_STORAGE_KEY));
    };
    syncLocalProcessEvents();
    window.addEventListener("storage", syncLocalProcessEvents);
    window.addEventListener("focus", syncLocalProcessEvents);
    return () => {
      window.removeEventListener("storage", syncLocalProcessEvents);
      window.removeEventListener("focus", syncLocalProcessEvents);
    };
  }, [isLocalDemoStudentProcessSupport]);
  const serverProcessEvents = safeRecordList(schoolSummary?.studentProcess?.events);
  const processEvents = isLocalDemoStudentProcessSupport ? localProcessEvents : serverProcessEvents;
  const studentLabelsByKey = schoolSummary?.studentProcess?.studentLabelsByKey || {};
  const studentProcessSupportPackage = useMemo(
    () => buildPostPracticumSupportPackage(processEvents, { ...schoolFormat, studentLabelsByKey }),
    [processEvents, schoolFormat, studentLabelsByKey],
  );
  const combinedTeacherStudents = useMemo(
    () => {
      if (practicumReleasePending) return [];
      return mergeTeacherStudentsWithProcessSupport(teacherStudents, studentProcessSupportPackage, {
        includeUnmatchedProcessStudents: isLocalDemoStudentProcessSupport,
      });
    },
    [teacherStudents, studentProcessSupportPackage, isLocalDemoStudentProcessSupport, practicumReleasePending],
  );
  const selectedStudent = combinedTeacherStudents.find((student) => student.id === selectedStudentId) || null;
  const combinedClassShareThemes = useMemo(() => {
    if (practicumReleasePending) return [];
    return mergeClassShareThemes(
      classShareThemes,
      safeRecordList(studentProcessSupportPackage.classwideLessonBacklog).map((item) => ({
        themeKey: item.key,
        label: item.label,
        count: item.studentCount,
        studentCount: item.studentCount,
        detail: item.avoidUse,
      })),
    );
  }, [classShareThemes, studentProcessSupportPackage, practicumReleasePending]);
  const combinedClassShareLessonPlans = useMemo(() => {
    if (practicumReleasePending) return [];
    const processByThemeKey = new Map(
      safeRecordList(studentProcessSupportPackage.classwideLessonBacklog).map((item) => [item.key, item]),
    );
    return buildClassShareLessonPlans(combinedClassShareThemes, reviewQueue).map((plan) => {
      const processPlan = processByThemeKey.get(plan.themeKey);
      if (!processPlan) return plan;
      return {
        ...plan,
        focusLabel: processPlan.label,
        classQuestion: processPlan.classQuestion,
        miniTask: processPlan.miniTask,
        avoidText: processPlan.avoidUse,
      };
    });
  }, [combinedClassShareThemes, reviewQueue, studentProcessSupportPackage, practicumReleasePending]);
  const studentProcessUnavailable = schoolSummary?.studentProcess?.unavailable === true;
  const studentProcessTruncated = schoolSummary?.studentProcess?.truncated === true;
  const schoolSummaryUnavailable = !usingDemoData && !schoolSummary;

  return (
    <div className="view-panel">
      <div className="context-bar">
        <div>
          <span className="context-label">実習後支援</span>
          <p>{session?.schoolName || "さくら保育者養成校"} の学生ごとに、記録のプロセスと支援材料を確認</p>
        </div>
        <div className="context-stats" aria-label="実習後支援の特徴">
          <span>学生一覧</span>
          <span>個人チェックポイント</span>
          <span>授業共有論点</span>
        </div>
      </div>

      <div className="toolbar">
        <div>
          <span className="label">教員向け</span>
          <h2>学生ごとに、実習後の支援材料を見る</h2>
        </div>
        <span className="badge">支援画面</span>
      </div>

      <div className="school-dashboard">
        {schoolSummaryUnavailable && (
          <div className="teacher-process-unavailable" role="status" aria-live="polite">
            <strong>学校データを表示できません</strong>
            <p>{schoolSummaryStatus || "時間をおいて再読み込みしてください。"}</p>
          </div>
        )}
        {studentProcessUnavailable && (
          <div className="teacher-process-unavailable" role="status" aria-live="polite">
            <strong>学生の記録プロセスを一時的に取得できません</strong>
            <p>学生一覧と既存の支援材料は表示しています。時間をおいて再読み込みしてください。</p>
          </div>
        )}
        {studentProcessTruncated && (
          <div className="teacher-process-truncated" role="status" aria-live="polite">
            <strong>学生データが多いため、一部のみ表示しています</strong>
            <p>表示中の情報だけで全体傾向を断定しないでください。</p>
          </div>
        )}
        {combinedTeacherStudents.length > 0 ? (
          <TeacherStudentProcessBoard
            students={combinedTeacherStudents}
            selectedStudent={selectedStudent}
            classShareThemes={combinedClassShareThemes}
            classShareLessonPlans={combinedClassShareLessonPlans}
            onSelectStudent={setSelectedStudentId}
          />
        ) : !studentProcessUnavailable && !schoolSummaryUnavailable ? (
          <TeacherPostPracticumSupportEmptyState waitingForPracticumEnd={practicumReleasePending} />
        ) : null}

      </div>
    </div>
  );
}

function getTeacherStudentCount(value) {
  const count = Number(value) || 0;
  return count > 0 ? count : 0;
}

function hasTeacherStudentRoute(student = {}) {
  return getTeacherStudentCount(student.teacherCheckCount)
    + getTeacherStudentCount(student.classShareCount)
    + getTeacherStudentCount(student.selfCheckCount);
}

function hasTeacherStudentRecordProcess(student = {}) {
  return getTeacherStudentCount(student.diaryCount)
    + getTeacherStudentCount(student.generationCount)
    + safeRecordList(student.recentLogs).length;
}

function matchesTeacherStudentRouteFilter(student = {}, filterValue = "all") {
  if (filterValue === "teacher") return getTeacherStudentCount(student.teacherCheckCount) > 0;
  if (filterValue === "class") return getTeacherStudentCount(student.classShareCount) > 0;
  if (filterValue === "student") return getTeacherStudentCount(student.selfCheckCount) > 0;
  if (filterValue === "post") return hasTeacherStudentRoute(student) === 0 && hasTeacherStudentRecordProcess(student) > 0;
  return true;
}

function buildTeacherStudentRouteFilters(students = []) {
  const safeStudents = safeRecordList(students);
  return [
    {
      value: "all",
      label: "すべて",
      detail: "全員を見る",
      count: safeStudents.length,
    },
    {
      value: "teacher",
      label: "教員確認",
      detail: "先に見る",
      count: safeStudents.filter((student) => matchesTeacherStudentRouteFilter(student, "teacher")).length,
    },
    {
      value: "class",
      label: "授業共有",
      detail: "授業で扱う",
      count: safeStudents.filter((student) => matchesTeacherStudentRouteFilter(student, "class")).length,
    },
    {
      value: "student",
      label: "本人確認",
      detail: "自己確認へ戻す",
      count: safeStudents.filter((student) => matchesTeacherStudentRouteFilter(student, "student")).length,
    },
    {
      value: "post",
      label: "その他の実習後確認",
      detail: "支援先未分類の記録プロセス",
      count: safeStudents.filter((student) => matchesTeacherStudentRouteFilter(student, "post")).length,
    },
  ].filter((item) => item.value === "all" || item.count > 0);
}

function TeacherPostPracticumSupportEmptyState({ waitingForPracticumEnd = false }) {
  return (
    <section className="school-panel teacher-post-practicum-empty" aria-label="実習後支援メモの初回状態">
      <div>
        <span className="label">実習後支援</span>
        <h3>{waitingForPracticumEnd ? "実習終了後に学生一覧を表示します" : "学生の記録が入ると、学生一覧を表示します"}</h3>
        <p>{waitingForPracticumEnd
          ? "実習期間中の記録プロセスは保持し、終了後に個人の支援ポイントと授業で扱う共通テーマへまとめます。"
          : "学生を選ぶと個人の支援ポイントを確認でき、共通するつまずきは授業で扱うテーマにまとまります。"}</p>
      </div>
      <div className="teacher-post-empty-grid">
        <article>
          <span>学生別</span>
          <strong>個人のチェックポイント</strong>
          <p>誰を先に見るか、学生本人へ何を返すかを分けます。</p>
        </article>
        <article>
          <span>授業共有</span>
          <strong>共通テーマ</strong>
          <p>複数学生でつまずく欄は、個別記録ではなく授業の問いへ変換します。</p>
        </article>
      </div>
    </section>
  );
}

function TeacherStudentProcessBoard({ students, selectedStudent, classShareThemes, classShareLessonPlans, onSelectStudent }) {
  const [activeStudentRouteFilter, setActiveStudentRouteFilter] = useState("all");
  const [studentCodeQuery, setStudentCodeQuery] = useState("");
  const studentSearchInputRef = useRef(null);
  const studentListRef = useRef(null);
  const studentDetailRef = useRef(null);
  const safeStudents = safeRecordList(students);
  const themes = safeRecordList(classShareThemes);
  const lessonPlans = safeRecordList(classShareLessonPlans);
  const studentRouteFilters = buildTeacherStudentRouteFilters(safeStudents);
  const normalizedStudentRouteFilter = studentRouteFilters.some((item) => item.value === activeStudentRouteFilter)
    ? activeStudentRouteFilter
    : "all";
  const normalizedStudentCodeQuery = studentCodeQuery.trim();
  const matchesStudentCodeQuery = (student) => !normalizedStudentCodeQuery || String(student.name || "").includes(normalizedStudentCodeQuery);
  const visibleStudents = safeStudents.filter((student) => (
    matchesTeacherStudentRouteFilter(student, normalizedStudentRouteFilter) && matchesStudentCodeQuery(student)
  ));
  const effectiveSelectedStudent = selectedStudent
    && matchesTeacherStudentRouteFilter(selectedStudent, normalizedStudentRouteFilter)
    && matchesStudentCodeQuery(selectedStudent)
    ? selectedStudent
    : null;
  const selectedProcessSteps = safeRecordList(effectiveSelectedStudent?.processSteps);
  const selectedProgress = effectiveSelectedStudent?.processProgress || null;
  const selectedStudentIndex = effectiveSelectedStudent ? visibleStudents.findIndex((student) => student.id === effectiveSelectedStudent.id) : -1;
  const previousStudent = selectedStudentIndex > 0 ? visibleStudents[selectedStudentIndex - 1] : null;
  const nextStudent = selectedStudentIndex >= 0 && selectedStudentIndex < visibleStudents.length - 1
    ? visibleStudents[selectedStudentIndex + 1]
    : null;
  const selectedStudentNextStep = effectiveSelectedStudent?.supportPlan?.nextActions?.[0]
    || effectiveSelectedStudent?.checkpoints?.[0]
    || selectedProgress?.nextMissingLabel
    || "個人のチェックポイントを見る";
  const selectedStudentReturnQuestion = effectiveSelectedStudent?.supportPlan?.returnQuestions?.[0]
    || effectiveSelectedStudent?.supportPlan?.returnPreparation?.studentPrompt
    || effectiveSelectedStudent?.checkpoints?.[0]
    || "次に見る場面を一つに絞れますか。";
  const selectedStudentBoundary = effectiveSelectedStudent?.supportPlan?.returnPreparation?.boundary
    || "本文を直すのではなく、支援前の確認観点だけを見る。";
  const activeFilterLabel = studentRouteFilters.find((item) => item.value === normalizedStudentRouteFilter)?.label || "すべて";
  const canOpenClassShareStudents = studentRouteFilters.some((item) => item.value === "class");
  const classThemeSummary = themes.length > 0
    ? `${themes.length}件 / ${themes[0].label}`
    : "共通論点はまだありません";
  const classLessonSummary = lessonPlans.length > 0
    ? `${lessonPlans.length}件の授業メモ`
    : "授業メモはまだありません";

  function focusTeacherStudentList() {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const list = studentListRef.current;
      if (!list) return;
      const targetTop = Math.max(0, list.getBoundingClientRect().top + window.scrollY - 12);
      window.scrollTo({ top: targetTop, behavior: "auto" });
      list.focus({ preventScroll: true });
    });
  }

  function focusTeacherStudentDetail() {
    const detail = studentDetailRef.current;
    if (!detail) return;
    const targetTop = Math.max(0, detail.getBoundingClientRect().top + window.scrollY - 12);
    window.scrollTo({ top: targetTop, behavior: "auto" });
    detail.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!effectiveSelectedStudent?.id) return undefined;
    const frame = window.requestAnimationFrame(focusTeacherStudentDetail);
    return () => window.cancelAnimationFrame(frame);
  }, [effectiveSelectedStudent?.id]);

  function handleTeacherStudentSelect(studentId) {
    if (effectiveSelectedStudent?.id === studentId) {
      window.requestAnimationFrame(focusTeacherStudentDetail);
      return;
    }
    onSelectStudent(studentId);
  }

  function handleStudentRouteFilterChange(nextFilter, options = {}) {
    setActiveStudentRouteFilter(nextFilter);
    if (selectedStudent && !matchesTeacherStudentRouteFilter(selectedStudent, nextFilter)) {
      onSelectStudent("");
    }
    if (options.focusList) focusTeacherStudentList();
  }

  function handleStudentCodeSearchChange(nextQuery) {
    setStudentCodeQuery(nextQuery);
    const normalizedNextQuery = nextQuery.trim();
    if (selectedStudent && normalizedNextQuery && !String(selectedStudent.name || "").includes(normalizedNextQuery)) {
      onSelectStudent("");
    }
  }

  function clearStudentSearch() {
    handleStudentCodeSearchChange("");
    window.requestAnimationFrame(() => studentSearchInputRef.current?.focus());
  }

  return (
    <section className="school-panel teacher-student-process-board" aria-label="学生別の支援確認">
      <div className="teacher-student-board-head">
        <div>
          <span className="label">学生別確認</span>
          <h3>学生一覧から、個人のチェックポイントを見る</h3>
          <p>実習後に、提出前チェックの残り、相談点、授業で扱う共通テーマを学生別に見返すための画面です。</p>
        </div>
        <span>{safeStudents.length}人</span>
      </div>

      <div className="teacher-student-filter-panel" aria-label="学生一覧の絞り込み">
        <div>
          <span className="review-filter-label">支援先で絞る</span>
          <p>{activeFilterLabel} {visibleStudents.length}人を表示中。必要な時だけ、支援先で絞り込みます。</p>
        </div>
        <div className="teacher-student-route-filters" role="group" aria-label="学生一覧の支援先">
          {studentRouteFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={normalizedStudentRouteFilter === filter.value ? "active" : ""}
              aria-pressed={normalizedStudentRouteFilter === filter.value}
              onClick={() => handleStudentRouteFilterChange(filter.value)}
            >
              <strong>{filter.label}</strong>
              <small>{filter.count}人 / {filter.detail}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="teacher-student-search">
        <label htmlFor="teacher-student-code-search">
          <span className="review-filter-label">学生を検索</span>
          <input
            ref={studentSearchInputRef}
            id="teacher-student-code-search"
            type="search"
            value={studentCodeQuery}
            placeholder="表示中の名前・コード"
            autoComplete="off"
            onChange={(event) => handleStudentCodeSearchChange(event.target.value)}
          />
        </label>
        {studentCodeQuery && (
          <button type="button" onClick={clearStudentSearch}>検索解除</button>
        )}
        <p className="teacher-student-search-status" aria-live="polite">
          検索結果 {visibleStudents.length}人
        </p>
      </div>

      <div className="teacher-student-board-grid">
        <div
          ref={studentListRef}
          className="teacher-student-list"
          id="teacher-student-list"
          role="region"
          aria-label="学生一覧"
          tabIndex={-1}
        >
          {visibleStudents.length === 0 ? (
            <p className="teacher-empty-note">検索条件と支援先に該当する学生はいません。</p>
          ) : visibleStudents.map((student) => (
            <button
              key={student.id}
              type="button"
              className={effectiveSelectedStudent?.id === student.id ? "active" : ""}
              aria-pressed={effectiveSelectedStudent?.id === student.id}
              aria-controls="teacher-student-detail"
              onClick={() => handleTeacherStudentSelect(student.id)}
            >
              <strong>{student.name}</strong>
              <span>{student.className || "クラス未設定"}</span>
              <small>{student.supportPlan?.label || "実習後の支援材料"}</small>
              {student.processSupport?.processDate && (
                <em className="teacher-student-next-reason">
                  最新日誌日 {student.processSupport.processDate} / {student.processSupport.processDateCount || 1}日分
                </em>
              )}
              {student.nextCheckReason && (
                <em className="teacher-student-next-reason">次に見る: {student.nextCheckReason}</em>
              )}
            </button>
          ))}
        </div>

        <div
          ref={studentDetailRef}
          className="teacher-student-detail"
          id="teacher-student-detail"
          role="region"
          aria-label="選択学生の個人チェックポイント"
          tabIndex={-1}
        >
          {!effectiveSelectedStudent ? (
            <div className="teacher-empty-detail-card">
              <span className="label">個人チェックポイント</span>
              <strong>学生を選択すると、個人の確認材料を表示します</strong>
              <p>記録プロセス、提出前確認、翌日の観察につながる欄、学生へ返す問いをここで確認します。</p>
            </div>
          ) : (
            <>
              <div className="teacher-student-detail-head">
                <div>
                  <span className="label">個人チェックポイント</span>
                  <h4>{effectiveSelectedStudent.name}</h4>
                  <p>{effectiveSelectedStudent.className || "クラス未設定"}</p>
                  {effectiveSelectedStudent.processSupport?.processDate && (
                    <p>最新日誌日 {effectiveSelectedStudent.processSupport.processDate} / {effectiveSelectedStudent.processSupport.processDateCount || 1}日分</p>
                  )}
                  {selectedProgress && (
                    <p className="teacher-process-summary">
                      次に見る観点: {selectedProgress.nextMissingLabel}
                    </p>
                  )}
                </div>
                <div className="teacher-student-route-counts" aria-label="対応先別件数">
                  <span>教員確認 {effectiveSelectedStudent.teacherCheckCount}</span>
                  <span>授業共有 {effectiveSelectedStudent.classShareCount}</span>
                  <span>本人確認 {effectiveSelectedStudent.selfCheckCount}</span>
                </div>
              </div>

              <div className="teacher-student-selection-strip" aria-label="選択中の学生">
                <div>
                  <span>選択中</span>
                  <strong>{effectiveSelectedStudent.name}</strong>
                  <p>次に見る: {selectedStudentNextStep}</p>
                </div>
                <div className="teacher-detail-nav-actions">
                  <button
                    type="button"
                    disabled={!previousStudent}
                    onClick={() => previousStudent && handleTeacherStudentSelect(previousStudent.id)}
                  >
                    前の学生
                  </button>
                  <button
                    type="button"
                    disabled={!nextStudent}
                    onClick={() => nextStudent && handleTeacherStudentSelect(nextStudent.id)}
                  >
                    次の学生
                  </button>
                  <a className="teacher-detail-nav-link" href="#teacher-student-list">一覧へ戻る</a>
                </div>
              </div>

              <div className="teacher-student-action-brief" aria-label="選択学生の最初に見ること">
                <article>
                  <span>先に見る</span>
                  <strong>{selectedStudentNextStep}</strong>
                </article>
                <article>
                  <span>返す問い</span>
                  <strong>{selectedStudentReturnQuestion}</strong>
                </article>
                <article>
                  <span>扱う境界</span>
                  <strong>{selectedStudentBoundary}</strong>
                </article>
              </div>

              <div className="teacher-checkpoint-list">
                {effectiveSelectedStudent.checkpoints.map((checkpoint) => (
                  <article key={checkpoint}>
                    <span>確認</span>
                    <p>{checkpoint}</p>
                  </article>
                ))}
              </div>

              <details className="teacher-student-support-details">
                <summary>
                  <span>
                    <span className="label">補助材料</span>
                    <strong>記録プロセス・返却準備・直近記録を開く</strong>
                  </span>
                  <em>必要な時だけ確認</em>
                </summary>
                <div className="teacher-student-support-details-body">
                  <div className="teacher-process-timeline" aria-label="記録プロセス">
                    {selectedProcessSteps.map((step) => (
                      <article key={step.label} className={`process-${step.status || "neutral"}`}>
                        <span>{step.label}</span>
                        <strong>{step.value}</strong>
                        <p>{step.body}</p>
                      </article>
                    ))}
                  </div>

                  {effectiveSelectedStudent.supportPlan && (
                    <section className={`teacher-support-plan tone-${effectiveSelectedStudent.supportPlan.tone || "neutral"}`} aria-label="選択学生の支援メモ">
                      <div className="teacher-support-plan-head">
                        <span>{effectiveSelectedStudent.supportPlan.label}</span>
                        <div>
                          <strong>{effectiveSelectedStudent.supportPlan.title}</strong>
                          <p>{effectiveSelectedStudent.supportPlan.body}</p>
                        </div>
                      </div>
                      <div className="teacher-support-plan-grid">
                        <article>
                          <span>次に見ること</span>
                          <ul>
                            {effectiveSelectedStudent.supportPlan.nextActions.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </article>
                        <article>
                          <span>返す問い</span>
                          <ul>
                            {effectiveSelectedStudent.supportPlan.returnQuestions.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </article>
                      </div>
                      {effectiveSelectedStudent.supportPlan.returnPreparation && (
                        <div className="teacher-return-prep teacher-student-return-prep" aria-label="返す前の下ごしらえ">
                          <div className="teacher-student-return-prep-head">
                            <span>{effectiveSelectedStudent.supportPlan.returnPreparation.route}</span>
                            <strong>返す前の下ごしらえ</strong>
                            <p>{effectiveSelectedStudent.supportPlan.returnPreparation.focus}</p>
                          </div>
                          <dl>
                            <div>
                              <dt>返す前に見る</dt>
                              <dd>{effectiveSelectedStudent.supportPlan.returnPreparation.teacherCheck}</dd>
                            </div>
                            <div>
                              <dt>学生へ返す問い</dt>
                              <dd>{effectiveSelectedStudent.supportPlan.returnPreparation.studentPrompt}</dd>
                            </div>
                            <div>
                              <dt>授業に回すなら</dt>
                              <dd>{effectiveSelectedStudent.supportPlan.returnPreparation.classUse}</dd>
                            </div>
                            <div>
                              <dt>扱わないこと</dt>
                              <dd>{effectiveSelectedStudent.supportPlan.returnPreparation.boundary}</dd>
                            </div>
                          </dl>
                        </div>
                      )}
                    </section>
                  )}

                  <div className="teacher-recent-records">
                    <span className="label">直近の記録</span>
                    {effectiveSelectedStudent.recentLogs.length === 0 ? (
                      <p className="teacher-empty-note">最近の記録はまだありません。</p>
                    ) : effectiveSelectedStudent.recentLogs.slice(0, 2).map((log) => (
                      <article key={log.id}>
                        <strong>{getKindLabel(log.kind)} / {formatShortDate(log.createdAt)}</strong>
                        <p>{log.displaySummary || "確認メタ情報なし"}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </details>
            </>
          )}
        </div>
      </div>

      <details className="teacher-class-theme-strip" aria-label="授業で扱う共通論点">
        <summary className="teacher-class-theme-summary">
          <div>
            <span className="label">授業共有論点</span>
            <h4>複数学生でつまずきやすい点を別に残す</h4>
            <p>{classThemeSummary}</p>
          </div>
          <span>{classLessonSummary}</span>
        </summary>
        <div>
          <span className="label">授業共有論点</span>
          <p>必要な時だけ開き、個別記録ではなく授業で扱う問いとして確認します。</p>
        </div>
        <div className="teacher-class-theme-grid">
          {themes.length === 0 ? (
            <p className="teacher-empty-note">授業で扱う共通論点はまだありません。</p>
          ) : themes.map((theme) => (
            <article key={theme.themeKey || theme.label}>
              <span>{theme.studentCount}名 / {theme.count}件</span>
              <strong>{theme.label}</strong>
              <p>{theme.detail}</p>
            </article>
          ))}
        </div>
        {lessonPlans.length > 0 && (
          <div className="teacher-class-lesson-plan" aria-label="次回授業で扱う問い">
            <div className="teacher-class-lesson-head">
              <div>
                <span className="label">授業メモ</span>
                <p>個別の記録を取り上げず、次回授業で扱う問いに変換します。</p>
              </div>
              {canOpenClassShareStudents && (
                <button type="button" onClick={() => handleStudentRouteFilterChange("class", { focusList: true })}>
                  授業共有の学生を見る
                </button>
              )}
            </div>
            <div className="teacher-class-lesson-grid">
              {lessonPlans.map((plan) => (
                <article key={plan.id}>
                  <span>{plan.studentCount}名 / {plan.focusLabel}</span>
                  <strong>{plan.label}</strong>
                  <p>{plan.classQuestion}</p>
                  <ul>
                    <li>{plan.miniTask}</li>
                    <li>{plan.avoidText}</li>
                  </ul>
                </article>
              ))}
            </div>
          </div>
        )}
      </details>

    </section>
  );
}

function normalizeClientTemplate(template = {}) {
  const rules = Array.isArray(template.checkRules)
    ? template.checkRules.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8)
    : [];
  return {
    diaryHeadings: normalizeClientList(template.diaryHeadings, defaultSchoolFormat.diaryHeadings, 5),
    studentDiaryFieldLabels: normalizeClientStudentDiaryFieldLabels(template.studentDiaryFieldLabels || template.diaryFieldLabels),
    studentDiaryRequirements: buildStudentDiaryRequirements(template),
    planHeadings: normalizeClientList(template.planHeadings, defaultSchoolFormat.planHeadings, 5),
    checkRules: rules.length >= 3 ? rules : defaultSchoolFormat.checkRules,
    writingStyle: typeof template.writingStyle === "string" && template.writingStyle.trim() ? template.writingStyle : defaultSchoolFormat.writingStyle,
  };
}

function normalizeClientStudentDiaryFieldLabels(value = {}) {
  const labels = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    goalReflection: safeCopyText(labels.goalReflection, 80) || defaultSchoolFormat.studentDiaryFieldLabels.goalReflection,
    episodeMemo: safeCopyText(labels.episodeMemo, 80) || defaultSchoolFormat.studentDiaryFieldLabels.episodeMemo,
    episodeInsight: safeCopyText(labels.episodeInsight, 80) || defaultSchoolFormat.studentDiaryFieldLabels.episodeInsight,
    overallLearning: safeCopyText(labels.overallLearning, 80) || defaultSchoolFormat.studentDiaryFieldLabels.overallLearning,
    nextAction: safeCopyText(labels.nextAction, 80) || defaultSchoolFormat.studentDiaryFieldLabels.nextAction,
  };
}

function normalizeClientList(value, fallback, count) {
  const list = Array.isArray(value) ? value : [];
  return Array.from({ length: count }, (_, index) => {
    const item = typeof list[index] === "string" ? list[index].trim() : "";
    return item || fallback[index] || "";
  });
}

function formatShortDate(value) {
  if (!value) return "日時未記録";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時未記録";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
