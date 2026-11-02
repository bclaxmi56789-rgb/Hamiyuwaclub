import { useState, useEffect } from "react";
import { Palette, Check, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEMES, getStoredTheme, applyTheme, type ThemeId } from "@/lib/theme";

export function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>("default");

  useEffect(() => {
    const initial = getStoredTheme();
    setCurrentTheme(initial);
    applyTheme(initial);
  }, []);

  const handleSelect = (themeId: ThemeId) => {
    setCurrentTheme(themeId);
    applyTheme(themeId);
  };

  const active = THEMES.find((t) => t.id === currentTheme) || THEMES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex h-8 items-center gap-2 rounded-full border px-2.5 text-xs font-medium shadow-none transition-colors hover:bg-accent"
          title={`थिम परिवर्तन (Theme): ${active.nameNp}`}
          aria-label={`थिम परिवर्तन (Theme): ${active.nameNp}`}
        >
          <span
            className="size-3 rounded-full border border-black/10 shadow-xs"
            style={{ backgroundColor: active.swatch }}
          />
          <Palette className="size-3.5 opacity-70" />
          <span className="hidden sm:inline-block max-w-[85px] truncate">
            {active.nameNp}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-lg">
        <DropdownMenuLabel className="flex items-center justify-between text-xs font-semibold px-2 py-1 text-muted-foreground">
          <span>रङ तथा थिम (Themes)</span>
          {active.isDark ? (
            <Moon className="size-3.5 opacity-70" />
          ) : (
            <Sun className="size-3.5 opacity-70" />
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-0.5">
          {THEMES.map((t) => {
            const isSelected = t.id === currentTheme;
            return (
              <DropdownMenuItem
                key={t.id}
                onClick={() => handleSelect(t.id)}
                className={`flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                  isSelected ? "bg-accent font-semibold text-accent-foreground" : ""
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="size-3.5 shrink-0 rounded-full border border-black/15 shadow-xs"
                    style={{ backgroundColor: t.swatch }}
                  />
                  <div className="truncate">
                    <div>{t.nameNp}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">
                      {t.name}
                    </div>
                  </div>
                </div>
                {isSelected && <Check className="size-3.5 shrink-0 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

