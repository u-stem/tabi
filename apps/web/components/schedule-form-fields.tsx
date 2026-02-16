"use client";

import type { ScheduleCategory, ScheduleColor, TransportMethod } from "@sugara/shared";
import {
  SCHEDULE_ADDRESS_MAX_LENGTH,
  SCHEDULE_COLOR_LABELS,
  SCHEDULE_COLORS,
  SCHEDULE_MEMO_MAX_LENGTH,
  SCHEDULE_NAME_MAX_LENGTH,
  SCHEDULE_PLACE_MAX_LENGTH,
  SCHEDULE_URL_MAX_LENGTH,
} from "@sugara/shared";
import { TimeInput } from "@/components/time-input";
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
  defaultValues?: {
    name?: string;
    address?: string;
    url?: string;
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
  defaultValues,
  idPrefix = "",
}: ScheduleFormFieldsProps) {
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
        <Label htmlFor={`${idPrefix}url`}>URL</Label>
        <Input
          id={`${idPrefix}url`}
          name="url"
          type="url"
          defaultValue={defaultValues?.url}
          placeholder="https://..."
          maxLength={SCHEDULE_URL_MAX_LENGTH}
        />
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
