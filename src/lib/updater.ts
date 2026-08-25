import packageInfo from "../../package.json";

const GITHUB_RELEASES_URL = "https://github.com/GrayJS/desk-clock/releases/";
const DEFAULT_UPDATE_API_URL =
  "https://api.github.com/repos/GrayJS/desk-clock/releases/latest";

export const CURRENT_VERSION = packageInfo.version;
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export type AvailableUpdate = {
  version: string;
  releaseUrl: string;
};

type GitHubRelease = {
  tag_name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
};

function parseVersion(value: string) {
  const match = value
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}

export function isVersionNewer(latest: string, current: string) {
  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);
  if (!latestParts || !currentParts) return false;

  for (let index = 0; index < 3; index += 1) {
    if (latestParts[index] > currentParts[index]) return true;
    if (latestParts[index] < currentParts[index]) return false;
  }
  return false;
}

export async function checkForUpdate(signal?: AbortSignal) {
  const updateApiUrl =
    import.meta.env.VITE_UPDATE_API_URL?.trim() || DEFAULT_UPDATE_API_URL;
  const response = await fetch(updateApiUrl, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`GitHub update check failed: ${response.status}`);

  const release = (await response.json()) as GitHubRelease;
  if (
    release.draft === true ||
    release.prerelease === true ||
    typeof release.tag_name !== "string" ||
    typeof release.html_url !== "string" ||
    !release.html_url.startsWith(GITHUB_RELEASES_URL) ||
    !isVersionNewer(release.tag_name, CURRENT_VERSION)
  ) {
    return null;
  }

  return {
    version: release.tag_name.replace(/^v/i, ""),
    releaseUrl: release.html_url,
  } satisfies AvailableUpdate;
}
