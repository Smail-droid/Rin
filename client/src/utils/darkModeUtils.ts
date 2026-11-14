import { useState, useEffect } from "react";

export type ThemeMode = "light" | "system" | "dark";

export function getStoredThemeMode(): ThemeMode {
  if (typeof localStorage === "undefined") return "system";
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

export function isNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

export function setThemeMode(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem("theme", mode);

  // 注入平滑过渡类
  document.documentElement.classList.add("theme-transitioning");

  if (mode !== "system") {
    document.documentElement.setAttribute("data-color-mode", mode);
  } else {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const autoDark = mediaQuery.matches || isNightTime();
    document.documentElement.setAttribute("data-color-mode", autoDark ? "dark" : "light");
  }
  window.dispatchEvent(new Event("colorSchemeChange"));

  setTimeout(() => {
    document.documentElement.classList.remove("theme-transitioning");
  }, 450);
}

export function listenSystemMode() {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function darkModeHandler() {
    const mode = localStorage.getItem("theme");
    if (mode === null || mode === "system") {
      const autoDark = mediaQuery.matches || isNightTime();
      document.documentElement.setAttribute("data-color-mode", autoDark ? "dark" : "light");
      window.dispatchEvent(new Event("colorSchemeChange"));
    }
  }

  // 判断当前模式
  darkModeHandler();
  // 监听系统偏好变化
  mediaQuery.addEventListener("change", darkModeHandler);

  // 每 60 秒检查一次，若处于系统自动模式且跨越了日出/日落时间，自动平滑切换
  if (typeof window !== "undefined") {
    setInterval(darkModeHandler, 60000);
  }
}

export function getCurrentColorMode(): "light" | "dark" {
  return (
    (document.documentElement.getAttribute("data-color-mode") as
      | "light"
      | "dark") || "light"
  );
}

export function useColorMode() {
  const [colorMode, setColorMode] = useState<"light" | "dark">(
    getCurrentColorMode()
  );

  useEffect(() => {
    const updateColorMode = () => {
      setColorMode(getCurrentColorMode());
    };

    // 初始设置
    updateColorMode();

    // 监听颜色模式变化事件
    window.addEventListener("colorSchemeChange", updateColorMode);

    // 清理函数
    return () => {
      window.removeEventListener("colorSchemeChange", updateColorMode);
    };
  }, []);

  return colorMode;
}
