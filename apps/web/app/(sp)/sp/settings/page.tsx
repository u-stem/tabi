/**
 * SP Settings page — excludes the profile tab (handled by /sp/my/edit instead).
 */
import SettingsPage from "@/app/(authenticated)/settings/page";

const SP_SECTIONS = ["account", "notifications", "other"] as const;

export default function SpSettingsPage() {
  return <SettingsPage availableSections={SP_SECTIONS} />;
}
