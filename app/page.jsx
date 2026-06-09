import { CONTACT_EMAIL } from "./site-config";
import hoikushiSummary from "../data/hoikushi-benchmark-summary.json";

export const metadata = {
  alternates: {
    canonical: "/",
  },
};

const issueCards = [
  {
    label: "学生のつまずき",
    title: "何を書けばいいかわからない",
    body: "観察はしているのに、事実・気づき・考察を分けて日誌にするところで手が止まりやすい。",
    tone: "teal",
    icon: "/images/manalio-issue-student-stuck.png",
  },
  {
    label: "教員の負担",
    title: "実習中の変化が見えにくい",
    body: "実習先で受けた指導を学生がどう理解し、翌日の観察や記録にどう活かそうとしたかは、返却物だけでは追いにくい。",
    tone: "navy",
    icon: "/images/manalio-issue-teacher-load.png",
  },
  {
    label: "一般AI利用の不安",
    title: "代筆・事実補完・個人情報リスク",
    body: "入力内容にない情報が追加される不安や、子どもに関する情報の取り扱いに懸念があります。",
    tone: "rose",
    icon: "/images/manalio-issue-ai-risk.png",
  },
  {
    label: "学校としての課題",
    title: "安全に使える仕組みが必要",
    body: "学校の指導方針やフォーマットに合わせて、AIを安全に活用する仕組みが求められます。",
    tone: "gold",
    icon: "/images/manalio-issue-school-system.png",
  },
];

const promiseCards = [
  {
    title: "観察メモをもとに、学びを整理",
    body: "学生が自分で書いた事実・考えたこと・明日見たいことに対して、問い返しと提出前の自己確認を返します。",
    icon: "memo",
  },
  {
    title: "実習先の指導を、翌日の観察へ",
    body: "学生が受け止めた指導を、明日見る子どもの姿・保育者の関わり・自分の行動目標に整理します。",
    icon: "plan",
  },
  {
    title: "学校ごとのフォーマットに対応",
    body: "実習日誌の見出し、文体、確認観点を学校の指導方針に合わせ、授業内で扱いやすい運用を目指せます。",
    icon: "grid",
  },
  {
    title: "教員が、学びの過程を確認",
    body: "全件添削を増やすのではなく、学生が翌日に何を見ようとしたか、どこで支援が必要だったかを教員が確認する材料として整理します。",
    icon: "memo",
  },
];

const feedbackLoopSteps = [
  {
    label: "01",
    title: "指導を自分の言葉で受け止める",
    body: "返却日誌やコメントをそのまま取り込むのではなく、学生が「言われたこと」「自分の理解」「まだ分からないこと」に分けて入力します。",
  },
  {
    label: "02",
    title: "翌日に見る観点へ変える",
    body: "AIは完成文ではなく、明日見る子どもの姿、保育者の関わり、自分の関わり方を確認する問いとして返します。",
  },
  {
    label: "03",
    title: "同じ指導を流さない",
    body: "実習先で受けた指導を、次の日誌で確認する項目と実習中の行動目標に整理します。",
  },
  {
    label: "04",
    title: "教員の確認・声かけにつなげる",
    body: "教員は全件を読むのではなく、学生が何を受け止め、どう改善しようとしたかを確認し、必要な声かけや授業共有につなげられます。",
  },
];

const governanceItems = [
  "学生の観察記録を起点にし、AIは問い返しと安全確認に徹する",
  "入力にない事実は補完せず、未記入の観点は確認項目として残す",
  "保育所保育指針は、断定ではなく観察・省察を見直す観点として参照",
  "子どもの実名・評価的表現・断定的な内面推測を避ける設計",
  "教員が確認観点、学校フォーマット、必要範囲の振り返りを確認",
  "実習先で受けた指導の受け止めと、翌日の観察への変化を面談で扱いやすくする",
];

const positioningCards = [
  {
    label: "保育施設向けAI",
    title: "hinary・ホイット・保育AIノート等",
    body: "現場職員の連絡帳、指導計画、要録、園内文書などの業務支援が中心です。",
  },
  {
    label: "園向けICT",
    title: "パステルApps・はいチーズ！等",
    body: "園の帳票作成、保育日誌、保護者連絡、運営管理などを効率化します。",
  },
  {
    label: "実習ICT・教材",
    title: "実習管理システム・日誌教材",
    body: "実習運用の電子化や書き方指導に近い領域で、AIによる省察支援とは目的が異なります。",
  },
  {
    label: "Manalio",
    title: "学生の省察と翌日の観察を支援",
    body: "学生の観察メモ、実習先指導の受け止め、自己確認、教員が学生との面談や指導で確認するポイントを一つの学習プロセスとして扱います。",
  },
];

