# パスワードリセット設計

Date: 2026-03-03

## 概要

メールアドレスを任意で設定できるようにし、設定済みのユーザーはセルフサービスでパスワードをリセットできるようにする。未設定のユーザーは管理者が一時パスワードを発行する。

## ゴール

- 設定ページでメールアドレスを任意登録できる（確認メール付き）
- メール登録済みのユーザーはログイン画面から自分でパスワードをリセットできる
- メール未登録のユーザーは管理者ダッシュボードから一時パスワードを発行できる

## 対象外

- サインアップ時のメールアドレス収集（既存フローを変更しない）
- メール認証を必須にすること（任意設定のまま）

---

## メール送信基盤

**サービス:** Gmail SMTP（Nodemailer）

独自ドメイン不要。sugara 専用の Google アカウントを作成し、App パスワードを発行して使用する。

**事前準備:**
1. sugara 用 Google アカウントを作成（例: `sugara.app@gmail.com`）
2. Google アカウントの「セキュリティ」→「2段階認証」を有効化
3. 「アプリ パスワード」を発行（16文字のパスワード）

**新規環境変数（ローカル `.env.local` と Vercel に追加）:**

| 変数名 | 用途 |
|--------|------|
| `GMAIL_USER` | sugara 用 Gmail アドレス |
| `GMAIL_APP_PASSWORD` | Google アプリ パスワード（16文字、スペース除去して設定） |

**Better Auth の設定変更（`apps/api/src/lib/auth.ts`）:**

```ts
import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// emailAndPassword に追加
sendResetPassword: async ({ user, url }) => {
  await transporter.sendMail({
    from: `"sugara" <${process.env.GMAIL_USER}>`,
    to: user.email,
    subject: "【sugara】パスワードのリセット",
    html: `<p><a href="${url}">こちらをクリックしてパスワードをリセット</a></p>`,
  })
},

// Better Auth 本体設定に追加（メールアドレス変更検証用）
sendVerificationEmail: async ({ user, url }) => {
  await transporter.sendMail({
    from: `"sugara" <${process.env.GMAIL_USER}>`,
    to: user.email,
    subject: "【sugara】メールアドレスの確認",
    html: `<p><a href="${url}">こちらをクリックしてメールアドレスを確認</a></p>`,
  })
},
```

---

## 設定ページ — メールアドレス登録

**変更ファイル:**
- `apps/web/app/(authenticated)/settings/page.tsx`（EmailSection を追加）
- `apps/web/components/email-section.tsx`（新規作成）

### 表示ロジック

- `users.email` が `@sugara.local` で終わる → 「未設定」と表示
- それ以外かつ `emailVerified = true` → マスクして表示（`m***@gmail.com`）
- それ以外かつ `emailVerified = false` → マスク表示 + 「未確認」バッジ

### 動作フロー

```
ユーザーが新しいメールアドレスを入力 → 送信
  → authClient.changeEmail({ newEmail, callbackURL: "/settings?verified=1" })
  → Resend で確認メールを送信
  → users.email が新しいアドレスに更新、emailVerified = true に
  → "/settings?verified=1" にリダイレクト
  → 「メールアドレスを設定しました」トースト表示
```

---

## パスワードリセットフロー

### ページ構成

| ページ | パス |
|--------|------|
| パスワードを忘れた方 | `/forgot-password` |
| 新しいパスワードの設定 | `/reset-password` |

### `/forgot-password`

- メールアドレス入力欄
- `authClient.forgetPassword({ email, redirectTo: "/reset-password" })` を呼ぶ
- 送信後は常に「送信しました。メールをご確認ください。」と表示（メール未登録・存在しないアドレスでも同じ文言 — email enumeration 防止）
- 「メールアドレスを設定していない場合は管理者にお問い合わせください」の補足テキストを表示

### `/reset-password`

- URL の `?token=xxx` を読み取る
- 新しいパスワード + 確認用パスワード入力
- `authClient.resetPassword({ newPassword, token })` を呼ぶ
- トークン無効・期限切れの場合はエラーメッセージを表示し `/forgot-password` へのリンクを出す
- 成功時はログインページへリダイレクト

### ログインページへの追記

`apps/web/app/(auth)/login/page.tsx` のフォーム下部に「パスワードを忘れた方 →」リンクを追加。

---

## 管理者による一時パスワード発行

### 新規 API エンドポイント

```
POST /api/admin/users/:userId/temp-password
```

- `requireAuth` + `requireAdmin` で保護
- ランダムな 12 文字（英数字）の一時パスワードを生成
- Better Auth の内部でハッシュ化して `users.password` を更新
- レスポンスで一時パスワードを返す（一度のみ）

### 管理者ダッシュボードの変更

`apps/web/app/admin/page.tsx` にユーザー一覧テーブルを追加:

| カラム | 内容 |
|--------|------|
| ユーザー名 | `users.username` |
| 登録日 | `users.createdAt` |
| メール | 設定済み / 未設定 |
| 操作 | 「一時PW発行」ボタン |

**「一時PW発行」ボタンの動作:**

```
クリック
  → POST /api/admin/users/:userId/temp-password
  → モーダルに一時パスワードを表示（コピーボタン付き）
  → 「このパスワードは一度しか表示されません」と警告
  → 管理者がユーザーにパスワードを別途伝える
```

---

## データモデルの変更

schema.ts の変更は不要。

- `users.email` — Better Auth の `changeEmail` が更新する
- `users.emailVerified` — 確認後に `true` に更新される
- `verifications` テーブル — Better Auth がトークン管理に使用（既存）

---

## テスト方針

- `POST /api/admin/users/:userId/temp-password`: 非管理者なら 403 を返すこと（ユニットテスト）
- 一時パスワードが 12 文字の英数字であること（ユニットテスト）
- メールが `@sugara.local` の場合、EmailSection が「未設定」と表示すること（ユニットテスト）
- `/reset-password` でトークンが無効な場合にエラーメッセージが表示されること（ユニットテスト）

---

## FAQ 更新（`apps/api/src/db/seed-faqs.ts`）

実装完了後に追加するエントリ:

- パスワードを忘れた場合の手順（メール登録済み / 未登録で分岐して説明）
- メールアドレスの設定方法
- 確認メールが届かない場合の対処法
