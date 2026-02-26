"use client";

import {
  MAX_ADDRESSES_PER_SOUVENIR,
  MAX_URLS_PER_SOUVENIR,
  SOUVENIR_ADDRESS_MAX_LENGTH,
  SOUVENIR_NAME_MAX_LENGTH,
  SOUVENIR_RECIPIENT_MAX_LENGTH,
  SOUVENIR_URL_MAX_LENGTH,
} from "@sugara/shared";
import { Check, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
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
  urls: string[];
  addresses: string[];
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

function useStringArrayField(initial: string[]) {
  const displayValues = initial.length > 0 ? initial : [""];
  const nextKeyRef = useRef(displayValues.length);
  const [keys, setKeys] = useState<number[]>(() => displayValues.map((_, i) => i));

  useEffect(() => {
    nextKeyRef.current = displayValues.length;
    setKeys(Array.from({ length: displayValues.length }, (_, i) => i));
  }, [displayValues.length]);

  const addKey = useCallback(() => {
    const key = nextKeyRef.current++;
    setKeys((prev) => [...prev, key]);
  }, []);

  const removeKey = useCallback((index: number) => {
    setKeys((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return { keys, addKey, removeKey };
}

export function SouvenirDialog({ tripId, open, onOpenChange, item, onSaved }: SouvenirDialogProps) {
  const isEdit = !!item;
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name);
      setRecipient(item.recipient ?? "");
      setUrls(item.urls);
      setAddresses(item.addresses);
      setMemo(item.memo ?? "");
    } else {
      setName("");
      setRecipient("");
      setUrls([]);
      setAddresses([]);
      setMemo("");
    }
  }, [open, item]);

  const displayUrls = urls.length > 0 ? urls : [""];
  const displayAddresses = addresses.length > 0 ? addresses : [""];

  const urlField = useStringArrayField(urls);
  const addressField = useStringArrayField(addresses);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        recipient: recipient.trim() || null,
        urls: urls.filter((u) => u.trim()),
        addresses: addresses.filter((a) => a.trim()),
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
          <ResponsiveDialogDescription>
            {isEdit ? "お土産の内容を変更します。" : "新しいお土産を追加します。"}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="souvenir-name">
              品名 <span className="text-destructive">*</span>
            </Label>
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
            <Label htmlFor="souvenir-recipient">対象</Label>
            <Input
              id="souvenir-recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="例: お母さん"
              maxLength={SOUVENIR_RECIPIENT_MAX_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <Label>住所・場所</Label>
            {displayAddresses.map((addr, index) => (
              <div key={addressField.keys[index]} className="flex items-center gap-1">
                <Input
                  value={addr}
                  onChange={(e) => {
                    const next = [...displayAddresses];
                    next[index] = e.target.value;
                    setAddresses(next);
                  }}
                  placeholder="例: 渋谷区道玄坂..."
                  maxLength={SOUVENIR_ADDRESS_MAX_LENGTH}
                />
                {index > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      addressField.removeKey(index);
                      setAddresses(displayAddresses.filter((_, i) => i !== index));
                    }}
                    aria-label="住所を削除"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {displayAddresses.length < MAX_ADDRESSES_PER_SOUVENIR && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  addressField.addKey();
                  setAddresses([...displayAddresses, ""]);
                }}
              >
                <Plus className="inline h-3 w-3" /> 住所を追加
              </button>
            )}
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            {displayUrls.map((url, index) => (
              <div key={urlField.keys[index]} className="flex items-center gap-1">
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    const next = [...displayUrls];
                    next[index] = e.target.value;
                    setUrls(next);
                  }}
                  placeholder="https://..."
                  maxLength={SOUVENIR_URL_MAX_LENGTH}
                />
                {index > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      urlField.removeKey(index);
                      setUrls(displayUrls.filter((_, i) => i !== index));
                    }}
                    aria-label="URL を削除"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {displayUrls.length < MAX_URLS_PER_SOUVENIR && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  urlField.addKey();
                  setUrls([...displayUrls, ""]);
                }}
              >
                <Plus className="inline h-3 w-3" /> URL を追加
              </button>
            )}
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
              {isEdit ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {loading ? "保存中..." : isEdit ? "保存" : "追加"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
