import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SharedFooter() {
  return (
    <footer className="mt-12 border-t bg-muted/30 py-8">
      <div className="container flex max-w-3xl flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium">sugara で旅行を計画する</p>
          <p className="text-xs text-muted-foreground">
            スケジュール管理、リアルタイム共同編集、費用管理など
          </p>
          <Button asChild size="sm" className="mt-2">
            <Link href="/">
              <ArrowRight className="h-3.5 w-3.5" />
              詳しく見る
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <Link href="/faq" className="underline underline-offset-4 hover:text-foreground">
            よくある質問
          </Link>
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
            利用規約
          </Link>
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            プライバシーポリシー
          </Link>
        </div>
      </div>
    </footer>
  );
}
