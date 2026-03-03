"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Download,
  FileText,
  HelpCircle,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Newspaper,
  Settings,
  Shield,
  Sun,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";

const FeedbackDialog = dynamic(() =>
  import("@/components/feedback-dialog").then((mod) => mod.FeedbackDialog),
);

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
  const { theme, setTheme } = useTheme();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
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
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="truncate">{session?.user?.name}</DrawerTitle>
            <DrawerDescription>
              {session?.user?.displayUsername
                ? `@${session.user.displayUsername}`
                : session?.user?.username
                  ? `@${session.user.username}`
                  : ""}
            </DrawerDescription>
          </DrawerHeader>
          <nav className="flex flex-col pb-4" aria-label="モバイルメニュー">
            {!isGuest && (
              <Link
                href="/sp/settings"
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-3 text-sm",
                  pathname === "/sp/settings" ? "bg-accent font-medium" : "hover:bg-accent",
                )}
              >
                <Settings className="h-4 w-4" />
                設定
              </Link>
            )}
            <div className="my-1 border-t" />
            {(
              [
                { value: "light", label: "ライト", icon: Sun },
                { value: "dark", label: "ダーク", icon: Moon },
                { value: "system", label: "システム", icon: Monitor },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-accent",
                  theme === value && "font-medium",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {theme === value && <Check className="ml-auto h-4 w-4" />}
              </button>
            ))}
            <div className="my-1 border-t" />
            <button
              type="button"
              onClick={() => {
                setFeedbackOpen(true);
                onOpenChange(false);
              }}
              className="flex min-h-[44px] items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-accent"
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
                className="flex min-h-[44px] items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-accent"
              >
                <Download className="h-4 w-4" />
                アプリをインストール
              </button>
            )}
            <div className="my-1 border-t" />
            <Link
              href="/faq"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-accent"
            >
              <HelpCircle className="h-4 w-4" />
              よくある質問
            </Link>
            <Link
              href="/news"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-accent"
            >
              <Newspaper className="h-4 w-4" />
              お知らせ
            </Link>
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-accent"
            >
              <FileText className="h-4 w-4" />
              利用規約
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-accent"
            >
              <Shield className="h-4 w-4" />
              プライバシーポリシー
            </Link>
            <div className="my-1 border-t" />
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                void switchViewMode("desktop");
              }}
              className="flex min-h-[44px] items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-accent"
            >
              <Monitor className="h-4 w-4" />
              PC版で表示
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setSignOutOpen(true);
              }}
              className="flex min-h-[44px] items-center gap-3 rounded-md px-3 py-3 text-sm text-destructive hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
              ログアウト
            </button>
          </nav>
        </DrawerContent>
      </Drawer>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <Drawer open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>ログアウトしますか？</DrawerTitle>
            <DrawerDescription>
              このデバイスからサインアウトされます。
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-destructive px-3 py-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              <LogOut className="h-4 w-4" />
              ログアウト
            </button>
            <DrawerClose asChild>
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md px-3 py-3 text-sm hover:bg-accent"
              >
                <X className="h-4 w-4" />
                キャンセル
              </button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
