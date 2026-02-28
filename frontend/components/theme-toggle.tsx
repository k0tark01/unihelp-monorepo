"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

const STORAGE_KEY = "unihelp-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    return;
  }

  root.classList.remove("dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem(STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      applyTheme(storedTheme);
      setMounted(true);
      return;
    }

    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme: Theme = systemPrefersDark ? "dark" : "light";
    setTheme(resolvedTheme);
    applyTheme(resolvedTheme);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  };

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Sun className="mr-2 h-4 w-4" />
        Theme
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={toggleTheme}>
      {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
      {theme === "dark" ? "Light" : "Dark"}
    </Button>
  );
}
