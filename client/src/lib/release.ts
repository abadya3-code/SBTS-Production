export const releaseVersion = __SBTS_RELEASE_VERSION__;
export const releaseCommit = __SBTS_RELEASE_COMMIT__;
export const shortReleaseCommit = releaseCommit === "local" ? releaseCommit : releaseCommit.slice(0, 12);
