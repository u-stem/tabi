"use client";

import { FEEDBACK_BODY_MAX_LENGTH } from "@sugara/shared";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const COOLDOWN_MS = 5000;

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const tf = useTranslations("feedback");
  const tm = useTranslations("messages");
  const tc = useTranslations("common");
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
      toast.success(tm("feedbackSent"));
      setBody("");
      onOpenChange(false);

      setCooldown(true);
      cooldownTimer.current = setTimeout(() => setCooldown(false), COOLDOWN_MS);
    } catch {
      setError(tm("feedbackSendFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{tf("title")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{tf("description")}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit}>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={tf("placeholder")}
            maxLength={FEEDBACK_BODY_MAX_LENGTH}
            rows={5}
            required
          />
          <div className="mt-1 flex select-none items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground">{tf("privacyNote")}</p>
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
          <ResponsiveDialogFooter className="mt-4">
            <ResponsiveDialogClose asChild>
              <Button type="button" variant="outline">
                <X className="h-4 w-4" />
                {tc("cancel")}
              </Button>
            </ResponsiveDialogClose>
            <Button type="submit" disabled={loading || !body.trim() || cooldown}>
              {loading ? tf("sending") : tf("send")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
