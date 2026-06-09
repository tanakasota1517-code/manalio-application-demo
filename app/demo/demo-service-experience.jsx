"use client";

import { useMemo, useState } from "react";

const sampleScenes = [
  {
    id: "blocks",
    title: "ブロック遊び",
    description: "試し直す姿を、結果ではなく過程として見る場面",
    observation: "A児がブロックを高く積み、崩れたあとも別の形を試していた。",
    reflection: "失敗しても続けた理由を、周囲の声かけや素材の置き方と合わせて見たい。",
    guidance: "実習先の指導者から「結果だけでなく、試す過程を見て記録するとよい」と言われた。",
    tomorrow: "同じ遊びの中で、保育者がどのタイミングで声をかけるか観察したい。",
    question: "A児が試し直す前後で、周囲の環境や保育者の関わりはどう変わっていましたか。",
    nextFocus: "明日は、崩れた直後の表情、周囲の反応、保育者の声かけのタイミングを分けて見る。",
    teacherNote: "挑戦を続ける姿を、できた/できないではなく試行錯誤として記録できているか確認する。",
  },
  {
    id: "meal",
    title: "食事場面",
    description: "子どもの気持ちを決めつけず、見た行動から考える場面",
    observation: "昼食でB児が苦手そうな野菜を皿の端に寄せ、保育者が小さく切って声をかけた。",
    reflection: "嫌いだから食べないと決めつけず、量や声かけで反応が変わるか見たい。",
    guidance: "実習先の指導者から「食べた量だけでなく、関わりの前後を見よう」と言われた。",
    tomorrow: "声かけの言葉と、B児が自分で選ぶ場面があるかを観察したい。",
    question: "B児の反応は、野菜そのもの、量、保育者の声かけのどれと関係していそうですか。",
    nextFocus: "明日は、食べる/食べないの結果だけでなく、声かけ前後の表情と手の動きを見る。",
    teacherNote: "子どもの好き嫌いを断定せず、環境や関わり方に目を向けられているか確認する。",
  },
  {
    id: "conflict",
    title: "友だちとのやりとり",
    description: "一方だけを評価せず、関係の変化を観察する場面",
    observation: "C児とD児が同じ玩具を使いたがり、C児が先に持っていた玩具をD児が取ろうとした。",
    reflection: "どちらが悪いかではなく、言葉が出る前の表情や保育者の間に入るタイミングを見たい。",
    guidance: "実習先の指導者から「けんかではなく、関わり方を学ぶ場面として見よう」と言われた。",
    tomorrow: "似た場面で子ども同士がどう伝えるか、保育者がどこまで待つかを観察したい。",
    question: "玩具をめぐるやりとりの中で、子ども同士が自分の思いを伝えようとした瞬間はありましたか。",
    nextFocus: "明日は、保育者が入る前に子ども同士が見せる表情、言葉、手の動きを見る。",
    teacherNote: "トラブルを評価語でまとめず、子どもの関わり方の変化として扱えているか確認する。",
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
  ["当日確認", "個別に早めに声をかけたい候補", "子どもの気持ちを断定していないか"],
  ["授業共有", "クラス全体で扱いやすい傾向", "実習先の助言を翌日の観察へ戻せているか"],
  ["学生本人", "提出前の自己確認として返せる項目", "結果ではなく過程を観察できているか"],
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
          場面を選ぶと、入力、提出前の気づき、問い返し、教員側の確認候補が連動します。
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
            <button type="button" className={mode === "student" ? "active" : ""} onClick={() => setMode("student")}>
              学生
            </button>
            <button type="button" className={mode === "teacher" ? "active" : ""} onClick={() => setMode("teacher")}>
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
            <div className="demo-student-inputs">
              <label>
                見たこと
                <textarea readOnly value={activeScene.observation} />
              </label>
              <label>
                自分で考えたこと
                <textarea readOnly value={activeScene.reflection} />
              </label>
              <label>
                実習先で受けた助言
                <textarea readOnly value={activeScene.guidance} />
              </label>
              <label>
                明日見たいこと
                <textarea readOnly value={activeScene.tomorrow} />
              </label>
            </div>

            <div className="demo-side-panel">
              <div className="demo-panel-head">
                <span>提出前の気づき</span>
                <button type="button" onClick={() => setShowReflection((current) => !current)}>
                  {showReflection ? "問い返しを隠す" : "問い返しを見る"}
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
                <div className="demo-question-panel">
                  <span>問い返し</span>
                  <strong>{activeScene.question}</strong>
                  <p>{activeScene.nextFocus}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="demo-teacher-board" aria-label="教員画面デモ">
            <div className="demo-teacher-summary">
              <span>確認候補</span>
              <strong>{activeScene.title}</strong>
              <p>{activeScene.teacherNote}</p>
            </div>
            <div className="demo-teacher-table">
              {teacherRows.map(([label, title, body]) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
