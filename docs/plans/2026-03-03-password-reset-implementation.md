# パスワードリセット Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Gmail SMTP を使ったメール送信基盤を構築し、設定ページでメールアドレスを任意登録できるようにした上で、セルフサービスのパスワードリセットフローと管理者による一時パスワード発行機能を実装する。

**Architecture:** Better Auth の `changeEmail`・`forgetPassword`・`resetPassword` 組み込み API を活用し、カスタムコードを最小に抑える。メール未設定ユーザーは管理者ダッシュボードから一時パスワードを発行する。

**Tech Stack:** Nodemailer + Gmail SMTP、Better Auth v1.4.x、Next.js App Router、Hono

---

## 前提確認

**Gmail SMTP の事前準備（実装前に済ませること）:**
1. sugara 用 Google アカウントを作成（例: `sugara.app@gmail.com`）
2. Google アカウントの「セキュリティ」→「2段階認証」を有効化
3. 「アプリ パスワード」を発行（アプリ: メール、デバイス: その他）→ 16文字のパスワードを控える

**環境変数（`.env.local` と Vercel の両方に設定）:**
```
GMAIL_USER=sugara.app@gmail.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx   # スペースなしの16文字
```

---

### Task 1: Nodemailer をインストールし Better Auth にメール送信を設定する

**Files:**
- Modify: `apps/api/package.json`（bun add で自動更新）
- Modify: `apps/api/src/lib/auth.ts`
- Modify: `apps/api/src/lib/env.ts`

**Step 1: パッケージをインストール**

```bash
bun add --filter @sugara/api nodemailer
bun add --filter @sugara/api -d @types/nodemailer
```

期待: `apps/api/package.json` に `nodemailer` が追加される。

**Step 2: env.ts に環境変数を追加**

`apps/api/src/lib/env.ts` の `env` オブジェクトに以下を追加:

```typescript
get GMAIL_USER() {
  return required("GMAIL_USER");
},
get GMAIL_APP_PASSWORD() {
  return required("GMAIL_APP_PASSWORD");
},
```

**Step 3: auth.ts に Nodemailer 初期化とメール送信コールバックを追加**

`apps/api/src/lib/auth.ts` の先頭 import に追加:

```typescript
import nodemailer from "nodemailer"
```

ファイル内（`export const auth = betterAuth({` の直前）に追加:

```typescript
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})
```

既存の `emailAndPassword: { enabled: true }` を以下に差し替え:

