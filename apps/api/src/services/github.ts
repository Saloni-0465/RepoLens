const API = "https://api.github.com";

function headers() {
  const token = process.env.GITHUB_TOKEN?.trim();
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "RepoLens",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export class GithubError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: headers() });
  if (res.status === 404) throw new GithubError("Repository not found or private.", "not_found", 404);
  if (!res.ok) {
    const body = await res.text();
    let githubMessage = "";
    try {
      githubMessage = (JSON.parse(body) as { message?: string }).message ?? "";
    } catch {
      // Keep the API error readable even if GitHub returns a non-JSON response.
    }

    if (res.status === 401) {
      throw new GithubError(
        "GitHub rejected GITHUB_TOKEN. Check that the token is valid and has not expired, then restart RepoLens.",
        "github_auth_failed",
        401,
      );
    }

    const remaining = res.headers.get("x-ratelimit-remaining");
    const isRateLimit = res.status === 429 || remaining === "0" || /rate limit/i.test(githubMessage);
    if (isRateLimit) {
      const reset = Number(res.headers.get("x-ratelimit-reset"));
      const resetText = Number.isFinite(reset) && reset > 0
        ? ` The current quota resets at ${new Date(reset * 1000).toLocaleTimeString()}.`
        : "";
      const tokenHint = process.env.GITHUB_TOKEN?.trim()
        ? " Check that GITHUB_TOKEN is valid, then restart RepoLens."
        : " Add a GitHub token to GITHUB_TOKEN in the project .env file, then restart RepoLens.";
      throw new GithubError(
        `GitHub API rate limit reached.${resetText}${tokenHint}`,
        "rate_limited",
        res.status,
      );
    }

    if (res.status === 403) {
      const detail = githubMessage ? ` GitHub says: ${githubMessage}` : "";
      const tokenHint = process.env.GITHUB_TOKEN?.trim()
        ? " Check that the token can read public repository metadata."
        : " If the repository is public, add a token to GITHUB_TOKEN in .env and restart RepoLens.";
      throw new GithubError(`GitHub denied this request.${detail}${tokenHint}`, "github_access_denied", 403);
    }

    throw new GithubError(`GitHub request failed (${res.status})${githubMessage ? `: ${githubMessage}` : "."}`, "github_error", res.status);
  }
  return (await res.json()) as T;
}

export type RepoMeta = {
  full_name: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  language: string | null;
  private: boolean;
  html_url: string;
};

export type TreeItem = { path: string; type: string; size?: number; sha: string };

export async function getRepo(owner: string, repo: string): Promise<RepoMeta> {
  const meta = await gh<RepoMeta>(`/repos/${owner}/${repo}`);
  if (meta.private) throw new GithubError("Private repositories are not supported in this version.", "private_repo", 400);
  return meta;
}

export async function getCommitSha(owner: string, repo: string, ref: string): Promise<string> {
  const data = await gh<{ sha: string }>(`/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`);
  return data.sha;
}

export async function getTree(owner: string, repo: string, sha: string): Promise<TreeItem[]> {
  const data = await gh<{ tree: TreeItem[]; truncated: boolean }>(
    `/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
  );
  return data.tree ?? [];
}

export async function getFileText(owner: string, repo: string, sha: string, path: string, maxBytes: number): Promise<string | null> {
  const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const res = await fetch(raw, { headers: { "User-Agent": "RepoLens" } });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) return null;
  if (buf.includes(0)) return null;
  return buf.toString("utf8");
}
