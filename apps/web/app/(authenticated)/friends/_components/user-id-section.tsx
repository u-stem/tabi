"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { copyToClipboard } from "@/lib/clipboard";
import { MSG } from "@/lib/messages";

export function UserIdSection({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(userId);
    setCopied(true);
    toast.success(MSG.SETTINGS_USER_ID_COPIED);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>あなたのユーザーID</CardTitle>
        <CardDescription>フレンド申請やメンバー追加時にこのIDを共有してください</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <code
            data-testid="user-id"
            className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all"
          >
            {userId}
          </code>
          <Button variant="outline" size="icon" onClick={handleCopy} aria-label="コピー">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
