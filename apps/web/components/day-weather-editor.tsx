"use client";

import { WEATHER_LABELS, WEATHER_TYPES, type WeatherType } from "@sugara/shared";
import { ArrowRight, Check, Cloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useDayWeather } from "@/lib/hooks/use-day-weather";
import { cn } from "@/lib/utils";
import { WEATHER_ICON, WEATHER_ICON_COLOR } from "@/lib/weather-icons";

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
            return (
              <PrimaryIcon
                className={cn("h-5 w-5 shrink-0", WEATHER_ICON_COLOR[currentWeatherType])}
              />
            );
          })()}
          <span className="flex items-center gap-1">
            <span>{WEATHER_LABELS[currentWeatherType]}</span>
            {currentWeatherTypeSecondary != null && (
              <>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {(() => {
                  const SecondaryIcon = WEATHER_ICON[currentWeatherTypeSecondary];
                  return (
                    <SecondaryIcon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        WEATHER_ICON_COLOR[currentWeatherTypeSecondary],
                      )}
                    />
                  );
                })()}
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
  const primary = weatherHook.weather.weatherType;
  const secondary = weatherHook.weather.weatherTypeSecondary;

  const handleClick = (type: WeatherType) => {
    weatherHook.setWeather((prev) => {
      if (prev.weatherType === type) {
        // 1つ目を再タップ → 全クリア
        return { ...prev, weatherType: null, weatherTypeSecondary: null };
      }
      if (prev.weatherTypeSecondary === type) {
        // 2つ目を再タップ → 2つ目だけクリア
        return { ...prev, weatherTypeSecondary: null };
      }
      if (prev.weatherType == null) {
        // 未選択 → 1つ目に設定
        return { ...prev, weatherType: type };
      }
      // 1つ目が選択済み → 2つ目に設定（上書き）
      return { ...prev, weatherTypeSecondary: type };
    });
  };

  const pickerClass = gridLayout ? "grid grid-cols-3 gap-2" : "flex flex-wrap gap-1";

  const buttonClass = gridLayout
    ? "flex flex-col items-center justify-center gap-1 rounded-md border py-3 transition-colors"
    : "flex h-9 w-9 items-center justify-center rounded-md border transition-colors";

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="flex min-h-[2.5rem] items-center gap-2 rounded-md border px-3 py-2 text-sm">
        {primary != null ? (
          <>
            {(() => {
              const Icon = WEATHER_ICON[primary];
              return <Icon className="h-5 w-5 shrink-0" />;
            })()}
            <span>{WEATHER_LABELS[primary]}</span>
            {secondary != null ? (
              <>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(() => {
                  const Icon = WEATHER_ICON[secondary];
                  return <Icon className="h-5 w-5 shrink-0" />;
                })()}
                <span>{WEATHER_LABELS[secondary]}</span>
              </>
            ) : (
              <span className="text-muted-foreground">（2つ目でのちを設定）</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">天気を選択してください</span>
        )}
      </div>

      {/* Weather grid */}
      <div className="space-y-2">
        <Label>天気</Label>
        <div className={pickerClass}>
          {WEATHER_TYPES.map((type) => {
            const Icon = WEATHER_ICON[type];
            const isPrimary = primary === type;
            const isSecondary = secondary === type;
            return (
              <button
                key={type}
                type="button"
                title={WEATHER_LABELS[type]}
                onClick={() => handleClick(type)}
                className={cn(
                  buttonClass,
                  isPrimary || isSecondary
                    ? "border-primary bg-primary/20"
                    : "border-border hover:bg-muted",
                )}
              >
                <Icon
                  className={cn("h-6 w-6", !(isPrimary || isSecondary) && WEATHER_ICON_COLOR[type])}
                />
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

      {/* Temperature inputs */}
      <div className="space-y-2">
        <Label>気温</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">最高</span>
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
              className={cn(gridLayout ? "flex-1" : "w-24", "text-center")}
            />
            <span className="text-sm text-muted-foreground">°C</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">最低</span>
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
              className={cn(gridLayout ? "flex-1" : "w-24", "text-center")}
            />
            <span className="text-sm text-muted-foreground">°C</span>
          </div>
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
            <DrawerFooter className="flex-row [&>*]:flex-1">
              <Button
                variant="outline"
                onClick={weatherHook.cancelEdit}
                disabled={weatherHook.saving}
              >
                <X className="h-4 w-4" />
                キャンセル
              </Button>
              <Button onClick={weatherHook.save} disabled={weatherHook.saving}>
                <Check className="h-4 w-4" />
                {weatherHook.saving ? "保存中..." : "保存"}
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
