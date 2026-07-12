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

export default function DemoPage() {
  return (
    <main id="main-content" className="site-root">
      <section className="site-shell site-subpage">
        <DemoHeader />

        <section className="detail-hero demo-hero">
          <div className="demo-hero-copy">
            <span className="site-kicker">機能デモ</span>
            <h1>観察を記録に。記録を学びに。</h1>
            <p>
              学生は学校の日誌様式に沿って記録し、Manalioは提出前の安全確認、整理案との比較、翌日の観察観点づくりを支援します。
              教員は実習後に、個別の確認点と授業で扱う共通テーマを見ます。
            </p>
            <p className="demo-hero-note">
              架空の実習場面だけで動くため、実名や実習先名は入力しないでください。
            </p>
            <div className="site-hero-actions">
              <a className="site-primary" href="/demo/student">学生画面を開く</a>
              <a className="site-secondary" href="/demo/teacher">教員画面を開く</a>
              <a className="site-secondary" href="#service-demo">切り替えデモを見る</a>
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
              <span>整理案比較</span>
              <span>教員確認</span>
            </div>
          </div>
        </section>

        <DemoServiceExperience />

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
        <a href="/demo/student">学生画面</a>
        <a href="/demo/teacher">教員画面</a>
        <a href="#service-demo">切り替えデモ</a>
      </nav>
      <a className="site-header-cta" href="/demo/student">学生画面を開く</a>
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
        <a href="#service-demo">切り替えデモ</a>
      </nav>
      <p>Copyright © Manalio</p>
    </footer>
  );
}
