"use client";

import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TimeInputProps = {
  value?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  className?: string;
};

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function parseTime(value?: string): { hour: string; minute: string } | null {
  if (!value) return null;
  const [h, m] = value.split(":");
  if (!h || !m) return null;
  return { hour: h, minute: m };
}

export function TimeInput({ value, onChange, disabled, className }: TimeInputProps) {
  const parsed = parseTime(value);

  function handleHourChange(hour: string) {
    const m = parsed?.minute ?? "00";
    onChange(`${hour}:${m}`);
  }

  function handleMinuteChange(minute: string) {
    const h = parsed?.hour ?? "09";
    onChange(`${h}:${minute}`);
  }

  function handleClear() {
    onChange(undefined);
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Select value={parsed?.hour ?? ""} onValueChange={handleHourChange} disabled={disabled}>
        <SelectTrigger className="w-[70px]">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent>
          {hours.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select value={parsed?.minute ?? ""} onValueChange={handleMinuteChange} disabled={disabled}>
        <SelectTrigger className="w-[70px]">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent>
          {minutes.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {parsed && (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="ml-1 rounded p-1 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          aria-label="時刻をクリア"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
