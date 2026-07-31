import { describe, expect, it } from "vitest";
import { normalizeThemePreference } from "./_core/themePreference";

describe("theme preference normalization", () => {
  it.each([
    ["light", "standard"],
    ["system", "standard"],
    ["dark", "modern"],
    ["standard", "standard"],
    ["modern", "modern"],
    ["manus", "manus"],
  ] as const)("normalizes %s to %s", (input, expected) => {
    expect(normalizeThemePreference(input)).toBe(expected);
  });
});
