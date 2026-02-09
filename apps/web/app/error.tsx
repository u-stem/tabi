"use client";

import { Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">エラーが発生しました</h1>
      <p className="text-muted-foreground">
        予期しないエラーが発生しました。もう一度お試しください。
      </p>
      <div className="flex gap-4">
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          再試行
        </Button>
        <Button variant="outline" asChild>
          <Link href="/home">
            <Home className="h-4 w-4" />
            ホームに戻る
          </Link>
        </Button>
      </div>
    </div>
  );
}