const operationItems = [
  "学生が個人情報を入力しにくい画面設計",
  "外部AI送信前の検出・置換・送信停止",
  "学生・教員・学校単位の権限管理",
  "利用量とAI費用の管理",
  "すり抜け時の削除・報告・再発防止手順",
  "学校フォーマットと実習指導方針への調整",
];

const caseSteps = [
  {
    label: "導入 01",
    title: "実習準備授業でAI利用の境界を共有",
    body: "学生が使い始める前に、代筆ではなく観察と思考を整理するための使い方を確認します。",
  },
  {
    label: "導入 02",
    title: "1科目・1クラスから検証導入",
    body: "実習日誌フォーマット、確認観点、教員が確認するポイントの見え方を、学校の実運用に合わせて確認します。",
  },
  {
    label: "導入 03",
    title: "学生の翌日の変化を、面談と次年度指導へ活用",
    body: "実習先で受けた指導を翌日の観察につなげられたかを確認し、授業内で扱うべき観点を次の実習指導へつなげます。",
  },
];

const teacherTriageItems = [
  {
    label: "当日確認",
    title: "早めに止めたい候補だけ見る",
    body: "個人情報、強い断定、実習先との関係に影響しそうな表現を先に確認します。",
    tone: "urgent",
  },
  {
    label: "授業共有",
    title: "共通するつまずきを扱う",
    body: "複数学生に共通しそうな観察・表現・受け止め方を、匿名化して授業へ戻します。",
    tone: "class",
  },
  {
    label: "学生本人",
    title: "自己確認へ戻す",
    body: "入力不足や別の言い方で整う候補は、教員が抱え込まず学生本人の見直しへ返します。",
    tone: "self",
  },
];

const safetyFlowItems = [
  {
    label: "01",
    title: "入力時の気づき",
    body: "実名、園名、家庭事情などを責める表示ではなく、記録前の確認として知らせます。",
  },
  {
    label: "02",
    title: "外部AI送信前",
    body: "送ってよい本文かを確認し、高リスク情報は送信前に止める前提で設計します。",
  },
  {
    label: "03",
    title: "教員が扱う範囲",
    body: "全ログではなく、支援に必要な論点、分類、確認候補に絞って扱います。",
  },
  {
    label: "04",
    title: "学校ごとの運用範囲",
    body: "保存範囲、閲覧範囲、保存期間、外部AI利用範囲を学校の方針に合わせて扱います。",
  },
];

const faqItems = [
  {
    question: "学生がそのまま提出してしまう心配はありませんか。",
    answer: "学生が自分で書いた内容に対して、未入力項目や教員へ確認したい点を問いとして返す設計です。学校の方針に合わせて、提出前の自己確認や教員確認候補も組み合わせられます。",
  },
  {
    question: "学校指定の実習日誌フォーマットに合わせられますか。",
    answer: "見出し、確認観点、文体、禁止したい表現を学校ごとに設定できる前提で設計しています。最初の検証では実習日誌に範囲を絞り、実際のフォーマットを共有いただいた後に導入範囲を調整します。",
  },
  {
    question: "個人情報や子どもの実名はどう扱いますか。",
    answer: "子どもの実名・愛称、園名、保育者名などは入力しない運用を前提にし、A児・B教員・実習先園などの置換やマスキングを行います。正式導入時は、保存期間や閲覧権限も学校と合意して運用します。",
  },
  {
    question: "教員の確認作業が増えすぎる心配はありませんか。",
    answer: "全件を細かく添削する前提ではなく、個人情報・評価的表現・入力不足などを必要な範囲で整理します。高優先だけを当日確認、中優先は授業内共有、低優先は学生本人への自己確認として返す運用を想定しています。",
  },
  {
    question: "一般AIや学校の自前運用と何が違いますか。",
    answer: "生成AIそのものは学校でも使えます。ただ、学生が個人情報を入れない仕組み、送信前の確認・置換、代筆化を防ぐ問い返し設計、学生・教員の権限分離、利用量と費用の管理、すり抜け時の事故対応まで含めると、単なるチャット利用とは運用負担が異なります。Manalioはこの部分を保育実習に絞って用意します。",
  },
];

