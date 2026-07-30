import { useTheme, THEMES, type ThemeId } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

/**
 * ThemeToggle — Professional theme picker with visual previews.
 * Shows a swatch for each theme (sidebar color + primary accent).
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
  const { themeId, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn("relative", className)}
          title="Change theme"
          aria-label="Change application theme"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-3">
        <DropdownMenuLabel className="flex items-center gap-2 px-0 pb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Palette className="h-3.5 w-3.5" />
          Application Theme
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mb-3" />

        <div className="space-y-2">
          {THEMES.map((t) => {
            const active = themeId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as ThemeId)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all",
                  active
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "hover:bg-muted"
                )}
              >
                {/* Swatch */}
                <div
                  className="relative h-9 w-14 shrink-0 overflow-hidden rounded-md shadow-sm ring-1 ring-border"
                  aria-hidden
                >
                  {/* Background */}
                  <div
                    className="absolute inset-0"
                    style={{ background: t.preview.bg }}
                  />
                  {/* Sidebar strip */}
                  <div
                    className="absolute inset-y-0 left-0 w-3"
                    style={{ background: t.preview.sidebar }}
                  />
                  {/* Primary dot */}
                  <div
                    className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full"
                    style={{ background: t.preview.primary }}
                  />
                  {/* Accent line */}
                  <div
                    className="absolute right-1.5 top-1.5 h-1 w-4 rounded-full opacity-70"
                    style={{ background: t.preview.accent }}
                  />
                </div>

                {/* Labels */}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-tight",
                      active ? "text-primary" : "text-foreground"
                    )}
                  >
                    {t.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-tight">
                    {t.description}
                  </p>
                </div>

                {/* Active check */}
                {active && (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
