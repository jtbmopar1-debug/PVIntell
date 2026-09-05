"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const storageKey = "pvintell:theme:v1";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeSettings() {
  const [theme, setThemeState] = useState<Theme>("light");
  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    const local: Theme = stored === "dark" ? "dark" : "light";
    const localSync = window.setTimeout(() => { setThemeState(local); applyTheme(local); }, 0);
    const controller = new AbortController();
    void fetch("/api/account/theme", { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((body) => { const saved: Theme = body?.theme === "dark" ? "dark" : "light"; setThemeState(saved); window.localStorage.setItem(storageKey, saved); applyTheme(saved); }).catch(() => undefined);
    return () => { window.clearTimeout(localSync); controller.abort(); };
  }, []);
  function setTheme(next: Theme) { setThemeState(next); window.localStorage.setItem(storageKey, next); applyTheme(next); void fetch("/api/account/theme", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: next }) }).catch(() => undefined); }
  const next: Theme = theme === "light" ? "dark" : "light";
  const Icon = theme === "light" ? Sun : Moon;
  return <button type="button" onClick={() => setTheme(next)} aria-label={`Switch to ${next} theme`} title={`Using ${theme} theme. Switch to ${next}.`} className="grid size-10 place-items-center rounded-lg border border-transparent text-muted hover:border-line hover:bg-white hover:text-brand"><Icon size={19}/></button>;
}
