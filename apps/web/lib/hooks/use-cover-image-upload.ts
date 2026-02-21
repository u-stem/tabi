import { useCallback, useState } from "react";

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type UseCoverImageUploadReturn = {
  uploading: boolean;
  error: string | null;
  upload: (tripId: string, file: File) => Promise<string | null>;
  remove: (tripId: string) => Promise<void>;
};

export function useCoverImageUpload(): UseCoverImageUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (tripId: string, file: File): Promise<string | null> => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("JPEG、PNG、WebP のみアップロードできます");
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("ファイルサイズは3MB以下にしてください");
      return null;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/trips/${tripId}/cover-image`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        const message = typeof body.error === "string" ? body.error : "アップロードに失敗しました";
        console.error("Cover image upload failed:", message);
        setError("アップロードに失敗しました");
        return null;
      }

      const data = await res.json();
      return data.coverImageUrl;
    } catch (err) {
      console.error("Cover image upload failed:", err);
      setError("アップロードに失敗しました");
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  const remove = useCallback(async (tripId: string) => {
    try {
      await fetch(`/api/trips/${tripId}/cover-image`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch (err) {
      console.error("Cover image delete failed:", err);
    }
  }, []);

  return { uploading, error, upload, remove };
}
