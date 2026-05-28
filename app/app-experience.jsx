"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createContactLabelPattern,
  createFamilyInfoPattern,
  createGuardianNamePattern,
  createJapaneseAddressPattern,
  createLikelyFullNamePattern,
  createMedicalInfoPattern,
  createPhonePattern,
  normalizePrivacyScanText,
} from "./privacyPatterns.js";

const LIMITS = {
  freeDailyUses: 2,
  practiceDailyUses: 10,
  adBonusLimit: 3,
};
const ENABLE_LOG_EXPORTS = process.env.NEXT_PUBLIC_MANABI_ENABLE_LOG_EXPORTS === "true";

const initialDiary = {
  date: "",
  weather: "晴れ",
  age: "3歳児クラス",
  scene: "朝の自由遊び",
  goal: "",
  memo: "",
  reflection: "",
  tomorrowTask: "",
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

const defaultSchoolFormat = {
  diaryHeadings: ["エピソードの整理", "気づきの確認", "表現の確認", "明日の観察", "教員への相談"],
  planHeadings: ["活動概要", "ねらい", "環境構成", "展開と援助", "相談ポイント"],
  checkRules: ["個人名の置換・マスキング", "断定表現の確認", "未入力項目の明示", "保育所保育指針の観点", "学校の担当教員への相談点"],
  writingStyle: "学生が先に書いた記録に対して、完成文ではなく問い返し・安全確認・相談点として返す。",
};

const STUDENT_NAV_ITEMS = [
  ["diary", "記録を書く"],
];

const STUDENT_FLOW_STEPS = [
  ["input", "入力", "入力例・記録"],
  ["confirm", "安全確認", "表現を確認"],
  ["revise", "問い返し", "自分で整える"],
  ["final", "提出前", "記録を確認"],
];

const FINAL_DRAFT_PLACEHOLDER = [
  "問い返しを見ながら、自分の言葉で提出前の記録を整えます。",
  "例：A児がブロックで電車を作っていた場面で、B児が近くで見ている姿があった。私は...",
].join("\n");

const CLIENT_FIELD_LABELS = {
  goal: "今日のねらい",
  memo: "見たこと・自分の関わり",
  reflection: "自分で考えたこと",
  tomorrowTask: "明日見たいこと・相談したいこと",
  feedbackReceived: "実習先で受けた助言",
  feedbackInterpretation: "助言への自分の理解",
  feedbackUnclear: "まだ分からないこと",
  feedbackTomorrowAction: "明日変えたい行動",
  feedbackTeacherQuestion: "学校の担当教員に相談したいこと",
};

const STAFF_NAV_ITEMS = [
  ["school", "面談準備"],
  ["assignments", "実習前後の課題"],
  ["students", "学生一覧"],
  ["review", "確認レビュー"],
  ["formats", "フォーマット"],
  ["pass", "導入プラン"],
];

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
    studentName: "学生A",
    createdAt: new Date().toISOString(),
  },
  {
    id: "risky-demo",
    generationId: "demo-log-2",
    title: "評価語を含むメモ",
    tag: "表現確認",
    detail: "子どもへの評価・診断に近い表現が入力に含まれていた可能性があります。",
    handling: "class_share",
    handlingLabel: "授業共有",
    handlingDetail: "個別添削ではなく、授業内でまとめて扱う候補です。",
    studentName: "学生B",
    createdAt: new Date().toISOString(),
  },
  {
    id: "completion-demo",
    generationId: "demo-log-2",
    title: "入力内容から確認できない事実の確認",
    tag: "補完疑い",
    detail: "学生メモに根拠がない発達効果や場面描写が含まれていないか確認する候補です。",
    handling: "teacher_now",
    handlingLabel: "当日確認",
    handlingDetail: "個人情報や重大な表現リスクとして、当日中に教員が見る候補です。",
    studentName: "学生B",
    createdAt: new Date().toISOString(),
  },
  {
    id: "privacy-demo",
    generationId: "demo-log-3",
    title: "個人情報の確認",
    tag: "置換確認",
    detail: "子ども名・職員名など、置き換え確認が必要な情報が含まれていた可能性があります。",
    handling: "teacher_now",
    handlingLabel: "当日確認",
    handlingDetail: "個人情報や重大な表現リスクとして、当日中に教員が見る候補です。",
    studentName: "学生C",
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
    studentName: "学生D",
    createdAt: new Date().toISOString(),
  },
];

const reviewActions = [
  { id: "resolved", label: "確認済み", template: "教員確認済み。学生本人への追加対応は不要です。" },
  { id: "class", label: "授業で扱う", template: "同じつまずきが複数見られるため、授業共有テーマとして扱います。" },
  { id: "individual", label: "個別確認", template: "個人情報や表現リスクがあるため、該当学生を個別に確認します。" },
  { id: "student", label: "学生に再確認", template: "提出前に、観察事実・表現・学校の担当教員に確認したい点を学生本人へ見直してもらいます。" },
];

const reviewRouteFilters = [
  { value: "すべて", label: "すべて", detail: "全候補" },
  { value: "高", label: "当日確認", detail: "個別に見る" },
  { value: "中", label: "授業共有", detail: "まとめて扱う" },
  { value: "低", label: "学生本人", detail: "自己確認へ" },
];

