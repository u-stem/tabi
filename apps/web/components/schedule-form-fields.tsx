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
import { useCallback, useState } from "react";
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
  // Always show at least one URL input
  const displayUrls = urls.length > 0 ? urls : [""];

  // Stable keys for the dynamic URL list to avoid index-based keys.
  // Key counter and key array are managed via state so they only change through event handlers.
  const [urlKeys, setUrlKeys] = useState<number[]>(() => displayUrls.map((_, i) => i));
  const [nextKey, setNextKey] = useState(displayUrls.length);

  // Sync keys when displayUrls length changes from parent (e.g. dialog reset)
  if (urlKeys.length !== displayUrls.length) {
    const synced = Array.from({ length: displayUrls.length }, (_, i) => i);
    setUrlKeys(synced);
    setNextKey(displayUrls.length);
  }

  const addUrlKey = useCallback(() => {
    setUrlKeys((prev) => [...prev, nextKey]);
    setNextKey((k) => k + 1);
  }, [nextKey]);

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
          defaultValue={defaultValues?.name}
          placeholder="金閣寺"
          required
          maxLength={SCHEDULE_NAME_MAX_LENGTH}
        />
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
            defaultValue={defaultValues?.address}
            placeholder="京都市北区金閣寺町1"
            maxLength={SCHEDULE_ADDRESS_MAX_LENGTH}
          />
        </div>
      )}
      {category === "transport" && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}departurePlace`}>出発地</Label>
            <Input
              id={`${idPrefix}departurePlace`}
              name="departurePlace"
              defaultValue={defaultValues?.departurePlace}
              placeholder="東京駅"
              maxLength={SCHEDULE_PLACE_MAX_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}arrivalPlace`}>到着地</Label>
            <Input
              id={`${idPrefix}arrivalPlace`}
              name="arrivalPlace"
              defaultValue={defaultValues?.arrivalPlace}
              placeholder="新大阪駅"
              maxLength={SCHEDULE_PLACE_MAX_LENGTH}
            />
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
          defaultValue={defaultValues?.memo}
          maxLength={SCHEDULE_MEMO_MAX_LENGTH}
        />
      </div>
    </>
  );
}
