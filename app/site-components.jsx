export function PublicHeader() {
  return (
    <header className="site-header">
      <a className="site-brand" href="/">
        <img className="site-logo-horizontal" src="/images/manalio-logo-horizontal.svg" alt="Manalio" />
        <span className="site-brand-caption">保育実習の省察支援</span>
      </a>
      <nav className="site-nav" aria-label="公開サイト">
        <a href="/">Manalioとは</a>
        <a href="/product">機能</a>
        <a href="/governance">安全性</a>
        <a href="/evidence">信頼性検証</a>
        <a href="/pilot">導入の流れ</a>
        <a href="/login">ログイン</a>
      </nav>
      <a className="site-header-cta" href="/#contact">導入相談</a>
    </header>
  );
}

export function DetailCta({ label = "次のステップ", title, href, children }) {
  return (
    <section className="detail-cta">
      <span className="site-kicker">{label}</span>
      <h2>{title}</h2>
      <a className="site-primary" href={href}>{children}</a>
    </section>
  );
}

export function PublicFooter() {
  return (
    <footer className="site-footer" aria-label="サイト情報">
      <a className="site-brand" href="/">
        <img className="site-logo-horizontal" src="/images/manalio-logo-horizontal.svg" alt="Manalio" />
        <span className="site-brand-caption">保育実習の省察支援</span>
      </a>
      <nav aria-label="サイト内リンク">
        <a href="/evidence">信頼性検証</a>
        <a href="/terms">利用規約</a>
        <a href="/privacy">個人情報の取扱い</a>
        <a href="/commercial-transactions">特定商取引法に基づく表示</a>
      </nav>
      <p>Copyright © Manalio</p>
    </footer>
  );
}
