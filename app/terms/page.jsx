import { CONTACT_EMAIL } from "../site-config";

export const metadata = {
  title: "利用規約 | Manalio",
  description: "Manalioの利用条件、禁止事項、AI出力の取扱い、学校管理者と学生の責任範囲を定める利用規約です。",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <main id="main-content" className="legal-shell">
      <LegalHeader label="利用規約" title="利用規約" />

      <section className="legal-card">
        <p>
          この利用規約は、Manalioが提供する保育者養成校向けAI実習指導支援サービスの利用条件を定めるものです。
          正式契約時には、学校法人または導入組織との個別契約、申込書、見積書その他の合意内容が優先される場合があります。
        </p>
      </section>

      <LegalSection title="1. サービスの目的">
        <p>
          本サービスは、保育実習における観察、記録、省察、指導を受けて学んだことの整理を、学校の指導下で支援することを目的とします。
          AIによる完成文の代筆ではなく、学生が先に書いた観察メモ、考察、翌日の観察観点、学校の担当教員への相談事項を見直す補助として提供されます。
        </p>
      </LegalSection>

      <LegalSection title="2. アカウント管理">
        <p>
          学校管理者または実習担当教員は、学生・教員・管理者の権限を適切に管理するものとします。
          利用者は、自己のアカウント情報を第三者に利用させてはならず、漏えいまたは不正利用が疑われる場合は速やかに管理者へ連絡してください。
        </p>
      </LegalSection>

      <LegalSection title="3. AI出力の取扱い">
        <p>
          AI出力は、提出物の完成版ではなく、学生が自分の言葉で追記・修正し、学校の担当教員の指導を受けるための問い返しと確認事項です。
          利用者は、入力していない事実、個人情報、子どもへの評価・診断的表現が含まれていないか確認した上で利用するものとします。
        </p>
        <p>
          本サービスおよびAI出力は、採点、成績評価、単位認定、資格取得、実習先評価、合否判断その他学生に重要な影響を及ぼす判断を自動化するものではありません。
          最終的な教育上の判断は、導入組織の教職員が行います。
        </p>
      </LegalSection>

      <LegalSection title="4. 禁止事項">
        <ul>
          <li>子ども、保護者、職員その他の第三者を特定できる情報を不必要に入力する行為</li>
          <li>AI出力を確認・修正せず、自己の観察や考察として提出する行為</li>
          <li>第三者の権利、プライバシー、名誉、信用を侵害する行為</li>
          <li>本サービスの運営、セキュリティ、他の利用者の利用を妨げる行為</li>
          <li>法令、公序良俗、学校の実習規程に反する行為</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. 確認記録と教員確認">
        <p>
          本サービスは、学校による実習指導と安全なAI利用管理のため、生成日時、利用者、入力概要、問い返しの見出し、提出前の自己確認、確認記録、レビュー記録等を保存する場合があります。
          保存範囲と保存期間は、導入組織との契約または管理設定に従います。
        </p>
        <p>
          これらの記録は、学生を継続的に評価・管理するためではなく、実習後の個別指導、学習支援、安全なAI利用の確認に必要な範囲で利用されます。
        </p>
      </LegalSection>

      <LegalSection title="6. サービスの変更・停止">
        <p>
          本サービスは、機能改善、保守、外部AIサービスまたはインフラの障害、法令対応その他必要な事情により、内容の変更または一時停止を行う場合があります。
        </p>
      </LegalSection>

      <LegalSection title="7. 免責">
        <p>
          本サービスは、実習記録の作成過程を補助するものであり、提出物の評価、単位認定、資格取得、実習先での評価を保証するものではありません。
          AI出力の正確性、完全性、特定目的への適合性について、利用者および導入組織による確認が必要です。
        </p>
      </LegalSection>

      <LegalSection title="8. お問い合わせ">
        <p>
          本規約に関するお問い合わせは、
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
      <a href="/privacy">個人情報の取扱い</a>
      <a href="/commercial-transactions">特定商取引法に基づく表示</a>
    </footer>
  );
}
