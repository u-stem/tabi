import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type UseCoverImageUploadReturn = {
  uploading: boolean;
  error: string | null;
  upload: (tripId: string, file: File) => Promise<string | null>;
  remove: (url: string) => Promise<void>;
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
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${tripId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("trip-covers")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setError("アップロードに失敗しました");
        return null;
      }

      const { data } = supabase.storage.from("trip-covers").getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  }, []);

  const remove = useCallback(async (url: string) => {
    const match = url.match(/\/trip-covers\/(.+)$/);
    if (!match) return;
    await supabase.storage.from("trip-covers").remove([match[1]]);
  }, []);

  return { uploading, error, upload, remove };
}
