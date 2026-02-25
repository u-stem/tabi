import { Bookmark, Home, Users } from "lucide-react";

export const SP_NAV_LINKS = [
  { href: "/sp/home", label: "ホーム", icon: Home },
  { href: "/sp/bookmarks", label: "ブックマーク", icon: Bookmark },
  { href: "/sp/friends", label: "フレンド", icon: Users },
] as const;
