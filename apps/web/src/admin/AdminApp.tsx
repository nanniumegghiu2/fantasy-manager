import { useState } from "react";
import type { Profile } from "@app/shared-types";
import { AdminLayout, type AdminSection } from "./AdminLayout";
import { LeaguesScreen } from "./screens/LeaguesScreen";
import { PlayersScreen } from "./screens/PlayersScreen";
import { ClubsScreen } from "./screens/ClubsScreen";
import { ChallengesScreen } from "./screens/ChallengesScreen";

export default function AdminApp({ profile }: { profile: Profile }) {
  const [section, setSection] = useState<AdminSection>("leagues");

  return (
    <AdminLayout profile={profile} section={section} onSectionChange={setSection}>
      {section === "leagues" && <LeaguesScreen />}
      {section === "clubs" && <ClubsScreen />}
      {section === "players" && <PlayersScreen />}
      {section === "challenges" && <ChallengesScreen />}
    </AdminLayout>
  );
}
