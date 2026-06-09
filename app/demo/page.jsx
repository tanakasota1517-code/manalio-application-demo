import { PublicFooter, PublicHeader } from "../site-components";

export const metadata = {
  title: "BootCamp公開デモ | Manalio",
  description: "Manalioの課題意識、公開プロトタイプの動く範囲、安全境界を、架空例だけで確認できるBootCamp向け閲覧ページです。",
  alternates: {
    canonical: "/demo",
  },
  robots: {
    index: false,
    follow: false,
  },
};

const bootcampSignals = [
  {
    title: "解きたい課題",
    body: "保育実習の記録は、提出物で終わらせず、観察・省察・実習先の助言を次の日の学びへ戻す必要があります。",
  },
  {
    title: "動くプロトタイプ",
    body: "学生入力、記録前の安全確認、問い返し、翌日の観察観点、教員の確認材料までを架空例で確認できます。",
  },
  {
    title: "安全境界",
    body: "実データ、外部AI送信、学校データ保存、限定レビュー環境やアカウント情報はこの公開デモに含めません。",
  },
  {
    title: "継続開発",
    body: "学校ごとの日誌フォーマット、保存範囲、教員画面に出す情報を小さく検証しながら、MVPを更新していきます。",
  },
];

const flowSteps = [
  {
    label: "01",
    title: "観察を記録する",
    body: "見たこと、自分で考えたこと、明日見たいこと、実習先で受けた助言を分けて入力します。",
  },
  {
    label: "02",
    title: "記録前に気づく",
    body: "個人が分かる表現、文脈を見直したい表現、より安全な言い方を学生が確認します。",
  },
  {
    label: "03",
    title: "問い返しを受ける",
    body: "完成文ではなく、学生が自分の言葉で考え直すための問いを返します。",
  },
  {
    label: "04",
    title: "翌日の観察へ戻す",
    body: "実習先で受けた指導を、明日見る子どもの姿と自分の関わり方へつなげます。",
  },
  {
    label: "05",
    title: "教員が確認する",
    body: "当日確認、授業共有、学生本人の自己確認に分け、全件添削や評価ではなく指導材料として扱います。",
  },
];

const safetyItems = [
  {
    label: "高リスク候補",
    title: "個人が分かるかも",
    body: "実名、園名、電話番号、住所などは入力へ戻して見直す対象にします。",
  },
  {
    label: "文脈を見る",
    title: "記録前の確認",
    body: "発達、家庭事情、強い断定など、文脈によって扱いを確認したい表現を分けます。",
  },
  {
    label: "整えやすく",
    title: "別の言い方",
    body: "AちゃんをA児にするなど、教育的な記録として整えやすい候補を示します。",
  },
];

const demoAssurances = [
  "BootCamp・外部応募向けに切り出した閲覧専用デモです。",
  "実データ入力、外部AI送信、学校データ保存は行いません。",
  "限定レビュー環境やアカウント情報は含めていません。",
];

const reviewerHighlights = [
  {
    title: "代筆ではない",
    body: "AIが日誌を完成させる画面ではなく、学生が書いた観察をもとに考え直すための支援です。",
  },
  {
    title: "安全に気づく",
    body: "個人が分かる表現や扱いに注意が必要な表現を、学生が提出前に見直せる形で示します。",
  },
  {
    title: "翌日の観察に戻る",
    body: "実習先で受けた助言を、次の日に何を見るか、どう関わるかへつなげます。",
  },
  {
    title: "教員は判断材料にする",
    body: "全件添削や成績判定ではなく、学生への指導や授業で扱う候補を整理します。",
  },
];

const teacherItems = [
  "当日確認: 個別に早めに見たい候補",
  "授業共有: クラス全体で扱いやすい傾向",
  "学生本人: 提出前の自己確認として返せる項目",
];

