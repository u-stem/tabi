"use client";

import {
  Download,
  FileText,
  HelpCircle,
  LogOut,
  MessageSquare,
  Monitor,
  Newspaper,
  Settings,
  Shield,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const FeedbackDialog = dynamic(() =>
  import("@/components/feedback-dialog").then((mod) => mod.FeedbackDialog),
);

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { signOut, useSession } from "@/lib/auth-client";
import { isGuestUser } from "@/lib/guest";
import { useInstallPrompt } from "@/lib/hooks/use-install-prompt";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { switchViewMode } from "@/lib/view-mode";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SpUserMenuSheet({ open, onOpenChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const isGuest = isGuestUser(session);

  async function handleSignOut() {
    try {
      await signOut();
      queryClient.clear();
      router.push("/");
    } catch {
      toast.error(MSG.AUTH_LOGOUT_FAILED);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle className="truncate">{session?.user?.name}</SheetTitle>
            <SheetDescription>
              {session?.user?.displayUsername
                ? `@${session.user.displayUsername}`
                : session?.user?.username
                  ? `@${session.user.username}`
                  : ""}
            </SheetDescription>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-1" aria-label="モバイルメニュー">
            {!isGuest && (
              <Link
                href="/sp/settings"
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  pathname === "/sp/settings"
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Settings className="h-4 w-4" />
                設定
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setFeedbackOpen(true);
                onOpenChange(false);
              }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageSquare className="h-4 w-4" />
              フィードバック
            </button>
            {canInstall && (
              <button
                type="button"
                onClick={() => {
                  promptInstall();
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Download className="h-4 w-4" />
                アプリをインストール
              </button>
            )}
            <div className="my-2 border-t" />
            <Link
              href="/faq"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4" />
              よくある質問
            </Link>
            <Link
              href="/news"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Newspaper className="h-4 w-4" />
              お知らせ
            </Link>
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <FileText className="h-4 w-4" />
              利用規約
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Shield className="h-4 w-4" />
              プライバシーポリシー
            </Link>
            <div className="my-2 border-t" />
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                void switchViewMode("desktop");
              }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Monitor className="h-4 w-4" />
              PC版で表示
            </button>
            <button
              type="button"
              onClick={() => {
                handleSignOut();
                onOpenChange(false);
              }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              ログアウト
            </button>
          </nav>
        </SheetContent>
      </Sheet>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
