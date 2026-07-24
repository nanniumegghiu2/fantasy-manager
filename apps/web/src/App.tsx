import { useEffect } from "react";
import { useThemeStore } from "./store/useThemeStore";
import { useAuth } from "./hooks/useAuth";
import { useProfile } from "./hooks/useProfile";
import { LoadingScreen } from "./components/LoadingScreen";
import { LoginScreen } from "./components/LoginScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { HomeScreen } from "./components/HomeScreen";

function App() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refetch } = useProfile(session?.user.id);

  if (authLoading) return <LoadingScreen />;
  if (!session) return <LoginScreen />;
  if (profileLoading) return <LoadingScreen />;
  if (!profile) return <OnboardingScreen userId={session.user.id} onComplete={refetch} />;

  return <HomeScreen profile={profile} />;
}

export default App;
