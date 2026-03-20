"use client";

import { Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function SpError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  const tc = useTranslations("common");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <div className="flex gap-3">
        <Button size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          {tc("retry")}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/sp/home">
            <Home className="h-4 w-4" />
            {tc("returnHome")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
