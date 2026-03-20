"use client";

import {
  createQuickPollSchema,
  QUICK_POLL_OPTION_MAX_LENGTH,
  QUICK_POLL_QUESTION_MAX_LENGTH,
} from "@sugara/shared";
import { Check, Copy, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";

type CreateQuickPollDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateQuickPollDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateQuickPollDialogProps) {
  const tm = useTranslations("messages");
  const tp = useTranslations("poll");
  const tc = useTranslations("common");
  const nextId = useRef(2);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(() => [
    { id: 0, label: "" },
    { id: 1, label: "" },
  ]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [showResultsBeforeVote, setShowResultsBeforeVote] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  function resetAll() {
    nextId.current = 2;
    setQuestion("");
    setOptions([
      { id: 0, label: "" },
      { id: 1, label: "" },
    ]);
    setAllowMultiple(false);
    setShowResultsBeforeVote(true);
    setSubmitting(false);
    setShareUrl(null);
    setLinkCopied(false);
  }

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) resetAll();
  }

  function addOption() {
    if (options.length >= 10) return;
    const id = nextId.current++;
    setOptions([...options, { id, label: "" }]);
  }

  function removeOption(id: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((o) => o.id !== id));
  }

  function updateOption(id: number, label: string) {
    setOptions(options.map((o) => (o.id === id ? { ...o, label } : o)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nonEmptyOptions = options.filter((o) => o.label.trim()).map((o) => ({ label: o.label }));
    const data = {
      question: question.trim(),
      options: nonEmptyOptions,
      allowMultiple,
      showResultsBeforeVote,
    };
    const parsed = createQuickPollSchema.safeParse(data);
    if (!parsed.success) {
      toast.error(tm("validationError"));
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ id: string; shareToken: string }>("/api/quick-polls", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const url = `${window.location.origin}/p/${result.shareToken}`;
      setShareUrl(url);
      toast.success(tm("quickPollCreated"));
      onCreated();
    } catch {
      toast.error(tm("quickPollCreateFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      toast.success(tm("quickPollLinkCopied"));
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error(tm("copyFailed"));
    }
  }

  // After creation: show share URL (matches ShareDialog layout)
  if (shareUrl) {
    return (
      <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
        <ResponsiveDialogContent className="sm:max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{tp("shareTitle")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>{tp("shareDescription")}</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 text-sm"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={copyShareUrl}
                aria-label={linkCopied ? tp("copyDone") : tp("copyUrl")}
              >
                {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex justify-center rounded-md border bg-white p-4 dark:border-0 dark:shadow-sm">
              <QRCodeSVG value={shareUrl} size={200} level="M" />
            </div>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="flex max-h-[90vh] flex-col overflow-hidden">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{tp("createTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{tp("createDescription")}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-4">
          <div className="space-y-4 overflow-y-auto px-1">
            <div className="space-y-2">
              <Label htmlFor="poll-question">
                {tp("questionLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="poll-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={tp("questionPlaceholder")}
                maxLength={QUICK_POLL_QUESTION_MAX_LENGTH}
                required
              />
              <p className="text-right text-xs text-muted-foreground">
                {question.length}/{QUICK_POLL_QUESTION_MAX_LENGTH}
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                {tp("optionsLabel")} <span className="text-destructive">*</span>
              </Label>
              {options.map((opt, i) => (
                <div key={opt.id} className="flex gap-2">
                  <Input
                    value={opt.label}
                    onChange={(e) => updateOption(opt.id, e.target.value)}
                    placeholder={tp("optionPlaceholder", { index: i + 1 })}
                    maxLength={QUICK_POLL_OPTION_MAX_LENGTH}
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(opt.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {options.length < 10 && (
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="mr-1 h-4 w-4" />
                  {tp("addOption")}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="poll-allowMultiple">{tp("allowMultiple")}</Label>
                <Switch
                  id="poll-allowMultiple"
                  checked={allowMultiple}
                  onCheckedChange={setAllowMultiple}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="poll-showResults">{tp("showResultsBeforeVote")}</Label>
                <Switch
                  id="poll-showResults"
                  checked={showResultsBeforeVote}
                  onCheckedChange={setShowResultsBeforeVote}
                />
              </div>
            </div>
          </div>
          <ResponsiveDialogFooter className="shrink-0 border-t pt-4">
            <ResponsiveDialogClose asChild>
              <Button type="button" variant="outline">
                <X className="h-4 w-4" />
                {tc("cancel")}
              </Button>
            </ResponsiveDialogClose>
            <Button type="submit" disabled={submitting || !question.trim()}>
              <Plus className="h-4 w-4" />
              {submitting ? tp("creating") : tp("create")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
