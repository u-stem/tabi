"use client";

import {
  POLL_DESTINATION_MAX_LENGTH,
  POLL_NOTE_MAX_LENGTH,
  POLL_TITLE_MAX_LENGTH,
} from "@sugara/shared";
import { format, isValid, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { CalendarNav, END_YEAR, START_YEAR } from "@/components/calendar-nav";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";

type CandidateOption = { startDate: string; endDate: string };

function formatDateLabel(dateStr: string): string {
  const d = parse(dateStr, "yyyy-MM-dd", new Date());
  if (!isValid(d)) return dateStr;
  return format(d, "M/d (E)", { locale: ja });
}

function formatRange(opt: CandidateOption): string {
  if (opt.startDate === opt.endDate) return formatDateLabel(opt.startDate);
  return `${formatDateLabel(opt.startDate)} - ${formatDateLabel(opt.endDate)}`;
}

type CreatePollDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreatePollDialog({ open, onOpenChange, onCreated }: CreatePollDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollNote, setPollNote] = useState("");
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>();
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  function resetAll() {
    setError(null);
    setLoading(false);
    setPollNote("");
    setCandidates([]);
    setPendingRange(undefined);
    setCalendarMonth(new Date());
  }

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) resetAll();
  }

  function handleAddCandidate() {
    if (!pendingRange?.from) return;
    const startDate = format(pendingRange.from, "yyyy-MM-dd");
    const endDate = pendingRange.to ? format(pendingRange.to, "yyyy-MM-dd") : startDate;
    setCandidates((prev) => [...prev, { startDate, endDate }]);
    setPendingRange(undefined);
  }

  function handleRemoveCandidate(index: number) {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (candidates.length === 0) {
      setError(MSG.POLL_CANDIDATE_REQUIRED);
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      title: formData.get("title") as string,
      destination: formData.get("destination") as string,
      options: candidates,
    };
    if (pollNote) body.note = pollNote;

    try {
      const result = await api<{ id: string }>("/api/polls", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onOpenChange(false);
      toast.success(MSG.POLL_CREATED);
      onCreated();
      router.push(`/polls/${result.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err, MSG.POLL_CREATE_FAILED));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>日程調整を作成</DialogTitle>
          <DialogDescription>候補日を選択して参加者と日程を相談しましょう</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="poll-title">
              タイトル <span className="text-destructive">*</span>
            </Label>
            <Input
              id="poll-title"
              name="title"
              placeholder="夏の沖縄旅行"
              maxLength={POLL_TITLE_MAX_LENGTH}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="poll-destination">
              目的地 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="poll-destination"
              name="destination"
              placeholder="沖縄"
              maxLength={POLL_DESTINATION_MAX_LENGTH}
              required
            />
          </div>

          {/* Candidate dates */}
          <div className="space-y-2">
            <Label>
              候補日 <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              カレンダーで日付範囲を選択し「候補に追加」で追加
            </p>
            <div className="flex flex-col items-center">
              <CalendarNav
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                showReset={!!pendingRange?.from}
                onReset={() => setPendingRange(undefined)}
              />
              <Calendar
                mode="range"
                selected={pendingRange}
                onSelect={setPendingRange}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                numberOfMonths={2}
                locale={ja}
                hideNavigation
                startMonth={new Date(START_YEAR, 0)}
                endMonth={new Date(END_YEAR, 11)}
              />
            </div>
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCandidate}
                disabled={!pendingRange?.from}
              >
                <Plus className="h-4 w-4" />
                候補に追加
              </Button>
            </div>

            {/* Added candidates list */}
            {candidates.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  追加済みの候補 ({candidates.length}件)
                </p>
                <div className="divide-y rounded-md border">
                  {candidates.map((opt, i) => (
                    <div
                      key={`${opt.startDate}-${opt.endDate}`}
                      className="flex items-center justify-between px-3 py-1.5"
                    >
                      <span className="text-sm">{formatRange(opt)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveCandidate(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="poll-note">メモ</Label>
            <Textarea
              id="poll-note"
              value={pollNote}
              onChange={(e) => setPollNote(e.target.value)}
              placeholder="参加者への連絡事項など"
              maxLength={POLL_NOTE_MAX_LENGTH}
              rows={2}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              <Plus className="h-4 w-4" />
              {loading ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
