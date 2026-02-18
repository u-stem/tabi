"use client";

import {
  BOOKMARK_MEMO_MAX_LENGTH,
  BOOKMARK_NAME_MAX_LENGTH,
  BOOKMARK_URL_MAX_LENGTH,
  MAX_URLS_PER_BOOKMARK,
} from "@sugara/shared";
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BookmarkFormFields({
  name,
  memo,
  urls,
  onNameChange,
  onMemoChange,
  onUrlsChange,
}: {
  name: string;
  memo: string;
  urls: string[];
  onNameChange: (v: string) => void;
  onMemoChange: (v: string) => void;
  onUrlsChange: (v: string[]) => void;
}) {
  const displayUrls = urls.length > 0 ? urls : [""];

  // Stable keys for the dynamic URL list to avoid index-based keys
  const nextKeyRef = useRef(displayUrls.length);
  const [urlKeys, setUrlKeys] = useState<number[]>(() => displayUrls.map((_, i) => i));
  const prevLengthRef = useRef(displayUrls.length);

  useEffect(() => {
    if (prevLengthRef.current !== displayUrls.length) {
      prevLengthRef.current = displayUrls.length;
      nextKeyRef.current = displayUrls.length;
      setUrlKeys(Array.from({ length: displayUrls.length }, (_, i) => i));
    }
  }, [displayUrls.length]);

  const addUrlKey = useCallback(() => {
    const key = nextKeyRef.current++;
    setUrlKeys((prev) => [...prev, key]);
  }, []);

  const removeUrlKey = useCallback((index: number) => {
    setUrlKeys((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="bookmark-name">名前</Label>
        <Input
          id="bookmark-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="金閣寺"
          maxLength={BOOKMARK_NAME_MAX_LENGTH}
          required
          autoFocus
        />
        <p className="text-right text-xs text-muted-foreground">
          {name.length}/{BOOKMARK_NAME_MAX_LENGTH}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bookmark-memo">メモ</Label>
        <Textarea
          id="bookmark-memo"
          value={memo}
          onChange={(e) => onMemoChange(e.target.value)}
          placeholder="拝観料 500円"
          rows={3}
          maxLength={BOOKMARK_MEMO_MAX_LENGTH}
        />
        <p className="text-right text-xs text-muted-foreground">
          {memo.length}/{BOOKMARK_MEMO_MAX_LENGTH}
        </p>
      </div>
      <div className="space-y-2">
        <Label>URL</Label>
        {displayUrls.map((url, index) => (
          <div key={urlKeys[index]} className="flex items-center gap-1">
            <Input
              type="url"
              value={url}
              onChange={(e) => {
                const next = [...displayUrls];
                next[index] = e.target.value;
                onUrlsChange(next);
              }}
              placeholder="https://..."
              maxLength={BOOKMARK_URL_MAX_LENGTH}
            />
            {index > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  removeUrlKey(index);
                  onUrlsChange(displayUrls.filter((_, i) => i !== index));
                }}
                aria-label="URL を削除"
              >
                <Minus className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {displayUrls.length < MAX_URLS_PER_BOOKMARK && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              addUrlKey();
              onUrlsChange([...displayUrls, ""]);
            }}
          >
            <Plus className="inline h-3 w-3" /> URL を追加
          </button>
        )}
      </div>
    </div>
  );
}
