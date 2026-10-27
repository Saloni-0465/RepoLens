import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const runs = Router();

runs.get("/:runId", async (req, res) => {
  const run = await prisma.analysisRun.findUnique({
    where: { id: req.params.runId },
    include: { repository: true, technologies: true },
  });
  if (!run) return res.status(404).json({ error: "Analysis run not found" });
  res.json({
    id: run.id,
    repositoryId: run.repositoryId,
    fullName: run.repository.fullName,
    status: run.status,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    summary: run.summary,
    skippedFiles: run.skippedFiles,
    indexedFiles: run.indexedFiles,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    analyzedRevision: run.repository.analyzedRevision,
  });
});
