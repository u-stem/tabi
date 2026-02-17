"use client";

import type { ScheduleCategory, ScheduleColor, TransportMethod } from "@sugara/shared";
import {
  MAX_URLS_PER_SCHEDULE,
  SCHEDULE_ADDRESS_MAX_LENGTH,
  SCHEDULE_COLOR_LABELS,
  SCHEDULE_COLORS,
  SCHEDULE_MEMO_MAX_LENGTH,
  SCHEDULE_NAME_MAX_LENGTH,
  SCHEDULE_PLACE_MAX_LENGTH,
  SCHEDULE_URL_MAX_LENGTH,
} from "@sugara/shared";
import { Minus, Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { TimeInput } from "@/components/time-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SCHEDULE_COLOR_CLASSES } from "@/lib/colors";
import {
  CATEGORY_OPTIONS,
  getEndDayOptions,
  getTimeLabels,
  TRANSPORT_METHOD_OPTIONS,
} from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";

type ScheduleFormFieldsProps = {
  category: ScheduleCategory;
  onCategoryChange: (category: ScheduleCategory) => void;
  color: ScheduleColor;
  onColorChange: (color: ScheduleColor) => void;
  transportMethod: TransportMethod | "";
  onTransportMethodChange: (method: TransportMethod | "") => void;
  startTime: string | undefined;
  onStartTimeChange: (time: string | undefined) => void;
  endTime: string | undefined;
  onEndTimeChange: (time: string | undefined) => void;
  endDayOffset: number;
  onEndDayOffsetChange: (offset: number) => void;
  maxEndDayOffset: number;
  timeError: string | null;
  urls: string[];
  onUrlsChange: (urls: string[]) => void;
  defaultValues?: {
    name?: string;
    address?: string;
    departurePlace?: string;
    arrivalPlace?: string;
    memo?: string;
  };
  idPrefix?: string;
};

export function ScheduleFormFields({
  category,
  onCategoryChange,
  color,
  onColorChange,
  transportMethod,
  onTransportMethodChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  endDayOffset,
  onEndDayOffsetChange,
  maxEndDayOffset,
  timeError,
  urls,
  onUrlsChange,
  defaultValues,
  idPrefix = "",
}: ScheduleFormFieldsProps) {
  // Controlled state for text fields (Dialog unmounts on close, so these re-init correctly)
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [address, setAddress] = useState(defaultValues?.address ?? "");
  const [departurePlace, setDeparturePlace] = useState(defaultValues?.departurePlace ?? "");
  const [arrivalPlace, setArrivalPlace] = useState(defaultValues?.arrivalPlace ?? "");
  const [memo, setMemo] = useState(defaultValues?.memo ?? "");

  // Always show at least one URL input
  const displayUrls = urls.length > 0 ? urls : [""];

  // Stable keys for the dynamic URL list to avoid index-based keys.
  // useRef for key counter avoids stale closures; useState for the key array triggers re-render.
  const nextKeyRef = useRef(displayUrls.length);
  const [urlKeys, setUrlKeys] = useState<number[]>(() => displayUrls.map((_, i) => i));
  const prevLengthRef = useRef(displayUrls.length);

  // Sync keys when displayUrls length changes from parent (e.g. dialog reset)
  if (prevLengthRef.current !== displayUrls.length) {
    prevLengthRef.current = displayUrls.length;
    nextKeyRef.current = displayUrls.length;
    setUrlKeys(Array.from({ length: displayUrls.length }, (_, i) => i));
  }

  const addUrlKey = useCallback(() => {
    const key = nextKeyRef.current++;
    setUrlKeys((prev) => [...prev, key]);
  }, []);

  const removeUrlKey = useCallback((index: number) => {
    setUrlKeys((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}name`}>
          名前 <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`${idPrefix}name`}
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="金閣寺"
          required
          maxLength={SCHEDULE_NAME_MAX_LENGTH}
        />
        <p className="text-right text-xs text-muted-foreground">
          {name.length}/{SCHEDULE_NAME_MAX_LENGTH}
        </p>
      </div>
      <div className="space-y-2">
        <Label>カテゴリ</Label>
        <Select
          value={category}
          onValueChange={(v) => {
            onCategoryChange(v as ScheduleCategory);
            onTransportMethodChange("");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>色</Label>
        <div className="flex gap-2">
          {SCHEDULE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColorChange(c)}
              className={cn(
                "h-6 w-6 rounded-full",
                SCHEDULE_COLOR_CLASSES[c].bg,
                color === c && `ring-2 ring-offset-1 ${SCHEDULE_COLOR_CLASSES[c].ring}`,
              )}
              aria-label={SCHEDULE_COLOR_LABELS[c]}
            />
          ))}
        </div>
      </div>
      {category !== "transport" && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}address`}>住所</Label>
          <Input
            id={`${idPrefix}address`}
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="京都市北区金閣寺町1"
            maxLength={SCHEDULE_ADDRESS_MAX_LENGTH}
          />
          <p className="text-right text-xs text-muted-foreground">
            {address.length}/{SCHEDULE_ADDRESS_MAX_LENGTH}
          </p>
        </div>
      )}
      {category === "transport" && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}departurePlace`}>出発地</Label>
            <Input
              id={`${idPrefix}departurePlace`}
              name="departurePlace"
              value={departurePlace}
              onChange={(e) => setDeparturePlace(e.target.value)}
              placeholder="東京駅"
              maxLength={SCHEDULE_PLACE_MAX_LENGTH}
            />
            <p className="text-right text-xs text-muted-foreground">
              {departurePlace.length}/{SCHEDULE_PLACE_MAX_LENGTH}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}arrivalPlace`}>到着地</Label>
            <Input
              id={`${idPrefix}arrivalPlace`}
              name="arrivalPlace"
              value={arrivalPlace}
              onChange={(e) => setArrivalPlace(e.target.value)}
              placeholder="新大阪駅"
              maxLength={SCHEDULE_PLACE_MAX_LENGTH}
            />
            <p className="text-right text-xs text-muted-foreground">
              {arrivalPlace.length}/{SCHEDULE_PLACE_MAX_LENGTH}
            </p>
          </div>
          <div className="space-y-2">
            <Label>交通手段</Label>
            <Select
              value={transportMethod}
              onValueChange={(v) => onTransportMethodChange(v as TransportMethod)}
            >
              <SelectTrigger>
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {TRANSPORT_METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      <div className="space-y-2">
        <Label>URL</Label>
        {displayUrls.map((url, index) => (
          <div key={urlKeys[index]} className="flex items-center gap-1">
            <Input
              type="url"
              value={url}
              onChange={(e) => {
                const next = [...displayUrls];
                next[index] = e.target.value;
                onUrlsChange(next);
              }}
              placeholder="https://..."
              maxLength={SCHEDULE_URL_MAX_LENGTH}
            />
            {index > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  removeUrlKey(index);
                  onUrlsChange(displayUrls.filter((_, i) => i !== index));
                }}
                aria-label="URL を削除"
              >
                <Minus className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {displayUrls.length < MAX_URLS_PER_SCHEDULE && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              addUrlKey();
              onUrlsChange([...displayUrls, ""]);
            }}
          >
            <Plus className="inline h-3 w-3" /> URL を追加
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{getTimeLabels(category).start}</Label>
          <TimeInput value={startTime} onChange={onStartTimeChange} />
        </div>
        <div className="space-y-2">
          <Label>{getTimeLabels(category).end}</Label>
          <TimeInput value={endTime} onChange={onEndTimeChange} />
        </div>
      </div>
      {maxEndDayOffset > 0 && (
        <div className="space-y-2">
          <Label>{getTimeLabels(category).end}日</Label>
          <Select
            value={String(endDayOffset)}
            onValueChange={(v) => onEndDayOffsetChange(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getEndDayOptions(maxEndDayOffset).map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {timeError && <p className="text-sm text-destructive">{timeError}</p>}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}memo`}>メモ</Label>
        <Textarea
          id={`${idPrefix}memo`}
          name="memo"
          rows={3}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={SCHEDULE_MEMO_MAX_LENGTH}
        />
        <p className="text-right text-xs text-muted-foreground">
          {memo.length}/{SCHEDULE_MEMO_MAX_LENGTH}
        </p>
      </div>
    </>
  );
}
