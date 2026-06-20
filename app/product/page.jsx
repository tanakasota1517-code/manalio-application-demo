import { DetailCta, PublicFooter, PublicHeader } from "../site-components";

export const metadata = {
  title: "機能 | Manalio",
  description: "Manalioの学生向け省察支援、翌日の観察ポイント化、教員向け確認レビュー、学校フォーマット、教員確認観点の機能概要です。",
  alternates: {
    canonical: "/product",
  },
};

export default function ProductPage() {
  return (
    <main id="main-content" className="site-root">
      <section className="site-shell site-subpage">
        <PublicHeader />

        <section className="detail-hero">
          <span className="site-kicker">機能</span>
          <h1>学生の翌日を変え、教員の確認負担を軽くする。</h1>
          <p>
            Manalioは、学生が書いた観察と振り返りを出発点に、考え直すための問いと確認観点を返します。
            実習記録の効率化だけでなく、実習先で受けた指導を翌日の観察に変え、学校の指導内でリスクを下げながらAIを使える形にします。
          </p>
        </section>

        <section className="detail-section">
          <div className="detail-section-head">
            <span className="site-kicker">機能構成</span>
            <h2>学校導入に必要な5つの機能</h2>
          </div>
          <div className="detail-card-grid">
            <article>
              <span>01</span>
              <strong>学生画面</strong>
              <p>見たこと、自分で考えたこと、明日見たいことを分けて入力できます。</p>
            </article>
            <article>
              <span>02</span>
              <strong>教員画面</strong>
              <p>教員確認が必要な候補、学生ごとの振り返り概要、授業や個別指導で扱うポイントを、必要な範囲に絞って確認できます。</p>
            </article>
            <article>
              <span>03</span>
              <strong>学校フォーマット</strong>
              <p>実習日誌の見出し、文体、保育所保育指針を含む確認観点を学校別に調整します。</p>
            </article>
            <article>
              <span>04</span>
              <strong>確認レビュー</strong>
              <p>入力不足、置換・マスキング、評価的表現、相談点不足を、必要な範囲で見直しやすく整理します。</p>
            </article>
            <article>
              <span>05</span>
              <strong>フィードバックループ</strong>
              <p>学生が実習先で受けた指導を自分の言葉で整理し、翌日の観察ポイントへつなげます。</p>
            </article>
          </div>
        </section>

        <section className="detail-section detail-split">
          <div>
            <span className="site-kicker">学生画面</span>
            <h2>学生には、作成ではなく「考え直し」の余白を残す。</h2>
            <p>
              AIの返答は完成文ではなく、学生が自分の言葉で書き直すための問いです。
              学生メモにない事実は補完せず、確認すべき点として残します。
            </p>
          </div>
          <div className="detail-list">
            <p>見たこと・考えたこと・明日見たいことを分けて入力</p>
            <p>考察の根拠、明日の観察視点、学校の担当教員に確認したい点を整理</p>
            <p>個人情報や断定表現を提出前の自己確認で見直し</p>
          </div>
        </section>

        <section className="detail-section detail-split reverse">
          <div>
            <span className="site-kicker">フィードバックループ</span>
            <h2>実習先で受けた指導を、翌日の行動に変える。</h2>
            <p>
              返却日誌やコメントをそのまま読み込ませるのではなく、学生が受け止めた内容を自分の言葉で入力します。
              Manalioは、その内容を翌日の観察観点、記録で確認する点、学校の担当教員に相談する点へ整理します。
            </p>
          </div>
          <div className="detail-list">
            <p>言われたこと・自分の理解・まだ分からないことを分ける</p>
            <p>明日見る子どもの姿と保育者の関わりを整理</p>
            <p>同じ指導を流さないための自己確認項目を提示</p>
            <p>教員確認や授業共有に使うポイントとして残す</p>
          </div>
        </section>

        <section className="detail-section detail-split">
          <div>
            <span className="site-kicker">教員画面</span>
            <h2>教員には、支援に必要な変化と確認候補を集める。</h2>
            <p>
              学生の入力をすべて同じ重さで見るのではなく、個人情報や表現面など確認が必要なものを先に把握できます。
              実習先で受けた指導を学生がどう理解し、翌日にどう活かそうとしたかも、教員確認や授業共有に使いやすくなります。
            </p>
          </div>
          <div className="detail-list">
            <p>クラス別・課題別に、学習支援に必要な範囲を確認</p>
            <p>優先度別の自己確認結果</p>
            <p>授業や個別指導で確認したい学生ごとのポイント</p>
            <p>学校指定フォーマットの管理</p>
          </div>
        </section>

        <section className="detail-section detail-split reverse">
          <div>
            <span className="site-kicker">運用負担</span>
            <h2>実習期間中も、確認候補を対応先で分ける。</h2>
            <p>
              確認候補が多くなっても、同じ重さで扱う必要はありません。
              個人情報や断定表現など当日確認したいもの、授業でまとめて扱うもの、学生本人へ返すものに分けて、確認量を抑えます。
            </p>
          </div>
          <div className="detail-list">
            <p>高優先: 個人情報・未置換の識別情報・重大な表現リスク</p>
            <p>中優先: 授業内で共有しやすい表現や考察の傾向</p>
            <p>低優先: 学生本人の自己確認で促せる入力不足</p>
          </div>
        </section>

        <DetailCta title="学校の実習指導に合わせて、最初の導入範囲を決めましょう。" href="/pilot">
          導入の流れを見る
        </DetailCta>
        <PublicFooter />
      </section>
    </main>
  );
}
