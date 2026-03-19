import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import AdminClient from "./_components/admin-client";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const baseUrl = process.env.BETTER_AUTH_BASE_URL ?? "http://localhost:3000";

  // Server-side admin authorization: non-admin users never receive client code
  try {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 401 || res.status === 403) {
      notFound();
    }
  } catch {
    notFound();
  }

  return <AdminClient />;
}
