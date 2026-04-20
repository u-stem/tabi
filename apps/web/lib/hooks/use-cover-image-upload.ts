import { useTranslations } from "next-intl";
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
  const tm = useTranslations("messages");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (tripId: string, file: File): Promise<string | null> => {
      setError(null);

      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(tm("coverImageInvalidType"));
        return null;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError(tm("coverImageTooLarge"));
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
          setError(tm("coverImageUploadFailed"));
          return null;
        }

        const data = await res.json();
        return data.coverImageUrl;
      } catch {
        setError(tm("coverImageUploadFailed"));
        return null;
      } finally {
        setUploading(false);
      }
    },
    [tm],
  );

  const remove = useCallback(async (tripId: string) => {
    // Best-effort: if the remove call fails, we surface the state via the caller's reload,
    // so swallowing here avoids a noisy console for a non-fatal cleanup.
    await fetch(`/api/trips/${tripId}/cover-image`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => undefined);
  }, []);

  return { uploading, error, upload, remove };
}