export default function Home() {
  const measuredYears = hoikushiSummary.years.filter((year) => year.overall?.score != null && year.overall?.maxScore != null);
  const totalScore = measuredYears.reduce((sum, year) => sum + year.overall.score, 0);
  const totalMaxScore = measuredYears.reduce((sum, year) => sum + year.overall.maxScore, 0);
  const allYearsPassed = measuredYears.length === hoikushiSummary.years.length && measuredYears.every((year) => year.overall.pass);
  const latestYear = hoikushiSummary.years[0];
  const contactBody = [
    "学校名:",
    "学科・コース:",
    "学生数・クラス数:",
    "実習準備授業の時期:",
    "保育実習の時期:",
    "実習日誌フォーマットの有無:",
    "相談したいこと:",
  ].join("\n");
  const contactHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Manalioの導入相談")}&body=${encodeURIComponent(contactBody)}`;

  return (
    <main id="main-content" className="manalio-root">
      <header className="manalio-header">
        <a className="manalio-brand" href="/" aria-label="Manalio トップ">
          <img className="manalio-logo-horizontal" src="/images/manalio-logo-horizontal.svg" alt="Manalio" width="320" height="72" />
          <span className="manalio-brand-text">
            <small>保育実習の省察支援</small>
          </span>
        </a>
        <nav className="manalio-nav" aria-label="公開サイト">
          <a href="#about">Manalioとは</a>
          <a href="#loop">支援フロー</a>
          <a href="/product">機能</a>
          <a href="#value">導入メリット</a>
          <a href="#positioning">違い</a>
          <a href="#evidence">信頼性検証</a>
          <a href="/pilot">導入の流れ</a>
          <a href="/governance">安全性への取り組み</a>
          <a href="#case">導入イメージ</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="manalio-header-actions">
          <a className="manalio-button ghost" href="/app">サービス画面を見る</a>
          <a className="manalio-button primary" href="#contact">導入相談をする</a>
        </div>
      </header>

      <section className="manalio-hero" aria-label="Manalioの紹介">
        <div className="manalio-hero-copy">
          <p className="manalio-kicker">保育者養成校向けAI実習支援サービス</p>
          <h1>実習日誌を、<br />提出作業から<br />学びの記録へ。</h1>
          <p className="manalio-lead">
            <span>Manalioは、保育者養成校の実習指導を</span>
            <span>支えるAI活用サービスです。</span>
            <span>学生が自分で書いた観察メモと、</span>
            <span>実習先で受けた指導の振り返りに、</span>
            <span>問い返し・自己確認・翌日の観察視点を返します。</span>
          </p>
          <p className="manalio-tagline">観察を、記録に。記録を、学びに。</p>
          <div className="manalio-cta-row">
            <a className="manalio-button primary large" href="#contact">導入相談をする</a>
            <a className="manalio-button ghost large" href={contactHref}>資料請求する</a>
          </div>
          <div className="manalio-trust-badge" aria-label="サービスの方針">
            <strong>教育現場に配慮した安心設計</strong>
          </div>
        </div>

        <div className="manalio-hero-visual" aria-label="省察支援と教員確認のイメージ">
          <div className="manalio-workflow">
            <div className="manalio-steps" aria-hidden="true">
              <span><b>1</b>学生が観察を書く</span>
              <span><b>2</b>指導を受け止める</span>
              <span><b>3</b>翌日の観察へ</span>
            </div>
            <div className="manalio-work-columns">
              <article className="manalio-work-card">
                <h2>学生が書いた記録</h2>
                <ul>
                  <li>友だちと積み木で長く遊んでいた。</li>
                  <li>A児が積み木を探している場面があり、声をかけた。</li>
                  <li>片付けの時間、遊びを続ける姿が見られた。</li>
                </ul>
                <img className="manalio-line-illust student" src="/images/manalio-illust-student-writing.png" alt="" aria-hidden="true" width="520" height="346" decoding="async" />
              </article>
              <article className="manalio-work-card draft">
                <h2>AIからの問い返し</h2>
                <section>
                  <strong>事実の確認</strong>
                  <p>声をかけた場面で、A児はどのような様子でしたか。</p>
                </section>
                <section>
                  <strong>考察の確認</strong>
                  <p>自分の考えは、どの観察事実を根拠にできますか。</p>
                </section>
                <section>
                  <strong>表現の確認</strong>
                  <p>子どもの気持ちを断定せず、見られた姿として書けていますか。</p>
                </section>
                <section>
                  <strong>明日の観察</strong>
                  <p>片付け前後の保育者の関わりを記録できると、考察につながります。</p>
                </section>
              </article>
              <article className="manalio-work-card checks">
                <h2>教員が確認する観点</h2>
                <ul>
                  <li>個人情報が含まれていないか</li>
                  <li>入力内容から確認できない事実が含まれていないか</li>
                  <li>子どもを評価する表現になっていないか</li>
                  <li>面談で確認したい問いがあるか</li>
                </ul>
                <img className="manalio-line-illust teacher" src="/images/manalio-illust-teacher-checking.png" alt="" aria-hidden="true" width="520" height="346" decoding="async" />
              </article>
            </div>
          </div>
          <figure className="manalio-photo-card">
            <img src="/images/manalio-hero-photo.jpg" alt="保育者養成校で実習指導について学ぶ学生と教員のイメージ" width="1400" height="700" decoding="async" fetchPriority="high" />
          </figure>
        </div>
      </section>

      <section className="manalio-section manalio-why" id="about">
        <div className="manalio-section-head center">
          <h2>なぜ今、必要とされているのか</h2>
          <p>実習指導の現場では、学生・教員・学校それぞれに課題があります。</p>
        </div>
        <div className="manalio-issue-grid">
          {issueCards.map((card) => (
            <article className={`manalio-issue-card ${card.tone}`} key={card.label}>
              <img className="manalio-card-illust" src={card.icon} alt="" aria-hidden="true" width="520" height="346" loading="lazy" decoding="async" />
              <span>{card.label}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="manalio-section manalio-feedback" id="loop">
        <div className="manalio-section-head center">
          <p className="manalio-kicker">実習フィードバックループ</p>
          <h2>実習先で受けた指導を、翌日の観察に変える。</h2>
          <p>
            Manalioの中核は、提出用の本文を仕上げることではありません。
            学生が受け止めた指導を、自分の言葉で整理し、翌日の行動と教員の確認・声かけにつなげることです。
          </p>
        </div>
        <div className="manalio-loop-grid">
          {feedbackLoopSteps.map((step) => (
            <article className="manalio-loop-card" key={step.title}>
              <span>{step.label}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="manalio-section manalio-value" id="value">
        <div className="manalio-value-copy">
          <p className="manalio-kicker">Manalioが実現すること</p>
          <h2>学生の学びを深め、教員の確認負担を軽くする。</h2>
          <div className="manalio-promise-list">
            {promiseCards.map((card) => (
              <article key={card.title}>
                <span className={`manalio-feature-icon ${card.icon}`} aria-hidden="true" />
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="manalio-dashboard" aria-label="教員確認画面のイメージ">
          <figure className="manalio-dashboard-image">
            <img src="/images/manalio-dashboard-mock.jpg" alt="学生一覧や提出状況を確認できる教員確認画面のイメージ" width="1000" height="643" loading="lazy" decoding="async" />
          </figure>
          <div className="manalio-dashboard-note">
            <h3>教員画面でできること</h3>
            <ul>
              <li>学生の振り返り状況を必要範囲で確認</li>
              <li>当日見る候補を高優先だけに絞り込み</li>
              <li>教員が確認する観点を設定・共有</li>
              <li>教員が確認・声かけに使う振り返り材料を整理</li>
            </ul>
            <div className="manalio-teacher-triage" aria-label="教員確認の扱い分け">
              {teacherTriageItems.map((item) => (
                <article className={item.tone} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="manalio-section manalio-positioning" id="positioning">
        <div className="manalio-section-head center">
          <p className="manalio-kicker">既存サービスとの違い</p>
          <h2>周辺サービスはあります。Manalioは、実習中の省察支援に絞ります。</h2>
          <p>
            既存サービスを否定するのではなく、目的の違いを明確にします。
            Manalioは、学生が実習中にどう観察し、どう受け止め、翌日にどう活かしたかを扱います。
          </p>
        </div>
        <div className="manalio-positioning-grid">
          {positioningCards.map((card) => (
            <article key={card.label}>
              <span>{card.label}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="manalio-section manalio-governance">
        <div className="manalio-section-head">
          <p className="manalio-kicker">安全性への取り組み</p>
          <h2>生成AIのリスクを下げ、教育現場で使うための設計。</h2>
          <p>
            Manalioは、AIの便利さだけではなく、教育的妥当性・個人情報保護・代筆防止を前提に設計しています。
          </p>
        </div>
        <div className="manalio-governance-grid">
          {governanceItems.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        <div className="manalio-safety-flow" aria-label="安全設計の流れ">
          {safetyFlowItems.map((item) => (
            <article key={item.title}>
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="manalio-section manalio-ops">
        <div className="manalio-ops-panel">
          <div>
            <p className="manalio-kicker">学校が自前でAIを使う場合との差分</p>
            <h2>AIの利用料だけでなく、安全に使うための運用まで必要です。</h2>
            <p>
              学校が生成AIを直接使うこと自体は可能です。ただ、保育実習で扱う情報を考えると、
              単なるチャット利用ではなく、送信前確認、権限管理、費用管理、事故時対応まで含めた設計が必要になります。
            </p>
          </div>
          <ul>
            {operationItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="manalio-section manalio-evidence" id="evidence">
        <div className="manalio-section-head center">
          <p className="manalio-kicker">信頼性検証</p>
          <h2>保育領域の基礎知識も、過去問ベンチマークで確認しています。</h2>
          <p>
            実習支援の品質を直接保証するものではありませんが、保育士試験（筆記）前期の過去問を使い、
            保育領域の基礎知識を年度・科目別に検証しています。
          </p>
        </div>
        <div className="manalio-evidence-grid">
          <article>
            <span>対象範囲</span>
            <strong>{hoikushiSummary.range.from}〜{hoikushiSummary.range.to}</strong>
            <p>{measuredYears.length}年分・前期筆記・{hoikushiSummary.subjects.length}科目</p>
          </article>
          <article>
            <span>総合得点</span>
            <strong>{totalScore}/{totalMaxScore}</strong>
            <p>5年分合計の過去問ベンチマーク</p>
          </article>
          <article>
            <span>確認結果</span>
            <strong>{allYearsPassed ? "全年度を掲載" : "検証中"}</strong>
            <p>基準相当の得点を、年度・科目別に掲載</p>
          </article>
        </div>
        <div className="manalio-evidence-panel">
          <div>
            <span>最新年度</span>
            <strong>{latestYear.year} {latestYear.overall.score}/{latestYear.overall.maxScore}</strong>
            <p>年度別・科目別の得点は、信頼性検証ページで確認できます。</p>
          </div>
          <a className="manalio-button ghost" href="/evidence">検証結果を見る</a>
        </div>
        <p className="manalio-evidence-disclaimer">{hoikushiSummary.disclaimer}</p>
      </section>

      <section className="manalio-section manalio-case" id="case">
        <div className="manalio-section-head center">
          <p className="manalio-kicker">導入イメージ</p>
          <h2>まずは、実習準備授業から小さく始める。</h2>
          <p>
            Manalioは、全学生へ一斉公開する前に、実習科目単位で安全性と教育効果を確認する導入を想定しています。
          </p>
        </div>
        <div className="manalio-case-grid">
          {caseSteps.map((step) => (
            <article key={step.title}>
              <span>{step.label}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="manalio-section manalio-faq" id="faq">
        <div className="manalio-section-head">
          <p className="manalio-kicker">FAQ</p>
          <h2>よくある確認事項</h2>
        </div>
        <div className="manalio-faq-list">
          {faqItems.map((item) => (
            <details key={item.question} open>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="manalio-contact" id="contact" aria-label="お問い合わせ">
        <div>
          <p className="manalio-kicker">導入相談</p>
          <h2>まずは、学校の実習指導の流れを聞かせてください。</h2>
          <p>
            実習準備授業、学生数、実習日誌フォーマット、AI利用ルールを確認し、
            導入範囲を一緒に設計します。
          </p>
        </div>
        <a className="manalio-button primary large" href={contactHref}>導入相談をする</a>
      </section>

      <footer className="manalio-footer" aria-label="サイト情報">
        <a className="manalio-brand" href="/" aria-label="Manalio トップ">
          <img className="manalio-logo-horizontal" src="/images/manalio-logo-horizontal.svg" alt="Manalio" width="320" height="72" decoding="async" />
          <span className="manalio-brand-text">
            <small>保育実習の省察支援</small>
          </span>
        </a>
        <nav aria-label="法務情報">
          <a href="/terms">利用規約</a>
          <a href="/privacy">個人情報の取扱い</a>
          <a href="/evidence">信頼性検証</a>
          <a href="/commercial-transactions">特定商取引法に基づく表示</a>
          <a href="/login">ログイン</a>
        </nav>
        <p>Copyright © Manalio</p>
      </footer>
    </main>
  );
}
