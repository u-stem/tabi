"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, LogOut, Monitor, Moon, Pencil, Settings, Sun, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { UserAvatar } from "@/components/user-avatar";
import { signOut, useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { switchViewMode } from "@/lib/view-mode";

const THEME_OPTIONS = [
  { value: "light", label: "ライト", icon: Sun },
  { value: "dark", label: "ダーク", icon: Moon },
  { value: "system", label: "システム", icon: Monitor },
] as const;

export default function SpMyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.title = pageTitle("マイページ");
  }, []);

  async function handleSignOut() {
    try {
      await signOut();
      queryClient.clear();
      router.push("/");
    } catch {
      toast.error(MSG.AUTH_LOGOUT_FAILED);
    }
  }

  const user = session?.user;
  const displayUsername = user?.displayUsername ?? user?.username;

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-4">
      {/* Profile header */}
      <div className="flex flex-col items-center gap-3 py-6">
        <UserAvatar
          name={user?.name ?? ""}
          image={user?.image}
          className="h-16 w-16"
          fallbackClassName="text-2xl"
        />
        <div className="text-center">
          <h1 className="text-lg font-semibold">{user?.name}</h1>
          {displayUsername && <p className="text-sm text-muted-foreground">@{displayUsername}</p>}
        </div>
        <Link
          href="/sp/my/edit"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border px-4 text-sm hover:bg-accent"
        >
          <Pencil className="h-3 w-3" />
          プロフィールを編集
        </Link>
      </div>

      {/* Settings link */}
      <div className="overflow-hidden rounded-lg border">
        <Link href="/sp/settings" className="flex h-12 items-center gap-3 px-4 hover:bg-accent">
          <Settings className="h-4 w-4" />
          <span className="flex-1">設定</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      {/* Theme toggle */}
      <div className="overflow-hidden rounded-lg border">
        <div className="px-4 py-3">
          <p className="mb-3 text-sm font-medium">テーマ</p>
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 text-xs transition-colors",
                  mounted && theme === value
                    ? "border-primary bg-primary/5 font-medium"
                    : "hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {mounted && theme === value && <Check className="h-3 w-3 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Other actions */}
      <div className="overflow-hidden rounded-lg border">
        <button
          type="button"
          onClick={() => void switchViewMode("desktop")}
          className="flex h-12 w-full items-center gap-3 px-4 hover:bg-accent"
        >
          <Monitor className="h-4 w-4" />
          PC版で表示
        </button>
      </div>

      {/* Logout */}
      <div className="overflow-hidden rounded-lg border">
        <button
          type="button"
          onClick={() => setSignOutOpen(true)}
          className="flex h-12 w-full items-center gap-3 px-4 text-destructive hover:bg-accent"
        >
          <LogOut className="h-4 w-4" />
          ログアウト
        </button>
      </div>

      {/* Logout confirmation drawer */}
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
    </div>
  );
}
