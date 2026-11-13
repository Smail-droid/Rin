import { AppProviders } from "./app/providers";
import { AppRoutes } from "./app/routes";
import { useAppBootstrap } from "./app/use-app-bootstrap";
import { MusicPlayerProvider } from "./components/music-player/music-player-context";
import { GlobalMusicPlayer } from "./components/music-player/global-music-player";

function App() {
  const { config, profile } = useAppBootstrap();

  return (
    <AppProviders config={config} profile={profile}>
      <MusicPlayerProvider>
        <AppRoutes />
        <GlobalMusicPlayer />
      </MusicPlayerProvider>
    </AppProviders>
  );
}

export default App;
