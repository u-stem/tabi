import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold tracking-tight">tabi</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Plan your perfect trip
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/auth/login"
          className="rounded-md bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90"
        >
          Login
        </Link>
        <Link
          href="/auth/signup"
          className="rounded-md border border-input px-6 py-3 hover:bg-accent"
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
}
