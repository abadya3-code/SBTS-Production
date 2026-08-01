import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { trpc } from "@/lib/trpc";

/* ══════════════════════════════════════════════════════════════════════════
   Theme System — SBTS Professional
   Three themes, each applied as data-theme="<id>" on <html>.
   All CSS variables in index.css are scoped to these selectors so every
   shadcn/ui component, Tailwind utility, and custom class responds.
   ══════════════════════════════════════════════════════════════════════════ */

export type ThemeId = "standard" | "modern" | "manus";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  /** Whether this theme has a dark color-scheme */
  isDark: boolean;
  /** Preview swatch colors for the picker UI */
  preview: {
    bg: string;
    sidebar: string;
    primary: string;
    accent: string;
  };
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "standard",
    name: "Standard",
    description: "Clean, light, and professional",
    isDark: false,
    preview: {
      bg: "#f6f8fc",
      sidebar: "#1e2d4a",
      primary: "#3b5998",
      accent: "#0ea5e9",
    },
  },
  {
    id: "modern",
    name: "Modern",
    description: "Dark, industrial, and application-focused",
    isDark: true,
    preview: {
      bg: "#0d1117",
      sidebar: "#111827",
      primary: "#22d3ee",
      accent: "#06b6d4",
    },
  },
  {
    id: "manus",
    name: "Manus Edition",
    description: "Premium violet special edition",
    isDark: true,
    preview: {
      bg: "#0c0a1a",
      sidebar: "#110e20",
      primary: "#a855f7",
      accent: "#d946ef",
    },
  },
];

/* ── Context ──────────────────────────────────────────────────────────────── */

interface ThemeContextType {
  theme: ThemeDefinition;
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  themes: ThemeDefinition[];
  /** Legacy compat — always matches theme.isDark */
  isDarkMode: boolean;
  allowUserThemeOverride: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_STORAGE_KEY = "sbts-theme-v2";
const DEFAULT_THEME: ThemeId = "standard";

export function normalizeThemeId(
  value: string | null | undefined
): ThemeId | null {
  if (!value) return null;
  if (value === "standard" || value === "light" || value === "system")
    return "standard";
  if (value === "modern" || value === "dark" || value === "sbts-custom")
    return "modern";
  if (value === "manus") return "manus";
  return null;
}

/* ── Provider ─────────────────────────────────────────────────────────────── */

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: appearance } = trpc.settings.appearance.get.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    try {
      const saved = normalizeThemeId(localStorage.getItem(THEME_STORAGE_KEY));
      if (saved) return saved;
    } catch {}
    return DEFAULT_THEME;
  });

  const allowUserThemeOverride = appearance?.allowUserThemeOverride ?? true;

  useEffect(() => {
    if (!appearance) return;
    let saved: ThemeId | null = null;
    try {
      saved = normalizeThemeId(localStorage.getItem(THEME_STORAGE_KEY));
    } catch {}
    const systemTheme =
      normalizeThemeId(appearance.defaultTheme) ?? DEFAULT_THEME;
    if (!appearance.allowUserThemeOverride || !saved) {
      setThemeId(systemTheme);
    }
  }, [appearance]);

  /* Apply theme to <html> element */
  const applyTheme = useCallback((id: ThemeId) => {
    const root = document.documentElement;
    // Remove all theme data attributes
    root.removeAttribute("data-theme");
    // Set new theme
    root.setAttribute("data-theme", id);
    // Sync color-scheme meta for browser UI (scrollbars, inputs)
    const def = THEMES.find(t => t.id === id)!;
    root.style.colorScheme = def.isDark ? "dark" : "light";
  }, []);

  /* On mount — apply saved theme immediately (no flash) */
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId, applyTheme]);

  const setTheme = useCallback(
    (id: ThemeId) => {
      if (!allowUserThemeOverride && appearance) return;
      setThemeId(id);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, id);
      } catch {}
      applyTheme(id);
    },
    [allowUserThemeOverride, appearance, applyTheme]
  );

  const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeId,
        setTheme,
        themes: THEMES,
        isDarkMode: theme.isDark,
        allowUserThemeOverride,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/* ── Legacy compat exports ────────────────────────────────────────────────── */
/** @deprecated use ThemeId */
export type ThemeName = ThemeId;
