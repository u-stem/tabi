"use client";

import {
  createQuickPollSchema,
  QUICK_POLL_OPTION_MAX_LENGTH,
  QUICK_POLL_QUESTION_MAX_LENGTH,
} from "@sugara/shared";
import { Check, Copy, Plus, X } from "lucide-react";
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
import { MSG } from "@/lib/messages";

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

  function setYesNo() {
    const id1 = nextId.current++;
    const id2 = nextId.current++;
    setOptions([
      { id: id1, label: "はい" },
      { id: id2, label: "いいえ" },
    ]);
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
      toast.error("入力内容を確認してください");
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
      toast.success(MSG.QUICK_POLL_CREATED);
      onCreated();
    } catch {
      toast.error(MSG.QUICK_POLL_CREATE_FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      toast.success(MSG.QUICK_POLL_LINK_COPIED);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error(MSG.COPY_FAILED);
    }
  }

  // After creation: show share URL
  if (shareUrl) {
    return (
      <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>投票を作成しました</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              以下のリンクを共有してください
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" onClick={copyShareUrl}>
                {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                コピー
              </Button>
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => window.open(shareUrl, "_blank")}>
              投票ページを開く
            </Button>
            <Button onClick={() => handleOpenChange(false)}>閉じる</Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="flex max-h-[90vh] flex-col overflow-hidden">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>投票を作成</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>質問と選択肢を入力してください</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-4">
          <div className="space-y-4 overflow-y-auto px-1">
            <div className="space-y-2">
              <Label htmlFor="poll-question">
                質問 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="poll-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="何を聞きますか？"
                maxLength={QUICK_POLL_QUESTION_MAX_LENGTH}
                required
              />
              <p className="text-right text-xs text-muted-foreground">
                {question.length}/{QUICK_POLL_QUESTION_MAX_LENGTH}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  選択肢 <span className="text-destructive">*</span>
                </Label>
                <Button type="button" variant="ghost" size="sm" onClick={setYesNo}>
                  Yes/No
                </Button>
              </div>
              {options.map((opt, i) => (
                <div key={opt.id} className="flex gap-2">
                  <Input
                    value={opt.label}
                    onChange={(e) => updateOption(opt.id, e.target.value)}
                    placeholder={`選択肢 ${i + 1}`}
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
                  追加
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="poll-allowMultiple">複数選択を許可</Label>
                <Switch
                  id="poll-allowMultiple"
                  checked={allowMultiple}
                  onCheckedChange={setAllowMultiple}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="poll-showResults">投票前に結果を表示</Label>
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
                キャンセル
              </Button>
            </ResponsiveDialogClose>
            <Button type="submit" disabled={submitting || !question.trim()}>
              <Plus className="h-4 w-4" />
              {submitting ? "作成中..." : "作成"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
