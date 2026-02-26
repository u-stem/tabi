import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = {
  title: pageTitle("オフライン"),
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <WifiOff className="h-10 w-10 text-muted-foreground" />
      <p className="text-lg font-medium">オフラインです</p>
      <p className="text-sm text-muted-foreground">
        インターネット接続を確認してから再度お試しください
      </p>
    </div>
  );
}
