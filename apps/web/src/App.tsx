import { lazy, Suspense, useEffect, useState } from "react";
import { useThemeStore } from "./store/useThemeStore";
import { useAuth } from "./hooks/useAuth";
import { useProfile } from "./hooks/useProfile";
import { LoadingScreen } from "./components/LoadingScreen";
import { LoginScreen } from "./components/LoginScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { HomeScreen } from "./components/HomeScreen";
import { AccessDenied } from "./admin/AccessDenied";

const AdminApp = lazy(() => import("./admin/AdminApp"));

function App() {
  const theme = useThemeStore((s) => s.theme);
  const [guestMode, setGuestMode] = useState(false);
  const isAdminRoute = window.location.pathname.startsWith("/admin");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refetch } = useProfile(session?.user.id);

  if (authLoading) return <LoadingScreen />;

  if (!session) {
    if (guestMode) return <HomeScreen profile={null} onExitGuest={() => setGuestMode(false)} />;
    return <LoginScreen onGuestPlay={() => setGuestMode(true)} />;
  }

  if (profileLoading) return <LoadingScreen />;
  if (!profile) return <OnboardingScreen userId={session.user.id} onComplete={refetch} />;

  if (isAdminRoute) {
    if (!profile.isAdmin) return <AccessDenied nickname={profile.nickname} />;
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AdminApp profile={profile} />
      </Suspense>
    );
  }

  return <HomeScreen profile={profile} />;
}

export default App;
