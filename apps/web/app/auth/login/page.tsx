import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-0 sm:px-4">
        <AuthForm />
      </main>
    </div>
  );
}