export default function DemoPage() {
  return (
    <main id="main-content" className="site-root">
      <section className="site-shell site-subpage">
        <PublicHeader />

        <section className="detail-hero demo-hero">
          <div className="demo-hero-copy">
            <span className="site-kicker">BootCamp向け公開プロトタイプ</span>
            <h1>観察を記録に。記録を学びに。</h1>
            <p>
              Manalioは、保育者養成校向けのAI実習支援MVPです。
              学生が自分で書いた観察、考え、実習先で受けた助言をもとに、記録前の安全確認、問い返し、翌日の観察観点、教員の確認材料へつなげる流れを架空例で確認できます。
            </p>
            <div className="demo-assurance-list" aria-label="この体験ページの前提">
              {demoAssurances.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div className="demo-hero-visual" aria-label="Manalioの体験イメージ">
            <img
              src="/images/manalio-illust-student-writing.png"
              alt="実習記録を整理する学生のイラスト"
            />
            <div className="demo-hero-flow" aria-label="応募用公開ページで見る流れ">
              <span>学生入力</span>
              <span>記録前の気づき</span>
              <span>問い返し</span>
              <span>教員確認</span>
            </div>
          </div>
        </section>

        <section className="detail-section demo-review-strip" aria-labelledby="demo-bootcamp-heading">
          <div className="detail-section-head">
            <span className="site-kicker">BootCampで見てほしいこと</span>
            <h2 id="demo-bootcamp-heading">アイデアではなく、動く範囲と安全境界を見せる</h2>
            <p>
              このページは学校営業用のLPではなく、応募・外部共有用に切り出した公開プロトタイプです。
              Manalioが何の課題に向き合い、どこまで動き、何を外へ出さない設計にしているかを確認できます。
            </p>
          </div>
          <div className="demo-review-grid">
            {bootcampSignals.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-section demo-review-strip" aria-labelledby="demo-review-heading">
          <div className="detail-section-head">
            <span className="site-kicker">プロダクトの核</span>
            <h2 id="demo-review-heading">Manalioがすること、しないこと</h2>
          </div>
          <div className="demo-review-grid">
            {reviewerHighlights.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-section">
          <div className="detail-section-head">
            <span className="site-kicker">全体の流れ</span>
            <h2>公開デモで確認できる5つの場面</h2>
          </div>
          <div className="demo-flow-grid">
            {flowSteps.map((step) => (
              <article key={step.label}>
                <span>{step.label}</span>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-section demo-split">
          <div>
            <span className="site-kicker">学生画面</span>
            <h2>入力例</h2>
            <div className="demo-note">
              <p><b>見たこと</b> A児がブロックを高く積み、崩れたあとも別の形を試していた。</p>
              <p><b>自分で考えたこと</b> 失敗しても続けた理由を、周囲の声かけや素材の置き方と合わせて見たい。</p>
              <p><b>明日見たいこと</b> 同じ遊びの中で、保育者がどのタイミングで声をかけるか観察したい。</p>
              <p><b>受けた助言</b> 実習先の指導者から「結果だけでなく、試す過程を見て記録するとよい」と言われた。</p>
            </div>
          </div>
          <div className="demo-output">
            <span>問い返し</span>
            <strong>明日は、A児が試し直す前後で、周囲の環境や保育者の関わりがどう変わったか見てみましょう。</strong>
            <p>「できた・できない」ではなく、試す過程を観察する視点に戻します。</p>
          </div>
        </section>

        <section className="detail-section">
          <div className="detail-section-head">
            <span className="site-kicker">記録前の気づき</span>
            <h2>安全確認は、学生への命令ではなく気づきとして見せる</h2>
          </div>
          <div className="detail-card-grid pricing">
            {safetyItems.map((item) => (
              <article key={item.title}>
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-section detail-split reverse">
          <div>
            <span className="site-kicker">教員画面</span>
            <h2>全件添削ではなく、指導で扱う候補を分ける</h2>
            <p>
              教員画面は学生の成績を判定する場所ではありません。
              学生がどこでつまずき、どの指導を翌日に活かそうとしているかを、必要な範囲に絞って確認するための画面です。
            </p>
          </div>
          <div className="detail-list">
            {teacherItems.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <section className="detail-cta demo-cta">
          <div>
            <span className="site-kicker">公開範囲</span>
            <h2>このページは、応募・外部共有用に切り出した安全なデモです。</h2>
            <p>実データ入力、外部AI送信、学校データ保存は行いません。公開GitHubも、現在の作業リポジトリをそのまま出さず、安全な候補フォルダだけを切り出して扱います。</p>
          </div>
          <a className="site-primary" href="/product">機能を見る</a>
        </section>

        <PublicFooter />
      </section>
    </main>
  );
}
