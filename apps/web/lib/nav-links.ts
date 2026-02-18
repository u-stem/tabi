import { Bookmark, Home, Users } from "lucide-react";

export const NAV_LINKS = [
  { href: "/home", label: "ホーム", icon: Home },
  { href: "/bookmarks", label: "ブックマーク", icon: Bookmark },
  { href: "/friends", label: "フレンド", icon: Users },
] as const;
