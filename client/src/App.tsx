import { AppProviders } from "./app/providers";
import { AppRoutes } from "./app/routes";
import { useAppBootstrap } from "./app/use-app-bootstrap";
import { MusicPlayerProvider } from "./components/music-player/music-player-context";
import { GlobalMusicPlayer } from "./components/music-player/global-music-player";
import { Suspense, lazy } from "react";

const InSituAestheticStudio = lazy(() =>
  import("./components/in-situ/aesthetic-studio").then((m) => ({ default: m.InSituAestheticStudio }))
);
const InSituDeskDock = lazy(() =>
  import("./components/in-situ/in-situ-desk-dock").then((m) => ({ default: m.InSituDeskDock }))
);

function App() {
  const { config, profile } = useAppBootstrap();

  return (
    <AppProviders config={config} profile={profile}>
      <MusicPlayerProvider>
        <AppRoutes />
        <GlobalMusicPlayer />
        <Suspense fallback={null}>
          <InSituAestheticStudio />
          {profile?.permission ? <InSituDeskDock /> : null}
        </Suspense>
      </MusicPlayerProvider>
    </AppProviders>
  );
}

export default App;
