const SKIP_DIR_PARTS = new Set([
  "node_modules",
  "vendor",
  "dist",
  "build",
  ".git",
  ".next",
  ".nuxt",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  ".idea",
  ".vscode",
  "out",
]);

const SKIP_NAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "poetry.lock",
  "cargo.lock",
  "composer.lock",
]);

const SKIP_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tgz",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".mov",
  ".wasm",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".class",
  ".jar",
  ".map",
]);

const SECRETISH = [/\.env($|\.)/i, /id_rsa/i, /credentials\.json$/i, /secrets?\./i];

export function shouldSkipPath(path: string): boolean {
  const parts = path.split("/");
  if (parts.some((p) => SKIP_DIR_PARTS.has(p))) return true;
  const name = parts[parts.length - 1] ?? "";
  if (SKIP_NAMES.has(name.toLowerCase())) return true;
  if (SECRETISH.some((re) => re.test(name))) return true;
  const dot = name.lastIndexOf(".");
  if (dot >= 0 && SKIP_EXT.has(name.slice(dot).toLowerCase())) return true;
  return false;
}

export function languageFromPath(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return "javascript";
  }
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".toml")) return "toml";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".rs")) return "rust";
  return null;
}

export function fileRole(path: string): string {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  if (
    [
      "package.json",
      "requirements.txt",
      "pyproject.toml",
      "pipfile",
      "go.mod",
      "cargo.toml",
      "pom.xml",
      "build.gradle",
      "composer.json",
      "gemfile",
    ].includes(name)
  ) {
    return "manifest";
  }
  if (
    ["dockerfile", "docker-compose.yml", "docker-compose.yaml", "tsconfig.json", "vite.config.ts", "webpack.config.js"].includes(
      name,
    ) ||
    name.startsWith(".eslintrc") ||
    name === "makefile"
  ) {
    return "config";
  }
  if (name === "readme.md" || name === "readme") return "docs";
  if (
    /(?:^|\/)(?:src\/)?(?:index|main|app|server|cli)\.(?:py|ts|tsx|js|jsx|mjs)$/i.test(path) ||
    /(?:^|\/)__main__\.py$/i.test(path)
  ) {
    return "entry";
  }
  if (languageFromPath(path) === "python" || languageFromPath(path) === "javascript" || languageFromPath(path) === "typescript") {
    return "source";
  }
  return "other";
}

export function isSourceOrManifest(path: string): boolean {
  const role = fileRole(path);
  return role === "source" || role === "manifest" || role === "entry" || role === "config" || role === "docs";
}
