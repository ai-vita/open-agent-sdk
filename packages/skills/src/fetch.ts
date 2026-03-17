import type { SkillBundle } from "./types.js";

interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

function parseGitHubRef(ref: string): { owner: string; repo: string; skillName: string } {
  const parts = ref.split("/");
  if (parts.length < 3) {
    throw new Error(`Invalid skill reference "${ref}". Expected format: owner/repo/skillName`);
  }
  return { owner: parts[0], repo: parts[1], skillName: parts[parts.length - 1] };
}

async function fetchDirectoryContents(
  owner: string,
  repo: string,
  path: string,
  basePath: string,
  branch = "main",
): Promise<Record<string, string>> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const response = await fetch(apiUrl, {
    headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "open-agent-sdk" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch "${path}": ${response.status} ${response.statusText}`);
  }

  const items: GitHubContentItem[] = (await response.json()) as GitHubContentItem[];
  const files: Record<string, string> = {};

  await Promise.all(
    items.map(async (item) => {
      const relativePath = item.path.startsWith(`${basePath}/`)
        ? item.path.slice(basePath.length + 1)
        : item.path;

      if (item.type === "file" && item.download_url) {
        const fileResponse = await fetch(item.download_url);
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch file "${item.path}": ${fileResponse.status}`);
        }
        files[relativePath] = await fileResponse.text();
      } else if (item.type === "dir") {
        const nested = await fetchDirectoryContents(owner, repo, item.path, basePath, branch);
        Object.assign(files, nested);
      }
    }),
  );

  return files;
}

/**
 * Fetch a single skill folder from GitHub.
 * @param ref - Format: "owner/repo/skillName" (e.g., "anthropics/skills/pdf")
 */
export async function fetchSkill(ref: string): Promise<SkillBundle> {
  const { owner, repo, skillName } = parseGitHubRef(ref);

  // Try "skills/{skillName}" folder first, fallback to "{skillName}"
  let basePath: string;
  let contents: Record<string, string>;

  try {
    basePath = `skills/${skillName}`;
    contents = await fetchDirectoryContents(owner, repo, basePath, basePath);
  } catch {
    basePath = skillName;
    contents = await fetchDirectoryContents(owner, repo, basePath, basePath);
  }

  return { name: skillName, files: contents };
}

/**
 * Fetch multiple skills from GitHub in parallel.
 */
export async function fetchSkills(refs: string[]): Promise<Record<string, SkillBundle>> {
  const bundles = await Promise.all(refs.map((ref) => fetchSkill(ref)));
  const result: Record<string, SkillBundle> = {};
  for (const bundle of bundles) {
    result[bundle.name] = bundle;
  }
  return result;
}
