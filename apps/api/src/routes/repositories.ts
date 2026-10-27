import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { parseGithubUrl } from "../lib/githubUrl.js";
import { runAnalysis } from "../services/pipeline.js";
import { answerQuestion } from "../services/qa.js";

export const repositories = Router();

const analyzeBody = z.object({
  url: z.string().min(8).max(400),
});

const questionBody = z.object({
  question: z.string().min(3).max(2000),
  sessionId: z.string().min(4).max(80).optional(),
});

repositories.post("/analyze", async (req, res) => {
  const parsed = analyzeBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  const gh = parseGithubUrl(parsed.data.url);
  if (!gh) return res.status(400).json({ error: "Enter a public GitHub repository URL, e.g. https://github.com/owner/repo" });

  const existing = await prisma.repository.findFirst({
    where: { fullName: gh.fullName },
    orderBy: { createdAt: "desc" },
    include: { analysisRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
  });

  const repo =
    existing ??
    (await prisma.repository.create({
      data: { fullName: gh.fullName, repositoryUrl: gh.url },
    }));

  const run = await prisma.analysisRun.create({
    data: { repositoryId: repo.id, status: "pending" },
  });

  void runAnalysis(run.id, gh.owner, gh.repo);

  res.status(202).json({
    repositoryId: repo.id,
    runId: run.id,
    fullName: gh.fullName,
    status: "pending",
  });
});

repositories.get("/:id", async (req, res) => {
  const repo = await prisma.repository.findUnique({
    where: { id: req.params.id },
    include: {
      analysisRuns: { orderBy: { startedAt: "desc" }, take: 1, include: { technologies: true } },
    },
  });
  if (!repo) return res.status(404).json({ error: "Repository not found" });
  const run = repo.analysisRuns[0] ?? null;
  res.json({
    id: repo.id,
    fullName: repo.fullName,
    repositoryUrl: repo.repositoryUrl,
    defaultBranch: repo.defaultBranch,
    analyzedRevision: repo.analyzedRevision,
    description: repo.description,
    stars: repo.stars,
    primaryLanguage: repo.primaryLanguage,
    analysis: run
      ? {
          runId: run.id,
          status: run.status,
          errorCode: run.errorCode,
          errorMessage: run.errorMessage,
          summary: run.summary,
          skippedFiles: run.skippedFiles,
          indexedFiles: run.indexedFiles,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          technologies: run.technologies,
        }
      : null,
  });
});

repositories.get("/:id/tree", async (req, res) => {
  const run = await latestRun(req.params.id);
  if (!run) return res.status(404).json({ error: "Repository not found" });
  const files = await prisma.fileRecord.findMany({
    where: { analysisRunId: run.id },
    select: { id: true, path: true, language: true, fileRole: true, sizeBytes: true, summary: true, parseStatus: true },
    orderBy: { path: "asc" },
  });
  res.json({ runId: run.id, status: run.status, tree: run.treeJson ?? [], files });
});

repositories.get("/:id/technologies", async (req, res) => {
  const run = await latestRun(req.params.id);
  if (!run) return res.status(404).json({ error: "Repository not found" });
  const technologies = await prisma.technologyFinding.findMany({ where: { analysisRunId: run.id } });
  res.json({ runId: run.id, technologies });
});

repositories.get("/:id/files/:fileId", async (req, res) => {
  const run = await latestRun(req.params.id);
  if (!run) return res.status(404).json({ error: "Repository not found" });
  const file = await prisma.fileRecord.findFirst({
    where: { id: req.params.fileId, analysisRunId: run.id },
    include: { chunks: { orderBy: { startLine: "asc" } } },
  });
  if (!file) return res.status(404).json({ error: "File not found in this analysis" });
  res.json(file);
});

repositories.post("/:id/questions", async (req, res) => {
  const parsed = questionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid question" });
  const run = await latestRun(req.params.id);
  if (!run) return res.status(404).json({ error: "Repository not found" });
  if (run.status !== "completed") {
    return res.status(409).json({ error: "Analysis is not complete yet", status: run.status });
  }
  const sessionId = parsed.data.sessionId ?? `sess_${run.id}`;
  const result = await answerQuestion(run.id, parsed.data.question, sessionId);
  res.json({ runId: run.id, sessionId, ...result });
});

async function latestRun(repoId: string) {
  return prisma.analysisRun.findFirst({
    where: { repositoryId: repoId },
    orderBy: { startedAt: "desc" },
  });
}
