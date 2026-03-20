"use client";

import type { BookmarkResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { Dices, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useBookmarkLists } from "@/lib/hooks/use-bookmark-lists";
import { useRoulette } from "@/lib/hooks/use-roulette";
import { isDialogOpen } from "@/lib/hotkeys";
import { ALL_PREFECTURES, REGIONS } from "@/lib/prefectures";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type Mode = "prefecture" | "custom" | "bookmark";

function RouletteDisplay({
  state,
  display,
  onSpin,
  onReset,
  disabled,
}: {
  state: "idle" | "spinning" | "result";
  display: string;
  onSpin: () => void;
  onReset: () => void;
  disabled: boolean;
}) {
  const tt = useTranslations("tools");
  useHotkeys(
    "space",
    () => {
      if (!isDialogOpen() && !disabled && state !== "spinning") onSpin();
    },
    { preventDefault: true },
  );
  useHotkeys(
    "r",
    () => {
      if (!isDialogOpen() && state === "result") onReset();
    },
    { preventDefault: true },
  );

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div
        className={cn(
          "flex h-32 w-full items-center justify-center rounded-xl border-2 border-dashed text-center",
          state === "result" && "border-solid border-primary bg-primary/5",
          state === "spinning" && "border-solid border-muted-foreground",
        )}
      >
        <span
          className={cn(
            "text-2xl font-bold transition-opacity",
            state === "idle" && "text-muted-foreground",
            state === "spinning" && "text-foreground",
            state === "result" && "text-primary text-3xl",
          )}
        >
          {state === "idle" ? "?" : display}
        </span>
      </div>
      <div className="flex gap-3">
        {state === "result" ? (
          <>
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="h-4 w-4" /> {tt("reset")}
              <span className="hidden text-xs text-muted-foreground lg:inline">(R)</span>
            </Button>
            <Button onClick={onSpin}>
              <Dices className="h-4 w-4" /> {tt("spinAgain")}
              <span className="hidden text-xs text-muted-foreground lg:inline">(Space)</span>
            </Button>
          </>
        ) : (
          <Button onClick={onSpin} disabled={disabled || state === "spinning"}>
            <Dices className="h-4 w-4" /> {state === "spinning" ? tt("spinning") : tt("spin")}
            {state === "idle" && (
              <span className="hidden text-xs text-muted-foreground lg:inline">(Space)</span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function PrefectureMode() {
  const tt = useTranslations("tools");
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());

  const candidates = useMemo(() => {
    if (selectedRegions.size === 0) return ALL_PREFECTURES;
    return REGIONS.filter((r) => selectedRegions.has(r.name)).flatMap((r) => r.prefectures);
  }, [selectedRegions]);

  const { state, display, spin, reset } = useRoulette(candidates);

  const toggleRegion = useCallback(
    (name: string) => {
      reset();
      setSelectedRegions((prev) => {
        const next = new Set(prev);
        if (next.has(name)) {
          next.delete(name);
        } else {
          next.add(name);
        }
        return next;
      });
    },
    [reset],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{tt("regionFilter")}</p>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button
              key={r.name}
              type="button"
              onClick={() => toggleRegion(r.name)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                selectedRegions.has(r.name)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              {r.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {tt("itemCount", { count: candidates.length })}
        </p>
      </div>
      <RouletteDisplay
        state={state}
        display={display}
        onSpin={spin}
        onReset={reset}
        disabled={candidates.length === 0}
      />
    </div>
  );
}

type Item = { id: number; text: string };

function CustomMode() {
  const tt = useTranslations("tools");
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const nextId = useRef(0);

  const addItem = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setItems((prev) => [...prev, { id: nextId.current++, text: trimmed }]);
    setInput("");
  }, [input]);

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addItem();
      }
    },
    [addItem],
  );

  const candidates = useMemo(() => items.map((item) => item.text), [items]);
  const { state, display, spin, reset } = useRoulette(candidates);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tt("inputPlaceholder")}
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={addItem} disabled={!input.trim()}>
            <Plus className="h-4 w-4" /> {tt("add")}
          </Button>
        </div>
        {items.length > 0 && (
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{item.text}</span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              {tt("itemCount", { count: items.length })}
            </p>
          </div>
        )}
      </div>
      <RouletteDisplay
        state={state}
        display={display}
        onSpin={spin}
        onReset={reset}
        disabled={items.length === 0}
      />
    </div>
  );
}

function BookmarkMode() {
  const tt = useTranslations("tools");
  const { bookmarkLists, isLoading } = useBookmarkLists(false);
  const [selectedListId, setSelectedListId] = useState<string>("");

  const { data: bookmarkItems } = useQuery({
    queryKey: queryKeys.bookmarks.list(selectedListId),
    queryFn: () => api<BookmarkResponse[]>(`/api/bookmark-lists/${selectedListId}/bookmarks`),
    enabled: !!selectedListId,
  });

  const candidates = useMemo(() => (bookmarkItems ?? []).map((b) => b.name), [bookmarkItems]);

  const { state, display, spin, reset } = useRoulette(candidates);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Select value={selectedListId} onValueChange={setSelectedListId}>
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? tt("loadingList") : tt("selectList")} />
          </SelectTrigger>
          <SelectContent>
            {bookmarkLists.map((list) => (
              <SelectItem key={list.id} value={list.id}>
                {list.name} ({list.bookmarkCount}件)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {candidates.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {tt("itemCountBookmark", { count: candidates.length })}
          </p>
        )}
      </div>
      <RouletteDisplay
        state={state}
        display={display}
        onSpin={spin}
        onReset={reset}
        disabled={candidates.length === 0}
      />
    </div>
  );
}

export const ROULETTE_MODES = [
  { value: "prefecture", labelKey: "prefecture" },
  { value: "custom", labelKey: "custom" },
  { value: "bookmark", labelKey: "bookmark" },
] as const;

export function RouletteModeContent({ mode }: { mode: Mode }) {
  switch (mode) {
    case "prefecture":
      return <PrefectureMode />;
    case "custom":
      return <CustomMode />;
    case "bookmark":
      return <BookmarkMode />;
  }
}

export function RouletteContent() {
  const tt = useTranslations("tools");
  const [mode, setMode] = useState<Mode>("prefecture");

  return (
    <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
      <TabsList className="w-full">
        {ROULETTE_MODES.map((m) => (
          <TabsTrigger key={m.value} value={m.value} className="flex-1">
            {tt(m.labelKey)}
          </TabsTrigger>
        ))}
      </TabsList>
      {ROULETTE_MODES.map((m) => (
        <TabsContent key={m.value} value={m.value}>
          <RouletteModeContent mode={m.value} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
