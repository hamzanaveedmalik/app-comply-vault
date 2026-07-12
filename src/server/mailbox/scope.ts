/**
 * Folder scope helpers — no Graph/DB imports (testable in isolation).
 */

export function isFolderInScope(
  folderId: string,
  scopeFolders: string[]
): boolean {
  if (scopeFolders.length === 0) return false;
  return scopeFolders.includes(folderId);
}
