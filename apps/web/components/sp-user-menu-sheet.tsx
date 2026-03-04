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
  User,
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

import { Button } from "@/components/ui/button";
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
              <>
                <Link
                  href={`/sp/users/${session?.user?.id}`}
                  onClick={() => onOpenChange(false)}
                  className="flex h-12 items-center gap-3 rounded-md px-3 text-base hover:bg-accent"
                >
                  <User className="h-4 w-4" />
                  プロフィール
                </Link>
                <Link
                  href="/sp/settings"
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-md px-3 text-base",
                    pathname === "/sp/settings" ? "bg-accent font-medium" : "hover:bg-accent",
                  )}
                >
                  <Settings className="h-4 w-4" />
                  設定
                </Link>
              </>
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
                  "flex h-12 items-center gap-3 rounded-md px-3 text-base hover:bg-accent",
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
              className="flex h-12 items-center gap-3 rounded-md px-3 text-base hover:bg-accent"
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
                className="flex h-12 items-center gap-3 rounded-md px-3 text-base hover:bg-accent"
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
              className="flex h-12 items-center gap-3 rounded-md px-3 text-base hover:bg-accent"
            >
              <HelpCircle className="h-4 w-4" />
              よくある質問
            </Link>
            <Link
              href="/news"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex h-12 items-center gap-3 rounded-md px-3 text-base hover:bg-accent"
            >
              <Newspaper className="h-4 w-4" />
              お知らせ
            </Link>
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex h-12 items-center gap-3 rounded-md px-3 text-base hover:bg-accent"
            >
              <FileText className="h-4 w-4" />
              利用規約
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex h-12 items-center gap-3 rounded-md px-3 text-base hover:bg-accent"
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
              className="flex h-12 items-center gap-3 rounded-md px-3 text-base hover:bg-accent"
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
              className="flex h-12 items-center gap-3 rounded-md px-3 text-base text-destructive hover:bg-accent"
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
            <DrawerDescription>このデバイスからサインアウトされます。</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="flex-row [&>*]:flex-1">
            <DrawerClose asChild>
              <Button variant="outline">
                <X className="h-4 w-4" />
                キャンセル
              </Button>
            </DrawerClose>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              ログアウト
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
