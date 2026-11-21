"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "smart-delivery-theme";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initialTheme = readInitialTheme();
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  const label = mounted
    ? theme === "dark"
      ? "Switch to light theme"
      : "Switch to dark theme"
    : "Toggle color theme";

  return (
    <button
      id="theme-toggle-control"
      type="button"
      className="button button-secondary"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={mounted ? theme === "dark" : undefined}
    >
      <span aria-hidden="true">{mounted && theme === "dark" ? "☀" : "☾"}</span>
      <span>{mounted ? (theme === "dark" ? "Light Mode" : "Dark Mode") : "Theme"}</span>
    </button>
  );
}

