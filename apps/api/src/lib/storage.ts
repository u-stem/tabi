import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ERROR_MSG } from "./constants";
import { logger } from "./logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:55321";

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

const SUPABASE_STORAGE_PATH_PREFIX = `/storage/v1/object/public/${TRIP_COVERS_BUCKET}/`;

/**
 * Extract the storage path from a Supabase public URL.
 * Returns null if the URL does not originate from the expected bucket.
 */
export function extractStoragePath(url: string): string | null {
  const idx = url.indexOf(SUPABASE_STORAGE_PATH_PREFIX);
  if (idx === -1) return null;
  const path = url.slice(idx + SUPABASE_STORAGE_PATH_PREFIX.length);
  // Prevent path traversal
  if (!path || path.includes("..")) return null;
  return path;
}

/**
 * Copy a cover image to a new trip's directory.
 * Returns the new public URL, or null if the copy failed.
 */
export async function copyCoverImage(
  sourceUrl: string,
  destTripId: string,
): Promise<string | null> {
  const sourcePath = extractStoragePath(sourceUrl);
  if (!sourcePath) return null;

  const ext = sourcePath.split(".").pop() || "jpg";
  const destPath = `${destTripId}/${Date.now()}.${ext}`;

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.storage.from(TRIP_COVERS_BUCKET).copy(sourcePath, destPath);

  if (error) {
    logger.error({ err: error.message }, "Storage copy failed");
    return null;
  }

  const { data } = supabaseAdmin.storage.from(TRIP_COVERS_BUCKET).getPublicUrl(destPath);
  return data.publicUrl;
}

export async function deleteCoverImage(url: string): Promise<void> {
  const path = extractStoragePath(url);
  if (!path) return;

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.storage.from(TRIP_COVERS_BUCKET).remove([path]);

  if (error) {
    logger.error({ err: error.message }, "Storage delete failed");
  }
}
