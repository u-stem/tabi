import { db } from "../db/index";
import { appSettings } from "../db/schema";

export type AppSettings = {
  signupEnabled: boolean;
};

// Reads the single settings row. Falls back to permissive defaults if the row
// is missing (e.g., before the INSERT migration runs in CI).
export async function getAppSettings(): Promise<AppSettings> {
  const row = await db
    .select({ signupEnabled: appSettings.signupEnabled })
    .from(appSettings)
    .limit(1);

  return row[0] ?? { signupEnabled: true };
}
