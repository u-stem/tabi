import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Link href="/" className="text-xl font-bold">
          tabi
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <AuthForm mode="signup" />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          アカウントをお持ちの方は{" "}
          <Link
            href="/auth/login"
            className="font-medium text-blue-600 underline underline-offset-4 hover:text-blue-800"
          >
            ログイン
          </Link>
        </p>
      </main>
    </div>
  );
}
