# Manalio Application GitHub Candidate Export

## 日本語メモ

このフォルダは、応募や外部共有でGitHub URLを補足として出すために、現在の作業リポジトリから公開してよい最小範囲だけを切り出した候補です。

まだGitHub公開、push、権限変更、デプロイ、応募フォーム送信はしていません。

公開前に、この候補フォルダの中で次を実行してください。

    npm install
    npm run check
    npm run audit:secrets
    npm run build

GitHubへ出す時は、新しい公開リポジトリを作り、この候補フォルダの中身だけを移します。現在の作業リポジトリ全体は公開しません。

止める条件:

- `.env.local`、APIキー、Cookie、認証ヘッダーが入っている。
- レビュー用のURL、確認用ログイン、パスワード、送付文が入っている。
- 学校名、教員名、学生情報、子どもの実名、実習先情報が入っている。
- `docs/agent-vault/`、`docs/archive/`、`docs/meeting-notes/`、`obsidian/` が入っている。
- `.next/`、`node_modules/`、`.expo/`、`outputs/` をzipやGitHub Webアップロードで一緒に上げようとしている。
- READMEに、BootCamp向け公開プロトタイプ、実データ入力禁止、日誌代筆ではないことが書かれていない。

ビルド後に `.next/` が作られた場合、gitで公開するなら `.gitignore` で追跡対象外になります。zip化やGitHub Webアップロードを使う場合は、生成物を混ぜないため、候補を作り直してからアップロードしてください。

---

This folder was generated locally for review before creating a separate public GitHub repository.

It has not been published, pushed, deployed, or submitted to any application form.

Before public sharing, run these commands inside this folder:

    npm install
    npm run check
    npm run audit:secrets
    npm run build

Full application, teacher-review, and external-share audits should stay in the source work repository before export. This candidate only keeps the minimal local checks needed to prove that the cutout builds and contains no obvious secrets.

If `npm run build` creates `.next/`, do not upload this folder as a zip or via GitHub Web upload with `.next/` included. Use git so `.gitignore` excludes generated artifacts, or regenerate a fresh candidate before manual upload.

Stop if any internal notes, teacher-review URLs, login credentials, passwords, real school data, `.env.local`, or archived work logs appear.

Generated path: outputs/application-github-candidate-2026-06-09T15-45-52-237Z
