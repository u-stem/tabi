import { getAppSettings } from "@sugara/api/lib/app-settings";
import { ArrowRight, CalendarDays, Gift, LogIn, Receipt, Users, Vote, Zap } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { MSG } from "@/lib/messages";

const FEATURES = [
  {
    icon: CalendarDays,
    title: "スケジュール管理",
    description: "日程ごとにスポットを整理。ドラッグで並べ替えも。",
  },
  {
    icon: Zap,
    title: "リアルタイム共同編集",
    description: "メンバーの変更がリアルタイムに反映。誰がどこを見ているかも分かる。",
  },
  {
    icon: Receipt,
    title: "費用管理・精算",
    description: "費用を記録して自動で割り勘計算。精算チェックで支払い状況も管理。",
  },
  {
    icon: Vote,
    title: "投票",
    description: "日程調整やかんたん投票で意見を集約。リンク共有で外部の人も参加可能。",
  },
  {
    icon: Gift,
    title: "お土産リスト",
    description: "贈り先ごとに買うものを整理。優先度や購入済みの管理も。",
  },
  {
    icon: Users,
    title: "共有・招待",
    description: "メンバー招待やリンク共有で、未登録ユーザーにも旅程を公開。",
  },
] as const;

export default async function HomePage() {
  const { signupEnabled } = await getAppSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo />
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center sm:pt-32 sm:pb-20">
          <h1 className="text-2xl font-bold tracking-tight sm:text-5xl">
            計画もまた、旅の楽しみだ。
          </h1>
          <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
            旅行の計画を作成・共有できる共同編集アプリ。
          </p>
          {signupEnabled ? (
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/auth/signup">
                  <ArrowRight className="h-4 w-4" />
                  新規登録
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/login">
                  <LogIn className="h-4 w-4" />
                  ログイン
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-8 flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">{MSG.AUTH_SIGNUP_DISABLED}</p>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/login">
                  <LogIn className="h-4 w-4" />
                  ログイン
                </Link>
              </Button>
            </div>
          )}
        </section>

        {/* Features */}
        <section className="container max-w-4xl px-4 pb-24 sm:pb-32">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border p-5">
                <div className="flex items-center gap-2">
                  <f.icon className="h-5 w-5 text-muted-foreground" />
                  <h2 className="font-medium">{f.title}</h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="container flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-4 text-sm text-muted-foreground">
        <Link href="/faq" className="underline underline-offset-4 hover:text-foreground">
          よくある質問
        </Link>
        <Link href="/news" className="underline underline-offset-4 hover:text-foreground">
          お知らせ
        </Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          利用規約
        </Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          プライバシーポリシー
        </Link>
      </footer>
    </div>
  );
}
