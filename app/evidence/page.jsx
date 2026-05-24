import { DetailCta, PublicFooter, PublicHeader } from "../site-components";
import hoikushiSummary from "../../data/hoikushi-benchmark-summary.json";

export const metadata = {
  title: "信頼性検証 | Manalio",
  description: "Manalioの保育士試験（筆記）過去問ベンチマークと、AI出力品質の検証方針です。",
  alternates: {
    canonical: "/evidence",
  },
};

export default function EvidencePage() {
  return (
    <main id="main-content" className="site-root">
      <section className="site-shell site-subpage">
        <PublicHeader />

        <section className="detail-hero governance">
          <span className="site-kicker">信頼性検証</span>
          <h1>AI活用の信頼性を、検証結果と運用方針で示します。</h1>
          <p>
            Manalioでは、保育士試験（筆記）の過去問を用いたベンチマークと、
            実習日誌出力のガードレール検証を分けて記録します。
            学校が導入判断に使える根拠として、対象範囲と表示方針を明確にします。
          </p>
        </section>

        <section className="detail-section">
          <div className="detail-section-head">
            <span className="site-kicker">基礎知識の確認</span>
            <h2>保育領域の基礎知識は、筆記過去問で定量確認する。</h2>
          </div>
          <div className="detail-card-grid">
            <article>
              <span>01</span>
              <strong>過去問と正答を利用</strong>
              <p>年度・回・科目・問題数を明記し、対象範囲がわかる形で掲載します。</p>
            </article>
            <article>
              <span>02</span>
              <strong>科目別に採点</strong>
              <p>総合点だけでなく、科目ごとの得点と満点を確認し、基準相当かを見ます。</p>
            </article>
            <article>
              <span>03</span>
              <strong>結果ログを保存</strong>
              <p>実行条件、実行日、問題数、採点方法を記録し、結果の説明可能性を保ちます。</p>
            </article>
            <article>
              <span>04</span>
              <strong>表現を限定</strong>
              <p>資格取得や受験結果を約束するものではなく、筆記過去問ベンチマークの結果として表示します。</p>
            </article>
          </div>
        </section>

        <section className="detail-section detail-split">
          <div>
            <span className="site-kicker">表示方針</span>
            <h2>表示する表現は、検証範囲に限定します。</h2>
            <p>
              表示できるのは「保育士試験（筆記）過去問において、合格基準相当の得点を確認」のような表現です。
              AIが資格を取得した、学生の受験結果を約束する、といった誤認につながる表現は使いません。
            </p>
          </div>
          <div className="detail-list">
            <p>対象年度・対象科目・問題数を明記</p>
            <p>実行条件と実行日を記録</p>
            <p>筆記過去問に限定した検証として表示</p>
            <p>実習支援品質とは別の補助指標として扱う</p>
          </div>
        </section>

        <section className="detail-section">
          <div className="detail-section-head">
            <span className="site-kicker">科目別得点</span>
            <h2>令和3〜7年度・前期の科目別得点を記録します。</h2>
            <p>
              年度別・科目別の得点と判定を、学校が確認しやすい粒度で掲載しています。
              5年分の結果を、科目ごとに確認できます。
            </p>
          </div>
          <div className="detail-score-note">
            <strong>{hoikushiSummary.range.from}〜{hoikushiSummary.range.to} / {hoikushiSummary.range.session}</strong>
            <span>合格基準相当: 各科目 {Math.round(hoikushiSummary.passThreshold * 100)}% 以上</span>
          </div>
          <div className="detail-score-table-wrap" aria-label="保育士試験ベンチマーク科目別得点">
            <table className="detail-score-table">
              <thead>
                <tr>
                  <th scope="col">科目</th>
                  {hoikushiSummary.years.map((year) => (
                    <th scope="col" key={year.year}>{year.year}<br />{year.session}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hoikushiSummary.subjects.map((subject) => (
                  <tr key={subject.name}>
                    <th scope="row">
                      {subject.name}
                      <small>{subject.questionCount}問 / 基準{subject.passingCorrect * 5}点</small>
                    </th>
                    {hoikushiSummary.years.map((year) => {
                      const item = year.subjects.find((candidate) => candidate.name === subject.name);
                      return (
                        <td key={`${year.year}-${subject.name}`} data-year={`${year.year} ${year.session}`}>
                          <ScoreCell item={item} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="detail-disclaimer">{hoikushiSummary.disclaimer}</p>
        </section>

        <section className="detail-section detail-note">
          <span className="site-kicker">掲載状況</span>
          <h2>令和3〜7年度前期の5年分を掲載しています。</h2>
          <p>
            実習支援の品質や資格取得の結果を約束するものではなく、保育領域の基礎知識を確認する補助指標として扱います。
            表示内容は、対象年度・対象科目・採点基準とあわせて確認できます。
          </p>
          <div className="detail-link-row">
            <a href="/governance">安全性を見る</a>
            <a href="/#contact">導入相談をする</a>
          </div>
        </section>

        <DetailCta title="検証結果も含めて、学校ごとに安心して使える導入範囲を設計します。" href="/#contact">
          導入相談をする
        </DetailCta>
        <PublicFooter />
      </section>
    </main>
  );
}

function ScoreCell({ item }) {
  if (!item || item.score == null || item.maxScore == null || item.pass == null) {
    return (
      <span className="detail-score-cell pending">
        <b>確認中</b>
        <small>未掲載</small>
      </span>
    );
  }

  return (
    <span className={`detail-score-cell ${item.pass ? "passed" : "failed"}`}>
      <b>{item.score}/{item.maxScore}</b>
      <small>{item.pass ? "基準相当" : "要改善"}</small>
    </span>
  );
}
