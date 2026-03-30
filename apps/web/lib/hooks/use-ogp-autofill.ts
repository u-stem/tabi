import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

type UseOgpAutofillParams = {
  url: string;
  name: string;
  onTitleFetched: (title: string) => void;
};

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function useOgpAutofill({ url, name, onTitleFetched }: UseOgpAutofillParams) {
  const fetchedUrlRef = useRef<string>("");
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!url || name || !isValidHttpsUrl(url)) return;
    if (url === fetchedUrlRef.current) return;
    if (loadingRef.current) return;

    const timer = setTimeout(async () => {
      loadingRef.current = true;
      try {
        const { title } = await api<{ title: string }>("/api/ogp", {
          params: { url },
        });
        fetchedUrlRef.current = url;
        if (title) {
          onTitleFetched(title);
        }
      } catch {
        // Silently fail - user can type manually
      } finally {
        loadingRef.current = false;
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [url, name, onTitleFetched]);
}
