"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { MSG } from "@/lib/messages";

export function GuestButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGuest() {
    setLoading(true);
    try {
      const result = await authClient.signIn.anonymous();
      if (result.error) {
        toast.error(MSG.AUTH_GUEST_FAILED);
        return;
      }
      toast.success(MSG.AUTH_GUEST_STARTED);
      router.push("/home");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" className="h-11 w-full" onClick={handleGuest} disabled={loading}>
      {loading ? "作成中..." : "ゲストで試す"}
    </Button>
  );
}
