import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ApiError } from "@/lib/api";

/**
 * Redirect to login page when a query fails with 401.
 * Uses a ref guard to prevent multiple redirects from concurrent errors.
 */
export function useAuthRedirect(error: Error | null) {
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401 && !redirected.current) {
      redirected.current = true;
      router.push("/auth/login");
    }
  }, [error, router]);
}
