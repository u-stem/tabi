"use client";

import type { MemberResponse } from "@sugara/shared";
import { UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";

type MemberDialogProps = {
  tripId: string;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MemberDialog({ tripId, isOwner, open, onOpenChange }: MemberDialogProps) {
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
      toast.error(MSG.MEMBER_LIST_FAILED);
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
      toast.success(MSG.MEMBER_ADDED);
      setEmail("");
      fetchMembers();
    } catch (err) {
      const message = err instanceof Error ? err.message : MSG.MEMBER_ADD_FAILED;
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
      toast.success(MSG.MEMBER_ROLE_CHANGED);
      fetchMembers();
    } catch {
      toast.error(MSG.MEMBER_ROLE_CHANGE_FAILED);
    }
  }

  async function handleRemove(userId: string) {
    try {
      await api(`/api/trips/${tripId}/members/${userId}`, {
        method: "DELETE",
      });
      toast.success(MSG.MEMBER_REMOVED);
      fetchMembers();
    } catch {
      toast.error(MSG.MEMBER_REMOVE_FAILED);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setEmail("");
          setRole("editor");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>メンバー管理</DialogTitle>
          <DialogDescription>旅行メンバーの招待と権限を管理します</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "40vh" }}>
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  {member.role === "owner" ? (
                    <span className="shrink-0 text-xs text-muted-foreground">オーナー</span>
                  ) : isOwner ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleRoleChange(member.userId, v)}
                      >
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
                        aria-label={`${member.name}を削除`}
                        onClick={() => handleRemove(member.userId)}
                      >
                        削除
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {member.role === "editor" ? "編集者" : "閲覧者"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {isOwner && (
            <form onSubmit={handleAdd} className="space-y-3 border-t pt-3">
              <Label className="text-sm font-medium">メンバーを追加</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="user@example.com"
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
              <DialogFooter>
                <Button type="submit" size="sm" disabled={adding}>
                  <UserPlus className="h-4 w-4" />
                  {adding ? "追加中..." : "追加"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
