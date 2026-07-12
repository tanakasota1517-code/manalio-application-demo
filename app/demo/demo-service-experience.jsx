"use client";

import { useMemo, useState } from "react";

const sampleScenes = [
  {
    id: "blocks",
    studentName: "学生A",
    title: "ブロック遊び",
    description: "試し直す姿を、結果ではなく過程として見る場面",
    goalReflection: "子どもが自分で試す姿を見ようとした。積んだものが崩れた後も、すぐにやめずに別の置き方を試していたところを観察できた。",
    episodes: [
      {
        title: "エピソード1",
        body: "A児がブロックを高く積み、崩れたあとも別の形を試していた。",
        insight: "失敗しても続けた理由を、周囲の声かけや素材の置き方と合わせて見たい。",
      },
      {
        title: "エピソード2",
        body: "近くにいたB児が別のブロックを渡すと、A児はそれを線路のように並べていた。",
        insight: "友だちの関わりが、遊びを続けるきっかけになっていたように見えた。",
      },
    ],
    guidance: "実習先の指導者から「結果だけでなく、試す過程を見て記録するとよい」と言われた。",
    overallLearning: "保育者は、すぐに答えを出すのではなく、子どもが試し直せる環境や関わりを整えることが大切だと感じた。",
    nextAction: "同じ遊びの中で、保育者がどのタイミングで声をかけるか観察したい。",
    draft: "崩れた場面だけで終わらせず、A児が何を試し直したのか、B児の関わりで遊びがどう変わったのかを追記すると、学びが見えやすくなります。",
    question: "A児が試し直す前後で、周囲の環境や保育者の関わりはどう変わっていましたか。",
    nextFocus: "明日は、崩れた直後の表情、周囲の反応、保育者の声かけのタイミングを分けて見る。",
    teacherNote: "挑戦を続ける姿を、できた/できないではなく試行錯誤として記録できているか確認する。",
    teacherCheckpoints: ["試し直した過程が書けているか", "友だちの関わりを結果ではなく変化として見ているか"],
  },
  {
    id: "meal",
    studentName: "学生B",
    title: "食事場面",
    description: "子どもの気持ちを決めつけず、見た行動から考える場面",
    goalReflection: "食事場面で子どもの様子を観察する目標だった。食べた量だけでなく、皿の置き方や保育者の声かけへの反応を見る必要があると分かった。",
    episodes: [
      {
        title: "エピソード1",
        body: "昼食でB児が野菜を皿の端に寄せ、保育者が小さく切って声をかけた。",
        insight: "嫌いだから食べないと決めつけず、量や声かけで反応が変わるか見たい。",
      },
      {
        title: "エピソード2",
        body: "保育者が一口分を示すと、B児は少し手を伸ばしたが、すぐには口に入れなかった。",
        insight: "食べるかどうかだけでなく、選ぼうとする途中の姿も記録したい。",
      },
    ],
    guidance: "実習先の指導者から「食べた量だけでなく、関わりの前後を見よう」と言われた。",
    overallLearning: "保育者は、食べた結果だけで判断せず、子どもが安心して試せる声かけや量の調整を考えることが大切だと感じた。",
    nextAction: "声かけの言葉と、B児が自分で選ぶ場面があるかを観察したい。",
    draft: "「苦手そう」と書く場合は、見た行動を根拠に戻します。皿の端に寄せたこと、声かけ後に手を伸ばしたことを並べると、決めつけを避けられます。",
    question: "B児の反応は、野菜そのもの、量、保育者の声かけのどれと関係していそうですか。",
    nextFocus: "明日は、食べる/食べないの結果だけでなく、声かけ前後の表情と手の動きを見る。",
    teacherNote: "子どもの好き嫌いを断定せず、環境や関わり方に目を向けられているか確認する。",
    teacherCheckpoints: ["食べた量だけで判断していないか", "声かけ前後の姿を根拠にしているか"],
  },
  {
    id: "conflict",
    studentName: "学生C",
    title: "友だちとのやりとり",
    description: "一方だけを決めつけず、関係の変化を観察する場面",
    goalReflection: "友だちとの関わりを見る目標だった。玩具をめぐるやりとりで、どちらが悪いかではなく、言葉や表情の変化を見る必要があると感じた。",
    episodes: [
      {
        title: "エピソード1",
        body: "C児とD児が同じ玩具を使いたがり、D児がC児の持っていた玩具に手を伸ばした。",
        insight: "どちらが悪いかではなく、言葉が出る前の表情や保育者の間に入るタイミングを見たい。",
      },
      {
        title: "エピソード2",
        body: "保育者がすぐに止めずに近くで見守ると、C児が玩具を少し横にずらした。",
        insight: "保育者が待つことで、子ども同士のやりとりが続く場面があった。",
      },
    ],
    guidance: "実習先の指導者から「けんかではなく、関わり方を学ぶ場面として見よう」と言われた。",
    overallLearning: "保育者は、すぐに正解を示すだけでなく、子どもが自分の思いを出せる時間を見極めることが大切だと感じた。",
    nextAction: "似た場面で子ども同士がどう伝えるか、保育者がどこまで待つかを観察したい。",
    draft: "トラブルとしてまとめるより、手を伸ばした、横にずらした、保育者が見守ったという行動の順番を残すと、関係の変化を考察しやすくなります。",
    question: "玩具をめぐるやりとりの中で、子ども同士が自分の思いを伝えようとした瞬間はありましたか。",
    nextFocus: "明日は、保育者が入る前に子ども同士が見せる表情、言葉、手の動きを見る。",
    teacherNote: "トラブルと決めつけず、子どもの関わり方の変化として扱えているか確認する。",
    teacherCheckpoints: ["どちらが悪いかの記録になっていないか", "保育者が待った意味を観察に戻せているか"],
  },
];

