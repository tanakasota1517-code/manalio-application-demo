import { PublicFooter, PublicHeader } from "../site-components";
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
    title: "学生が自分の観察を整理する",
    body: "見たこと、自分の考え、実習先で受けた助言を分けて入力し、記録にする前の材料を整えます。",
  },
  {
    title: "AIは完成文ではなく問いを返す",
    body: "日誌を代筆せず、学生がもう一度考えるための問い、確認候補、翌日の観察観点を返します。",
  },
  {
    title: "教員は指導材料として見る",
    body: "全件添削や成績判定ではなく、学生への声かけや授業共有に使える候補を確認します。",
  },
];

export default function DemoPage() {
  return (
    <main id="main-content" className="site-root">
      <section className="site-shell site-subpage">
        <PublicHeader />

        <section className="detail-hero demo-hero">
          <div className="demo-hero-copy">
            <span className="site-kicker">触れる公開デモ</span>
            <h1>観察を記録に。記録を学びに。</h1>
            <p>
              Manalioは、保育者養成校向けのAI実習支援SaaSです。
              学生が書いた観察と振り返りをもとに、提出前の気づき、問い返し、翌日の観察観点、教員が確認する指導材料へつなげます。
            </p>
            <div className="site-hero-actions">
              <a className="site-primary" href="#service-demo">サービス画面を試す</a>
              <a className="site-secondary" href="/product">機能を見る</a>
            </div>
          </div>
          <div className="demo-hero-visual" aria-label="Manalioの体験イメージ">
            <img
              src="/images/manalio-illust-student-writing.png"
              alt="実習記録を整理する学生のイラスト"
            />
            <div className="demo-hero-flow" aria-label="デモで触れる流れ">
              <span>学生入力</span>
              <span>提出前の気づき</span>
              <span>問い返し</span>
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
              Manalioは、入力、問い返し、安全確認、教員確認、学校フォーマット対応までを一つの流れとして扱います。
              まずは小さなクラス単位で、どの情報を保存し、誰が見られるかを確認しながら導入します。
            </p>
          </div>
          <a className="site-primary" href="/governance">安全性を見る</a>
        </section>

        <PublicFooter />
      </section>
    </main>
  );
}
