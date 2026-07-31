export const canonicalThemePreferences = ["standard", "modern", "manus"] as const;
export type CanonicalThemePreference = (typeof canonicalThemePreferences)[number];
export type AcceptedThemePreference = CanonicalThemePreference | "light" | "dark" | "system";

/** Keep older clients compatible without writing retired values back to MySQL. */
export function normalizeThemePreference(theme: AcceptedThemePreference): CanonicalThemePreference {
  if (theme === "dark") return "modern";
  if (theme === "light" || theme === "system") return "standard";
  return theme;
}
