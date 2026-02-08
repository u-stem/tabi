"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import type { MemberResponse } from "@tabi/shared";

type MemberDialogProps = {
  tripId: string;
};

export function MemberDialog({ tripId }: MemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [adding, setAdding] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<MemberResponse[]>(`/api/trips/${tripId}/members`);
      setMembers(data);
    } catch {
      toast.error("メンバー一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, fetchMembers]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api(`/api/trips/${tripId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      toast.success("メンバーを追加しました");
      setEmail("");
      fetchMembers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "メンバーの追加に失敗しました";
      toast.error(message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await api(`/api/trips/${tripId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      toast.success("ロールを変更しました");
      fetchMembers();
    } catch {
      toast.error("ロールの変更に失敗しました");
    }
  }

  async function handleRemove(userId: string) {
    try {
      await api(`/api/trips/${tripId}/members/${userId}`, {
        method: "DELETE",
      });
      toast.success("メンバーを削除しました");
      fetchMembers();
    } catch {
      toast.error("メンバーの削除に失敗しました");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          メンバー
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>メンバー管理</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.userId} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  {member.role === "owner" ? (
                    <span className="shrink-0 text-xs text-muted-foreground">オーナー</span>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      <Select value={member.role} onValueChange={(v) => handleRoleChange(member.userId, v)}>
                        <SelectTrigger className="h-7 w-[100px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">編集者</SelectItem>
                          <SelectItem value="viewer">閲覧者</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(member.userId)}
                      >
                        削除
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAdd} className="space-y-3 border-t pt-3">
            <Label className="text-sm font-medium">メンバーを追加</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">編集者</SelectItem>
                  <SelectItem value="viewer">閲覧者</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={adding}>
              {adding ? "追加中..." : "追加"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
