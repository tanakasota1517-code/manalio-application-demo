import { DetailCta, PublicFooter, PublicHeader } from "../site-components";

export const metadata = {
  title: "安全なAI利用 | Manalio",
  description: "Manalioの個人情報保護、代筆防止、学校単位の運用、確認記録に関する安全設計です。",
  alternates: {
    canonical: "/governance",
  },
};

export default function GovernancePage() {
  return (
    <main id="main-content" className="site-root">
      <section className="site-shell site-subpage">
        <PublicHeader />

        <section className="detail-hero governance">
          <span className="site-kicker">安全設計</span>
          <h1>AIを使わせるのではなく、学校として扱える状態にする。</h1>
          <p>
            Manalioは、保育実習で扱う情報の性質を前提に、個人情報、代筆化、断定表現、保存範囲を最初から運用設計に含めます。
          </p>
        </section>

        <section className="detail-section">
          <div className="detail-section-head">
            <span className="site-kicker">基本方針</span>
            <h2>学校導入に必要な安全設計</h2>
          </div>
          <div className="detail-card-grid">
            <article>
              <span>01</span>
              <strong>学校アカウント制</strong>
              <p>学生が自由登録するのではなく、学校・学科・クラス単位で利用範囲を管理します。</p>
            </article>
            <article>
              <span>02</span>
              <strong>個人情報の扱い</strong>
              <p>子ども、保護者、職員を特定できる情報は入力しない運用を前提にし、検出時は置換・マスキング・送信停止を行います。</p>
            </article>
            <article>
              <span>03</span>
              <strong>代筆防止</strong>
              <p>学生が先に自分で書き、AIは問い返しと提出前の自己確認を返す設計にします。</p>
            </article>
            <article>
              <span>04</span>
              <strong>確認記録</strong>
              <p>学生入力本文やAI本文を広く保存するのではなく、入力概要、確認候補、教員が面談前に確認するポイントなど、実習後の学習支援に必要な範囲だけを扱います。</p>
            </article>
          </div>
        </section>

        <section className="detail-section detail-split">
          <div>
            <span className="site-kicker">出力制御</span>
            <h2>AI出力は「提出物」ではなく「指導前の材料」。</h2>
            <p>
              実習日誌は、学生本人の観察と省察が中心です。
              そのため、Manalioでは出力の末尾に確認の問いを残し、入力にない事実を補わない方針を取ります。
            </p>
          </div>
          <div className="detail-list">
            <p>入力にない事実は本文に追加しない</p>
            <p>子どもの内面や診断を断定しない</p>
            <p>実名はA児、B児などに置換・マスキングする</p>
            <p>学生が教員に相談する点を残す</p>
          </div>
        </section>

        <section className="detail-section detail-split reverse">
          <div>
            <span className="site-kicker">送信前ガード</span>
            <h2>止めすぎず、危険な情報は外部AIへ送らない。</h2>
            <p>
              A児・B教員など教育上必要な伏せ字表現は許容しながら、実名、園名、住所、電話番号、診断名、家庭事情の詳細などは送信前に検出します。
              機械検出だけで完全性は保証せず、入力ルールと学校運用を組み合わせてリスクを下げます。
            </p>
          </div>
          <div className="detail-list">
            <p>許容: A児、B教員、3歳児、自由遊び、給食場面</p>
            <p>注意: 発達・家庭・怪我・強い叱責など文脈確認が必要な語</p>
            <p>停止: 実名、園名、住所、電話番号、診断名、家庭事情の詳細</p>
          </div>
        </section>

        <section className="detail-section detail-split">
          <div>
            <span className="site-kicker">すり抜け時の対応</span>
            <h2>誤入力や検出漏れは、事故対応の手順まで含めて扱う。</h2>
            <p>
              個人情報が送信前確認をすり抜けた場合は、該当記録の非表示、外部送信範囲の確認、学校への報告、必要な削除対応、再発防止を行う前提です。
              「完全に防げる」と言い切るのではなく、多層対策と事故時対応をセットで設計します。
            </p>
          </div>
          <div className="detail-list">
            <p>該当記録の隔離・非表示</p>
            <p>外部AIへ送信された範囲の確認</p>
            <p>学校担当者への報告と対応判断</p>
            <p>検出ルール・UI文言・運用手順の見直し</p>
          </div>
        </section>

        <section className="detail-section detail-note">
          <span className="site-kicker">法務確認</span>
          <h2>規約・個人情報・取引条件を分けて確認できます。</h2>
          <p>
            学校導入前に、利用範囲、保存期間、問い合わせ窓口、外部サービス利用時のデータ取扱いを確認できるようにしています。
          </p>
          <div className="detail-link-row">
            <a href="/terms">利用規約</a>
            <a href="/privacy">個人情報の取扱い</a>
            <a href="/commercial-transactions">特定商取引法に基づく表示</a>
          </div>
        </section>

        <DetailCta title="安全性を前提に、実習科目単位の検証導入から始められます。" href="/pilot">
          導入の流れを見る
        </DetailCta>
        <PublicFooter />
      </section>
    </main>
  );
}
