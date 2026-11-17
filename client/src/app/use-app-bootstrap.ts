import { useEffect, useRef, useState } from "react";
import { ConfigWrapper } from "@rin/config";
import type { Profile } from "../state/profile";
import { defaultClientConfig } from "../state/config";
import { applyArtTitleColor, applyGalleryTiltDegree, applyThemeColor, applyThemeCustomCursor, applyThemeFontSize, applyThemeOpacity, applyThemeWallpaper } from "../utils/theme-color";
import { readBootstrappedClientConfig } from "./bootstrap-config";
import { client } from "./runtime";

function applyViewportScaling() {
  const highResolutionThreshold = 2560;
  document.documentElement.style.fontSize = window.screen.width >= highResolutionThreshold ? "125%" : "100%";
}

export function useAppBootstrap() {
  const initializedRef = useRef(false);
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

    const updateClientConfig = (nextConfig: Record<string, unknown>) => {
      sessionStorage.setItem("config", JSON.stringify(nextConfig));
      setConfig(new ConfigWrapper(nextConfig, defaultClientConfig));
      applyThemeColor(typeof nextConfig["theme.color"] === "string" ? nextConfig["theme.color"] : undefined);
      applyThemeOpacity(nextConfig["theme.opacity"]);
      applyThemeFontSize(nextConfig["theme.font_size"]);
      applyThemeWallpaper(typeof nextConfig["theme.wallpaper"] === "string" ? nextConfig["theme.wallpaper"] : undefined, typeof nextConfig["theme.wallpaper_opacity"] === "number" ? nextConfig["theme.wallpaper_opacity"] : undefined);
      applyThemeCustomCursor(nextConfig["theme.custom_cursor"] !== false && nextConfig["theme.custom_cursor"] !== "false");
      if (nextConfig["gallery.tilt_degree"] !== undefined) {
        applyGalleryTiltDegree(Number.parseFloat(String(nextConfig["gallery.tilt_degree"])));
      }
      if (nextConfig["atelier.title_custom_color_enabled"] === true || nextConfig["atelier.title_custom_color_enabled"] === "true") {
        applyArtTitleColor(typeof nextConfig["atelier.title_color"] === "string" ? nextConfig["atelier.title_color"] : undefined);
      } else {
        applyArtTitleColor(undefined);
      }
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
      updateClientConfig(bootstrappedConfig);
    } else if (cachedConfig) {
      const configObject = JSON.parse(cachedConfig) as Record<string, unknown>;
      setConfig(new ConfigWrapper(configObject, defaultClientConfig));
      applyThemeColor(typeof configObject["theme.color"] === "string" ? configObject["theme.color"] : undefined);
      applyThemeOpacity(configObject["theme.opacity"]);
      applyThemeFontSize(configObject["theme.font_size"]);
      applyThemeWallpaper(typeof configObject["theme.wallpaper"] === "string" ? configObject["theme.wallpaper"] : undefined, typeof configObject["theme.wallpaper_opacity"] === "number" ? configObject["theme.wallpaper_opacity"] : undefined);
      applyThemeCustomCursor(configObject["theme.custom_cursor"] !== false && configObject["theme.custom_cursor"] !== "false");
      if (configObject["gallery.tilt_degree"] !== undefined) {
        applyGalleryTiltDegree(Number.parseFloat(String(configObject["gallery.tilt_degree"])));
      }
      if (configObject["atelier.title_custom_color_enabled"] === true || configObject["atelier.title_custom_color_enabled"] === "true") {
        applyArtTitleColor(typeof configObject["atelier.title_color"] === "string" ? configObject["atelier.title_color"] : undefined);
      } else {
        applyArtTitleColor(undefined);
      }
    }

    // 无论本地是否有缓存，均异步向边缘服务端同步最新的 D1 真实配置，杜绝重置为默认值
    client.config
      .get("client")
      .then(({ data }) => {
        if (data && typeof data === "object") {
          updateClientConfig(data as Record<string, unknown>);
        }
      })
      .catch(() => {});

    const handleConfigEvent = () => {
      const cached = sessionStorage.getItem("config");
      if (cached) {
        try {
          const configObject = JSON.parse(cached) as Record<string, unknown>;
          updateClientConfig(configObject);
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
