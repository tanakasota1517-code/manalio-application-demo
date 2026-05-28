import { PublicFooter, PublicHeader } from "../site-components";

export const metadata = {
  title: "体験ページ | Manalio",
  description: "Manalioの学生入力、記録前の気づき、問い返し、翌日の観察、教員向け整理の流れを、安全な架空例だけで確認できる閲覧ページです。",
  alternates: {
    canonical: "/demo",
  },
  robots: {
    index: false,
    follow: false,
  },
};

const flowSteps = [
  {
    label: "01",
    title: "学生が先に書く",
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
    title: "教員が面談に使う",
    body: "当日確認、授業共有、学生本人の自己確認に分け、全件添削ではなく面談材料として扱います。",
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
  "ログイン情報なしで、全体の思想だけを確認できます。",
  "実データ入力、外部AI送信、学校データ保存は行いません。",
  "応募・事前相談では、限定レビュー環境のURLやアカウントを使いません。",
];

const reviewerHighlights = [
  {
    title: "学生が先に書く",
    body: "AIが文章を完成させる前提ではなく、学生の観察と言葉を出発点にします。",
  },
  {
    title: "記録前に気づく",
    body: "個人が分かる表現や扱いに注意が必要な表現を、提出前に見直せる形で示します。",
  },
  {
    title: "翌日の観察に戻す",
    body: "実習先で受けた助言を、次の日に何を見るか、どう関わるかへつなげます。",
  },
  {
    title: "教員は支援に使う",
    body: "全件添削や成績判定ではなく、学生との面談・授業で扱う候補を整理します。",
  },
];

const teacherItems = [
  "当日確認: 個別に早めに見たい候補",
  "授業共有: クラス全体で扱いやすい傾向",
  "学生本人: 提出前の自己確認として返せる項目",
  "次回相談: 学校フォーマット、保存範囲、費用感",
];

const consultationItems = [
  {
    label: "学校フォーマット",
    title: "どの見出しに合わせるか",
    body: "実習日誌の欄、自己確認観点、教員が見たい見出しを、学校の様式に合わせます。",
  },
  {
    label: "保存範囲",
    title: "何を残し、何を残さないか",
    body: "学生の本文を広く保存するのではなく、教員が確認する段階と範囲を相談します。",
  },
  {
    label: "小さな試用",
    title: "どの場面から試すか",
    body: "対象人数、期間、費用感、教員側の確認負担を合わせて、無理のないPoC範囲を決めます。",
  },
];

export default function DemoPage() {
  return (
    <main id="main-content" className="site-root">
      <section className="site-shell site-subpage">
        <PublicHeader />

        <section className="detail-hero demo-hero">
          <div className="demo-hero-copy">
            <span className="site-kicker">安全な架空例で見る</span>
            <h1>学生が書き、気づき、翌日の観察へ戻る流れ。</h1>
            <p>
              Manalioは、実習日誌を代わりに完成させる画面ではありません。
              学生が自分で書いた記録をもとに、記録前の気づき、問い返し、教員が支援すべき点の整理へつなげる流れを確認できます。
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
              <span>教員支援</span>
            </div>
          </div>
        </section>

        <section className="detail-section demo-review-strip" aria-labelledby="demo-review-heading">
          <div className="detail-section-head">
            <span className="site-kicker">まず見てほしいところ</span>
            <h2 id="demo-review-heading">Manalioの価値が伝わる4つの視点</h2>
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
            <h2>最初に見てほしい5つの場面</h2>
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
            <h2>全件添削ではなく、面談で扱う候補を分ける</h2>
            <p>
              教員画面は学生の成績を判定する場所ではありません。
              学生がどこでつまずき、どの指導を翌日に活かそうとしているかを、必要な範囲に絞って確認する画面です。
            </p>
          </div>
          <div className="detail-list">
            {teacherItems.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <section className="detail-section">
          <div className="detail-section-head">
            <span className="site-kicker">PoC前に確認すること</span>
            <h2>画面を見たあと、次回はこの3点を相談します</h2>
          </div>
          <div className="detail-card-grid pricing">
            {consultationItems.map((item) => (
              <article key={item.title}>
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-cta demo-cta">
          <div>
            <span className="site-kicker">次に相談したいこと</span>
            <h2>PoC前に、学校フォーマットと保存範囲を一緒に確認します。</h2>
            <p>このページは安全な架空例だけで流れを見るための入口です。実データ入力、外部AI送信、学校データ保存は行いません。</p>
          </div>
          <a className="site-primary" href="/product">機能を見る</a>
        </section>

        <PublicFooter />
      </section>
    </main>
  );
}
