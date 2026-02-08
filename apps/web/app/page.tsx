import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold tracking-tight">tabi</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        あなたの旅を、もっと自由に
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/auth/login"
          className="rounded-md bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90"
        >
          ログイン
        </Link>
        <Link
          href="/auth/signup"
          className="rounded-md border border-input px-6 py-3 hover:bg-accent"
        >
          新規登録
        </Link>
      </div>
    </div>
  );
}
