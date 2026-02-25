import { Bookmark, Home, Users } from "lucide-react";

const NAV_LINK_DEFS = [
  { path: "/home", label: "ホーム", icon: Home },
  { path: "/bookmarks", label: "ブックマーク", icon: Bookmark },
  { path: "/friends", label: "フレンド", icon: Users },
] as const;

export const NAV_LINKS = NAV_LINK_DEFS.map((l) => ({ ...l, href: l.path })) as {
  path: (typeof NAV_LINK_DEFS)[number]["path"];
  label: (typeof NAV_LINK_DEFS)[number]["label"];
  icon: (typeof NAV_LINK_DEFS)[number]["icon"];
  href: (typeof NAV_LINK_DEFS)[number]["path"];
}[];

export const SP_NAV_LINKS = NAV_LINK_DEFS.map((l) => ({
  ...l,
  href: `/sp${l.path}` as `/sp${(typeof NAV_LINK_DEFS)[number]["path"]}`,
})) as {
  path: (typeof NAV_LINK_DEFS)[number]["path"];
  label: (typeof NAV_LINK_DEFS)[number]["label"];
  icon: (typeof NAV_LINK_DEFS)[number]["icon"];
  href: `/sp${(typeof NAV_LINK_DEFS)[number]["path"]}`;
}[];
