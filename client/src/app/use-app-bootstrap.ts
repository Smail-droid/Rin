import { useEffect, useRef, useState } from "react";
import { ConfigWrapper } from "@rin/config";
import type { Profile } from "../state/profile";
import { defaultClientConfig } from "../state/config";
import {
  applyGalleryTiltDegree,
  applyThemeColor,
  applyThemeCustomCursor,
  applyThemeFontFamily,
  applyThemeFontSize,
  applyThemeOpacity,
  applyThemeWallpaper,
} from "../utils/theme-color";
import { readBootstrappedClientConfig } from "./bootstrap-config";
import { client } from "./runtime";

function applyViewportScaling() {
  const highResolutionThreshold = 2560;
  document.documentElement.style.fontSize = window.screen.width >= highResolutionThreshold ? "125%" : "100%";
}

type AppliedDomSnapshot = {
  color?: string;
  secondary?: string;
  preset?: string;
  opacity?: unknown;
  fontFamily?: string;
  fontSize?: unknown;
  wallpaper?: string;
  wallpaperOpacity?: number;
  customCursor?: boolean;
  tiltDegree?: number;
};

/** 增量脏检查应用 DOM/CSS 副作用，避免改一个颜色时重刷全站字体/字号/壁纸引发整页重排 */
function applyDomConfigIncremental(nextConfig: Record<string, unknown>, prev: AppliedDomSnapshot) {
  const color = typeof nextConfig["theme.color"] === "string" ? nextConfig["theme.color"] : undefined;
  const secondary = typeof nextConfig["theme.secondary_color"] === "string" ? nextConfig["theme.secondary_color"] : undefined;
  const preset = typeof nextConfig["theme.preset"] === "string" ? nextConfig["theme.preset"] : undefined;
  if (color !== prev.color || secondary !== prev.secondary || preset !== prev.preset) {
    applyThemeColor(color, secondary, preset);
    prev.color = color;
    prev.secondary = secondary;
    prev.preset = preset;
  }

  const opacity = nextConfig["theme.opacity"];
  if (opacity !== prev.opacity) {
    applyThemeOpacity(opacity);
    prev.opacity = opacity;
  }

  const fontFamily = typeof nextConfig["theme.font_family"] === "string" ? nextConfig["theme.font_family"] : undefined;
  if (fontFamily !== prev.fontFamily) {
    applyThemeFontFamily(fontFamily);
    prev.fontFamily = fontFamily;
  }

  const fontSize = nextConfig["theme.font_size"];
  if (fontSize !== prev.fontSize) {
    applyThemeFontSize(fontSize);
    prev.fontSize = fontSize;
  }

  const wallpaper = typeof nextConfig["theme.wallpaper"] === "string" ? nextConfig["theme.wallpaper"] : undefined;
  const wallpaperOpacity = typeof nextConfig["theme.wallpaper_opacity"] === "number" ? nextConfig["theme.wallpaper_opacity"] : undefined;
  if (wallpaper !== prev.wallpaper || wallpaperOpacity !== prev.wallpaperOpacity) {
    applyThemeWallpaper(wallpaper, wallpaperOpacity);
    prev.wallpaper = wallpaper;
    prev.wallpaperOpacity = wallpaperOpacity;
  }

  const customCursor = nextConfig["theme.custom_cursor"] !== false && nextConfig["theme.custom_cursor"] !== "false";
  if (customCursor !== prev.customCursor) {
    applyThemeCustomCursor(customCursor);
    prev.customCursor = customCursor;
  }

  if (nextConfig["gallery.tilt_degree"] !== undefined) {
    const tilt = Number.parseFloat(String(nextConfig["gallery.tilt_degree"]));
    if (!Number.isNaN(tilt) && tilt !== prev.tiltDegree) {
      applyGalleryTiltDegree(tilt);
      prev.tiltDegree = tilt;
    }
  }
}

export function useAppBootstrap() {
  const initializedRef = useRef(false);
  const appliedDomRef = useRef<AppliedDomSnapshot>({});
  const [profile, setProfile] = useState<Profile | undefined | null>(() => {
    try {
      const cached = sessionStorage.getItem("cached_profile") || localStorage.getItem("cached_profile");
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
    return undefined;
  });
  const [config, setConfig] = useState<ConfigWrapper>(new ConfigWrapper({}, new Map()));

  useEffect(() => {
    applyViewportScaling();

    if (initializedRef.current) {
      return;
    }

    const updateClientConfig = (nextConfig: Record<string, unknown>, writeSession = true) => {
      if (writeSession) {
        sessionStorage.setItem("config", JSON.stringify(nextConfig));
      }
      setConfig(new ConfigWrapper(nextConfig, defaultClientConfig));
      applyDomConfigIncremental(nextConfig, appliedDomRef.current);
    };

    client.user.profile().then(({ data, error }) => {
      if (data) {
        const nextProfile: Profile = {
          id: data.id,
          avatar: data.avatar || "",
          permission: data.permission,
          name: data.username,
        };
        try {
          sessionStorage.setItem("cached_profile", JSON.stringify(nextProfile));
        } catch {}
        setProfile(nextProfile);
      } else if (error) {
        try {
          const cached = sessionStorage.getItem("cached_profile") || localStorage.getItem("cached_profile");
          if (cached) {
            setProfile(JSON.parse(cached));
            return;
          }
          sessionStorage.removeItem("cached_profile");
        } catch {}
        setProfile(null);
      }
    });

    const cachedConfig = sessionStorage.getItem("config");
    const bootstrappedConfig = readBootstrappedClientConfig();

    if (bootstrappedConfig) {
      updateClientConfig(bootstrappedConfig, true);
    } else if (cachedConfig) {
      try {
        const configObject = JSON.parse(cachedConfig) as Record<string, unknown>;
        updateClientConfig(configObject, false);
      } catch {}
    }

    // 异步向边缘服务端同步最新的 D1 真实配置
    client.config
      .get("client")
      .then(({ data }) => {
        if (data && typeof data === "object") {
          let merged = data as Record<string, unknown>;
          try {
            const visitorCached = sessionStorage.getItem("config");
            if (visitorCached) {
              const parsed = JSON.parse(visitorCached);
              merged = { ...merged, ...parsed };
            }
          } catch {}
          updateClientConfig(merged, true);
        }
      })
      .catch(() => {});

    const handleConfigEvent = () => {
      const cached = sessionStorage.getItem("config");
      if (cached) {
        try {
          const configObject = JSON.parse(cached) as Record<string, unknown>;
          updateClientConfig(configObject, false);
        } catch {}
      }
    };
    window.addEventListener("rin:config-updated", handleConfigEvent);

    initializedRef.current = true;
    return () => {
      window.removeEventListener("rin:config-updated", handleConfigEvent);
    };
  }, []);

  return { config, profile };
}
