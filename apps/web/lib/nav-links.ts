import { Bookmark, Home, UserPlus } from "lucide-react";

export const NAV_LINKS = [
  { href: "/home", label: "ホーム", icon: Home },
  { href: "/bookmarks", label: "ブックマーク", icon: Bookmark },
  { href: "/friends", label: "フレンド", icon: UserPlus },
] as const;
