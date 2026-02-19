"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { CalendarNav, END_YEAR, START_YEAR } from "@/components/calendar-nav";
import { DateRangePicker } from "@/components/date-range-picker";
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
import { api, getApiErrorMessage } from "@/lib/api";
import { formatDateRangeShort } from "@/lib/format";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";

type DateMode = "direct" | "poll";
type CandidateOption = { startDate: string; endDate: string };

type CreateTripDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateTripDialog({ open, onOpenChange, onCreated }: CreateTripDialogProps) {
  const router = useRouter();
  const [dateMode, setDateMode] = useState<DateMode>("direct");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Direct mode state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Poll mode state
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>();
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  function resetAll() {
    setDateMode("direct");
    setError(null);
    setLoading(false);
    setStartDate("");
    setEndDate("");
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
    const start = format(pendingRange.from, "yyyy-MM-dd");
    const end = pendingRange.to ? format(pendingRange.to, "yyyy-MM-dd") : start;
    setCandidates((prev) => [...prev, { startDate: start, endDate: end }]);
    setPendingRange(undefined);
  }

  function handleRemoveCandidate(index: number) {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const destination = (formData.get("destination") as string) || undefined;

    if (dateMode === "poll") {
      if (candidates.length === 0) {
        setError(MSG.POLL_CANDIDATE_REQUIRED);
        return;
      }

      setLoading(true);
      const body: Record<string, unknown> = {
        title,
        pollOptions: candidates,
      };
      if (destination) body.destination = destination;

      try {
        const trip = await api<{ id: string }>("/api/trips", {
          method: "POST",
          body: JSON.stringify(body),
        });
        router.push(`/trips/${trip.id}`);
        onOpenChange(false);
        toast.success(MSG.TRIP_CREATED);
        onCreated();
      } catch (err) {
        setError(getApiErrorMessage(err, MSG.TRIP_CREATE_FAILED));
      } finally {
        setLoading(false);
      }
    } else {
      const sd = formData.get("startDate") as string;
      const ed = formData.get("endDate") as string;

      if (!sd || !ed) {
        setError(MSG.TRIP_DATE_REQUIRED);
        return;
      }

      setLoading(true);
      try {
        const trip = await api<{ id: string }>("/api/trips", {
          method: "POST",
          body: JSON.stringify({
            title,
            ...(destination && { destination }),
            startDate: sd,
            endDate: ed,
          }),
        });
        router.push(`/trips/${trip.id}`);
        onOpenChange(false);
        toast.success(MSG.TRIP_CREATED);
        onCreated();
      } catch (err) {
        setError(getApiErrorMessage(err, MSG.TRIP_CREATE_FAILED));
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>新しい旅行を作成</DialogTitle>
          <DialogDescription>旅行の基本情報を入力してください</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-4">
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="create-title">
                旅行タイトル <span className="text-destructive">*</span>
              </Label>
              <Input id="create-title" name="title" placeholder="京都3日間の旅" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-destination">目的地</Label>
              <Input id="create-destination" name="destination" placeholder="京都" />
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2 rounded-lg border p-1">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  dateMode === "direct"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setDateMode("direct")}
              >
                日程を決定する
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  dateMode === "poll"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setDateMode("poll")}
              >
                日程を調整する
              </button>
            </div>

            {dateMode === "direct" ? (
              <div className="space-y-2">
                <Label>
                  旅行期間 <span className="text-destructive">*</span>
                </Label>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChangeStart={setStartDate}
                  onChangeEnd={setEndDate}
                />
                <input type="hidden" name="startDate" value={startDate} />
                <input type="hidden" name="endDate" value={endDate} />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    日程案 <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCandidate}
                    disabled={!pendingRange?.from}
                  >
                    <Plus className="h-4 w-4" />
                    日程案に追加
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  カレンダーで日付範囲を選択し「日程案に追加」で追加
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

                {candidates.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      追加済みの日程案 ({candidates.length}件)
                    </p>
                    <div className="divide-y rounded-md border">
                      {candidates.map((opt, i) => (
                        <div
                          key={`${opt.startDate}-${opt.endDate}`}
                          className="flex items-center justify-between px-3 py-1.5"
                        >
                          <span className="text-sm">
                            {formatDateRangeShort(opt.startDate, opt.endDate)}
                          </span>
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
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t pt-4">
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
