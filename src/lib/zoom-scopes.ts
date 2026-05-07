/**
 * Zoom List recordings scope checks (error 4711 when the token lacks the right scopes).
 * See granular scope matrix: https://developers.zoom.us/docs/integrations/oauth-scopes-granular/
 */

/** True if granted OAuth scope string probably cannot call GET /users/{id}/recordings (4711 risk). */
export function zoomRecordingListScopesLikelyMissing(
  granted: string | null | undefined
): boolean {
  if (granted == null || granted.trim() === "") return true;
  const s = granted.toLowerCase();
  if (s.includes("cloud_recording:read:list_user_recordings:admin")) return false;
  if (s.includes("cloud_recording:read:list_user_recordings:master")) return false;
  if (/\brecording:read\b/.test(s) && !s.includes("recording:read:admin")) return false;
  return true;
}

/** Shown on sync 4711 and in Integrations UI when scopes look wrong. */
export const ZOOM_SCOPE_4711_USER_HINT =
  "In https://marketplace.zoom.us/ open your app — use the same Development or Production tab as the Client ID in Vercel. Under Scopes, search list_user_recordings:admin or list_user_recordings:master and add them along with cloud_recording:read:list_user_recordings; fill the scope-use description; save. Deploy ComplyVault, then Disconnect → Connect Zoom here.";
