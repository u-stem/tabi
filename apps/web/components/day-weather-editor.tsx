"use client";

import { WEATHER_LABELS, WEATHER_TYPES, type WeatherType } from "@sugara/shared";
import { Check, Cloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import type { useDayWeather } from "@/lib/hooks/use-day-weather";
import { cn } from "@/lib/utils";
import { WEATHER_ICON } from "@/lib/weather-icons";

type Weather = ReturnType<typeof useDayWeather>;

type DayWeatherEditorProps = {
  weatherHook: Weather;
  currentDayId: string;
  currentWeatherType?: WeatherType | null;
  currentWeatherTypeSecondary?: WeatherType | null;
  currentTempHigh?: number | null;
  currentTempLow?: number | null;
  canEdit: boolean;
  online: boolean;
  variant?: "inline" | "drawer";
};

function WeatherTrigger({
  currentWeatherType,
  currentWeatherTypeSecondary,
  currentTempHigh,
  currentTempLow,
  canEdit,
  online,
  onClick,
}: {
  currentWeatherType?: WeatherType | null;
  currentWeatherTypeSecondary?: WeatherType | null;
  currentTempHigh?: number | null;
  currentTempLow?: number | null;
  canEdit: boolean;
  online: boolean;
  onClick: () => void;
}) {
  const hasWeather = currentWeatherType != null;
  return (
    <button
      type="button"
      onClick={canEdit && online ? onClick : undefined}
      className={cn(
        "flex w-full select-none items-center gap-2 rounded-md border border-dashed px-3 py-2 text-left text-sm transition-colors",
        canEdit && online
          ? "cursor-pointer hover:border-border hover:bg-muted/50"
          : "cursor-default",
        hasWeather
          ? "border-border text-foreground"
          : "border-muted-foreground/20 text-muted-foreground",
      )}
    >
      {hasWeather ? (
        <>
          {(() => {
            const PrimaryIcon = WEATHER_ICON[currentWeatherType];
            return <PrimaryIcon className="h-5 w-5 shrink-0" />;
          })()}
          <span className="flex items-center gap-1">
            <span>{WEATHER_LABELS[currentWeatherType]}</span>
            {currentWeatherTypeSecondary != null && (
              <>
                <span className="text-muted-foreground">のち</span>
                <span>{WEATHER_LABELS[currentWeatherTypeSecondary]}</span>
              </>
            )}
            {(currentTempHigh != null || currentTempLow != null) && (
              <span className="text-muted-foreground">
                {currentTempHigh != null ? `${currentTempHigh}°` : "--"}
                {" / "}
                {currentTempLow != null ? `${currentTempLow}°` : "--"}
              </span>
            )}
          </span>
        </>
      ) : (
        <>
          <Cloud className="h-3.5 w-3.5 shrink-0" />
          <span>天気を追加</span>
        </>
      )}
    </button>
  );
}

function WeatherPickerForm({
  weatherHook,
  gridLayout,
}: {
  weatherHook: Weather;
  gridLayout?: boolean;
}) {
  const pickerClass = gridLayout ? "grid grid-cols-4 gap-1.5" : "flex flex-wrap gap-1";

  const buttonClass = gridLayout
    ? "flex flex-col items-center justify-center gap-0.5 rounded-md py-2 transition-colors"
    : "flex h-9 w-9 items-center justify-center rounded-md transition-colors";

  return (
    <div className="space-y-3">
      {/* Primary weather picker */}
      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">天気</p>
        <div className={pickerClass}>
          {WEATHER_TYPES.map((type) => {
            const Icon = WEATHER_ICON[type];
            return (
              <button
                key={type}
                type="button"
                title={WEATHER_LABELS[type]}
                onClick={() =>
                  weatherHook.setWeather((prev) => ({
                    ...prev,
                    weatherType: prev.weatherType === type ? null : type,
                    weatherTypeSecondary:
                      prev.weatherType === type ? null : prev.weatherTypeSecondary,
                  }))
                }
                className={cn(
                  buttonClass,
                  weatherHook.weather.weatherType === type
                    ? "bg-primary/20 ring-1 ring-primary"
                    : "hover:bg-muted",
                )}
              >
                <Icon className="h-6 w-6" />
                {gridLayout && (
                  <span className="text-center text-[10px] leading-tight">
                    {WEATHER_LABELS[type]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary weather picker (for "のち" pattern) */}
      {weatherHook.weather.weatherType != null && (
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">のち（省略可）</p>
          <div className={pickerClass}>
            {WEATHER_TYPES.map((type) => {
              const Icon = WEATHER_ICON[type];
              return (
                <button
                  key={type}
                  type="button"
                  title={WEATHER_LABELS[type]}
                  onClick={() =>
                    weatherHook.setWeather((prev) => ({
                      ...prev,
                      weatherTypeSecondary: prev.weatherTypeSecondary === type ? null : type,
                    }))
                  }
                  className={cn(
                    buttonClass,
                    weatherHook.weather.weatherTypeSecondary === type
                      ? "bg-primary/20 ring-1 ring-primary"
                      : "hover:bg-muted",
                  )}
                >
                  <Icon className="h-6 w-6" />
                  {gridLayout && (
                    <span className="text-center text-[10px] leading-tight">
                      {WEATHER_LABELS[type]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Temperature inputs */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">最高</span>
          <Input
            type="number"
            min={-50}
            max={60}
            value={weatherHook.weather.tempHigh ?? ""}
            onChange={(e) =>
              weatherHook.setWeather((prev) => ({
                ...prev,
                tempHigh: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            placeholder="--"
            className="h-7 w-16 text-center text-sm"
          />
          <span className="text-xs text-muted-foreground">°C</span>
        </div>
        <span className="text-xs text-muted-foreground">/</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">最低</span>
          <Input
            type="number"
            min={-50}
            max={60}
            value={weatherHook.weather.tempLow ?? ""}
            onChange={(e) =>
              weatherHook.setWeather((prev) => ({
                ...prev,
                tempLow: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            placeholder="--"
            className="h-7 w-16 text-center text-sm"
          />
          <span className="text-xs text-muted-foreground">°C</span>
        </div>
      </div>
    </div>
  );
}

export function DayWeatherEditor({
  weatherHook,
  currentDayId,
  currentWeatherType,
  currentWeatherTypeSecondary,
  currentTempHigh,
  currentTempLow,
  canEdit,
  online,
  variant = "inline",
}: DayWeatherEditorProps) {
  const isEditing = weatherHook.editingDayId === currentDayId;
  const hasWeather = currentWeatherType != null;

  const startEdit = () =>
    weatherHook.startEdit(currentDayId, {
      weatherType: currentWeatherType,
      weatherTypeSecondary: currentWeatherTypeSecondary,
      tempHigh: currentTempHigh,
      tempLow: currentTempLow,
    });

  if (variant === "drawer") {
    return (
      <div className="mb-3">
        <WeatherTrigger
          currentWeatherType={currentWeatherType}
          currentWeatherTypeSecondary={currentWeatherTypeSecondary}
          currentTempHigh={currentTempHigh}
          currentTempLow={currentTempLow}
          canEdit={canEdit}
          online={online}
          onClick={startEdit}
        />
        <Drawer
          open={isEditing}
          onOpenChange={(open) => {
            if (!open) weatherHook.cancelEdit();
          }}
        >
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>天気を設定</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-2">
              <WeatherPickerForm weatherHook={weatherHook} gridLayout />
            </div>
            <DrawerFooter>
              <Button onClick={weatherHook.save} disabled={weatherHook.saving}>
                <Check className="h-4 w-4" />
                {weatherHook.saving ? "保存中..." : "保存"}
              </Button>
              <Button
                variant="outline"
                onClick={weatherHook.cancelEdit}
                disabled={weatherHook.saving}
              >
                <X className="h-4 w-4" />
                キャンセル
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className="mb-3">
      {isEditing ? (
        <div className="space-y-3 rounded-md border border-border px-3 py-2">
          <WeatherPickerForm weatherHook={weatherHook} />

          {/* Actions */}
          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={weatherHook.cancelEdit}
              disabled={weatherHook.saving}
            >
              <X className="h-3.5 w-3.5" />
              キャンセル
            </Button>
            <Button size="sm" onClick={weatherHook.save} disabled={weatherHook.saving}>
              <Check className="h-3.5 w-3.5" />
              {weatherHook.saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      ) : (
        <WeatherTrigger
          currentWeatherType={currentWeatherType}
          currentWeatherTypeSecondary={currentWeatherTypeSecondary}
          currentTempHigh={currentTempHigh}
          currentTempLow={currentTempLow}
          canEdit={canEdit}
          online={online}
          onClick={startEdit}
        />
      )}
    </div>
  );
}
