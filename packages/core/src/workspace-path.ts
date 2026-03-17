import path from "node:path";

/**
 * Resolve and validate a path against a workspace root directory.
 * Returns an absolute, normalized path guaranteed to be within rootDir.
 * Throws if the resolved path escapes the root.
 */
export function resolveWorkspacePath(rootDir: string, requestedPath: string): string {
  const normalizedRoot = path.resolve(rootDir);

  if (!requestedPath) {
    return normalizedRoot;
  }

  const resolved = path.resolve(normalizedRoot, requestedPath);

  if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}/`)) {
    throw new Error(
      `Path "${requestedPath}" resolves to "${resolved}" which is outside the workspace root "${normalizedRoot}"`,
    );
  }

  return resolved;
}
