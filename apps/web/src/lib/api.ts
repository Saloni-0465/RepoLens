export type Technology = {
  id: string;
  name: string;
  category: string;
  evidenceFile: string;
  evidenceDetail: string;
  confidence: string;
};

export type RepoView = {
  id: string;
  fullName: string;
  repositoryUrl: string;
  defaultBranch: string | null;
  analyzedRevision: string | null;
  description: string | null;
  stars: number | null;
  primaryLanguage: string | null;
  analysis: {
    runId: string;
    status: string;
    errorCode: string | null;
    errorMessage: string | null;
    summary: string | null;
    skippedFiles: number;
    indexedFiles: number;
    startedAt: string;
    completedAt: string | null;
    technologies: Technology[];
  } | null;
};

export type FileMeta = {
  id: string;
  path: string;
  language: string | null;
  fileRole: string | null;
  sizeBytes: number;
  summary: string | null;
  parseStatus: string;
};

export type TreeNode = { name: string; path: string; type: "file" | "dir"; children?: TreeNode[] };

export type Citation = {
  path: string;
  startLine: number;
  endLine: number;
  snippet?: string;
  fileId?: string;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function analyzeRepo(url: string) {
  return req<{ repositoryId: string; runId: string; fullName: string; status: string }>("/api/repositories/analyze", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function getRepository(id: string) {
  return req<RepoView>(`/api/repositories/${id}`);
}

export function getTree(id: string) {
  return req<{ runId: string; status: string; tree: TreeNode[]; files: FileMeta[] }>(`/api/repositories/${id}/tree`);
}

export function getFile(id: string, fileId: string) {
  return req<{
    id: string;
    path: string;
    language: string | null;
    summary: string | null;
    content: string | null;
    chunks: { id: string; startLine: number; endLine: number; symbolName: string | null; content: string }[];
  }>(`/api/repositories/${id}/files/${fileId}`);
}

export function getSource(id: string, path: string) {
  return req<{ path: string; language: string | null; fileRole: string | null; summary: string | null; content: string | null }>(
    `/api/repositories/${id}/source?path=${encodeURIComponent(path)}`,
  );
}

export function askQuestion(id: string, question: string, sessionId: string) {
  return req<{
    answer: string;
    citations: Citation[];
    insufficient: boolean;
    evidenceCount: number;
    sessionId: string;
  }>(`/api/repositories/${id}/questions`, {
    method: "POST",
    body: JSON.stringify({ question, sessionId }),
  });
}
