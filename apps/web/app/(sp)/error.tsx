"use client";

import { Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SpError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold">エラーが発生しました</h1>
      <p className="text-sm text-muted-foreground">
        予期しないエラーが発生しました。もう一度お試しください。
      </p>
      <div className="flex gap-3">
        <Button size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          再試行
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/sp/home">
            <Home className="h-4 w-4" />
            ホームへ
          </Link>
        </Button>
      </div>
    </div>
  );
}
