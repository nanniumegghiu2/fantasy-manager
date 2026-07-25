import { useState } from "react";
import { useAdminAuth } from "./hooks/useAdminAuth";
import { AdminLoginScreen } from "./components/AdminLoginScreen";
import { AccessDenied } from "./components/AccessDenied";
import { AdminLayout, type AdminSection } from "./components/AdminLayout";
import { PlayersScreen } from "./screens/PlayersScreen";
import { ClubsScreen } from "./screens/ClubsScreen";
import { ChallengesScreen } from "./screens/ChallengesScreen";

function App() {
  const { session, profile, loading } = useAdminAuth();
  const [section, setSection] = useState<AdminSection>("players");

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[var(--surface)] text-[var(--text-secondary)]">
        Caricamento...
      </div>
    );
  }

  if (!session) return <AdminLoginScreen />;
  if (!profile?.isAdmin) return <AccessDenied nickname={profile?.nickname ?? "Utente"} />;

  return (
    <AdminLayout profile={profile} section={section} onSectionChange={setSection}>
      {section === "players" && <PlayersScreen />}
      {section === "clubs" && <ClubsScreen />}
      {section === "challenges" && <ChallengesScreen />}
    </AdminLayout>
  );
}

export default App;
