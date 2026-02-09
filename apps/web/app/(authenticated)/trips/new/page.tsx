"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export default function NewTripPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

    if (data.startDate > data.endDate) {
      setError("出発日は帰着日より前に設定してください");
      setLoading(false);
      return;
    }

    try {
      const trip = await api<{ id: string }>("/api/trips", {
        method: "POST",
        body: JSON.stringify(data),
      });
      toast.success("旅行を作成しました");
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "旅行の作成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden="true">&larr;</span> ホームに戻る
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>新しい旅行を作成</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">旅行タイトル</Label>
              <Input id="title" name="title" placeholder="京都3日間の旅" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">目的地</Label>
              <Input id="destination" name="destination" placeholder="京都" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">出発日</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">帰着日</Label>
                <Input id="endDate" name="endDate" type="date" required />
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "作成中..." : "旅行を作成"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
