import { CONTACT_EMAIL, LEGAL_INFO } from "../site-config";

export const metadata = {
  title: "特定商取引法に基づく表示 | Manalio",
  description: "Manalioの特定商取引法に基づく表示です。現在は学校向けの個別見積り・問い合わせ型導入を前提としています。",
  alternates: {
    canonical: "/commercial-transactions",
  },
};

const rows = [
  ["販売事業者", LEGAL_INFO.sellerName],
  ["代表責任者", LEGAL_INFO.representative],
  ["所在地", LEGAL_INFO.address],
  ["電話番号", LEGAL_INFO.phone],
  ["お問い合わせ先", <a key="contact" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>],
  ["販売価格", LEGAL_INFO.price],
  ["商品代金以外の必要料金", LEGAL_INFO.additionalFees],
  ["支払方法", LEGAL_INFO.paymentMethod],
  ["支払時期", LEGAL_INFO.paymentTiming],
  ["サービス提供時期", LEGAL_INFO.serviceStart],
  ["返品・キャンセル", LEGAL_INFO.cancellation],
  ["動作環境", "最新版の主要ブラウザおよびインターネット接続環境が必要です。"],
];

export default function CommercialTransactionsPage() {
  return (
    <main id="main-content" className="legal-shell">
      <header className="legal-hero">
        <a className="site-brand" href="/">
          <img className="site-logo-horizontal" src="/images/manalio-logo-horizontal.svg" alt="Manalio" />
          <span className="site-brand-caption">保育実習の省察支援</span>
        </a>
        <span className="site-kicker">事業者情報</span>
        <h1>特定商取引法に基づく表示</h1>
        <p>最終更新日: 2026年5月20日</p>
      </header>

      <section className="legal-card">
        <p>
          現在、Manalioは学校・学科・実習科目ごとの個別見積りを前提とした問い合わせ型の導入を想定しています。
          当サイト上で直接の決済または即時申込みを開始する場合は、販売条件、申込画面、最終確認画面を事前に明示します。
        </p>
      </section>

      <dl className="legal-table" aria-label="特定商取引法に基づく表示事項">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="legal-section">
        <h2>注意事項</h2>
        <p>
          Manalioは学校・学科単位の個別契約を前提としています。オンライン申込みや決済機能を提供する場合は、
          申込み前の確認画面および本ページで販売条件を明示します。
        </p>
      </section>

      <footer className="legal-footer">
        <a href="/">トップへ戻る</a>
        <a href="/terms">利用規約</a>
        <a href="/privacy">個人情報の取扱い</a>
      </footer>
    </main>
  );
}
