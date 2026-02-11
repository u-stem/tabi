"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DateRangePicker } from "@/components/date-range-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";

export default function NewTripPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      destination: formData.get("destination") as string,
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
    };

    if (!data.startDate || !data.endDate) {
      setError(MSG.TRIP_DATE_REQUIRED);
      setLoading(false);
      return;
    }

    try {
      const trip = await api<{ id: string }>("/api/trips", {
        method: "POST",
        body: JSON.stringify(data),
      });
      toast.success(MSG.TRIP_CREATED);
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : MSG.TRIP_CREATE_FAILED);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                旅行タイトル <span className="text-destructive">*</span>
              </Label>
              <Input id="title" name="title" placeholder="京都3日間の旅" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">
                目的地 <span className="text-destructive">*</span>
              </Label>
              <Input id="destination" name="destination" placeholder="京都" required />
            </div>
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
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={loading}>
                <Plus className="h-4 w-4" />
                {loading ? "作成中..." : "作成"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
