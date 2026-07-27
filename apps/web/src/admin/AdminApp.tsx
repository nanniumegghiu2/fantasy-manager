import { useState } from "react";
import type { Profile } from "@app/shared-types";
import { AdminLayout, type AdminSection } from "./AdminLayout";
import { LeaguesScreen } from "./screens/LeaguesScreen";
import { PlayersScreen } from "./screens/PlayersScreen";
import { ClubsScreen } from "./screens/ClubsScreen";
import { ChallengesScreen } from "./screens/ChallengesScreen";

export default function AdminApp({ profile }: { profile: Profile }) {
  const [section, setSection] = useState<AdminSection>("leagues");
  const [leagueFilter, setLeagueFilter] = useState<string | null>(null);
  const [clubFilter, setClubFilter] = useState<string | null>(null);

  function handleNavChange(next: AdminSection) {
    setLeagueFilter(null);
    setClubFilter(null);
    setSection(next);
  }

  return (
    <AdminLayout profile={profile} section={section} onSectionChange={handleNavChange}>
      {section === "leagues" && (
        <LeaguesScreen
          onOpenClubs={(leagueId) => {
            setLeagueFilter(leagueId);
            setSection("clubs");
          }}
        />
      )}
      {section === "clubs" && (
        <ClubsScreen
          leagueFilter={leagueFilter}
          onBack={() => {
            setLeagueFilter(null);
            setSection("leagues");
          }}
          onOpenPlayers={(clubId) => {
            setClubFilter(clubId);
            setSection("players");
          }}
        />
      )}
      {section === "players" && (
        <PlayersScreen
          clubFilter={clubFilter}
          onBack={() => {
            setClubFilter(null);
            setSection("clubs");
          }}
        />
      )}
      {section === "challenges" && <ChallengesScreen />}
    </AdminLayout>
  );
}
