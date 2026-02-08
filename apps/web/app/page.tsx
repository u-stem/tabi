import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <span className="text-xl font-bold">tabi</span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          あなたの旅を、もっと自由に
        </h1>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          旅行の計画から共有まで、すべてをひとつの場所で。
          スポットを地図上で管理し、旅の全体像を把握しましょう。
        </p>
        <div className="mt-8 flex gap-4">
          <Button asChild size="lg">
            <Link href="/auth/signup">無料で始める</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/login">ログイン</Link>
          </Button>
        </div>
      </main>

      <footer className="container flex h-14 items-center justify-center text-sm text-muted-foreground">
        tabi - 旅行プランナー
      </footer>
    </div>
  );
}
