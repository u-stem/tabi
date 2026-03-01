import { getAppSettings } from "@sugara/api/lib/app-settings";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SignupForm } from "@/components/signup-form";
import { Button } from "@/components/ui/button";
import { MSG } from "@/lib/messages";

export default async function SignupPage() {
  const { signupEnabled } = await getAppSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-0 sm:px-4">
        {signupEnabled ? (
          <SignupForm />
        ) : (
          <div className="w-full max-w-md space-y-4 px-4 text-center">
            <h1 className="text-2xl font-bold">新規登録</h1>
            <p className="text-muted-foreground">{MSG.AUTH_SIGNUP_DISABLED_DETAIL}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/login">ログインはこちら</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
