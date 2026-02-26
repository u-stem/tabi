"use client";

import {
  SOUVENIR_ADDRESS_MAX_LENGTH,
  SOUVENIR_NAME_MAX_LENGTH,
  SOUVENIR_RECIPIENT_MAX_LENGTH,
  SOUVENIR_URL_MAX_LENGTH,
} from "@sugara/shared";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, getApiErrorMessage } from "@/lib/api";

type SouvenirItem = {
  id: string;
  name: string;
  recipient: string | null;
  url: string | null;
  address: string | null;
  memo: string | null;
  isPurchased: boolean;
};

type SouvenirDialogProps = {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: SouvenirItem | null;
  onSaved: () => void;
};

export function SouvenirDialog({ tripId, open, onOpenChange, item, onSaved }: SouvenirDialogProps) {
  const isEdit = !!item;
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [url, setUrl] = useState("");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name);
      setRecipient(item.recipient ?? "");
      setUrl(item.url ?? "");
      setAddress(item.address ?? "");
      setMemo(item.memo ?? "");
    } else {
      setName("");
      setRecipient("");
      setUrl("");
      setAddress("");
      setMemo("");
    }
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        recipient: recipient.trim() || null,
        url: url.trim() || null,
        address: address.trim() || null,
        memo: memo.trim() || null,
      };

      if (isEdit) {
        await api(`/api/trips/${tripId}/souvenirs/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api(`/api/trips/${tripId}/souvenirs`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save souvenir"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{isEdit ? "お土産を編集" : "お土産を追加"}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="souvenir-name">品名</Label>
            <Input
              id="souvenir-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 東京バナナ"
              maxLength={SOUVENIR_NAME_MAX_LENGTH}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="souvenir-recipient">誰向け</Label>
            <Input
              id="souvenir-recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="例: お母さん"
              maxLength={SOUVENIR_RECIPIENT_MAX_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="souvenir-url">URL</Label>
            <Input
              id="souvenir-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              maxLength={SOUVENIR_URL_MAX_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="souvenir-address">住所・場所</Label>
            <Input
              id="souvenir-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="例: 渋谷区道玄坂..."
              maxLength={SOUVENIR_ADDRESS_MAX_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="souvenir-memo">メモ</Label>
            <Textarea
              id="souvenir-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="自由メモ"
              rows={2}
            />
          </div>
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose asChild>
              <Button type="button" variant="outline">
                <X className="h-4 w-4" />
                キャンセル
              </Button>
            </ResponsiveDialogClose>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "保存中..." : isEdit ? "保存" : "追加"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
