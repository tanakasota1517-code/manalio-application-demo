import { DemoServiceExperience } from "./demo-service-experience";

export const metadata = {
  title: "Manalio デモ | 保育実習の省察支援",
  description: "Manalioの学生画面と教員画面を、架空の実習場面で触りながら確認できる公開デモです。",
  alternates: {
    canonical: "/demo",
  },
  robots: {
    index: false,
    follow: false,
  },
};

const demoPoints = [
  {
    title: "学校フォーマットに沿って学生が書く",
    body: "目標の振り返り、エピソード、気づき、次の日取り組みたいことを、学校ごとの日誌様式に近い形で整理します。",
  },
  {
    title: "叩き台と見比べて、自分で直す",
    body: "完成文を渡すのではなく、元の記録とAIの叩き台を横に置き、学生が自分の言葉で直すための材料を返します。",
  },
  {
    title: "教員は指導材料として見る",
    body: "学生への声かけ、授業共有、自己確認へ戻す候補を分け、確認作業を支援に使いやすい形へ整理します。",
  },
];

export default function DemoPage() {
  return (
    <main id="main-content" className="site-root">
      <section className="site-shell site-subpage">
        <DemoHeader />

        <section className="detail-hero demo-hero">
          <div className="demo-hero-copy">
            <span className="site-kicker">触れる公開デモ</span>
            <h1>観察を記録に。記録を学びに。</h1>
            <p>
              Manalioは、保育者養成校向けのAI実習支援SaaSです。
              学生が学校の日誌様式に沿って書いた観察と振り返りをもとに、提出前の安全確認、叩き台との比較、翌日の観察観点、教員が確認する指導材料へつなげます。
            </p>
            <p className="demo-hero-note">
              架空の実習場面で、学生画面と教員画面の流れをそのまま試せます。
            </p>
            <div className="site-hero-actions">
              <a className="site-primary" href="#service-demo">サービス画面を試す</a>
              <a className="site-secondary" href="/demo/student">学生画面を開く</a>
            </div>
          </div>
          <div className="demo-hero-visual" aria-label="Manalioの体験イメージ">
            <img
              src="/images/manalio-illust-student-writing.png"
              alt="実習記録を整理する学生のイラスト"
            />
            <div className="demo-hero-flow" aria-label="デモで触れる流れ">
              <span>学校フォーマット</span>
              <span>安全確認</span>
              <span>叩き台比較</span>
              <span>教員確認</span>
            </div>
          </div>
        </section>

        <section className="detail-section demo-review-strip" aria-labelledby="demo-points-heading">
          <div className="detail-section-head">
            <span className="site-kicker">Manalioの核</span>
            <h2 id="demo-points-heading">日誌を代筆せず、実習で見たことを学びに戻す</h2>
          </div>
          <div className="demo-review-grid">
            {demoPoints.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <DemoServiceExperience />

        <section className="detail-cta demo-cta">
          <div>
            <span className="site-kicker">次に見るところ</span>
            <h2>学生画面だけでなく、学校として説明できるAI利用にする。</h2>
            <p>
              Manalioは、学校フォーマットへの入力、安全確認、叩き台比較、教員確認までを一つの流れとして扱います。
              まずは小さなクラス単位で、どの情報を保存し、誰が見られるかを確認しながら導入します。
            </p>
          </div>
          <a className="site-primary" href="/demo/teacher">教員画面を開く</a>
        </section>

        <DemoFooter />
      </section>
    </main>
  );
}

function DemoHeader() {
  return (
    <header className="site-header">
      <a className="site-brand" href="/demo">
        <img className="site-logo-horizontal" src="/images/manalio-logo-horizontal.svg" alt="Manalio" />
        <span className="site-brand-caption">保育実習の省察支援</span>
      </a>
      <nav className="site-nav" aria-label="公開デモ">
        <a href="#demo-points-heading">Manalioの核</a>
        <a href="#service-demo">サービス画面</a>
        <a href="/demo/student">学生画面</a>
        <a href="/demo/teacher">教員画面</a>
      </nav>
      <a className="site-header-cta" href="#service-demo">デモを試す</a>
    </header>
  );
}

function DemoFooter() {
  return (
    <footer className="site-footer" aria-label="公開デモ情報">
      <a className="site-brand" href="/demo">
        <img className="site-logo-horizontal" src="/images/manalio-logo-horizontal.svg" alt="Manalio" />
        <span className="site-brand-caption">保育実習の省察支援</span>
      </a>
      <nav aria-label="公開デモ内リンク">
        <a href="/demo/student">学生画面</a>
        <a href="/demo/teacher">教員画面</a>
        <a href="#service-demo">流れを見る</a>
      </nav>
      <p>Copyright © Manalio</p>
    </footer>
  );
}