```typescript
emailAndPassword: {
  enabled: true,
  sendResetPassword: async ({ user, url }) => {
    await transporter.sendMail({
      from: `"sugara" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: "【sugara】パスワードのリセット",
      html: `
        <p>パスワードリセットのリクエストを受け付けました。</p>
        <p><a href="${url}">こちらをクリックしてパスワードをリセットしてください</a></p>
        <p>このリンクは1時間有効です。リクエストに心当たりがない場合は無視してください。</p>
      `,
    })
  },
},
```

`betterAuth({` の直下（`database:` などと同じレベル）に以下を追加:

```typescript
emailVerification: {
  sendVerificationEmail: async ({ user, url }) => {
    await transporter.sendMail({
      from: `"sugara" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: "【sugara】メールアドレスの確認",
      html: `
        <p>メールアドレスの確認リクエストを受け付けました。</p>
        <p><a href="${url}">こちらをクリックしてメールアドレスを確認してください</a></p>
        <p>このリンクは1時間有効です。</p>
      `,
    })
  },
},
```

**Step 4: 型チェック**

```bash
bun run check-types
```

期待: エラーなし。

**Step 5: commit**

```bash
git add apps/api/src/lib/auth.ts apps/api/src/lib/env.ts apps/api/package.json bun.lockb
git commit -m "feat: Nodemailer を導入し Better Auth にメール送信を設定"
```

---

### Task 2: auth-client にメール関連の API を追加する

**Files:**
- Modify: `apps/web/lib/auth-client.ts`

**Step 1: auth-client.ts を確認する**

現在の `createAuthClient` の plugins に `emailVerificationClient` などが含まれているか確認する。Better Auth v1.4.x では `authClient.changeEmail()` と `authClient.forgetPassword()` はプラグインなしで使えることが多いが、型定義が出ない場合は対応するクライアントプラグインを追加する必要がある。

`apps/web/lib/auth-client.ts` を開き、`authClient` に以下のメソッドが型付きで使えるか確認する:
- `authClient.changeEmail()`
- `authClient.forgetPassword()`
- `authClient.resetPassword()`

Better Auth の型定義でこれらが出ない場合は、`createAuthClient` の import 元を確認し公式ドキュメント通りに追加する。v1.4.x では基本的に `createAuthClient` から自動で使える。

**Step 2: 型チェック**

```bash
bun run check-types
```

期待: エラーなし。メソッドが型エラーになる場合は Better Auth の changelog を確認して対応する。

**Step 3: commit（変更がある場合のみ）**

```bash
git add apps/web/lib/auth-client.ts
git commit -m "feat: auth-client にメール関連メソッドの型定義を追加"
```

---

### Task 3: 設定ページにメールアドレス登録セクションを追加する

**Files:**
- Create: `apps/web/components/email-section.tsx`
- Modify: `apps/web/app/(authenticated)/settings/page.tsx`
- Test: `apps/web/components/email-section.test.tsx`

**Step 1: テストを書く（Red）**

```typescript
// apps/web/components/email-section.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { EmailSection } from "./email-section"

describe("EmailSection", () => {
  it("email が @sugara.local の場合「未設定」と表示する", () => {
    render(<EmailSection currentEmail="alice@sugara.local" emailVerified={false} />)
    expect(screen.getByText("未設定")).toBeInTheDocument()
  })

  it("実アドレスかつ verified=true の場合マスクして表示する", () => {
    render(<EmailSection currentEmail="alice@gmail.com" emailVerified={true} />)
    expect(screen.getByText(/a\*+@gmail\.com/)).toBeInTheDocument()
    expect(screen.queryByText("未確認")).not.toBeInTheDocument()
  })

  it("実アドレスかつ verified=false の場合「未確認」バッジを表示する", () => {
    render(<EmailSection currentEmail="alice@gmail.com" emailVerified={false} />)
    expect(screen.getByText("未確認")).toBeInTheDocument()
  })
})
```

**Step 2: テストの失敗を確認（Red）**

```bash
bun run --filter @sugara/web test
```

期待: FAIL（コンポーネントが存在しないため）。

**Step 3: EmailSection コンポーネントを作成**

```tsx
// apps/web/components/email-section.tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { authClient } from "@/lib/auth-client"
import { MSG } from "@/lib/messages"

type Props = {
  currentEmail: string
  emailVerified: boolean
}

const SUGARA_EMAIL_DOMAIN = "sugara.local"

function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  const masked = local[0] + "*".repeat(Math.max(local.length - 1, 2))
  return `${masked}@${domain}`
}

function isRealEmail(email: string): boolean {
  return !email.endsWith(`@${SUGARA_EMAIL_DOMAIN}`)
}

export function EmailSection({ currentEmail, emailVerified }: Props) {
  const [newEmail, setNewEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const hasRealEmail = isRealEmail(currentEmail)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!newEmail.trim()) return
    if (newEmail === currentEmail) {
      setError("現在のメールアドレスと同じです。")
      return
    }

    setLoading(true)
    try {
      const result = await authClient.changeEmail({
        newEmail: newEmail.trim(),
        callbackURL: "/settings?emailVerified=1",
      })
      if (result.error) {
        setError(result.error.message ?? "メールアドレスの変更に失敗しました。")
        return
      }
      setSent(true)
      setNewEmail("")
    } catch {
      setError("メールアドレスの変更に失敗しました。")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="font-medium">メールアドレス</h3>
        <p className="text-sm text-muted-foreground">
          パスワードリセット時に使用します。
        </p>
      </div>

      <div className="flex items-center gap-2">
        {hasRealEmail ? (
          <>
            <span className="text-sm">{maskEmail(currentEmail)}</span>
            {!emailVerified && (
              <Badge variant="secondary">未確認</Badge>
            )}
          </>
        ) : (
          <span className="text-sm text-muted-foreground">未設定</span>
        )}
      </div>

      {sent ? (
        <p className="text-sm text-green-600">
          確認メールを送信しました。メールのリンクをクリックして設定を完了してください。
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="new-email">
              {hasRealEmail ? "新しいメールアドレス" : "メールアドレスを登録"}
            </Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="example@gmail.com"
              autoComplete="email"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
          <Button type="submit" disabled={loading || !newEmail.trim()}>
            {loading ? "送信中..." : "確認メールを送信"}
          </Button>
        </form>
      )}
    </section>
  )
}
```

**Step 4: 設定ページの account セクションに EmailSection を追加**

`apps/web/app/(authenticated)/settings/page.tsx` の `case "account":` ブロックに追加:

```tsx
// 既存の import に追加
import { EmailSection } from "@/components/email-section"

// case "account": の return 内（UsernameSection の前）に追加
<EmailSection
  currentEmail={user.email ?? ""}
  emailVerified={user.emailVerified ?? false}
/>
```

`useSession()` の user オブジェクトに `email` と `emailVerified` が含まれているか確認する。含まれていない場合は `authClient.getSession()` で取得する。

**Step 5: `/settings?emailVerified=1` のトースト表示**

`apps/web/app/(authenticated)/settings/page.tsx` で `useSearchParams()` を使い、`emailVerified=1` のパラメータがある場合にトーストを表示:

```tsx
// コンポーネント内
const searchParams = useSearchParams()
useEffect(() => {
  if (searchParams.get("emailVerified") === "1") {
    toast.success("メールアドレスを設定しました。")
    // URL からパラメータを消す
    router.replace("/settings")
  }
}, [searchParams, router])
```

**Step 6: テストが通ることを確認（Green）**

```bash
bun run --filter @sugara/web test
```

**Step 7: commit**

```bash
git add apps/web/components/email-section.tsx apps/web/components/email-section.test.tsx apps/web/app/(authenticated)/settings/page.tsx
git commit -m "feat: 設定ページにメールアドレス登録セクションを追加"
```

---

### Task 4: /forgot-password ページを作成する

**Files:**
- Create: `apps/web/app/auth/forgot-password/page.tsx`
- Modify: `apps/web/components/auth-form.tsx`（「パスワードを忘れた方」リンクを追加）
- Test: `apps/web/app/auth/forgot-password/page.test.tsx`

**Step 1: テストを書く（Red）**

```typescript
// apps/web/app/auth/forgot-password/page.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ForgotPasswordPage from "./page"

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    forgetPassword: vi.fn().mockResolvedValue({ error: null }),
  },
}))

describe("ForgotPasswordPage", () => {
  it("送信後は常に成功メッセージを表示する（メール未登録でも）", async () => {
    render(<ForgotPasswordPage />)
    fireEvent.change(screen.getByLabelText(/メールアドレス/), {
      target: { value: "test@example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: /送信/ }))
    await waitFor(() => {
      expect(screen.getByText(/送信しました/)).toBeInTheDocument()
    })
  })

  it("authClient.forgetPassword が呼ばれる", async () => {
    const { authClient } = await import("@/lib/auth-client")
    render(<ForgotPasswordPage />)
    fireEvent.change(screen.getByLabelText(/メールアドレス/), {
      target: { value: "test@example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: /送信/ }))
    await waitFor(() => {
      expect(authClient.forgetPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        redirectTo: "/auth/reset-password",
      })
    })
  })
})
```

**Step 2: テストの失敗を確認（Red）**

```bash
bun run --filter @sugara/web test
```

**Step 3: /forgot-password ページを作成**

```tsx
// apps/web/app/auth/forgot-password/page.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { authClient } from "@/lib/auth-client"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      await authClient.forgetPassword({
        email: email.trim(),
        redirectTo: "/auth/reset-password",
      })
    } catch {
      // エラーでも成功と同じメッセージを表示（email enumeration 防止）
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">パスワードのリセット</h1>
            <p className="text-sm text-muted-foreground">
              登録済みのメールアドレスを入力してください。
            </p>
          </div>

          {sent ? (
            <div className="space-y-4 rounded-lg border p-4 text-center">
              <p className="text-sm">
                送信しました。メールをご確認ください。
              </p>
              <p className="text-xs text-muted-foreground">
                メールが届かない場合は迷惑メールフォルダをご確認ください。
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  autoComplete="email"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
                {loading ? "送信中..." : "送信する"}
              </Button>
            </form>
          )}

          <p className="text-center text-xs text-muted-foreground">
            メールアドレスを設定していない場合は管理者にお問い合わせください。
          </p>

          <div className="text-center">
            <Link href="/auth/login" className="text-sm text-muted-foreground hover:underline">
              ログインに戻る
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
```

**Step 4: auth-form.tsx に「パスワードを忘れた方」リンクを追加**

`apps/web/components/auth-form.tsx` のパスワードフィールド付近に以下を追加:

```tsx
// パスワード入力欄のラベル行、または送信ボタンの下に追加
<div className="text-right">
  <Link
    href="/auth/forgot-password"
    className="text-xs text-muted-foreground hover:underline"
  >
    パスワードを忘れた方
  </Link>
</div>
```

**Step 5: テストが通ることを確認（Green）**

```bash
bun run --filter @sugara/web test
```

**Step 6: commit**

```bash
git add apps/web/app/auth/forgot-password/page.tsx apps/web/app/auth/forgot-password/page.test.tsx apps/web/components/auth-form.tsx
git commit -m "feat: /forgot-password ページを追加、ログインページにリンクを追加"
```

---

### Task 5: /reset-password ページを作成する

**Files:**
- Create: `apps/web/app/auth/reset-password/page.tsx`
- Test: `apps/web/app/auth/reset-password/page.test.tsx`

**Step 1: テストを書く（Red）**

```typescript
// apps/web/app/auth/reset-password/page.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// useSearchParams をモック（token パラメータ付き）
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("token=valid-token"),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    resetPassword: vi.fn().mockResolvedValue({ error: null }),
  },
}))

describe("ResetPasswordPage", () => {
  it("token がない場合はエラーメッセージを表示する", async () => {
    vi.mocked(require("next/navigation").useSearchParams).mockReturnValue(
      new URLSearchParams("")
    )
    const { default: ResetPasswordPage } = await import("./page")
    render(<ResetPasswordPage />)
    expect(screen.getByText(/無効なリンク/)).toBeInTheDocument()
  })

  it("パスワードが一致しない場合はエラーを表示する", async () => {
    const { default: ResetPasswordPage } = await import("./page")
    render(<ResetPasswordPage />)
    fireEvent.change(screen.getByLabelText(/新しいパスワード/), {
      target: { value: "Password1" },
    })
    fireEvent.change(screen.getByLabelText(/確認用/), {
      target: { value: "Different1" },
    })
    fireEvent.click(screen.getByRole("button", { name: /保存/ }))
    expect(screen.getByText(/一致しません/)).toBeInTheDocument()
  })
})
```

**Step 2: テストの失敗を確認（Red）**

```bash
bun run --filter @sugara/web test
```

**Step 3: /reset-password ページを作成**

```tsx
// apps/web/app/auth/reset-password/page.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { authClient } from "@/lib/auth-client"
import { validatePassword } from "@/lib/constants"
import { toast } from "sonner"

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="space-y-4 text-center">
          <p>無効なリンクです。</p>
          <Link href="/auth/forgot-password" className="text-sm underline">
            パスワードリセットをやり直す
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const { valid, errors } = validatePassword(newPassword)
    if (!valid) {
      setError(`パスワードの要件を満たしていません: ${errors.join("、")}`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません。")
      return
    }

    setLoading(true)
    try {
      const result = await authClient.resetPassword({
        newPassword,
        token: token!,
      })
      if (result.error) {
        if (result.error.status === 400) {
          setError("リンクが無効または期限切れです。もう一度リセットをお試しください。")
        } else {
          setError("パスワードのリセットに失敗しました。")
        }
        return
      }
      toast.success("パスワードを変更しました。")
      router.push("/auth/login")
    } catch {
      setError("パスワードのリセットに失敗しました。")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">新しいパスワードを設定</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">新しいパスワード</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">確認用パスワード</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !newPassword || !confirmPassword}
            >
              {loading ? "保存中..." : "保存する"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
```

**Step 4: テストが通ることを確認（Green）**

```bash
bun run --filter @sugara/web test
```

**Step 5: commit**

```bash
git add apps/web/app/auth/reset-password/page.tsx apps/web/app/auth/reset-password/page.test.tsx
git commit -m "feat: /reset-password ページを追加"
```

---

### Task 6: 管理者 API — ユーザー一覧取得と一時パスワード発行

**Files:**
- Modify: `apps/api/src/routes/admin.ts`
- Test: `apps/api/src/routes/admin.test.ts`（新規または既存に追記）

**Step 1: テストを書く（Red）**

```typescript
// apps/api/src/routes/admin.test.ts に追記
describe("POST /api/admin/users/:userId/temp-password", () => {
  it("非管理者なら 403 を返す", async () => {
    // 一般ユーザーでリクエスト
    const res = await app.request(
      "/api/admin/users/some-user-id/temp-password",
      { method: "POST", headers: authHeaders(regularUser) }
    )
    expect(res.status).toBe(403)
  })

  it("管理者なら一時パスワードを返す", async () => {
    const res = await app.request(
      `/api/admin/users/${targetUser.id}/temp-password`,
      { method: "POST", headers: authHeaders(adminUser) }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tempPassword).toMatch(/^[A-Za-z0-9]{12}$/)
  })

  it("存在しないユーザーなら 404 を返す", async () => {
    const res = await app.request(
      "/api/admin/users/non-existent-id/temp-password",
      { method: "POST", headers: authHeaders(adminUser) }
    )
    expect(res.status).toBe(404)
  })
})

describe("GET /api/admin/users", () => {
  it("非管理者なら 403 を返す", async () => {
    const res = await app.request("/api/admin/users", {
      headers: authHeaders(regularUser),
    })
    expect(res.status).toBe(403)
  })

  it("管理者ならユーザー一覧を返す", async () => {
    const res = await app.request("/api/admin/users", {
      headers: authHeaders(adminUser),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.users)).toBe(true)
    expect(body.users[0]).toMatchObject({
      id: expect.any(String),
      username: expect.any(String),
      hasRealEmail: expect.any(Boolean),
      createdAt: expect.any(String),
    })
  })
})
```

**Step 2: テストの失敗を確認（Red）**

```bash
bun run --filter @sugara/api test
```

**Step 3: admin.ts にエンドポイントを追加**

`apps/api/src/routes/admin.ts` の末尾（他のエンドポイントの後）に以下を追加:

```typescript
import { randomBytes } from "node:crypto"
import { ctx } from "hono/context-storage" // Better Auth のコンテキスト (必要に応じて)

const SUGARA_EMAIL_DOMAIN = "sugara.local"
const TEMP_PASSWORD_LENGTH = 12

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  // 紛らわしい文字(I, l, 0, O, 1)を除いた62文字から生成
  return Array.from(
    { length: TEMP_PASSWORD_LENGTH },
    () => chars[randomBytes(1)[0] % chars.length]
  ).join("")
}

// GET /api/admin/users — ユーザー一覧（管理者専用）
adminRoutes.get("/api/admin/users", requireAuth, requireAdmin, async (c) => {
  const userList = await db
    .select({
      id: users.id,
      username: users.username,
      displayUsername: users.displayUsername,
      email: users.email,
      emailVerified: users.emailVerified,
      isAnonymous: users.isAnonymous,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.isAnonymous, false))
    .orderBy(desc(users.createdAt))

  return c.json({
    users: userList.map((u) => ({
      id: u.id,
      username: u.username ?? u.displayUsername ?? "不明",
      hasRealEmail: !!u.email && !u.email.endsWith(`@${SUGARA_EMAIL_DOMAIN}`),
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
    })),
  })
})

// POST /api/admin/users/:userId/temp-password — 一時パスワード発行
adminRoutes.post(
  "/api/admin/users/:userId/temp-password",
  requireAuth,
  requireAdmin,
  async (c) => {
    const { userId } = c.req.param()

    // ユーザー存在確認
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.isAnonymous, false)))
      .limit(1)

    if (!user) {
      return c.json({ error: "User not found" }, 404)
    }

    const tempPassword = generateTempPassword()

    // Better Auth の内部 API でパスワードを更新
    // auth.api.setPassword は Better Auth v1.x で利用可能
    await auth.api.setUserPassword({
      body: {
        userId,
        newPassword: tempPassword,
      },
    })

    return c.json({ tempPassword })
  }
)
```

**注意:** `auth.api.setUserPassword` が Better Auth v1.4.x に存在しない場合の代替案:

```typescript
// 代替: Drizzle で直接パスワードをハッシュして更新
import { Scrypt } from "oslo/password" // Better Auth が内部で使用するライブラリ
const hashedPassword = await new Scrypt().hash(tempPassword)
await db
  .update(accounts)  // Better Auth の accounts テーブル
  .set({ password: hashedPassword, updatedAt: new Date() })
  .where(
    and(
      eq(accounts.userId, userId),
      eq(accounts.providerId, "credential")
    )
  )
```

Better Auth が実際に使っているパスワードハッシュ方式を `apps/api/src/db/schema.ts` の `accounts` テーブルから確認してから実装すること。

**Step 4: テストが通ることを確認（Green）**

```bash
bun run --filter @sugara/api test
```

**Step 5: commit**

```bash
git add apps/api/src/routes/admin.ts apps/api/src/routes/admin.test.ts
git commit -m "feat: 管理者 API にユーザー一覧と一時パスワード発行を追加"
```

---

### Task 7: 管理者ダッシュボードにユーザー一覧と一時パスワード発行 UI を追加する

**Files:**
- Modify: `apps/web/app/admin/page.tsx`

**Step 1: ユーザー一覧テーブルと発行ダイアログを追加**

`apps/web/app/admin/page.tsx` に以下を追加:

型定義の追加（ファイル上部）:

```typescript
type AdminUser = {
  id: string
  username: string
  hasRealEmail: boolean
  emailVerified: boolean
  createdAt: string
}

type AdminUsersResponse = { users: AdminUser[] }
```

データフェッチの追加（既存の `useQuery` の後）:

```typescript
const { data: usersData } = useQuery({
  queryKey: ["admin", "users"],
  queryFn: () => api<AdminUsersResponse>("/api/admin/users"),
  staleTime: 60 * 1000,
  retry: false,
})
```

一時パスワード発行のロジック:

```typescript
const [tempPasswordInfo, setTempPasswordInfo] = useState<{
  username: string
  tempPassword: string
} | null>(null)

async function handleIssueTempPassword(userId: string, username: string) {
  try {
    const result = await api<{ tempPassword: string }>(
      `/api/admin/users/${userId}/temp-password`,
      { method: "POST" }
    )
    setTempPasswordInfo({ username, tempPassword: result.tempPassword })
  } catch {
    toast.error("一時パスワードの発行に失敗しました。")
  }
}
```

ユーザー一覧テーブルの JSX（既存の StatCard セクションの後に追加）:

```tsx
{/* ユーザー一覧 */}
<section className="space-y-3">
  <h2 className="text-sm font-medium text-muted-foreground">ユーザー一覧</h2>
  <div className="rounded-lg border">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-muted/50">
          <th className="px-4 py-2 text-left font-medium">ユーザー名</th>
          <th className="px-4 py-2 text-left font-medium">登録日</th>
          <th className="px-4 py-2 text-left font-medium">メール</th>
          <th className="px-4 py-2 text-right font-medium">操作</th>
        </tr>
      </thead>
      <tbody>
        {(usersData?.users ?? []).map((u) => (
          <tr key={u.id} className="border-b last:border-0">
            <td className="px-4 py-2">{u.username}</td>
            <td className="px-4 py-2 text-muted-foreground">
              {new Date(u.createdAt).toLocaleDateString("ja-JP")}
            </td>
            <td className="px-4 py-2">
              {u.hasRealEmail ? (
                <Badge variant="secondary">
                  {u.emailVerified ? "設定済み" : "未確認"}
                </Badge>
              ) : (
                <span className="text-muted-foreground">未設定</span>
              )}
            </td>
            <td className="px-4 py-2 text-right">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleIssueTempPassword(u.id, u.username)}
              >
                一時PW発行
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>

{/* 一時パスワードモーダル */}
{tempPasswordInfo && (
  <Dialog open onOpenChange={() => setTempPasswordInfo(null)}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>一時パスワードを発行しました</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {tempPasswordInfo.username} さんの一時パスワードです。
          このパスワードをユーザーに伝えてください。
        </p>
        <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
          <code className="flex-1 font-mono text-lg">
            {tempPasswordInfo.tempPassword}
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(tempPasswordInfo.tempPassword)
              toast.success("コピーしました")
            }}
          >
            コピー
          </Button>
        </div>
        <p className="text-xs text-destructive">
          このパスワードは一度しか表示されません。
        </p>
      </div>
    </DialogContent>
  </Dialog>
)}
```

**Step 2: 型チェック**

```bash
bun run check-types
```

**Step 3: commit**

```bash
git add apps/web/app/admin/page.tsx
git commit -m "feat: 管理者ダッシュボードにユーザー一覧と一時パスワード発行を追加"
```

---

### Task 8: FAQ 更新と全体テスト

**Files:**
- Modify: `apps/api/src/db/seed-faqs.ts`

**Step 1: 全テストを実行**

```bash
bun run test
```

期待: すべて PASS。

**Step 2: 型チェックと lint**

```bash
bun run check-types && bun run check
```

**Step 3: FAQ に追加**

`apps/api/src/db/seed-faqs.ts` に以下のエントリを追加:

```typescript
{
  question: "パスワードを忘れた場合はどうすればいいですか？",
  answer: "メールアドレスを設定済みの場合は、ログイン画面の「パスワードを忘れた方」からリセットできます。メールアドレスを設定していない場合は、管理者にお問い合わせください。",
  category: "account",
},
{
  question: "メールアドレスの設定方法を教えてください",
  answer: "設定ページの「アカウント」タブに「メールアドレス」欄があります。メールアドレスを入力して「確認メールを送信」をクリックし、届いたメールのリンクをクリックすると設定が完了します。",
  category: "account",
},
{
  question: "確認メールが届きません",
  answer: "迷惑メールフォルダをご確認ください。それでも届かない場合は、管理者にお問い合わせください。",
  category: "account",
},
```

**Step 4: FAQ をローカル DB に反映**

```bash
bun run --filter @sugara/api db:seed-faqs
```

**Step 5: 最終コミット**

```bash
git add apps/api/src/db/seed-faqs.ts
git commit -m "feat: パスワードリセット機能の FAQ を追加"
```

---

## 動作確認チェックリスト

実装完了後、以下を手動で確認する:

- [ ] 設定ページ「アカウント」タブに「メールアドレス」欄が表示される
- [ ] ダミーメール（@sugara.local）のユーザーは「未設定」と表示される
- [ ] メールアドレスを入力して送信すると確認メールが届く
- [ ] 確認リンクをクリックすると設定完了のトーストが表示される
- [ ] ログインページに「パスワードを忘れた方」リンクが表示される
- [ ] /forgot-password でメール送信後に「送信しました」メッセージが表示される（存在しないアドレスでも同様）
- [ ] リセットメールが届き、リンクをクリックすると /reset-password に遷移する
- [ ] 新しいパスワードを入力して保存するとログインページに遷移する
- [ ] 管理者ダッシュボードにユーザー一覧が表示される
- [ ] 「一時PW発行」をクリックするとモーダルに一時パスワードが表示される
- [ ] 発行した一時パスワードでログインできる
