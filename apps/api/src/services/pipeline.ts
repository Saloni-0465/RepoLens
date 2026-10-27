import { prisma } from "../lib/prisma.js";
import { fileRole, isSourceOrManifest, languageFromPath, shouldSkipPath } from "../lib/filters.js";
import { analyzeFiles } from "./analyzerClient.js";
import { getCommitSha, getFileText, getRepo, getTree, GithubError } from "./github.js";

const MAX_FILES = Number(process.env.MAX_FILES ?? 120);
const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES ?? 200_000);
const MAX_TOTAL_BYTES = Number(process.env.MAX_TOTAL_BYTES ?? 8_000_000);

function priority(path: string): number {
  const role = fileRole(path);
  if (role === "manifest") return 0;
  if (role === "docs") return 1;
  if (role === "entry") return 2;
  if (role === "config") return 3;
  if (role === "source") return 4;
  return 9;
}

export async function runAnalysis(runId: string, owner: string, repo: string) {
  await prisma.analysisRun.update({ where: { id: runId }, data: { status: "running" } });
  try {
    const meta = await getRepo(owner, repo);
    const sha = await getCommitSha(owner, repo, meta.default_branch);
    const tree = await getTree(owner, repo, sha);
    const blobs = tree.filter((t) => t.type === "blob" && t.path && !shouldSkipPath(t.path));
    const skipped = tree.filter((t) => t.type === "blob" && t.path && shouldSkipPath(t.path)).length;

    const candidates = blobs
      .filter((t) => isSourceOrManifest(t.path) && (t.size ?? 0) <= MAX_FILE_BYTES)
      .sort((a, b) => priority(a.path) - priority(b.path) || a.path.localeCompare(b.path));

    const selected = [];
    let total = 0;
    for (const item of candidates) {
      if (selected.length >= MAX_FILES) break;
      const size = item.size ?? 0;
      if (total + size > MAX_TOTAL_BYTES) break;
      selected.push(item);
      total += size;
    }

    const fetched = [];
    const queue = [...selected];
    const workers = Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) break;
        const content = await getFileText(owner, repo, sha, item.path, MAX_FILE_BYTES);
        if (!content) continue;
        fetched.push({
          path: item.path,
          content,
          language: languageFromPath(item.path),
          role: fileRole(item.path),
          size: Buffer.byteLength(content),
        });
      }
    });
    await Promise.all(workers);

    const analysis = await analyzeFiles(
      fetched.map((f) => ({ path: f.path, content: f.content, language: f.language, role: f.role })),
    );

    const treeJson = buildTree(blobs.map((b) => b.path));
    const byPath = new Map(analysis.files.map((f) => [f.path, f]));

    await prisma.$transaction(async (tx) => {
      await tx.repository.update({
        where: { id: (await tx.analysisRun.findUniqueOrThrow({ where: { id: runId } })).repositoryId },
        data: {
          description: meta.description,
          defaultBranch: meta.default_branch,
          analyzedRevision: sha,
          stars: meta.stargazers_count,
          primaryLanguage: meta.language,
        },
      });

      await tx.analysisRun.update({
        where: { id: runId },
        data: {
          treeJson,
          skippedFiles: skipped + Math.max(0, blobs.length - selected.length),
          indexedFiles: fetched.length,
          summary: composeSummary(meta.full_name, meta.description, analysis, sha, meta.default_branch),
        },
      });

      await tx.technologyFinding.deleteMany({ where: { analysisRunId: runId } });
      if (analysis.technologies.length) {
        await tx.technologyFinding.createMany({
          data: analysis.technologies.map((t) => ({
            analysisRunId: runId,
            name: t.name,
            category: t.category,
            evidenceFile: t.evidence_file,
            evidenceDetail: t.evidence_detail,
            confidence: t.confidence,
          })),
        });
      }

      for (const file of fetched) {
        const parsed = byPath.get(file.path);
        const record = await tx.fileRecord.create({
          data: {
            analysisRunId: runId,
            path: file.path,
            language: file.language,
            sizeBytes: file.size,
            fileRole: file.role,
            summary: parsed?.summary ?? null,
            parseStatus: parsed?.parse_status ?? "ok",
            content: file.content,
          },
        });
        const chunks = parsed?.chunks ?? fallbackChunks(file.content);
        if (chunks.length) {
          await tx.codeChunk.createMany({
            data: chunks.map((c) => ({
              fileRecordId: record.id,
              startLine: c.start_line,
              endLine: c.end_line,
              symbolName: c.symbol_name,
              content: c.content.slice(0, 8000),
            })),
          });
        }
      }

      await tx.analysisRun.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date() },
      });
    });
  } catch (err) {
    const code = err instanceof GithubError ? err.code : "analysis_failed";
    const message = err instanceof Error ? err.message : "Unknown analysis error";
    await prisma.analysisRun.update({
      where: { id: runId },
      data: { status: "failed", completedAt: new Date(), errorCode: code, errorMessage: message },
    });
  }
}

function fallbackChunks(content: string) {
  const lines = content.split(/\r?\n/);
  const chunks = [];
  for (let i = 0; i < lines.length; i += 40) {
    const slice = lines.slice(i, i + 40);
    chunks.push({
      start_line: i + 1,
      end_line: i + slice.length,
      symbol_name: null,
      content: slice.join("\n"),
    });
  }
  return chunks.slice(0, 12);
}

function composeSummary(
  fullName: string,
  description: string | null,
  analysis: Awaited<ReturnType<typeof analyzeFiles>>,
  sha: string,
  branch: string,
) {
  const techs = [...new Set(analysis.technologies.map((t) => t.name))].slice(0, 10);
  const entries = analysis.overview_hints.entry_points.slice(0, 6);
  const readme = analysis.overview_hints.readme_excerpt?.replace(/\s+/g, " ").slice(0, 420);
  const parts = [
    `${fullName} @ ${branch} (${sha.slice(0, 7)}).`,
    description ? description.replace(/\s+/g, " ").slice(0, 280) : null,
    techs.length ? `Detected stack: ${techs.join(", ")}.` : "No dependency manifests were found among indexed files.",
    entries.length ? `Likely entry points: ${entries.join(", ")}.` : null,
    readme ? `From README: ${readme}` : "No README excerpt was indexed.",
  ];
  return parts.filter(Boolean).join(" ");
}

export type TreeNode = { name: string; path: string; type: "file" | "dir"; children?: TreeNode[] };

export function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const p of paths.sort()) {
    const parts = p.split("/");
    let level = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      acc = acc ? `${acc}/${name}` : name;
      const isFile = i === parts.length - 1;
      let node = level.find((n) => n.name === name);
      if (!node) {
        node = { name, path: acc, type: isFile ? "file" : "dir", children: isFile ? undefined : [] };
        level.push(node);
      }
      if (!isFile) level = node.children!;
    }
  }
  return root;
}
