export type ThemeId =
  | "default"
  | "emerald"
  | "ocean"
  | "amber"
  | "purple"
  | "dark"
  | "forest-dark"
  | "ocean-dark";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  nameNp: string;
  swatch: string;
  isDark: boolean;
}

export const THEMES: ThemeOption[] = [
  {
    id: "default",
    name: "Classic Slate",
    nameNp: "क्लासिक कालो/सेतो",
    swatch: "#1e293b",
    isDark: false,
  },
  {
    id: "emerald",
    name: "Forest Emerald",
    nameNp: "वातावरण हरियो",
    swatch: "#059669",
    isDark: false,
  },
  {
    id: "ocean",
    name: "Ocean Sapphire",
    nameNp: "समुद्र नीलो",
    swatch: "#2563eb",
    isDark: false,
  },
  {
    id: "amber",
    name: "Warm Amber",
    nameNp: "सुनौलो अम्बर",
    swatch: "#d97706",
    isDark: false,
  },
  {
    id: "purple",
    name: "Royal Purple",
    nameNp: "शाही बैजनी",
    swatch: "#7c3aed",
    isDark: false,
  },
  {
    id: "dark",
    name: "Midnight Dark",
    nameNp: "गाढा रात (डार्क)",
    swatch: "#0f172a",
    isDark: true,
  },
  {
    id: "forest-dark",
    name: "Midnight Emerald",
    nameNp: "गाढा हरियो",
    swatch: "#064e3b",
    isDark: true,
  },
  {
    id: "ocean-dark",
    name: "Midnight Blue",
    nameNp: "गाढा नीलो",
    swatch: "#1e3a8a",
    isDark: true,
  },
];

const THEME_STORAGE_KEY = "hami_yuwa_theme";

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "default";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (stored && THEMES.some((t) => t.id === stored)) {
      return stored;
    }
  } catch {
    // ignore localStorage errors
  }
  return "default";
}

export function applyTheme(themeId: ThemeId): void {
  if (typeof document === "undefined") return;
  const targetTheme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  
  const root = document.documentElement;
  root.setAttribute("data-theme", targetTheme.id);
  
  if (targetTheme.isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, targetTheme.id);
  } catch {
    // ignore
  }
}

