import { AuthForm } from "@/components/auth-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="space-y-4">
        <AuthForm mode="login" />
        <p className="text-center text-sm text-muted-foreground">
          アカウントをお持ちでない方は{" "}
          <Link href="/auth/signup" className="underline">
            新規登録
          </Link>
        </p>
      </div>
    </div>
  );
}
