import { AuthForm } from "@/components/auth-form";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="space-y-4">
        <AuthForm mode="signup" />
        <p className="text-center text-sm text-muted-foreground">
          アカウントをお持ちの方は{" "}
          <Link href="/auth/login" className="underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
