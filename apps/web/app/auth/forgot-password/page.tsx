"use client"

import Link from "next/link"
import { useState } from "react"
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
      await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/auth/reset-password",
      })
    } catch {
      // Show success regardless to prevent email enumeration
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
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !email.trim()}
              >
                {loading ? "送信中..." : "送信する"}
              </Button>
            </form>
          )}

          <p className="text-center text-xs text-muted-foreground">
            メールアドレスを設定していない場合は管理者にお問い合わせください。
          </p>

          <div className="text-center">
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground hover:underline"
            >
              ログインに戻る
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
