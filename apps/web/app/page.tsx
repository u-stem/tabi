import { ArrowRight, LogIn } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          計画もまた、旅の楽しみだ。
        </h1>
        <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
          旅行の計画を作成・共有できる共同編集アプリ。
        </p>
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
      </main>

      <footer className="container flex h-14 items-center justify-center gap-4 text-sm text-muted-foreground">
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          利用規約
        </Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          プライバシーポリシー
        </Link>
        <span>sugara</span>
      </footer>
    </div>
  );
}
