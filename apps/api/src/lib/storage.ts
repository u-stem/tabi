import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ERROR_MSG } from "./constants";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";

let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
    }
    _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return _supabaseAdmin;
}

export const TRIP_COVERS_BUCKET = "trip-covers";
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateCoverImage(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return ERROR_MSG.FILE_TYPE_NOT_ALLOWED;
  }
  if (file.size > MAX_FILE_SIZE) {
    return ERROR_MSG.FILE_TOO_LARGE;
  }
  return null;
}

export async function uploadCoverImage(
  tripId: string,
  file: Buffer,
  contentType: string,
): Promise<string> {
  const ext = EXT_MAP[contentType] || "jpg";
  const path = `${tripId}/${Date.now()}.${ext}`;

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.storage
    .from(TRIP_COVERS_BUCKET)
    .upload(path, file, { contentType, upsert: false });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from(TRIP_COVERS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Copy a cover image to a new trip's directory.
 * Returns the new public URL, or null if the copy failed.
 */
export async function copyCoverImage(
  sourceUrl: string,
  destTripId: string,
): Promise<string | null> {
  const match = sourceUrl.match(/\/trip-covers\/(.+)$/);
  if (!match) return null;

  const sourcePath = match[1];
  const ext = sourcePath.split(".").pop() || "jpg";
  const destPath = `${destTripId}/${Date.now()}.${ext}`;

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.storage.from(TRIP_COVERS_BUCKET).copy(sourcePath, destPath);

  if (error) {
    console.error("Storage copy failed:", error.message);
    return null;
  }

  const { data } = supabaseAdmin.storage.from(TRIP_COVERS_BUCKET).getPublicUrl(destPath);
  return data.publicUrl;
}

export async function deleteCoverImage(url: string): Promise<void> {
  const match = url.match(/\/trip-covers\/(.+)$/);
  if (!match) return;

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.storage.from(TRIP_COVERS_BUCKET).remove([match[1]]);

  if (error) {
    console.error("Storage delete failed:", error.message);
  }
}
