"use client";

import {
  createQuickPollSchema,
  QUICK_POLL_OPTION_MAX_LENGTH,
  QUICK_POLL_QUESTION_MAX_LENGTH,
} from "@sugara/shared";
import { useMutation } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { pageTitle } from "@/lib/constants";
import { MSG } from "@/lib/messages";

export default function NewQuickPollPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const nextId = useRef(2);
  const [options, setOptions] = useState(() => [
    { id: 0, label: "" },
    { id: 1, label: "" },
  ]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [showResultsBeforeVote, setShowResultsBeforeVote] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    document.title = pageTitle("投票を作成");
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: {
      question: string;
      options: { label: string }[];
      allowMultiple: boolean;
      showResultsBeforeVote: boolean;
    }) =>
      api<{ id: string; shareToken: string }>("/api/quick-polls", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      const url = `${window.location.origin}/p/${data.shareToken}`;
      setShareUrl(url);
      toast.success(MSG.QUICK_POLL_CREATED);
    },
    onError: () => toast.error(MSG.QUICK_POLL_CREATE_FAILED),
  });

  function handleSubmit(e: React.FormEvent) {
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
    createMutation.mutate(data);
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

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(MSG.QUICK_POLL_LINK_COPIED);
    } catch {
      toast.error(MSG.COPY_FAILED);
    }
  }

  if (shareUrl) {
    return (
      <div className="mt-4 mx-auto max-w-2xl space-y-6">
        <h1 className="text-lg font-semibold">投票を作成しました</h1>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">以下のリンクを共有してください</p>
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="font-mono text-sm" />
            <Button onClick={copyShareUrl}>コピー</Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/polls")}>
            投票一覧へ
          </Button>
          <Button variant="outline" onClick={() => window.open(shareUrl, "_blank")}>
            投票ページを開く
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 mx-auto max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="question">質問</Label>
          <Input
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="何を聞きますか？"
            maxLength={QUICK_POLL_QUESTION_MAX_LENGTH}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>選択肢</Label>
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
            <Label htmlFor="allowMultiple">複数選択を許可</Label>
            <Switch id="allowMultiple" checked={allowMultiple} onCheckedChange={setAllowMultiple} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="showResults">投票前に結果を表示</Label>
            <Switch
              id="showResults"
              checked={showResultsBeforeVote}
              onCheckedChange={setShowResultsBeforeVote}
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          投票を作成
        </Button>
      </form>
    </div>
  );
}
