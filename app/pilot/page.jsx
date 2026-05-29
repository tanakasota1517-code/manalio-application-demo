import { DetailCta, PublicFooter, PublicHeader } from "../site-components";

export const metadata = {
  title: "導入の流れ | Manalio",
  description: "Manalioを実習準備授業から検証導入し、学科・学校単位へ広げるための導入ステップです。",
  alternates: {
    canonical: "/pilot",
  },
};

export default function PilotPage() {
  return (
    <main id="main-content" className="site-root">
      <section className="site-shell site-subpage">
        <PublicHeader />

        <section className="detail-hero pilot">
          <span className="site-kicker">導入設計</span>
          <h1>いきなり全校導入ではなく、実習準備授業から始める。</h1>
          <p>
            学生が実習中に初めて触るのではなく、授業内で観察メモ、置換・マスキング、表現修正、AI出力の直し方を練習してから実習へつなげます。
          </p>
        </section>

        <section className="detail-section">
          <div className="detail-section-head">
            <span className="site-kicker">導入手順</span>
            <h2>導入までの進め方</h2>
          </div>
          <div className="detail-timeline">
            <article>
              <span>手順 1</span>
              <strong>学校フォーマット確認</strong>
              <p>実習日誌の様式、文体、評価観点、AI利用に関する学校内ルールを確認します。</p>
            </article>
            <article>
              <span>手順 2</span>
              <strong>実習準備課題を設計</strong>
              <p>授業内で扱うサンプル場面、提出前の自己確認、教員確認の観点を決めます。</p>
            </article>
            <article>
              <span>手順 3</span>
              <strong>小規模に検証導入</strong>
              <p>1科目または1クラスから利用し、学生の入力傾向と教員の確認負担を見ます。</p>
            </article>
            <article>
              <span>手順 4</span>
              <strong>学科・学校単位へ拡張</strong>
              <p>確認記録、保存期間、料金、導入研修を整え、継続利用できる運用にします。</p>
            </article>
          </div>
        </section>

        <section className="detail-section">
          <div className="detail-section-head">
            <span className="site-kicker">契約設計</span>
            <h2>費用は、AIの利用単価だけでなく学校運用まで含めて設計します。</h2>
            <p>
              学生個人課金ではなく、学校単位で対象範囲、利用期間、フォーマット調整、保存期間、確認レポートを決めます。
              学校が自前でAIを扱う場合に必要になる権限管理、送信前チェック、置換・マスキング、利用量管理まで含めて検討します。
            </p>
          </div>
          <div className="detail-card-grid pricing">
            <article>
              <span>検証導入</span>
              <strong>実習科目パイロット</strong>
              <p>1科目・1クラスから。実習準備授業と実習期間をセットで検証します。</p>
            </article>
            <article>
              <span>標準導入</span>
              <strong>学科導入</strong>
              <p>複数クラス、確認候補、学校フォーマット、教員が面談前に確認するポイントを含めます。</p>
            </article>
            <article>
              <span>学校導入</span>
              <strong>学校導入</strong>
              <p>複数学科、導入研修、AI利用規程、保存期間の設計まで支援します。</p>
            </article>
          </div>
        </section>

        <section className="detail-section">
          <div className="detail-section-head">
            <span className="site-kicker">PoCで確認すること</span>
            <h2>導入可否より先に、教育的に使える範囲を確認します。</h2>
          </div>
          <div className="detail-card-grid">
            <article>
              <span>01</span>
              <strong>学生の省察</strong>
              <p>実習先で受けた指導を、翌日の具体的な観察や行動に変えられるかを確認します。</p>
            </article>
            <article>
              <span>02</span>
              <strong>教員負担</strong>
              <p>教員が毎日全件を見る運用にならず、面談で使える論点だけを確認できるかを見ます。</p>
            </article>
            <article>
              <span>03</span>
              <strong>安全性</strong>
              <p>個人情報、評価的表現、入力内容から確認できない事実をどの程度防げるかを検証します。</p>
            </article>
            <article>
              <span>04</span>
              <strong>受容性</strong>
              <p>学生が過度に見られている感覚を持たず、学校の実習指導の中で無理なく使える範囲かを確認します。</p>
            </article>
          </div>
        </section>

        <section className="detail-section detail-note">
          <span className="site-kicker">初回相談</span>
          <h2>初回相談で確認したいこと</h2>
          <div className="detail-list two-column">
            <p>実習準備授業の回数と時期</p>
            <p>実習日誌の学校指定様式</p>
            <p>学生数、クラス数、実習担当教員数</p>
            <p>AI利用に関する学校内ルール</p>
            <p>保存したい確認記録と保存期間</p>
            <p>導入時に確認したい評価項目</p>
          </div>
        </section>

        <DetailCta label="導入相談" title="学校の実習指導に合わせて、最初の導入範囲を設計します。" href="/#contact">
          導入相談をする
        </DetailCta>
        <PublicFooter />
      </section>
    </main>
  );
}
