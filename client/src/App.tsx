import { AppProviders } from "./app/providers";
import { AppRoutes } from "./app/routes";
import { useAppBootstrap } from "./app/use-app-bootstrap";
import { MusicPlayerProvider } from "./components/music-player/music-player-context";
import { GlobalMusicPlayer } from "./components/music-player/global-music-player";
import { ToastViewport } from "./components/toast-viewport";
import { Suspense, lazy } from "react";

const InSituAestheticStudio = lazy(() =>
  import("./components/in-situ/aesthetic-studio").then((m) => ({ default: m.InSituAestheticStudio }))
);

function App() {
  const { config, profile } = useAppBootstrap();

  return (
    <AppProviders config={config} profile={profile}>
      <MusicPlayerProvider>
        <AppRoutes />
        <GlobalMusicPlayer />
        <ToastViewport />
        <Suspense fallback={null}>
          <InSituAestheticStudio />
        </Suspense>
      </MusicPlayerProvider>
    </AppProviders>
  );
}

export default App;
