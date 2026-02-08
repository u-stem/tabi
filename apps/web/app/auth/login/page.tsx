import { AuthForm } from "@/components/auth-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Link href="/" className="text-xl font-bold">
          tabi
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <AuthForm mode="login" />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          アカウントをお持ちでない方は{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            新規登録
          </Link>
        </p>
      </main>
    </div>
  );
}
