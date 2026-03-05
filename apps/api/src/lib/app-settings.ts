import { db } from "../db/index";
import { appSettings } from "../db/schema";

export type MapsMode = "off" | "admin_only" | "public";

export type AppSettings = {
  signupEnabled: boolean;
  mapsMode: MapsMode;
};

const VALID_MAPS_MODES: ReadonlySet<string> = new Set(["off", "admin_only", "public"]);

export function isValidMapsMode(value: unknown): value is MapsMode {
  return typeof value === "string" && VALID_MAPS_MODES.has(value);
}

// Reads the single settings row. Falls back to permissive defaults if the row
// is missing (e.g., before the INSERT migration runs in CI).
export async function getAppSettings(): Promise<AppSettings> {
  const row = await db
    .select({
      signupEnabled: appSettings.signupEnabled,
      mapsMode: appSettings.mapsMode,
    })
    .from(appSettings)
    .limit(1);

  if (!row[0]) {
    return {
      signupEnabled: true,
      mapsMode: "admin_only",
    };
  }

  return {
    ...row[0],
    mapsMode: row[0].mapsMode as MapsMode,
  };
}
