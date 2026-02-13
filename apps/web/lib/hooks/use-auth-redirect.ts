import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ApiError } from "@/lib/api";

/**
 * Redirect to login page when a query fails with 401.
 */
export function useAuthRedirect(error: Error | null) {
  const router = useRouter();
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      router.push("/auth/login");
    }
  }, [error, router]);
}
