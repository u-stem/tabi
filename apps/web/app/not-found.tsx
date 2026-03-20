import { Home } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFoundPage() {
  const t = await getTranslations("error");
  const tc = await getTranslations("common");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">{t("notFound")}</p>
      <Button asChild>
        <Link href="/home">
          <Home className="h-4 w-4" />
          {tc("returnHome")}
        </Link>
      </Button>
    </div>
  );
}
