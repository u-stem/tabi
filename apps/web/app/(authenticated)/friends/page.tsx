"use client";

import { useEffect } from "react";
import { pageTitle } from "@/lib/constants";
import { FriendsTab, SendRequestSection } from "./_components/friends-tab";
import { GroupsTab } from "./_components/groups-tab";

export default function FriendsPage() {
  useEffect(() => {
    document.title = pageTitle("フレンド");
  }, []);

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-8">
      <FriendsTab />
      <GroupsTab />
      <SendRequestSection />
    </div>
  );
}
