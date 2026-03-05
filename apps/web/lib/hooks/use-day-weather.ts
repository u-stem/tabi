import type { TripResponse, WeatherType } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type WeatherState = {
  weatherType: WeatherType | null;
  weatherTypeSecondary: WeatherType | null;
  tempHigh: number | null;
  tempLow: number | null;
};

type UseDayWeatherArgs = {
  tripId: string;
  currentDayId: string | null;
  onDone: () => void;
};

export function useDayWeather({ tripId, currentDayId, onDone }: UseDayWeatherArgs) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.trips.detail(tripId);

  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherState>({
    weatherType: null,
    weatherTypeSecondary: null,
    tempHigh: null,
    tempLow: null,
  });
  const [saving, setSaving] = useState(false);

  function startEdit(dayId: string, current: Partial<WeatherState>) {
    setEditingDayId(dayId);
    setWeather({
      weatherType: current.weatherType ?? null,
      weatherTypeSecondary: current.weatherTypeSecondary ?? null,
      tempHigh: current.tempHigh ?? null,
      tempLow: current.tempLow ?? null,
    });
  }

  function cancelEdit() {
    setEditingDayId(null);
    setWeather({ weatherType: null, weatherTypeSecondary: null, tempHigh: null, tempLow: null });
  }

  async function save() {
    if (!currentDayId || editingDayId !== currentDayId) return;
    setSaving(true);
    const dayId = currentDayId;
    const next = { ...weather };

    await queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(cacheKey, {
        ...prev,
        days: prev.days.map((d) => (d.id !== dayId ? d : { ...d, ...next })),
      });
    }
    toast.success(MSG.DAY_WEATHER_UPDATED);
    setEditingDayId(null);
    setWeather({ weatherType: null, weatherTypeSecondary: null, tempHigh: null, tempLow: null });

    try {
      await api(`/api/trips/${tripId}/days/${dayId}`, {
        method: "PATCH",
        body: JSON.stringify({
          weatherType: next.weatherType,
          weatherTypeSecondary: next.weatherTypeSecondary,
          tempHigh: next.tempHigh,
          tempLow: next.tempLow,
        }),
      });
      onDone();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.DAY_WEATHER_UPDATE_FAILED);
    } finally {
      setSaving(false);
    }
  }

  return {
    editingDayId,
    weather,
    setWeather,
    saving,
    startEdit,
    cancelEdit,
    save,
  };
}
