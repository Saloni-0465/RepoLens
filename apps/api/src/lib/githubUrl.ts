const GITHUB_RE = /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i;

export function parseGithubUrl(raw: string): { owner: string; repo: string; fullName: string; url: string } | null {
  const trimmed = raw.trim();
  const match = trimmed.match(GITHUB_RE);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2];
  if (!owner || !repo || owner.toLowerCase() === "orgs") return null;
  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    url: `https://github.com/${owner}/${repo}`,
  };
}
