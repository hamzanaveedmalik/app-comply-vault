/**
 * Zoom List recordings scope checks (error 4711 when the token lacks the right scopes).
 * See granular scope matrix: https://developers.zoom.us/docs/integrations/oauth-scopes-granular/
 */

/** True if this exact granular scope appears as its own token (not :admin / :master). */
function hasStandaloneScope(grantedLower: string, scope: string): boolean {
  const esc = scope.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|\\s)${esc}(?=\\s|$)`, "i");
  return re.test(grantedLower);
}

/** True if granted OAuth scope string probably cannot call GET /users/{id}/recordings (4711 risk). */
export function zoomRecordingListScopesLikelyMissing(
  granted: string | null | undefined
): boolean {
  if (granted == null || granted.trim() === "") return true;
  const s = granted.toLowerCase();
  if (/\brecording:read\b/.test(s) && !s.includes("recording:read:admin")) return false;
  if (s.includes("cloud_recording:read:list_user_recordings:admin")) return false;
  if (s.includes("cloud_recording:read:list_user_recordings:master")) return false;
  return true;
}

/**
 * User has `cloud_recording:read:list_user_recordings` but not :admin / :master / classic recording:read —
 * Zoom often still returns 4711 on List recordings until an elevated variant is granted.
 */
export function zoomHasBaseListUserRecordingsOnly(
  granted: string | null | undefined
): boolean {
  if (granted == null || granted.trim() === "") return false;
  const s = granted.toLowerCase();
  if (/\brecording:read\b/.test(s) && !s.includes("recording:read:admin")) return false;
  if (s.includes("cloud_recording:read:list_user_recordings:admin")) return false;
  if (s.includes("cloud_recording:read:list_user_recordings:master")) return false;
  return hasStandaloneScope(s, "cloud_recording:read:list_user_recordings");
}

/** Shown on sync 4711 and in Integrations UI when scopes look wrong. */
export const ZOOM_SCOPE_4711_USER_HINT =
  "Open https://marketplace.zoom.us/ → your app → same Development or Production tab as Vercel ZOOM_CLIENT_ID. Under Scopes search list_user_recordings:admin or list_user_recordings:master; add one of them (Zoom often requires this even if base list_user_recordings is already granted). If those IDs never appear, switch the General app to Admin-managed or add classic recording:read if Zoom shows it. Save scopes, then Disconnect → Connect Zoom in ComplyVault.";
