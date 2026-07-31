/**
 * Immutable release identity for the server bundle.
 *
 * RELEASE_VERSION is intentionally checked against package.json and VERSION by
 * scripts/verify-release.mjs. APP_VERSION is a retired deployment variable and
 * must never override the code that is actually running.
 */
export const RELEASE_VERSION = "2.2.2";

export const RELEASE_COMMIT =
  process.env.RAILWAY_GIT_COMMIT_SHA?.trim()
  || process.env.GIT_COMMIT_SHA?.trim()
  || "local";

export function shortReleaseCommit(commit = RELEASE_COMMIT): string {
  return commit === "local" ? commit : commit.slice(0, 12);
}

export function releaseIdentity() {
  return {
    version: RELEASE_VERSION,
    commit: RELEASE_COMMIT,
  } as const;
}
