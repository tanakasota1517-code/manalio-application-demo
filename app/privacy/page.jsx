import { CONTACT_EMAIL } from "../site-config";

export const metadata = {
  title: "個人情報の取扱い | Manalio",
  description: "Manalioにおける個人情報、実習記録、確認記録、外部サービス利用時のデータ取扱いについて説明します。",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="legal-shell">
      <LegalHeader label="個人情報" title="個人情報の取扱いについて" />

      <section className="legal-card">
        <p>
          Manalioは、保育者養成校における実習指導とAI利用管理のため、必要な範囲で個人情報および実習記録に関する情報を取り扱います。
          導入組織との契約内容、学校の実習規程、適用法令に従って、適切な安全管理措置を講じます。
        </p>
      </section>

      <LegalSection title="1. 取得する情報">
        <ul>
          <li>氏名、メールアドレス、学校名、クラス名、利用者ロールなどのアカウント情報</li>
          <li>学生が入力する実習メモ、自分で考えたこと、指導を受けて学んだことの要約</li>
          <li>AIによる問い返し、提出前の自己確認、翌日の観察ポイント、教員確認候補、確認記録</li>
          <li>ログイン日時、生成日時、利用回数、エラー情報などの利用記録</li>
          <li>お問い合わせ時に提供される氏名、所属、連絡先、相談内容</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. 利用目的">
        <ul>
          <li>本サービスの提供、本人確認、アカウント管理のため</li>
          <li>実習記録の省察支援、学校フォーマット反映、提出前の自己確認のため</li>
          <li>指導を受けて学んだことを翌日の観察観点や記録改善につなげるため</li>
          <li>導入組織の教員・管理者による必要範囲の確認、実習後の個別指導、学習支援、確認候補の扱いのため</li>
          <li>不正利用防止、セキュリティ確保、障害対応、利用上限管理のため</li>
          <li>機能改善、品質検証、問い合わせ対応、契約・請求に関する連絡のため</li>
        </ul>
        <p>
          本サービスは、AIによる採点、成績評価、単位認定、実習評価、合否判断を目的として個人情報を利用しません。
        </p>
      </LegalSection>

      <LegalSection title="3. 個人情報・要配慮情報の入力について">
        <p>
          学生は、子ども、保護者、実習先職員その他の第三者を特定できる情報を、必要以上に入力しないでください。
          子どもの実名、家庭環境、診断名、健康情報など、実習記録に不要な情報は置換・マスキングまたは省略することを原則とします。
        </p>
        <p>
          第三者情報または要配慮情報が誤って入力された可能性がある場合、導入組織と確認の上、削除、置換・マスキング、閲覧制限、外部AI送信の停止その他必要な措置を行う場合があります。
        </p>
      </LegalSection>

      <LegalSection title="4. 外部サービスの利用">
        <p>
          本サービスは、認証、データ保存、AI生成、ホスティング等のため、外部サービス事業者を利用する場合があります。
          外部AIサービスへ送信する情報は、サービス提供に必要な範囲に限定します。
          住所、連絡先、診断名、家庭事情など高リスクな情報が含まれる可能性がある場合はAI送信を停止し、子どもの名前、園名、職員名などは置換・マスキング・最小化した上で取り扱います。
          利用する外部サービス、送信範囲、保存期間その他の条件は、導入組織との契約または説明資料で確認します。
        </p>
      </LegalSection>

      <LegalSection title="5. 第三者提供・共同利用">
        <p>
          法令に基づく場合を除き、本人または導入組織の同意なく、個人情報を第三者へ販売または目的外提供しません。
          導入組織内では、実習指導、学生ごとの振り返り、確認候補、確認記録の確認のため、権限を持つ教員・管理者が必要な範囲で情報を閲覧できます。
          教員向けの通常画面や書き出しでは、入力本文やAI本文をそのまま広く配布するのではなく、入力概要、提出前の自己確認、確認観点、面談用サマリーを中心に扱います。
        </p>
      </LegalSection>

      <LegalSection title="6. 保存期間">
        <p>
          アカウント情報、確認記録、レビュー情報、問い合わせ情報の保存期間は、導入組織との契約、学校の運用、法令上の保存義務、サービス運営上の必要性に応じて定めます。
          不要となった情報は、合理的な期間内に削除または個人を特定しにくい形へ加工します。
        </p>
      </LegalSection>

      <LegalSection title="7. 開示・訂正・利用停止等">
        <p>
          保有個人データに関する開示、訂正、利用停止、削除等の請求については、本人確認および導入組織との権限確認を行った上で、法令に従い対応します。
        </p>
      </LegalSection>

      <LegalSection title="8. お問い合わせ">
        <p>
          個人情報の取扱いに関するお問い合わせは、
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          または導入組織の管理者を通じてご連絡ください。
        </p>
      </LegalSection>

      <LegalFooter />
    </main>
  );
}

function LegalHeader({ label, title }) {
  return (
    <header className="legal-hero">
      <a className="site-brand" href="/">
        <img className="site-logo-horizontal" src="/images/manalio-logo-horizontal.svg" alt="Manalio" />
        <span className="site-brand-caption">実習指導支援AIプラットフォーム</span>
      </a>
      <span className="site-kicker">{label}</span>
      <h1>{title}</h1>
      <p>最終更新日: 2026年5月20日</p>
    </header>
  );
}

function LegalSection({ title, children }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function LegalFooter() {
  return (
    <footer className="legal-footer">
      <a href="/">トップへ戻る</a>
      <a href="/terms">利用規約</a>
      <a href="/commercial-transactions">特定商取引法に基づく表示</a>
    </footer>
  );
}