const demoRecentLogs = [
  {
    id: "demo-log-1",
    kind: "diary",
    provider: "claude",
    model: "demo",
    createdAt: new Date().toISOString(),
    studentName: "学生A",
    className: "保育実習I / 2年A組",
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
    studentName: "学生B",
    className: "保育実習I / 2年A組",
    inputPreview: "片付けの時間に席を立つ子がいて、声をかけた。うまくいったと思う。",
    outputPreview: "実習生の関わりの意図と、実際に見られた子どもの姿を分けて問い返す。",
    sections: [
      { heading: "援助の振り返り", body: "声をかけたことは記録されているが、声かけの内容や、その後に見られた子どもの姿は未記入である。" },
      { heading: "明日に向けて", body: "切り替え場面で、子どもが見通しをもてる関わりになっていたかを学校の担当教員に確認したい。" },
    ],
    checks: ["声かけの具体的な内容は記録できていますか。", "子どもの反応を評価語ではなく姿として書けていますか。", "保育所保育指針や5領域の観点と、実際に見た姿はつながっていますか。"],
    checkCount: 3,
    reviewTags: ["確認多め", "指針確認"],
  },
  {
    id: "demo-log-3",
    kind: "diary",
    provider: "claude",
    model: "demo",
    createdAt: new Date().toISOString(),
    studentName: "学生C",
    className: "保育実習I / 2年A組",
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
    studentName: "学生D",
    className: "保育実習I / 2年A組",
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
  { tag: "表現確認", count: 2 },
  { tag: "置換確認", count: 1 },
  { tag: "補完疑い", count: 1 },
  { tag: "指針確認", count: 1 },
];

const demoStudentUsage = [
  { id: "demo-student-1", name: "学生A", email: "student@example.ac.jp", generations: 4, diary: 4, plan: 0, reviewCandidates: 2, latestAt: new Date().toISOString() },
  { id: "demo-student-2", name: "学生B", email: "student2@example.ac.jp", generations: 2, diary: 2, plan: 0, reviewCandidates: 1, latestAt: new Date().toISOString() },
];

const demoPocMetrics = [
  { label: "翌日行動化", value: "3/4件", detail: "実習先で受けた指導を、翌日の観察や行動に置き換えられた件数" },
  { label: "教員確認負担", value: "1/5件", detail: "教員が当日確認する候補だけに絞った件数" },
  { label: "学生の負担感確認", value: "面談で確認", detail: "学生に何が見えるかを説明し、負担感・抵抗感をアンケートで確認" },
];

const teacherPreviewCheckpoints = [
  {
    kicker: "学生画面",
    title: "迷わず使えるか",
    detail: "入力、安全確認、問い返し、学生が自分で書いた記録の提出前チェックの順番が、自然かを確認します。",
  },
  {
    kicker: "実習先助言",
    title: "翌日の観察へ戻せるか",
    detail: "実習先で受けた助言が、学生の反省で止まらず、翌日の見る点や相談点に変わるかを見ます。",
  },
  {
    kicker: "教員画面",
    title: "次の支援に使えるか",
    detail: "面談で見る、授業で扱う、学生本人に戻す、という対応先の分け方が実際の運用に合うかを見ます。",
  },
  {
    kicker: "学校フォーマット",
    title: "残したい見出しが合うか",
    detail: "学校の日誌様式に合わせるため、残したい見出しや提出前の確認観点を見ます。",
  },
];

const teacherPreviewReturnItems = [
  "PoC前に最低限直す点",
  "教員画面に出ると役立つ情報・出ない方がよい情報",
  "学校フォーマットに合わせるために必要な見出し",
];

const formatReviewQuestions = [
  {
    kicker: "日誌様式",
    title: "残したい見出し",
    detail: "学校の実習日誌で必ず残したい欄名、順番、文体を確認します。",
  },
  {
    kicker: "提出前確認",
    title: "毎年直している表現",
    detail: "個人名、園名、評価語、入力不足など、学校として特に見たい観点を確認します。",
  },
  {
    kicker: "保存範囲",
    title: "教員が見返したい段階",
    detail: "安全確認後の本文、問い返し、学生が自分で書いた記録の提出前チェックのうち、どこを面談材料として残すかを確認します。",
  },
];

const assignmentTemplates = [
  {
    title: "観察メモを事実・考察・問いに分ける",
    type: "実習準備",
    due: "実習開始2週間前",
    target: "2年生 全クラス",
    completion: 72,
    signals: ["入力不足", "考察欄", "実習担当教員への相談"],
  },
  {
    title: "評価語を観察表現に直す",
    type: "AIリテラシー",
    due: "次回授業まで",
    target: "保育実習I",
    completion: 64,
    signals: ["評価語", "断定表現", "子どもの姿"],
  },
  {
    title: "日誌の考察を5領域の観点で見直す",
    type: "実習準備",
    due: "実習開始1週間前",
    target: "2年生 全クラス",
    completion: 58,
    signals: ["指針確認", "子どもの姿", "考察"],
  },
];

const commonMistakes = [
  { label: "入力が短すぎる", count: 18, detail: "出来事だけで、場面・関わり・子どもの反応が不足しやすい。" },
  { label: "評価語が残る", count: 11, detail: "落ち着き、やる気、できる/できない等の表現が出やすい。" },
  { label: "相談点が出ない", count: 9, detail: "AIの問いを完成文として受け取り、学校の担当教員へ確認する観点が弱い。" },
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

function hasMeaningfulText(value) {
  const signalChars = normalizePrivacyScanText(value).match(/[一-龯ぁ-んァ-ンA-Za-z0-9０-９]/g) || [];
  return signalChars.length >= 2;
}

function buildDiaryGenerationPayload(diary, feedback, tone) {
  return {
    ...diary,
    goal: normalizeMultiline(diary.goal),
    memo: normalizeMultiline(diary.memo),
    reflection: normalizeMultiline(diary.reflection),
    tomorrowTask: normalizeMultiline(diary.tomorrowTask),
    feedbackGuidanceCategory: normalizeMultiline(feedback.guidanceCategory),
    feedbackReceived: normalizeMultiline(feedback.received),
    feedbackInterpretation: normalizeMultiline(feedback.interpretation),
    feedbackUnclear: normalizeMultiline(feedback.unclear),
    feedbackTomorrowAction: normalizeMultiline(feedback.tomorrowAction),
    feedbackTeacherQuestion: normalizeMultiline(feedback.teacherQuestion),
    tone,
  };
}

function getSourceLabel(source) {
  if (source === "openai" || source === "claude" || source === "anthropic") return "AI支援";
  return "省察支援";
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
  "manabi-practice-pass-demo",
];

function clearAppLocalStorage() {
  try {
    for (const key of APP_LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("manabi-diary-usage-")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // localStorage may be unavailable in hardened browser settings.
  }
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
    schoolName: safeCopyText(session.schoolName, 80),
    className: safeCopyText(session.className, 80),
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

function normalizeStoredDemoSession(session) {
  if (!session || typeof session !== "object" || Array.isArray(session)) return null;
  if (session.source !== "demo") return null;
  const role = session.role === "teacher" ? "teacher" : session.role === "student" ? "student" : null;
  if (!role) return null;
  return {
    source: "demo",
    role,
    roleLabel: role === "teacher" ? "教員" : "学生",
    name: safeCopyText(session.name || (role === "teacher" ? "実習担当教員" : "実習生"), 80),
    email: safeCopyText(session.email || "", 120),
    schoolName: safeCopyText(session.schoolName || "", 120),
    className: safeCopyText(session.className || "", 120),
    signedInAt: safeCopyText(session.signedInAt || "", 80),
  };
}

function buildInputSummary(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return {
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

function buildClientPrivacyFlags(value = {}) {
  const text = normalizePrivacyScanText(JSON.stringify(value || {}));
  const riskText = removeAllowedAnonymizedTerms(text);
  const compactRiskText = riskText.replace(/[\s　]+/g, "");
  return {
    hasChildNameLikeText: /(くん|ちゃん|君|子ども名|こども名|園児名|児童名|氏名|名前|実名|本名|愛称)/.test(riskText),
    hasSchoolNameLikeText: /(保育園|幼稚園|こども園|認定こども園|ナーサリー|キッズ園|園名|実習先名|施設名)/.test(riskText),
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

function buildClientPrivacyWarnings(value = {}) {
  const check = buildClientPrivacyCheck(value);
  return [...check.blockers, ...check.warnings];
}

function safeCopyText(value, maxLength = 280) {
  const text = normalizePrivacyScanText(value).replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  return redactSensitiveText(text).slice(0, maxLength);
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
    .replace(/([一-龯ぁ-んァ-ンA-Za-z0-9０-９]{2,30})(保育園|幼稚園|こども園|認定こども園|ナーサリー|キッズ園)/g, "〈園名〉")
    .replace(/(園名|実習先名|施設名)[:：]?\s*[^\s、。]{1,40}/g, "〈園名〉")
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
    inputSummary: buildInputSummary(sanitized?.input),
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

function readStoredSession() {
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

export function AppExperience() {
  const todayKey = useMemo(() => getLocalDateKey(), []);
  const usageKey = `manabi-diary-usage-${todayKey}`;
  const feedbackKey = "manabi-diary-feedback";
  const generationLogKey = "manabi-generation-logs";
  const passKey = "manabi-practice-pass-demo";
  const staffViewIds = useMemo(() => STAFF_NAV_ITEMS.map(([view]) => view), []);

  const [activeView, setActiveView] = useState("diary");
  const [tone, setTone] = useState("balanced");
  const [diary, setDiary] = useState({ ...initialDiary, date: todayKey });
  const [usage, setUsage] = useState({ used: 0, bonus: 0 });
  const [hasPracticePass, setHasPracticePass] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [resultMeta, setResultMeta] = useState(null);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [studentFlowStep, setStudentFlowStep] = useState("input");
  const [privacyReview, setPrivacyReview] = useState(null);
  const [checkedPayload, setCheckedPayload] = useState(null);
  const [finalDraft, setFinalDraft] = useState("");
  const [finalCheck, setFinalCheck] = useState(null);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [generationCount, setGenerationCount] = useState(0);
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [schoolSummary, setSchoolSummary] = useState(null);
  const [schoolSummaryStatus, setSchoolSummaryStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const role = session?.role || "student";
  const isStudent = role === "student";
  const isDemoSession = session?.source === "demo";
  const visibleNavItems = isStudent ? STUDENT_NAV_ITEMS : STAFF_NAV_ITEMS;
  const currentView = isStudent
    ? "diary"
    : (staffViewIds.includes(activeView) ? activeView : "school");

  const dailyLimit = hasPracticePass ? LIMITS.practiceDailyUses : LIMITS.freeDailyUses;
  const remaining = isDemoSession ? Math.max(0, dailyLimit + usage.bonus - usage.used) : Infinity;
  const total = dailyLimit + usage.bonus;
  const usageWidth = isDemoSession && total !== 0 ? (remaining / total) * 100 : 100;
  const staffMetrics = schoolSummary?.metrics || {};

  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      let nextSession = readStoredSession();
      try {
        const response = await fetch("/api/auth", { cache: "no-store" });
        if (response.ok) {
          const auth = await response.json();
          if (auth.session) {
            nextSession = auth.session;
            clearAppLocalStorage();
          } else if (auth.configured) {
            nextSession = null;
            clearAppLocalStorage();
          }
        }
      } catch (error) {
        console.warn("Auth session restore skipped:", error.message);
      }

      if (!cancelled) {
        setSession(nextSession);
        if (nextSession?.source === "demo") {
          try {
            const savedUsage = JSON.parse(localStorage.getItem(usageKey));
            setUsage({ used: 0, bonus: 0, ...savedUsage });
            setHasPracticePass(localStorage.getItem(passKey) === "active");
            setFeedbackCount(getSavedFeedbackRecords(feedbackKey).length);
            setGenerationCount(getSavedFeedbackRecords(generationLogKey).length);
          } catch {
            setUsage({ used: 0, bonus: 0 });
            setHasPracticePass(false);
            setFeedbackCount(0);
            setGenerationCount(0);
          }
        } else {
          setUsage({ used: 0, bonus: 0 });
          setHasPracticePass(false);
          setFeedbackCount(0);
          setGenerationCount(0);
        }
        setSessionChecked(true);
      }
    }

    loadInitialState();
    return () => {
      cancelled = true;
    };
  }, [feedbackKey, generationLogKey, passKey, usageKey]);

  useEffect(() => {
    if (!sessionChecked || !isStudent) return;
    if (activeView !== "diary") {
      setActiveView("diary");
    }
  }, [activeView, isStudent, sessionChecked]);

  useEffect(() => {
    if (!sessionChecked || isStudent) return;
    if (!staffViewIds.includes(activeView)) {
      setActiveView("school");
    }
  }, [activeView, isStudent, sessionChecked, staffViewIds]);

  useEffect(() => {
    if (!sessionChecked || isStudent || !["school", "assignments", "students", "review", "formats"].includes(currentView)) return;
    let cancelled = false;

    async function loadSchoolSummary() {
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
              ? "面談準備用の確認記録を表示しています。"
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
  }, [currentView, isStudent, session?.source, sessionChecked]);

  function getSessionContext() {
    return {
      schoolName: session?.schoolName || "",
      schoolId: session?.schoolId || "",
      className: session?.className || "",
      classId: session?.classId || "",
      schoolPlan: session?.schoolPlan || "",
      contractStatus: session?.contractStatus || "",
      userId: session?.userId || "",
      role: session?.role || "",
      roleLabel: session?.roleLabel || "",
      userName: session?.name || "",
      email: session?.email || "",
      source: session?.source || "",
    };
  }

  function saveGenerationLog(record) {
    if (isDemoSession) {
      const saved = getSavedFeedbackRecords(generationLogKey);
      const nextRecords = [sanitizeGenerationLogForExport(record), ...saved].slice(0, 100);
      if (safeSetLocalStorage(generationLogKey, JSON.stringify(nextRecords))) {
        setGenerationCount(nextRecords.length);
      }
    } else {
      setGenerationCount((current) => current + 1);
    }
    if (!record.serverPersisted) {
      persistServerLog("generation", record);
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

  function saveUsage(nextUsage) {
    setUsage(nextUsage);
    if (isDemoSession) {
      safeSetLocalStorage(usageKey, JSON.stringify(nextUsage));
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
      setDiary({ ...initialDiary, date: todayKey });
      resetFeedback();
    }
  }

  function updateDiary(field, value) {
    setDiary((current) => ({ ...current, [field]: value }));
    setPrivacyReview(null);
    setCheckedPayload(null);
    setFinalCheck(null);
    if (studentFlowStep !== "input") setStudentFlowStep("input");
  }

  function loadDiarySample(sample) {
    setDiary((current) => ({
      ...current,
      ...sample.values,
      date: current.date || todayKey,
      reflection: sample.values.reflection || "",
      tomorrowTask: sample.values.tomorrowTask || "",
    }));
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
  }

  async function generate(kind, payload, options = {}) {
    const subscription = options.subscription || (hasPracticePass ? "practice" : "free");
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind,
        payload,
        subscription,
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

  async function handleDiarySubmit(event) {
    event.preventDefault();
    if (isDemoSession && remaining <= 0) {
      setStatus("学生画面の利用枠を使い切りました。必要に応じて利用枠を追加できます。");
      return;
    }

    const memo = normalizeMultiline(diary.memo);
    if (!hasMeaningfulText(memo)) {
      setStatus("今日あったことを、言葉で入力してください。");
      return;
    }

    setBusy(true);
    try {
      const review = await privacyCheckRequest("diary", buildDiaryGenerationPayload(diary, feedback, tone), "pre_ai");
      setPrivacyReview(review);
      setCheckedPayload(review.payload);
      setResult(null);
      setResultMeta(null);
      setFinalCheck(null);
      setStudentFlowStep("confirm");
      setStatus(review.summary || "安全確認を表示しました。内容を確認してから問い返しへ進めます。");
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
    if (isDemoSession && remaining <= 0) {
      setStatus("学生画面の利用枠を使い切りました。必要に応じて利用枠を追加できます。");
      return;
    }
    const payload = checkedPayload || buildDiaryGenerationPayload(diary, feedback, tone);
    setBusy(true);
    try {
      const content = await generate("diary", payload);
      setResult(content);
      const actualSubscription = hasPracticePass ? "practice" : "free";
      const generationId = content.generationId || crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const input = payload;
      setResultMeta({
        kind: "diary",
        generationId,
        subscription: actualSubscription,
        tone,
        input,
        session: getSessionContext(),
        createdAt,
      });
      saveGenerationLog({
        id: generationId,
        kind: "diary",
        subscription: actualSubscription,
        input,
        output: content,
        session: getSessionContext(),
        serverPersisted: Boolean(content.generationId),
        createdAt,
      });
      saveUsage({ ...usage, used: usage.used + 1 });
      setStudentFlowStep("revise");
      setFinalDraft("");
      setFinalCheck(null);
      setStatus("問い返しと提出前の自己確認を表示しました。最後に自分の言葉で記録を整えてください。");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function privacyCheckRequest(kind, payload, phase) {
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
    setStatus("安全な表現に整えた記録を反映しました。");
  }

  function watchAd() {
    if (!isDemoSession) {
      setStatus("利用枠は学校契約と上限設定で管理されています。");
      return;
    }
    if (usage.bonus >= LIMITS.adBonusLimit || hasPracticePass) return;
    setStatus("利用枠を追加しています...");
    window.setTimeout(() => {
      saveUsage({ ...usage, bonus: usage.bonus + 1 });
      setStatus("追加サポートが1回増えました。");
    }, 900);
  }

  function activatePracticePass() {
    if (!isDemoSession) {
      setStatus("導入プランは学校契約として管理します。");
      return;
    }
    if (!safeSetLocalStorage(passKey, "active")) {
      setStatus("ブラウザの保存設定により、学校導入モードを保存できませんでした。");
      return;
    }
    setHasPracticePass(true);
    setStatus("学校導入モードを有効化しました。");
  }

  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setStatus("ログアウトしています。");
    try {
      clearAppLocalStorage();
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
      window.location.replace("/login");
    } catch (error) {
      setStatus(`${error.message} もう一度ログアウトを押してください。`);
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
    const canCopyCheckedFinal = Boolean(finalCheck)
      && !finalCheck.blocked
      && (!finalCheck.changed || checkedText === sanitizedText);
    if (!canCopyCheckedFinal) {
      setStudentFlowStep("final");
      if (!finalCheck) {
        setStatus("記録をコピーする前に、提出前チェックを行ってください。");
      } else if (finalCheck.blocked) {
        setStatus("記録に扱えない表現が残っています。入力を見直してから再チェックしてください。");
      } else {
        setStatus("安全化した文を反映してからコピーしてください。");
      }
      return;
    }
    await navigator.clipboard.writeText(finalDraft.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
    setStatus("記録をコピーしました。");
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
    const serverRecords = (schoolSummary?.recentLogs || []).map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      kind: log.kind,
      session: {
        schoolName: schoolSummary?.school?.name || session?.schoolName || "",
        className: log.className || "",
        role: "student",
      },
      input: { preview: log.inputPreview || "" },
      output: {
        headings: (log.sections || []).map((section) => section.heading),
        checks: log.checks || [],
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

  if (!sessionChecked) {
    return (
      <AppGateCard
        title="ログイン状態を確認しています"
        description="学校・クラス・ロール情報を読み込んでいます。"
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
      <section className={`workspace ${isStudent ? "student-workspace" : ""}`} id="demo" aria-label="実習記録の問い返しと提出前の自己確認">
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
              <span>面談準備</span>
            </div>
          </div>}

          <div className={`usage-panel ${isStudent ? "student-session-panel" : ""}`}>
            <div>
              <span className="label">ログイン中</span>
              <strong className="session-role">{session?.roleLabel || "教員"}</strong>
            </div>
            <div className="session-meta">
              <span>{session?.schoolName || "さくら保育者養成校"}</span>
              <span>{session?.className || "保育実習I / 2年A組"}</span>
            </div>
            <p className="muted">{status || "ロールに応じた画面を表示しています。"}</p>
            <button className="ghost-button" type="button" onClick={logout} disabled={logoutBusy}>
              {logoutBusy ? "ログアウト中..." : "ログアウト"}
            </button>
          </div>

          {!isStudent && (
            <div className="usage-panel compact-panel staff-summary-card">
              <div>
                <span className="label">利用スナップショット</span>
                <strong>{staffMetrics.students ?? 0}人</strong>
              </div>
            <div className="staff-summary-list">
                <span>確認記録 {staffMetrics.generations ?? generationCount}件</span>
                <span>確認候補 {staffMetrics.reviewCandidates ?? schoolSummary?.reviewQueue?.length ?? 0}件</span>
                <span>振り返り {staffMetrics.feedback ?? feedbackCount}件</span>
              </div>
            </div>
          )}

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

          {!isStudent && <div className="note">
            <span className="label">導入方針</span>
            <p>学生が一般AIの出力を十分に見直さずに使うことを防ぎ、授業内で安全な問い返しとして使える形にします。</p>
          </div>}
        </aside>

        <section className="editor">
          {currentView === "diary" && (
            <DiaryView
              diary={diary}
              tone={tone}
              busy={busy}
              samples={diarySamples}
              feedback={feedback}
              onToneChange={setTone}
              onChange={updateDiary}
              onFeedbackChange={updateFeedback}
              onSubmit={handleDiarySubmit}
              onSample={loadDiarySample}
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
                setFinalCheck(null);
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
              feedbackCount={feedbackCount}
              generationCount={generationCount}
              schoolSummary={schoolSummary}
              schoolSummaryStatus={schoolSummaryStatus}
              session={session}
              enableLogExports={ENABLE_LOG_EXPORTS}
              onExportGenerationCsv={() => exportGenerationLogs("csv")}
              onExportGenerationJson={() => exportGenerationLogs("json")}
            />
          )}

          {currentView === "assignments" && (
            <AssignmentManagementView schoolSummary={schoolSummary} schoolSummaryStatus={schoolSummaryStatus} session={session} />
          )}

          {currentView === "students" && (
            <StudentManagementView schoolSummary={schoolSummary} schoolSummaryStatus={schoolSummaryStatus} session={session} />
          )}

          {currentView === "review" && (
            <TeacherReviewView schoolSummary={schoolSummary} schoolSummaryStatus={schoolSummaryStatus} session={session} />
          )}

          {currentView === "formats" && (
            <FormatSettingsView session={session} />
          )}

          {currentView === "pass" && <SchoolPlanView hasPracticePass={hasPracticePass} onActivate={activatePracticePass} />}
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
                    {buildFeedbackNextSteps(feedback).observationPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="result-section">
                <h3>提出前の自己確認</h3>
                <ul>
                  {result.checks.map((check) => (
                    <li key={check}>{check}</li>
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

function AppGateCard({ title, description, actionLabel, actionHref }) {
  return (
    <main id="main-content" className="login-shell">
      <section className="login-card" aria-label={title}>
        <a className="lp-brand login-brand" href="/">
          <img className="login-logo-horizontal" src="/images/manalio-logo-horizontal.svg" alt="Manalio" />
        </a>
        <div className="login-copy">
          <span className="lp-eyebrow">サービス画面</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actionHref && (
          <div className="login-actions single-action">
            <a className="primary-button login-link" href={actionHref}>{actionLabel}</a>
          </div>
        )}
      </section>
    </main>
  );
}

function FeedbackPanel({ feedback, onChange }) {
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
      <div className="feedback-field-grid">
        <TextAreaField
          label="助言の要点"
          value={feedback.received}
          placeholder="例：子どもの姿だけでなく、保育者の関わりにも目を向けるとよいと助言を受けた。"
          onChange={(value) => onChange("received", value)}
        />
        <TextAreaField
          label="自分の理解"
          value={feedback.interpretation}
          placeholder="例：子どもの行動だけで終わらず、声かけ前後の変化を見る必要があると理解した。"
          onChange={(value) => onChange("interpretation", value)}
        />
        <TextAreaField
          label="まだ迷っていること"
          value={feedback.unclear}
          placeholder="例：保育者の意図を、どこまで自分の考察として書いてよいか分からない。"
          onChange={(value) => onChange("unclear", value)}
        />
        <TextAreaField
          label="明日、見たいこと・試したいこと"
          value={feedback.tomorrowAction}
          placeholder="例：声かけの前後で子どもの姿がどう変わったかをメモする。"
          onChange={(value) => onChange("tomorrowAction", value)}
        />
      </div>
      <label className="feedback-comment">
        学校の担当教員に相談したいこと
        <textarea value={feedback.teacherQuestion} rows={3} placeholder="例：保育者の関わりを観察するとき、特に見るべき点を確認したい。" onChange={(event) => onChange("teacherQuestion", event.target.value)} />
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

function TextAreaField({ label, value, placeholder, onChange }) {
  return (
    <label className="feedback-comment compact">
      {label}
      <textarea value={value} rows={3} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function DiaryView({
  diary,
  tone,
  busy,
  samples,
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
  onFeedbackChange,
  onSubmit,
  onSample,
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
  const canConfirm = Boolean(privacyReview && checkedPayload);
  const canRevise = Boolean(result);
  const canFinal = Boolean(finalCheck);

  return (
    <div className={`view-panel student-flow-panel step-${flowStep}`}>
      <div className="student-work-header">
        <div>
          <span className="label">今日の実習記録</span>
          <h2>{getStudentFlowTitle(flowStep)}</h2>
          <p>{getStudentFlowDescription(flowStep)}</p>
        </div>
        <StudentFlowTabs
          activeStep={flowStep}
          canConfirm={canConfirm}
          canRevise={canRevise}
          canFinal={canFinal}
          onChange={onFlowStepChange}
        />
      </div>

      {flowStep === "input" && (
        <StudentInputStep
          diary={diary}
          tone={tone}
          busy={busy}
          samples={samples}
          feedback={feedback}
          privacyCheck={privacyCheck}
          onToneChange={onToneChange}
          onChange={onChange}
          onFeedbackChange={onFeedbackChange}
          onSubmit={onSubmit}
          onSample={onSample}
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
    input: "実習記録を書く",
    confirm: "安全な表現を確認する",
    revise: "問い返しを見て自分で整える",
    final: "提出前に記録を確認する",
  }[step] || "実習記録を書く";
}

function getStudentFlowDescription(step) {
  return {
    input: "見たこと、自分の考え、実習先で受けた助言を入力します。まずは自分の言葉で書きます。",
    confirm: "Manalioが安全な表現に整えた内容を確認します。ここで納得してから問い返しへ進みます。",
    revise: "返ってきた問いを使って、提出する文章を自分の言葉で整えます。",
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
  tone,
  busy,
  samples,
  feedback,
  privacyCheck,
  onToneChange,
  onChange,
  onFeedbackChange,
  onSubmit,
  onSample,
  onReset,
}) {
  const memoReady = Boolean(diary.memo.trim());
  const supportCount = [
    diary.reflection,
    diary.tomorrowTask,
    feedback.received || feedback.interpretation || feedback.tomorrowAction || feedback.teacherQuestion,
  ].filter((value) => String(value || "").trim()).length;
  return (
    <div className="student-step-card">
      <SampleLibrary title="安全な架空入力例" description="実データを入れずに、記録と実習先で受けた助言の流れを試せます。自由入力も最初から架空の場面で試します。安全な表現の確認は「名前を置き換える練習」から始められます。" samples={samples} onSelect={onSample} />

      <p className="quick-safety-note">
        名前や園名などは、問い返し前に安全な表現へ整えて確認します。実在の学生・子ども・園を少し置き換えた入力は避けてください。
      </p>

      <div className="student-input-guide" aria-label="入力の進め方">
        <article className={memoReady ? "ready" : ""}>
          <span>必須</span>
          <strong>見た場面を書く</strong>
          <p>{memoReady ? "入力済み。安全確認へ進めます。" : "1場面だけで進めます。"}</p>
        </article>
        <article className={supportCount >= 2 ? "ready" : ""}>
          <span>あると良い</span>
          <strong>考え・明日・助言</strong>
          <p>{supportCount >= 2 ? "問い返しが具体化します。" : "入力例で自動入力されます。"}</p>
        </article>
        <article>
          <span>次の手順</span>
          <strong>安全確認</strong>
          <p>問い返し前に、整えた本文を確認します。</p>
        </article>
      </div>

      <form className="form-grid" onSubmit={onSubmit}>
        <div className="form-section-title wide">
          <span>1</span>
          <div>
            <strong>基本情報</strong>
            <p>日誌に必要な前提だけ入れます。</p>
          </div>
        </div>
        <label>
          日付
          <input type="date" value={diary.date} onChange={(event) => onChange("date", event.target.value)} />
        </label>
        <label>
          天気
          <select value={diary.weather} onChange={(event) => onChange("weather", event.target.value)}>
            {["晴れ", "くもり", "雨", "雪"].map((weather) => <option key={weather}>{weather}</option>)}
          </select>
        </label>
        <label>
          クラス・年齢
          <select value={diary.age} onChange={(event) => onChange("age", event.target.value)}>
            {["0歳児クラス", "1歳児クラス", "2歳児クラス", "3歳児クラス", "4歳児クラス", "5歳児クラス", "異年齢保育"].map((age) => <option key={age}>{age}</option>)}
          </select>
        </label>
        <label>
          場面
          <select value={diary.scene} onChange={(event) => onChange("scene", event.target.value)}>
            {["朝の自由遊び", "戸外遊び", "製作活動", "食事", "午睡", "帰りの会", "部分実習"].map((scene) => <option key={scene}>{scene}</option>)}
          </select>
        </label>
        <label className="wide">
          今日のねらい
          <input value={diary.goal} placeholder="例：子ども同士の関わりを観察し、保育者の援助を学ぶ" onChange={(event) => onChange("goal", event.target.value)} />
        </label>
        <div className="form-section-title wide">
          <span>2</span>
          <div>
            <strong>エピソード記録</strong>
            <p>見たこと、自分の関わり、自分の気づきを分けて書きます。</p>
          </div>
        </div>
        <label className="wide">
          見たこと・自分の関わり
          <textarea value={diary.memo} rows={7} placeholder={"箇条書きでOK\n・A児がブロックで電車を作っていた\n・B児が近くで見ていたが入れずにいた\n・「一緒に駅を作ってみる？」と声をかけた"} onChange={(event) => onChange("memo", event.target.value)} />
        </label>
        <label className="wide">
          自分で考えたこと
          <textarea value={diary.reflection} rows={5} placeholder={"自分の記録を見直すために、まず自分の言葉で書きます。\n例：A児は友だちの遊びに入りたい気持ちがあったかもしれないが、実際には近くで見ていた姿だけを記録した。"} onChange={(event) => onChange("reflection", event.target.value)} />
        </label>
        <label className="wide">
          明日見たいこと・相談したいこと
          <textarea value={diary.tomorrowTask} rows={4} placeholder={"例：友だちの遊びに入る前後で、子どもがどのような姿を見せるか観察したい。保育者の見守り方について学校の担当教員に相談したい。"} onChange={(event) => onChange("tomorrowTask", event.target.value)} />
        </label>
        <div className="form-section-title wide">
          <span>3</span>
          <div>
            <strong>実習先で受けた助言</strong>
            <p>助言の要点を、自分の理解、翌日の観察、担当教員への相談につなげます。</p>
          </div>
        </div>
        <div className="wide">
          <FeedbackPanel
            feedback={feedback}
            onChange={onFeedbackChange}
          />
        </div>
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
        <div className="actions wide">
          <button className="primary-button" type="submit" disabled={busy || !memoReady}>{busy ? "安全確認中..." : memoReady ? "安全な表現を確認" : "見たことを入力すると進めます"}</button>
          <button className="secondary-button" type="button" onClick={onReset}>クリア</button>
        </div>
      </form>
    </div>
  );
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

function StudentReviseStep({ result, feedbackNextSteps, finalDraft, copied, busy, onBack, onCopyResult, onFinalDraftChange, onFinalCheck }) {
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
  return (
    <section className="student-step-card ai-step" aria-label="問い返し結果と提出前の記録作成">
      <div className="ai-step-head">
        <div>
          <span className="label">問い返し結果</span>
          <h3>そのまま写すのではなく、見直す観点として使います</h3>
        </div>
        <button className="secondary-button compact" type="button" onClick={onCopyResult}>
          {copied ? "コピー済み" : "問いをコピー"}
        </button>
      </div>
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
              {feedbackNextSteps.observationPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        )}
        <section className="result-section">
          <h3>提出前の自己確認</h3>
          <ul>
            {resultChecks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </section>
      </article>
      <label className="final-draft-editor">
        自分で整えた記録
        <textarea value={finalDraft} rows={8} placeholder={FINAL_DRAFT_PLACEHOLDER} onChange={(event) => onFinalDraftChange(event.target.value)} />
      </label>
      <div className="actions">
        <button className="secondary-button" type="button" onClick={onBack}>確認画面に戻る</button>
        <button className="primary-button" type="button" onClick={onFinalCheck} disabled={busy || !hasMeaningfulText(finalDraft)}>
          {busy ? "確認中..." : "提出前チェックへ進む"}
        </button>
      </div>
    </section>
  );
}

function StudentFinalStep({ finalDraft, finalCheck, copied, busy, onFinalDraftChange, onFinalCheck, onUseSanitizedFinal, onCopyFinal, onBack }) {
  const checkedText = normalizeMultiline(finalDraft);
  const sanitizedText = normalizeMultiline(finalCheck?.payload?.memo || "");
  const hasFinalDraftText = hasMeaningfulText(finalDraft);
  const canCopyCheckedFinal = Boolean(finalCheck)
    && !finalCheck.blocked
    && (!finalCheck.changed || checkedText === sanitizedText);
  const copyLabel = copied
    ? "コピー済み"
    : !finalCheck
      ? "チェック後にコピーできます"
      : finalCheck.blocked
        ? "見直すとコピーできます"
        : finalCheck.changed && checkedText !== sanitizedText
          ? "反映後にコピーできます"
          : "記録をコピー";
  return (
    <section className="student-step-card final-step" aria-label="提出前チェック">
      <label className="final-draft-editor">
        自分で整えた記録
        <textarea value={finalDraft} rows={9} placeholder={FINAL_DRAFT_PLACEHOLDER} onChange={(event) => onFinalDraftChange(event.target.value)} />
      </label>
      {finalCheck ? (
        <>
          <ReviewSummary review={finalCheck} compact />
          {finalCheck.changed && (
            <SanitizedPreview payload={finalCheck.payload} fields={["memo"]} title="安全化した提出前の記録" />
          )}
        </>
      ) : (
        <div className="review-confirm-note">
          <strong>最後に見ること</strong>
          <p>ここでは問い返しを増やさず、Manalio内のルールだけで個人情報や要配慮情報が残っていないか確認します。</p>
        </div>
      )}
      <div className="actions">
        <button className="secondary-button" type="button" onClick={onBack}>問い返しに戻る</button>
        <button className="secondary-button" type="button" onClick={onFinalCheck} disabled={busy || !hasFinalDraftText}>{busy ? "確認中..." : "再チェック"}</button>
        {finalCheck?.changed && (
          <button className="secondary-button" type="button" onClick={onUseSanitizedFinal}>安全化した文を反映</button>
        )}
        <button className="primary-button" type="button" onClick={onCopyFinal} disabled={!hasFinalDraftText || !canCopyCheckedFinal}>
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

function SampleLibrary({ title, description, samples, onSelect }) {
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
          <button className="sample-card" key={sample.id} type="button" onClick={() => onSelect(sample)}>
            <strong>{sample.title}</strong>
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

function SchoolAdminView({ feedbackCount, generationCount, schoolSummary, schoolSummaryStatus, session, enableLogExports, onExportGenerationCsv, onExportGenerationJson }) {
  const usingDemoData = session?.source === "demo" && schoolSummary?.configured === false;
  const demoMetrics = {
    students: demoStudentUsage.length,
    teachers: 1,
    generations: generationCount,
    feedback: feedbackCount,
    reviewCandidates: demoReviewQueue.length,
    activeStudents: demoStudentUsage.filter((student) => student.generations > 0).length,
  };
  const metrics = usingDemoData ? demoMetrics : schoolSummary?.metrics;
  const reviewQueue = usingDemoData ? demoReviewQueue : safeRecordList(schoolSummary?.reviewQueue);
  const recentLogs = safeRecordList(schoolSummary?.recentLogs);
  const checkSummary = usingDemoData ? demoCheckSummary : safeRecordList(schoolSummary?.checkSummary);
  const studentUsage = usingDemoData ? demoStudentUsage : safeRecordList(schoolSummary?.studentUsage);
  const pocMetrics = usingDemoData ? demoPocMetrics : safeRecordList(schoolSummary?.pocMetrics);
  const exportDisabled = !enableLogExports || (metrics?.generations ?? generationCount) === 0;
  const workloadPlan = buildTeacherWorkloadPlan(reviewQueue, metrics?.students ?? studentUsage.length);

  return (
    <div className="view-panel">
      <div className="context-bar">
        <div>
          <span className="context-label">面談準備・確認レビュー</span>
          <p>{session?.schoolName || "さくら保育者養成校"} の学生の振り返りを、実習後面談で確認しやすい形に整理</p>
        </div>
        <div className="context-stats" aria-label="面談準備の特徴">
          <span>面談サマリー</span>
          <span>根拠確認</span>
          <span>確認レビュー</span>
        </div>
      </div>

      <div className="toolbar">
        <div>
          <span className="label">教員向け</span>
          <h2>実習後面談と確認レビュー</h2>
        </div>
        <span className="badge">学校導入</span>
      </div>

      <div className="school-dashboard">
        <div className="school-metrics">
          <MetricCard label="登録学生" value={`${metrics?.students ?? 0}人`} detail={session?.className || "保育実習I / 2年A組"} />
          <MetricCard label="確認記録" value={`${metrics?.generations ?? generationCount}件`} detail={schoolSummary?.configured ? "面談準備用に保存された確認記録" : "一時保存された参考記録"} />
          <MetricCard label="確認候補" value={`${metrics?.reviewCandidates ?? reviewQueue.length}件`} detail="当日確認・授業共有・学生本人に分類" />
          <MetricCard label="振り返り" value={`${metrics?.feedback ?? feedbackCount}件`} detail="指導を受けて学んだことと翌日の観察観点" />
        </div>

        <TeacherPreviewPanel />

        <section className="school-panel workload-panel">
          <div>
            <span className="label">教員負担の抑制</span>
            <h3>全件確認ではなく、対応先で分ける運用</h3>
          </div>
          <div className="teacher-workload-grid">
            <article className="workload-card high">
              <span>当日確認</span>
              <strong>{workloadPlan.highCount}件</strong>
              <p>個人情報・置き換え確認など、提出前に必ず見たい候補</p>
            </article>
            <article className="workload-card medium">
              <span>授業共有</span>
              <strong>{workloadPlan.mediumCount}件</strong>
              <p>評価語・表現確認など、まとめて指導しやすい候補</p>
            </article>
            <article className="workload-card low">
              <span>学生本人</span>
              <strong>{workloadPlan.lowCount}件</strong>
              <p>入力不足など、提出前に学生本人へ返せる候補</p>
            </article>
          </div>
          <p className="muted">
            目安として、教員が当日見る候補を{workloadPlan.reviewNowCount}件に絞ります。
            共通テーマは授業共有へ、入力不足は学生本人への提出前の自己確認として返す運用にできます。
          </p>
        </section>

        <section className="school-panel poc-metrics-panel">
          <div>
            <span className="label">PoCで見る成果</span>
            <h3>利用率より、翌日の行動と負担感を見る</h3>
          </div>
          <div className="poc-metrics-grid">
            {pocMetrics.length === 0 ? (
              demoPocMetrics.map((item) => (
                <article key={item.label}>
                  <span>{item.label}</span>
                  <strong>未集計</strong>
                  <p>{item.detail}</p>
                </article>
              ))
            ) : pocMetrics.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="school-panel">
          <div>
            <span className="label">接続状況</span>
            <h3>学校データ接続</h3>
          </div>
          <p className="muted">{schoolSummaryStatus || "学校データの取得状態を表示します。"}</p>
          <div className="school-check-grid">
            <span>{usingDemoData ? "参考データ" : schoolSummary?.configured ? "学校データ接続中" : "接続確認中"}</span>
            <span>{session?.roleLabel || "教員"}で利用中</span>
            <span>{session?.schoolName || "学校未設定"}</span>
          </div>
        </section>

        <section className="school-panel">
          <div>
            <span className="label">確認記録</span>
            <h3>面談準備記録の書き出し</h3>
          </div>
          <p className="muted">{enableLogExports ? "書き出しは面談準備用の概要に絞ります。学生入力や問い返しの根拠は、必要な記録だけ画面上で確認できます。" : "PoC前の合意ができるまで、確認記録の書き出しは停止しています。"}</p>
          <div className="feedback-export-actions">
            <button className="secondary-button" type="button" onClick={onExportGenerationCsv} disabled={exportDisabled}>CSV</button>
            <button className="secondary-button" type="button" onClick={onExportGenerationJson} disabled={exportDisabled}>JSON</button>
          </div>
        </section>

        <section className="school-panel">
          <div>
            <span className="label">確認観点</span>
            <h3>確認観点の集計</h3>
          </div>
          <div className="signal-list">
            {checkSummary.length === 0 ? (
              <p className="muted">まだ確認観点の集計はありません。</p>
            ) : checkSummary.map((item) => (
              <div className="signal-row" key={item.tag}>
                <span>{item.tag}</span>
                <strong>{item.count}件</strong>
                <i style={{ width: `${Math.min(100, item.count * 18)}%` }} aria-hidden="true" />
              </div>
            ))}
          </div>
        </section>

        <section className="school-panel">
          <div>
            <span className="label">学生利用</span>
            <h3>学生別の確認記録</h3>
          </div>
          <div className="student-usage-list">
            {studentUsage.length === 0 ? (
              <p className="muted">まだ学生の確認記録はありません。</p>
            ) : studentUsage.slice(0, 5).map((student) => (
              <article className="student-usage-item" key={student.id}>
                <div>
                  <strong>{student.name || student.email || "学生"}</strong>
                  <p>{student.email || "メール未設定"} / 最終利用 {formatShortDate(student.latestAt)}</p>
                </div>
                <div className="student-usage-stats">
                  <span>日誌 {student.diary ?? 0}</span>
                  <span>確認候補 {student.reviewCandidates ?? 0}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="school-panel demo-flow-panel">
          <div>
            <span className="label">事前レビュー</span>
            <h3>教員レビューの確認順</h3>
          </div>
          <div className="school-step-list">
            <span>1. 学生画面で安全な架空入力例を試す</span>
            <span>2. 安全な表現、問い返し、提出前チェックまで見る</span>
            <span>3. 教員画面で当日確認・授業共有・学生本人の分類を見る</span>
            <span>4. 学校フォーマットと保存範囲をアンケートフォームへ返す</span>
          </div>
        </section>

        <section className="school-panel">
          <div>
            <span className="label">確認候補</span>
            <h3>教員の次アクション候補</h3>
          </div>
          <div className="review-list">
            {reviewQueue.length === 0 ? (
              <p className="muted">まだ確認候補はありません。</p>
            ) : reviewQueue.map((item) => (
              <ReviewItem
                key={item.id}
                title={item.title}
                tag={item.tag}
                detail={item.detail}
                handlingLabel={item.handlingLabel || getReviewHandlingLabel(item)}
                meta={item.studentName ? `${item.studentName} / ${formatShortDate(item.createdAt)}` : ""}
              />
            ))}
          </div>
        </section>

        <section className="school-panel">
          <div>
            <span className="label">最近の記録</span>
            <h3>最近の確認記録</h3>
          </div>
          {recentLogs.length === 0 ? (
            <p className="muted">まだ面談準備用の確認記録はありません。学生画面で省察チェックを行うとここに表示されます。</p>
          ) : (
            <div className="school-log-list">
              {recentLogs.map((log) => (
                <article className="school-log-item" key={log.id}>
                  <div>
                    <strong>{getKindLabel(log.kind)}</strong>
                    <p>{log.studentName} / {log.className || "クラス未設定"} / {formatShortDate(log.createdAt)}</p>
                    <small>{log.inputPreview || "入力プレビューなし"}</small>
                  </div>
                  <span>確認{log.checkCount}件</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="school-panel">
          <div>
            <span className="label">導入機能</span>
            <h3>学校導入で必要な機能</h3>
          </div>
          <div className="school-check-grid">
            {["クラス招待", "学生別利用上限", "教員確認候補", "学校指定フォーマット", "利用規約同意", "データ保存期間設定"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="metric-card">
      <span className="label">{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function TeacherPreviewPanel({ title = "教員に確認していただきたいこと", items = teacherPreviewCheckpoints }) {
  const safeItems = safeRecordList(items);
  return (
    <section className="school-panel teacher-preview-panel">
      <div>
        <span className="label">事前レビュー</span>
        <h3>{title}</h3>
        <p className="teacher-preview-lead">PoCに進むかは、機能数ではなく、学生が使えるか、教員負担が増えないか、学校フォーマットに合うかで確認します。</p>
      </div>
      <div className="teacher-preview-grid">
        {safeItems.map((item) => (
          <article key={item.title}>
            <span>{item.kicker}</span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <div className="school-step-list" aria-label="アンケートフォームで返す観点">
        {teacherPreviewReturnItems.map((item, index) => (
          <span key={item}>{index + 1}. {item}</span>
        ))}
      </div>
    </section>
  );
}

function ReviewItem({ title, tag, detail, meta, handlingLabel }) {
  return (
    <article className="review-item">
      <div>
        <h4>{title}</h4>
        <p>{detail}</p>
        {meta && <em>{meta}</em>}
      </div>
      <span>{handlingLabel || tag}</span>
    </article>
  );
}

function AssignmentManagementView({ schoolSummary, schoolSummaryStatus, session }) {
  const usingDemoData = session?.source === "demo" && schoolSummary?.configured === false;
  const students = usingDemoData ? demoStudentUsage.length : schoolSummary?.metrics?.students ?? 0;
  const activeStudents = usingDemoData ? demoStudentUsage.filter((student) => student.generations > 0).length : schoolSummary?.metrics?.activeStudents ?? 0;
  const averageCompletion = Math.round(assignmentTemplates.reduce((sum, item) => sum + item.completion, 0) / assignmentTemplates.length);

  return (
    <div className="view-panel">
      <div className="context-bar">
        <div>
          <span className="context-label">実習前後の課題</span>
          <p>{session?.schoolName || "学校"} の授業内課題として、実習準備からAI利用を練習させる</p>
        </div>
        <div className="context-stats">
          <span>対象学生 {students}人</span>
          <span>利用中 {activeStudents}人</span>
          <span>平均進捗 {averageCompletion}%</span>
        </div>
      </div>

      <div className="toolbar">
        <div>
          <span className="label">課題運用</span>
          <h2>実習準備課題</h2>
        </div>
        <span className="badge">授業内運用</span>
      </div>

      <div className="assignment-layout">
        <section className="school-panel assignment-main">
          <div>
            <span className="label">授業課題</span>
            <h3>配布中の課題</h3>
          </div>
          <div className="assignment-list">
            {assignmentTemplates.map((assignment) => (
              <article className="assignment-item" key={assignment.title}>
                <div>
                  <span>{assignment.type}</span>
                  <h4>{assignment.title}</h4>
                  <p>{assignment.target} / 締切: {assignment.due}</p>
                  <div className="tag-list">
                    {assignment.signals.map((signal) => <span key={signal}>{signal}</span>)}
                  </div>
                </div>
                <div className="assignment-progress">
                  <strong>{assignment.completion}%</strong>
                  <i><b style={{ width: `${assignment.completion}%` }} /></i>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="school-panel assignment-side">
          <div>
            <span className="label">確認が必要な点</span>
            <h3>よく出る確認点</h3>
          </div>
          <div className="mistake-list">
            {commonMistakes.map((mistake) => (
              <article key={mistake.label}>
                <strong>{mistake.count}件</strong>
                <div>
                  <span>{mistake.label}</span>
                  <p>{mistake.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="school-panel">
        <div>
          <span className="label">課題作成</span>
          <h3>課題作成の型</h3>
        </div>
        <div className="assignment-template-grid">
          {["サンプル場面を選ぶ", "学生が事実・考察・明日の課題を書く", "AIが問い返しと安全確認を返す", "学生が見直し、必要なら実習担当教員へ相談", "教員が面談サマリーを確認"].map((item, index) => (
            <span key={item}>{index + 1}. {item}</span>
          ))}
        </div>
        <p className="muted">{schoolSummaryStatus || "課題の配布・締切・提出状況を学校単位で確認します。"}</p>
      </section>
    </div>
  );
}

function StudentManagementView({ schoolSummary, schoolSummaryStatus, session }) {
  const profiles = safeRecordList(schoolSummary?.profiles);
  const students = profiles.filter((profile) => profile.role === "student");
  const teachers = profiles.filter((profile) => profile.role !== "student");

  return (
    <div className="view-panel">
      <div className="context-bar">
        <div>
          <span className="context-label">学生・クラス一覧</span>
          <p>{session?.schoolName || "学校"} の学生、教員、クラス所属を確認</p>
        </div>
        <div className="context-stats">
          <span>学生 {students.length}人</span>
          <span>教員 {teachers.length}人</span>
        </div>
      </div>

      <div className="toolbar">
        <div>
          <span className="label">利用者一覧</span>
          <h2>利用者と権限</h2>
        </div>
        <span className="badge">招待設定</span>
      </div>

      <div className="school-dashboard">
        <section className="school-panel">
          <div>
            <span className="label">招待方針</span>
            <h3>学校担当者が招待する運用</h3>
          </div>
          <p className="muted">公開登録ではなく、学校側が学生・教員を登録し、プロフィールのroleで画面と権限を切り替えます。</p>
          <div className="school-check-grid">
            <span>公開登録OFF</span>
            <span>権限分離</span>
            <span>学校単位の閲覧制限</span>
            <span>日次上限</span>
          </div>
        </section>

        <section className="school-panel">
          <div>
            <span className="label">学生</span>
            <h3>学生一覧</h3>
          </div>
          {students.length === 0 ? (
            <p className="muted">{schoolSummaryStatus || "学生データを読み込み中です。"}</p>
          ) : (
            <RosterList profiles={students} />
          )}
        </section>

        <section className="school-panel">
          <div>
            <span className="label">教員</span>
            <h3>教員・管理者</h3>
          </div>
          {teachers.length === 0 ? <p className="muted">教員データを読み込み中です。</p> : <RosterList profiles={teachers} />}
        </section>
      </div>
    </div>
  );
}

function RosterList({ profiles }) {
  const safeProfiles = safeRecordList(profiles);
  return (
    <div className="roster-list">
      {safeProfiles.map((profile) => (
        <article className="roster-item" key={profile.id}>
          <div>
            <strong>{profile.name || profile.email}</strong>
            <p>{profile.email}</p>
          </div>
          <span>{profile.roleLabel}</span>
        </article>
      ))}
    </div>
  );
}

function TeacherReviewView({ schoolSummary, schoolSummaryStatus, session }) {
  const usingDemoData = session?.source === "demo" && schoolSummary?.configured === false;
  const reviewQueue = usingDemoData ? demoReviewQueue : safeRecordList(schoolSummary?.reviewQueue);
  const recentLogs = usingDemoData ? demoRecentLogs : safeRecordList(schoolSummary?.recentLogs);
  const filters = ["すべて", ...new Set(reviewQueue.map((item) => item.tag))];
  const priorityFilters = reviewRouteFilters;
  const [activeFilter, setActiveFilter] = useState("すべて");
  const [activePriority, setActivePriority] = useState("高");
  const [selectedLogId, setSelectedLogId] = useState("");
  const [reviewActionMap, setReviewActionMap] = useState({});
  const workloadPlan = buildTeacherWorkloadPlan(reviewQueue);
  const filteredQueue = reviewQueue
    .filter((item) => activeFilter === "すべて" || item.tag === activeFilter)
    .filter((item) => activePriority === "すべて" || getReviewPriorityLabel(item) === activePriority)
    .slice()
    .sort((a, b) => getReviewPriorityRank(a) - getReviewPriorityRank(b));
  const selectedQueueItem = filteredQueue.find((item) => (item.generationId || item.id) === selectedLogId) || filteredQueue[0];
  const selectedQueueKey = selectedQueueItem?.generationId || selectedQueueItem?.id || "";
  const selectedLog = selectedQueueKey ? recentLogs.find((log) => log.id === selectedQueueKey) || selectedQueueItem?.log || null : null;
  const selectedReviewAction = selectedQueueKey ? reviewActionMap[selectedQueueKey] : null;
  const visibleQueueLabel = activePriority === "すべて"
    ? "すべての確認候補"
    : `${getReviewRouteLabel(activePriority)}の候補`;

  function applyReviewAction(action) {
    if (!selectedQueueKey) return;
    setReviewActionMap((current) => ({
      ...current,
      [selectedQueueKey]: {
        ...action,
        at: new Date().toISOString(),
      },
    }));
  }

  return (
    <div className="view-panel">
      <div className="context-bar">
        <div>
          <span className="context-label">確認レビュー</span>
          <p>学生の振り返りを、当日確認・授業共有・学生本人に分けて確認</p>
        </div>
        <div className="context-stats">
          <span>確認待ち {reviewQueue.length}件</span>
          <span>処理済み {Object.keys(reviewActionMap).length}件</span>
          <span>最近 {recentLogs.length}件</span>
        </div>
      </div>

      <div className="toolbar">
        <div>
          <span className="label">確認レビュー</span>
          <h2>必要な候補だけを確認し、面談につなげる</h2>
        </div>
        <span className="badge">{schoolSummary?.configured ? "確認記録" : "参考表示"}</span>
      </div>

      <div className="school-dashboard">
        <section className="school-panel review-control-panel">
          <div>
            <span className="label">絞り込み</span>
            <h3>確認観点で絞り込み</h3>
          </div>
          <div className="review-load-summary" aria-label="レビュー負担の目安">
            <span>当日確認 {workloadPlan.reviewNowCount}件</span>
            <span>授業共有 {workloadPlan.classShareCount}件</span>
            <span>学生本人 {workloadPlan.lowCount}件</span>
            <span>全件添削しない運用</span>
          </div>
          <div className="review-filter-stack">
            <div>
              <span className="review-filter-label">対応先</span>
              <div className="review-filters" role="group" aria-label="レビュー対応先">
                {priorityFilters.map((filter) => (
                  <button
                    key={filter.value}
                    className={activePriority === filter.value ? "active" : ""}
                    type="button"
                    aria-pressed={activePriority === filter.value}
                    onClick={() => setActivePriority(filter.value)}
                  >
                    <strong>{filter.label}</strong>
                    <small>{filter.detail}</small>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="review-filter-label">確認観点</span>
              <div className="review-filters" role="group" aria-label="レビュー観点">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    className={activeFilter === filter ? "active" : ""}
                    type="button"
                    aria-pressed={activeFilter === filter}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="review-focus-note">
            初期表示は「当日確認」です。当日確認は個別に見る候補、授業共有はクラスで扱う候補、学生本人は提出前の自己確認へ返す候補です。
          </p>
          <p className="muted">{schoolSummaryStatus || "通常は面談サマリー中心で扱い、必要な候補だけ根拠を確認します。学生が省察チェックを行うと、確認候補と面談準備用の記録がここに集まります。"}</p>
        </section>

        <div className="review-workspace">
          <section className="school-panel">
            <div>
              <span className="label">確認一覧</span>
              <h3>{visibleQueueLabel}</h3>
            </div>
            {filteredQueue.length === 0 ? (
              <p className="muted">この観点の確認候補はありません。必要な場合だけ、対応先を授業共有・学生本人・すべてに切り替えて確認します。</p>
            ) : (
              <div className="review-list">
                {filteredQueue.map((item) => (
                  <button
                    className="review-select-item"
                    key={item.id}
                    type="button"
                    aria-pressed={selectedQueueKey === (item.generationId || item.id)}
                    onClick={() => setSelectedLogId(item.generationId || item.id)}
                  >
                    <span className={`priority-chip ${getReviewPriorityClass(item)}`}>{getReviewRouteLabel(getReviewPriorityLabel(item))} / {item.tag}</span>
                    <span className={`handling-chip ${getReviewHandlingClass(item)}`}>{getReviewHandlingLabel(item)}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <small>{item.handlingDetail || getReviewHandlingDetail(item)}</small>
                    <em>{item.studentName} / {formatShortDate(item.createdAt)}</em>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="school-panel review-detail">
            <div>
              <span className="label">必要時の根拠確認</span>
              <h3>{selectedLog ? `${selectedLog.studentName}の${getKindLabel(selectedLog.kind)}` : "記録詳細"}</h3>
            </div>
            {!selectedLog ? (
              <p className="muted">確認する記録を選択してください。</p>
            ) : (
              <div className="review-log-preview">
                <div className="log-meta-row">
                  <span>{formatShortDate(selectedLog.createdAt)}</span>
                  <span>{selectedLog.className || "クラス未設定"}</span>
                </div>
                <div>
                  <strong>学生入力の要点</strong>
                  <p>{selectedLog.inputPreview || "入力プレビューなし"}</p>
                </div>
                <div>
                  <strong>問い返しの根拠</strong>
                  {(selectedLog.sections || []).slice(0, 2).map((section) => (
                    <article key={section.heading}>
                      <span>{section.heading}</span>
                      <p>{section.body}</p>
                    </article>
                  ))}
                  <p className="evidence-note">本文全体を読む前提ではなく、確認が必要な候補だけ要点と根拠を見ます。</p>
                </div>
                <div>
                  <strong>提出前の自己確認</strong>
                  <ul>
                    {(selectedLog.checks || []).slice(0, 5).map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                </div>
                <div className="tag-list">
                  {(selectedLog.reviewTags || []).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                {selectedQueueItem && (
                  <div className="review-action-panel">
                    <strong>教員の軽い対応</strong>
                    <p>実習期間中は長文添削ではなく、必要なものだけ状態を付けて、学生への再確認や授業共有に回します。</p>
                    <div className="review-action-buttons" role="group" aria-label="レビュー対応">
                      {reviewActions.map((action) => (
                        <button
                          key={action.id}
                          className={selectedReviewAction?.id === action.id ? "active" : ""}
                          type="button"
                          aria-pressed={selectedReviewAction?.id === action.id}
                          onClick={() => applyReviewAction(action)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                    {selectedReviewAction && (
                      <div className="review-action-result">
                        <span>{selectedReviewAction.label}</span>
                        <p>{selectedReviewAction.template}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <section className="school-panel">
          <div>
            <span className="label">運用フロー</span>
            <h3>確認候補の扱い</h3>
          </div>
          <div className="school-step-list">
            {["個人情報・要配慮情報は当日確認", "共通テーマは授業共有へ", "入力不足は学生本人の提出前の自己確認へ", "実習後面談ではサマリー中心に確認"].map((item, index) => (
              <span key={item}>{index + 1}. {item}</span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function FormatSettingsView({ session }) {
  const [template, setTemplate] = useState(defaultSchoolFormat);
  const [formatStatus, setFormatStatus] = useState("学校フォーマットを読み込んでいます。");
  const [saving, setSaving] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplate() {
      setFormatStatus("学校フォーマットを読み込んでいます。");
      try {
        const response = await fetch("/api/school/templates", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "学校フォーマットを取得できませんでした。");
        }
        if (!cancelled) {
          setTemplate(normalizeClientTemplate(body.template));
          setSchemaReady(body.schemaReady !== false);
          setFormatStatus(body.schemaReady === false ? body.error || body.message || "標準フォーマットを表示しています。" : "学校フォーマットを問い返しに反映できます。");
        }
      } catch (error) {
        if (!cancelled) {
          setTemplate(defaultSchoolFormat);
          setSchemaReady(false);
          setFormatStatus(error.message);
        }
      }
    }

    loadTemplate();
    return () => {
      cancelled = true;
    };
  }, [session?.schoolId]);

  function updateHeading(kind, index, value) {
    setTemplate((current) => {
      const next = [...current[kind]];
      next[index] = value;
      return { ...current, [kind]: next };
    });
  }

  function updateRules(value) {
    const rules = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    setTemplate((current) => ({ ...current, checkRules: rules }));
  }

  function resetDefaults() {
    setTemplate(defaultSchoolFormat);
    setFormatStatus("標準フォーマットに戻しました。保存すると学校設定に反映されます。");
  }

  async function saveTemplate(event) {
    event.preventDefault();
    setSaving(true);
    setFormatStatus("学校フォーマットを保存しています。");
    try {
      const response = await fetch("/api/school/templates", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "学校フォーマットを保存できませんでした。");
      }
      setTemplate(normalizeClientTemplate(body.template));
      setSchemaReady(true);
      setFormatStatus("保存しました。次回の問い返しからこの見出し・確認観点を反映します。");
    } catch (error) {
      setSchemaReady(false);
      setFormatStatus(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="view-panel">
      <div className="context-bar">
        <div>
          <span className="context-label">学校フォーマット設定</span>
          <p>{session?.schoolName || "学校"} の実習日誌の提出様式に合わせ、学生への問い返しへ反映します。</p>
        </div>
        <div className="context-stats">
          <span>日誌</span>
          <span>チェック項目</span>
        </div>
      </div>

      <div className="toolbar">
        <div>
          <span className="label">フォーマット</span>
          <h2>提出様式の設定</h2>
        </div>
        <span className="badge">{schemaReady ? "保存対応" : "標準設定"}</span>
      </div>

      <form className="school-dashboard" onSubmit={saveTemplate}>
        <section className="school-panel format-status-panel">
          <div>
            <span className="label">設定状況</span>
            <h3>問い返しへの反映状態</h3>
          </div>
          <p className="muted">{formatStatus}</p>
        </section>

        <TeacherPreviewPanel title="学校フォーマット確認の観点" items={formatReviewQuestions} />

        <section className="school-panel">
          <div>
            <span className="label">日誌フォーマット</span>
            <h3>実習日誌テンプレート</h3>
          </div>
          <div className="template-field-list">
            {template.diaryHeadings.map((item, index) => (
              <label key={`diary-${index}`}>
                {index + 1}番目の見出し
                <input value={item} maxLength={18} onChange={(event) => updateHeading("diaryHeadings", index, event.target.value)} />
              </label>
            ))}
          </div>
        </section>

        <section className="school-panel">
          <div>
            <span className="label">学校ルール</span>
            <h3>学校ごとの確認ルール</h3>
          </div>
          <label>
            提出前の自己確認に反映する観点
            <textarea className="compact-textarea" value={template.checkRules.join("\n")} rows={5} onChange={(event) => updateRules(event.target.value)} />
          </label>
          <label>
            文体・提出ルール
            <textarea className="compact-textarea" value={template.writingStyle} maxLength={600} rows={5} onChange={(event) => setTemplate((current) => ({ ...current, writingStyle: event.target.value }))} />
          </label>
          <div className="school-check-grid">
            {template.checkRules.slice(0, 8).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        <div className="format-actions">
          <button className="primary-button" type="submit" disabled={saving}>{saving ? "保存中..." : "学校フォーマットを保存"}</button>
          <button className="secondary-button" type="button" onClick={resetDefaults} disabled={saving}>標準に戻す</button>
        </div>
      </form>
    </div>
  );
}

function normalizeClientTemplate(template = {}) {
  const rules = Array.isArray(template.checkRules)
    ? template.checkRules.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8)
    : [];
  return {
    diaryHeadings: normalizeClientList(template.diaryHeadings, defaultSchoolFormat.diaryHeadings, 5),
    planHeadings: normalizeClientList(template.planHeadings, defaultSchoolFormat.planHeadings, 5),
    checkRules: rules.length >= 3 ? rules : defaultSchoolFormat.checkRules,
    writingStyle: typeof template.writingStyle === "string" && template.writingStyle.trim() ? template.writingStyle : defaultSchoolFormat.writingStyle,
  };
}

function normalizeClientList(value, fallback, count) {
  const list = Array.isArray(value) ? value : [];
  return Array.from({ length: count }, (_, index) => {
    const item = typeof list[index] === "string" ? list[index].trim() : "";
    return item || fallback[index] || "";
  });
}

function getKindLabel(kind) {
  if (kind === "plan") return "指導案";
  return "日誌";
}

function buildTeacherWorkloadPlan(reviewQueue = [], studentCount = 0) {
  const counts = safeRecordList(reviewQueue).reduce((acc, item) => {
    acc[getReviewPriorityLabel(item)] += 1;
    return acc;
  }, { 高: 0, 中: 0, 低: 0 });
  return {
    highCount: counts.高,
    mediumCount: counts.中,
    lowCount: counts.低,
    reviewNowCount: counts.高,
    classShareCount: counts.中,
    studentSelfCheckCount: counts.低,
    studentCount,
  };
}

function getReviewRouteLabel(priority) {
  return reviewRouteFilters.find((filter) => filter.value === priority)?.label || "学生本人";
}

function getReviewPriorityLabel(item = {}) {
  if (["高", "中", "低"].includes(item.priority)) return item.priority;
  const text = `${item.tag || ""} ${item.title || ""} ${item.detail || ""}`;
  if (/個人情報|匿名化|置換確認|実名|園名|診断|家庭|補完疑い|入力外情報/.test(text)) return "高";
  if (/表現|評価|安全|指針|5領域|五領域|考察|感想/.test(text)) return "中";
  return "低";
}

function getReviewPriorityRank(item) {
  return { 高: 0, 中: 1, 低: 2 }[getReviewPriorityLabel(item)] ?? 3;
}

function getReviewPriorityClass(item) {
  const label = getReviewPriorityLabel(item);
  if (label === "高") return "priority-high";
  if (label === "中") return "priority-medium";
  return "priority-low";
}

function getReviewHandlingLabel(item = {}) {
  if (item.handlingLabel) return item.handlingLabel;
  const priority = getReviewPriorityLabel(item);
  if (priority === "高") return "当日確認";
  if (priority === "中") return "授業共有";
  return "学生本人";
}

function getReviewHandlingClass(item = {}) {
  const handling = item.handling || "";
  if (handling === "teacher_now" || getReviewPriorityLabel(item) === "高") return "handling-teacher";
  if (handling === "class_share" || getReviewPriorityLabel(item) === "中") return "handling-class";
  return "handling-student";
}

function getReviewHandlingDetail(item = {}) {
  const priority = getReviewPriorityLabel(item);
  if (priority === "高") return "個人情報や重大な表現リスクとして、当日中に教員が見る候補です。";
  if (priority === "中") return "個別添削ではなく、授業共有で扱い、学生本人への問いにも返せる候補です。";
  return "教員の個別確認ではなく、学生本人への提出前の自己確認で返す候補です。";
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

function SchoolPlanView({ hasPracticePass, onActivate }) {
  return (
    <div className="view-panel">
      <div className="context-bar">
        <div>
          <span className="context-label">学校導入プラン</span>
          <p>実習準備授業から実習後の振り返りまで、学科・学校単位で提供</p>
        </div>
        <div className="context-stats" aria-label="料金の特徴">
          <span>半期利用</span>
          <span>学科契約</span>
          <span>学校契約</span>
        </div>
      </div>

      <div className="toolbar">
        <div>
          <span className="label">導入プラン</span>
          <h2>導入プラン</h2>
        </div>
        <span className="badge">{hasPracticePass ? "学校導入モード有効" : "未設定"}</span>
      </div>

      <div className="pricing-grid">
        <PriceCard label="検証導入" title="実習科目パイロット" price="個別相談" items={["半期の実習準備授業", "学生画面", "課題運用", "導入後ヒアリング"]} />
        <PriceCard featured label="推奨" title="学科導入" price="お見積り" items={["複数クラス", "教員向け面談画面", "課題・確認候補", "学校指定フォーマット"]}>
          <button className="primary-button" type="button" onClick={onActivate}>学科導入モードを確認</button>
        </PriceCard>
        <PriceCard label="学校導入" title="学校・法人向け" price="個別見積" items={["複数学科", "SSO連携", "研修資料", "AI利用規程・同意文面支援"]} />
      </div>
    </div>
  );
}

function PriceCard({ label, title, price, items, featured = false, children }) {
  return (
    <article className={`price-card ${featured ? "featured" : ""}`}>
      <span className="label">{label}</span>
      <h3>{title}</h3>
      <strong>{price}</strong>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
      {children}
    </article>
  );
}
