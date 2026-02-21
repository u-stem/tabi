"use client";

import { ImagePlus, Move, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = "image/jpeg,image/png,image/webp";

const PREVIEW_MODES = {
  home: { label: "ホーム", aspect: "aspect-video" },
  detail: { label: "詳細", aspect: "aspect-[3/1]" },
} as const;

type PreviewMode = keyof typeof PREVIEW_MODES;

type CoverImagePickerProps = {
  imageUrl: string | null;
  previewFile: File | null;
  position: number;
  onFileSelect: (file: File | null) => void;
  onPositionChange: (position: number) => void;
  onRemove: () => void;
  disabled?: boolean;
};

export function CoverImagePicker({
  imageUrl,
  previewFile,
  position,
  onFileSelect,
  onPositionChange,
  onRemove,
  disabled = false,
}: CoverImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ y: number; startPosition: number } | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("home");

  const previewUrl = useMemo(
    () => (previewFile ? URL.createObjectURL(previewFile) : imageUrl),
    [previewFile, imageUrl],
  );

  useEffect(() => {
    return () => {
      if (previewFile && previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewFile, previewUrl]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      onFileSelect(file);
      e.target.value = "";
    },
    [onFileSelect],
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      setDragging(true);
      dragStartRef.current = { y: e.clientY, startPosition: position };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled, position],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current || !containerRef.current) return;
      const containerHeight = containerRef.current.offsetHeight;
      // Amplify drag delta for better control in a small preview
      const deltaY = e.clientY - dragStartRef.current.y;
      const deltaPercent = (deltaY / containerHeight) * 200;
      const newPosition = Math.round(
        Math.min(100, Math.max(0, dragStartRef.current.startPosition + deltaPercent)),
      );
      onPositionChange(newPosition);
    },
    [onPositionChange],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    dragStartRef.current = null;
  }, []);

  return (
    <div className="space-y-2">
      <Label>カバー画像</Label>
      {previewUrl ? (
        <div className="space-y-1">
          <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as PreviewMode)}>
            <TabsList className="w-full">
              {(
                Object.entries(PREVIEW_MODES) as [
                  PreviewMode,
                  (typeof PREVIEW_MODES)[PreviewMode],
                ][]
              ).map(([key, { label }]) => (
                <TabsTrigger key={key} value={key} className="flex-1">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Preview: renders exactly like the real TripCard/TripHeader */}
          <div
            ref={containerRef}
            className={cn(
              "relative w-full overflow-hidden rounded-md border",
              PREVIEW_MODES[previewMode].aspect,
              !disabled && "cursor-grab",
              dragging && "cursor-grabbing",
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <img
              src={previewUrl}
              alt="カバー画像プレビュー"
              className="pointer-events-none h-full w-full object-cover"
              style={{ objectPosition: `center ${position}%` }}
              draggable={false}
            />

            {!disabled && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/30 py-1 text-xs text-white">
                <Move className="h-3 w-3" />
                ドラッグで位置を調整
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
            >
              画像を変更
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRemove}
              disabled={disabled}
            >
              <X className="h-3.5 w-3.5" />
              削除
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          disabled={disabled}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed py-8 text-muted-foreground transition-colors",
            !disabled && "cursor-pointer hover:border-primary hover:text-primary",
          )}
        >
          <ImagePlus className="h-8 w-8" />
          <span className="text-sm">クリックまたはドラッグ&ドロップで画像を選択</span>
          <span className="text-xs">JPEG, PNG, WebP (3MB以下)</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
