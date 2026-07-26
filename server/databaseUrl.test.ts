import { describe, expect, it } from "vitest";
import { getDatabaseUrl } from "./_core/databaseUrl";

describe("database URL validation", () => {
  it("accepts a valid hosted MySQL URL", () => {
    expect(
      getDatabaseUrl("mysql://user:pass@mysql.railway.internal:3306/railway", {
        required: true,
        production: true,
      }),
    ).toContain("mysql.railway.internal");
  });

  it("rejects a duplicated DATABASE_URL prefix", () => {
    expect(() =>
      getDatabaseUrl("DATABASE_URL=mysql://user:pass@host:3306/db", {
        required: true,
      }),
    ).toThrow(/do not prefix/i);
  });

  it("rejects localhost in production", () => {
    expect(() =>
      getDatabaseUrl("mysql://user:pass@127.0.0.1:3306/db", {
        required: true,
        production: true,
      }),
    ).toThrow(/localhost/i);
  });
});
