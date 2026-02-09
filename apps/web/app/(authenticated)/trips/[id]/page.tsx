"use client";

import type { DayPatternResponse, TripResponse } from "@tabi/shared";
import { PATTERN_LABEL_MAX_LENGTH } from "@tabi/shared";
import { ChevronDown, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DayTimeline } from "@/components/day-timeline";
import { EditTripDialog } from "@/components/edit-trip-dialog";
import { hashColor, PresenceAvatars } from "@/components/presence-avatars";
import { TripActions } from "@/components/trip-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { formatDateRange, getDayCount } from "@/lib/format";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { useTripSync } from "@/lib/hooks/use-trip-sync";
import { cn } from "@/lib/utils";

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const online = useOnlineStatus();
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedPattern, setSelectedPattern] = useState<Record<string, number>>({});
  const [addPatternOpen, setAddPatternOpen] = useState(false);
  const [addPatternLabel, setAddPatternLabel] = useState("");
  const [addPatternLoading, setAddPatternLoading] = useState(false);
  const [renamePattern, setRenamePattern] = useState<DayPatternResponse | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  // Defined before fetchTrip so it can be passed to useTripSync below
  const fetchTripRef = useRef<() => void>(() => {});

  const { presence, isConnected, updatePresence } = useTripSync(tripId, () =>
    fetchTripRef.current(),
  );

  const fetchTrip = useCallback(async () => {
    try {
      const data = await api<TripResponse>(`/api/trips/${tripId}`);
      setTrip(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/auth/login");
        return;
      }
      setError("旅行の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [tripId, router]);

  useEffect(() => {
    fetchTripRef.current = fetchTrip;
  }, [fetchTrip]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  const currentDay = trip?.days[selectedDay] ?? null;
  const currentPatternIndex = currentDay ? (selectedPattern[currentDay.id] ?? 0) : 0;
  const currentPattern = currentDay?.patterns[currentPatternIndex] ?? null;

  useEffect(() => {
    if (currentDay) {
      updatePresence(currentDay.id, currentPattern?.id ?? null);
    }
  }, [currentDay?.id, currentPattern?.id, updatePresence]);

  async function handleAddPattern(e: React.FormEvent) {
    e.preventDefault();
    if (!currentDay || !addPatternLabel.trim()) return;
    setAddPatternLoading(true);
    try {
      await api(`/api/trips/${tripId}/days/${currentDay.id}/patterns`, {
        method: "POST",
        body: JSON.stringify({ label: addPatternLabel.trim() }),
      });
      toast.success("パターンを追加しました");
      setAddPatternOpen(false);
      setAddPatternLabel("");
      fetchTrip();
    } catch {
      toast.error("パターンの追加に失敗しました");
    } finally {
      setAddPatternLoading(false);
    }
  }

  async function handleDuplicatePattern(patternId: string) {
    if (!currentDay) return;
    try {
      await api(`/api/trips/${tripId}/days/${currentDay.id}/patterns/${patternId}/duplicate`, {
        method: "POST",
      });
      toast.success("パターンを複製しました");
      fetchTrip();
    } catch {
      toast.error("パターンの複製に失敗しました");
    }
  }

  async function handleDeletePattern(patternId: string) {
    if (!currentDay) return;
    try {
      await api(`/api/trips/${tripId}/days/${currentDay.id}/patterns/${patternId}`, {
        method: "DELETE",
      });
      toast.success("パターンを削除しました");
      // Reset to first pattern
      setSelectedPattern((prev) => ({ ...prev, [currentDay.id]: 0 }));
      fetchTrip();
    } catch {
      toast.error("パターンの削除に失敗しました");
    }
  }

  async function handleRenamePattern(e: React.FormEvent) {
    e.preventDefault();
    if (!currentDay || !renamePattern || !renameLabel.trim()) return;
    setRenameLoading(true);
    try {
      await api(`/api/trips/${tripId}/days/${currentDay.id}/patterns/${renamePattern.id}`, {
        method: "PATCH",
        body: JSON.stringify({ label: renameLabel.trim() }),
      });
      toast.success("名前を変更しました");
      setRenamePattern(null);
      setRenameLabel("");
      fetchTrip();
    } catch {
      toast.error("名前の変更に失敗しました");
    } finally {
      setRenameLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-6 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="space-y-4">
            {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
              <div key={key} className="rounded-lg border p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return <p className="text-destructive">{error ?? "旅行が見つかりません"}</p>;
  }

  const dayCount = getDayCount(trip.startDate, trip.endDate);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <PresenceAvatars users={presence} isConnected={isConnected} />
        </div>
        <p className="text-muted-foreground">
          {`${trip.destination} / `}
          {formatDateRange(trip.startDate, trip.endDate)}
          <span className="ml-2 text-sm">({dayCount}日間)</span>
        </p>
        <div className="mt-3 flex items-center justify-between">
          <TripActions
            tripId={tripId}
            status={trip.status}
            onStatusChange={fetchTrip}
            onEdit={() => setEditOpen(true)}
            disabled={!online}
          />
        </div>
      </div>
      <EditTripDialog
        tripId={tripId}
        title={trip.title}
        destination={trip.destination}
        startDate={trip.startDate}
        endDate={trip.endDate}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdate={fetchTrip}
      />
      <div className="flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="日程タブ">
        {trip.days.map((day, index) => (
          <button
            key={day.id}
            type="button"
            role="tab"
            aria-selected={selectedDay === index}
            aria-controls={`day-panel-${day.id}`}
            onClick={() => setSelectedDay(index)}
            className={cn(
              "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors",
              selectedDay === index
                ? "text-blue-600 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {day.dayNumber}日目
            {presence
              .filter((u) => u.dayId === day.id)
              .slice(0, 3)
              .map((u, i) => (
                <span
                  key={u.userId}
                  className={cn("absolute top-1 h-1.5 w-1.5 rounded-full", hashColor(u.userId))}
                  style={{ right: `${4 + i * 6}px` }}
                />
              ))}
          </button>
        ))}
      </div>

      {currentDay && currentPattern && (
        <div id={`day-panel-${currentDay.id}`} role="tabpanel" className="mt-4">
          <DayTimeline
            key={currentPattern.id}
            tripId={tripId}
            dayId={currentDay.id}
            patternId={currentPattern.id}
            date={currentDay.date}
            spots={currentPattern.spots}
            onRefresh={fetchTrip}
            disabled={!online}
            headerContent={
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {currentDay.patterns.map((pattern, index) => {
                  const isActive = currentPatternIndex === index;
                  return (
                    <div
                      key={pattern.id}
                      className={cn(
                        "flex shrink-0 items-center rounded-full border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-1",
                        isActive
                          ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPattern((prev) => ({
                            ...prev,
                            [currentDay.id]: index,
                          }))
                        }
                        className="py-1.5 pl-3 pr-1 text-xs font-medium focus:outline-none"
                      >
                        {pattern.label}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="py-1.5 pr-2 pl-0.5 text-xs focus:outline-none"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenamePattern(pattern);
                              setRenameLabel(pattern.label);
                            }}
                          >
                            <Pencil className="mr-2 h-3 w-3" />
                            名前変更
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicatePattern(pattern.id)}>
                            <Copy className="mr-2 h-3 w-3" />
                            複製
                          </DropdownMenuItem>
                          {!pattern.isDefault && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeletePattern(pattern.id)}
                            >
                              <Trash2 className="mr-2 h-3 w-3" />
                              削除
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
                {online && (
                  <button
                    type="button"
                    onClick={() => setAddPatternOpen(true)}
                    className="shrink-0 rounded-full border border-dashed border-muted-foreground/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
                  >
                    <Plus className="inline h-3 w-3" /> パターン追加
                  </button>
                )}
              </div>
            }
          />
        </div>
      )}

      {/* Add pattern dialog */}
      <Dialog
        open={addPatternOpen}
        onOpenChange={(open) => {
          setAddPatternOpen(open);
          if (!open) setAddPatternLabel("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>パターン追加</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPattern} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pattern-label">ラベル</Label>
              <Input
                id="pattern-label"
                value={addPatternLabel}
                onChange={(e) => setAddPatternLabel(e.target.value)}
                placeholder="例: 雨の日プラン"
                maxLength={PATTERN_LABEL_MAX_LENGTH}
              />
            </div>
            <Button
              type="submit"
              disabled={addPatternLoading || !addPatternLabel.trim()}
              className="w-full"
            >
              {addPatternLoading ? "追加中..." : "追加"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename pattern dialog */}
      <Dialog
        open={renamePattern !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenamePattern(null);
            setRenameLabel("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>パターン名変更</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenamePattern} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-label">ラベル</Label>
              <Input
                id="rename-label"
                value={renameLabel}
                onChange={(e) => setRenameLabel(e.target.value)}
                maxLength={PATTERN_LABEL_MAX_LENGTH}
              />
            </div>
            <Button
              type="submit"
              disabled={renameLoading || !renameLabel.trim()}
              className="w-full"
            >
              {renameLoading ? "変更中..." : "変更"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