const safetyChecks = [
  {
    title: "個人が分かるかも",
    body: "実名、園名、住所、電話番号のように特定につながる情報は、記録前に置き換える。",
  },
  {
    title: "記録前の確認",
    body: "気持ちや家庭事情を断定していないか、見た行動と言える範囲に戻す。",
  },
  {
    title: "別の言い方",
    body: "「わがまま」ではなく「同じ玩具を使いたがった」のように、観察した事実へ寄せる。",
  },
];

const teacherRows = [
  ["授業共有", "記録が結果だけになりやすい", "過程、環境、保育者の関わりに戻す"],
  ["授業共有", "気持ちを断定しやすい", "見た行動と言える範囲を分ける"],
  ["学生本人", "翌日に見る点が弱い", "次に見る場面を一つに絞る"],
];

export function DemoServiceExperience() {
  const [activeSceneId, setActiveSceneId] = useState(sampleScenes[0].id);
  const [mode, setMode] = useState("student");
  const [showReflection, setShowReflection] = useState(true);
  const activeScene = useMemo(
    () => sampleScenes.find((scene) => scene.id === activeSceneId) || sampleScenes[0],
    [activeSceneId],
  );

  return (
    <section className="detail-section demo-product-shell" id="service-demo" aria-labelledby="service-demo-heading">
      <div className="detail-section-head">
        <span className="site-kicker">サービス画面</span>
        <h2 id="service-demo-heading">学生画面と教員画面を切り替えて触る</h2>
        <p>
          下の画面は、Manalioの実際の利用場面に近い形で動くデモです。
          場面を選ぶと、学校フォーマットの記入、安全な表現確認、整理案との比較、教員側の確認候補が連動します。
          架空データだけを使い、外部AI APIや学校データ保存は行いません。
        </p>
        <div className="detail-link-row demo-service-links">
          <a className="site-primary" href="/demo/student">学生画面を開く</a>
          <a className="site-secondary" href="/demo/teacher">教員画面を開く</a>
        </div>
      </div>

      <div className="demo-app-frame">
        <div className="demo-app-toolbar">
          <div>
            <span className="label">Manalio</span>
            <strong>{mode === "student" ? "学生画面" : "教員画面"}</strong>
          </div>
          <div className="demo-role-switch" role="group" aria-label="表示する画面">
            <button type="button" className={mode === "student" ? "active" : ""} aria-pressed={mode === "student"} onClick={() => setMode("student")}>
              学生
            </button>
            <button type="button" className={mode === "teacher" ? "active" : ""} aria-pressed={mode === "teacher"} onClick={() => setMode("teacher")}>
              教員
            </button>
          </div>
        </div>

        <div className="demo-scene-list" aria-label="場面を選ぶ">
          {sampleScenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              className={scene.id === activeSceneId ? "active" : ""}
              aria-pressed={scene.id === activeSceneId}
              onClick={() => {
                setActiveSceneId(scene.id);
                setShowReflection(true);
              }}
            >
              <strong>{scene.title}</strong>
              <span>{scene.description}</span>
            </button>
          ))}
        </div>

        {mode === "student" ? (
          <div className="demo-workspace" aria-label="学生画面デモ">
            <div className="demo-student-format">
              <label>
                その日の実習目標に対する振り返り
                <textarea readOnly value={activeScene.goalReflection} />
              </label>
              <div className="demo-episode-stack">
                {activeScene.episodes.map((episode) => (
                  <article key={episode.title}>
                    <span>{episode.title}</span>
                    <p>{episode.body}</p>
                    <em>{episode.insight}</em>
                  </article>
                ))}
              </div>
              <label>
                保育者として大切にしなければならないことの気づき
                <textarea readOnly value={activeScene.overallLearning} />
              </label>
              <label>
                次の日取り組みたいこと
                <textarea readOnly value={activeScene.nextAction} />
              </label>
            </div>

            <div className="demo-side-panel">
              <div className="demo-panel-head">
                <span>整理案と比較</span>
                <button type="button" onClick={() => setShowReflection((current) => !current)}>
                  {showReflection ? "比較を隠す" : "比較を見る"}
                </button>
              </div>
              <div className="demo-safety-list">
                {safetyChecks.map((item) => (
                  <article key={item.title}>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
              {showReflection && (
                <div className="demo-comparison-panel">
                  <article>
                    <span>元の記録</span>
                    <strong>{activeScene.episodes[0].body}</strong>
                    <p>{activeScene.overallLearning}</p>
                  </article>
                  <article>
                    <span>整理案</span>
                    <strong>{activeScene.draft}</strong>
                    <p>{activeScene.question}</p>
                  </article>
                  <div className="demo-question-panel">
                    <span>翌日の観察</span>
                    <strong>{activeScene.nextFocus}</strong>
                    <p>学生が元の記録と見比べ、自分の言葉で整えるための材料です。</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="demo-teacher-board" aria-label="教員画面デモ">
            <div className="demo-teacher-students" aria-label="学生一覧">
              {sampleScenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  className={scene.id === activeSceneId ? "active" : ""}
                  aria-pressed={scene.id === activeSceneId}
                  onClick={() => setActiveSceneId(scene.id)}
                >
                  <strong>{scene.studentName}</strong>
                  <span>{scene.title}</span>
                  <small>{scene.nextFocus}</small>
                </button>
              ))}
            </div>
            <div className="demo-teacher-detail">
              <div className="demo-teacher-summary">
                <span>個人チェックポイント</span>
                <strong>{activeScene.studentName} / {activeScene.title}</strong>
                <p>{activeScene.teacherNote}</p>
              </div>
              <div className="demo-teacher-process">
                {["記録", "安全確認", "問い返し", "実習後確認"].map((step, index) => (
                  <article key={step}>
                    <span>{step}</span>
                    <strong>{index === 0 ? "入力済み" : index === 1 ? "確認済み" : index === 2 ? "問いあり" : "確認材料"}</strong>
                  </article>
                ))}
              </div>
              <div className="demo-teacher-checkpoints">
                {activeScene.teacherCheckpoints.map((item) => (
                  <article key={item}>
                    <span>確認</span>
                    <p>{item}</p>
                  </article>
                ))}
              </div>
              <div className="demo-teacher-table">
                {teacherRows.map(([label, title, body]) => (
                  <article key={`${label}-${title}`}>
                    <span>{label}</span>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
