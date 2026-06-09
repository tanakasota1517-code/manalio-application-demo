"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const demoProfiles = {
  teacher: {
    role: "teacher",
    roleLabel: "教員",
    name: "実習担当教員",
    email: "teacher@example.ac.jp",
  },
  student: {
    role: "student",
    roleLabel: "学生",
    name: "実習生",
    email: "student@example.ac.jp",
  },
};

const APP_LOCAL_STORAGE_KEYS = [
  "manabi-session",
  "manabi-demo-session",
  "manabi-diary-feedback",
  "manabi-generation-logs",
  "manabi-practice-pass-demo",
];
const SHOW_DEMO_SHORTCUTS = process.env.NEXT_PUBLIC_MANABI_SHOW_DEMO_SHORTCUTS === "true";

function clearAppLocalStorage() {
  try {
    for (const key of APP_LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("manabi-diary-usage-")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // localStorage may be unavailable in hardened browser settings.
  }
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [authConfigured, setAuthConfigured] = useState(null);
  const [publicSignup, setPublicSignup] = useState(false);
  const [demoLoginAllowed, setDemoLoginAllowed] = useState(false);
  const [mode, setMode] = useState("signIn");
  const [schoolName, setSchoolName] = useState("さくら保育者養成校");
  const [className, setClassName] = useState("保育実習I / 2年A組");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [status, setStatus] = useState("ログイン状態を確認しています。");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const response = await fetch("/api/auth", { cache: "no-store" });
        const body = await response.json();
        if (cancelled) return;
        setAuthConfigured(Boolean(body.configured));
        setPublicSignup(Boolean(body.publicSignup));
        setDemoLoginAllowed(!body.configured && SHOW_DEMO_SHORTCUTS);
        if (body.configured && !body.publicSignup) {
          setMode("signIn");
        }
        if (body.session) {
          clearAppLocalStorage();
          router.replace("/app");
          return;
        }
        setStatus(body.configured ? body.publicSignup ? "学校アカウントでログイン・新規登録できます。" : "学校アカウントでログインできます。新規登録は学校管理者の招待が必要です。" : "ログイン環境を確認できません。学校管理者にお問い合わせください。");
      } catch {
        if (!cancelled) {
          setAuthConfigured(false);
          setDemoLoginAllowed(false);
          setStatus("ログイン状態を確認できませんでした。管理者にお問い合わせください。");
        }
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function saveDemoSession(session) {
    clearAppLocalStorage();
    return safeSetLocalStorage("manabi-demo-session", JSON.stringify(session));
  }

  function loginAs(selectedRole = role) {
    const profile = demoProfiles[selectedRole];
    const session = {
      source: "demo",
      ...profile,
      email: email || profile.email,
      schoolName,
      className,
      signedInAt: new Date().toISOString(),
    };
    if (!saveDemoSession(session)) {
      setStatus("ブラウザの保存設定により、サービス画面を開けませんでした。学校アカウントでのログインを試してください。");
      return;
    }
    router.push("/app");
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    if (!authConfigured) {
      if (demoLoginAllowed) {
        loginAs(role);
      } else {
        setStatus("ログイン環境を確認できないため、デモセッションでは開けません。学校アカウントの設定を確認してください。");
      }
      return;
    }

    setBusy(true);
    setStatus(mode === "signUp" ? "アカウントを作成しています。" : "ログインしています。");

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email,
          password,
          role,
          name,
          schoolName,
          className,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || "ログインに失敗しました。");
      }
      if (body.needsConfirmation) {
        setStatus(body.message || "確認メールを送信しました。メール認証後にログインしてください。");
        return;
      }
      if (!body.session) {
        throw new Error("セッションを取得できませんでした。");
      }

      clearAppLocalStorage();
      router.push("/app");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  const showSetupFields = demoLoginAllowed || (publicSignup && mode === "signUp");

  return (
    <main id="main-content" className="login-shell">
      <section className="login-card" aria-label="Manalioログイン">
        <a className="lp-brand login-brand" href="/">
          <img className="login-logo-horizontal" src="/images/manalio-logo-horizontal.svg" alt="Manalio" />
        </a>

        <div className="login-copy">
          <span className="lp-eyebrow">学校アカウント</span>
          <h1>学校アカウントでログイン</h1>
          <p>{authConfigured ? "学校から案内されたメールアドレスとパスワードでログインしてください。" : demoLoginAllowed ? "学校・役割を選んでサービス画面に入れます。" : "学校アカウントの設定を確認しています。"}</p>
        </div>

        {authConfigured && publicSignup && (
          <div className="mode-switch login-mode-switch" role="group" aria-label="ログイン種別">
            {[
              ["signIn", "ログイン"],
              ["signUp", "新規登録"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`mode ${mode === value ? "active" : ""}`}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <form className="login-form" onSubmit={handleAuthSubmit}>
          {showSetupFields && (
            <>
              <label>
                学校名
                <input value={schoolName} autoComplete="organization" onChange={(event) => setSchoolName(event.target.value)} />
              </label>
              <label>
                クラス・実習科目
                <input value={className} onChange={(event) => setClassName(event.target.value)} />
              </label>
              <label>
                表示名
                <input value={name} autoComplete="name" placeholder="例：実習生A" onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                役割
                <select value={role} onChange={(event) => setRole(event.target.value)}>
                  <option value="teacher">教員</option>
                  <option value="student">学生</option>
                </select>
              </label>
            </>
          )}
          <label>
            メールアドレス
            <input type="email" value={email} autoComplete="username" placeholder="name@example.ac.jp" onChange={(event) => setEmail(event.target.value)} />
          </label>
          {authConfigured && (
            <label>
              パスワード
              <input type="password" value={password} autoComplete={mode === "signUp" ? "new-password" : "current-password"} placeholder="8文字以上" onChange={(event) => setPassword(event.target.value)} />
            </label>
          )}
          <button className="primary-button" type="submit" disabled={busy || authConfigured === null || (!authConfigured && !demoLoginAllowed)}>
            {busy ? "処理中..." : authConfigured ? mode === "signUp" ? "アカウント作成" : "ログイン" : "サービス画面を開く"}
          </button>
        </form>

        {SHOW_DEMO_SHORTCUTS && (
          <div className="login-actions">
            <button className="secondary-button login-link" type="button" onClick={() => loginAs("teacher")}>教員として確認</button>
            <button className="secondary-button login-link" type="button" onClick={() => loginAs("student")}>学生として確認</button>
          </div>
        )}

        <div className="login-note">
          <span>状態</span>
          <p>{status}</p>
        </div>
      </section>
    </main>
  );
}
