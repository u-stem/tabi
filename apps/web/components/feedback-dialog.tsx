"use client";

import { FEEDBACK_BODY_MAX_LENGTH } from "@sugara/shared";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";

type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const COOLDOWN_MS = 5000;

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) {
        clearTimeout(cooldownTimer.current);
      }
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || cooldown) return;
    setError(null);
    setLoading(true);

    try {
      await api("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ body: body.trim() }),
      });
      toast.success(MSG.FEEDBACK_SENT);
      setBody("");
      onOpenChange(false);

      setCooldown(true);
      cooldownTimer.current = setTimeout(() => setCooldown(false), COOLDOWN_MS);
    } catch {
      setError(MSG.FEEDBACK_SEND_FAILED);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>フィードバック</DialogTitle>
          <DialogDescription>バグ報告や改善要望をお聞かせください</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="バグ報告や改善要望など"
            maxLength={FEEDBACK_BODY_MAX_LENGTH}
            rows={5}
            required
          />
          <div className="mt-1 flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              個人情報は含めないでください
            </p>
            <p className="shrink-0 text-xs text-muted-foreground">
              {body.length}/{FEEDBACK_BODY_MAX_LENGTH}
            </p>
          </div>
          {error && (
            <div
              role="alert"
              className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading || !body.trim() || cooldown}>
              {loading ? "送信中..." : "送信"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
