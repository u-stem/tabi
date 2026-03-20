import { WifiOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/lib/constants";

export async function generateMetadata() {
  const t = await getTranslations("error");
  return {
    title: pageTitle(t("offlineTitle")),
  };
}

export default async function OfflinePage() {
  const tc = await getTranslations("common");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <WifiOff className="h-10 w-10 text-muted-foreground" />
      <p className="text-lg font-medium">{tc("offline")}</p>
      <p className="text-sm text-muted-foreground">{tc("offlineRetry")}</p>
    </div>
  );
}
