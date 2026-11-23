"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "smart-delivery-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Keep the selected theme for this page if browser storage is unavailable.
    }
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
      className="button button-ghost icon-button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {mounted && theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
