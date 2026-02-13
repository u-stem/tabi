import { Home, UserPlus, Users } from "lucide-react";

export const NAV_LINKS = [
  { href: "/home", label: "ホーム", icon: Home },
  { href: "/shared-trips", label: "共有旅行", icon: Users },
  { href: "/friends", label: "フレンド", icon: UserPlus },
] as const;
