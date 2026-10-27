export type AnalyzerFile = {
  path: string;
  content: string;
  language: string | null;
  role: string;
};

export type AnalyzerResult = {
  technologies: {
    name: string;
    category: string;
    evidence_file: string;
    evidence_detail: string;
    confidence: string;
  }[];
  files: {
    path: string;
    summary: string;
    parse_status: string;
    symbols: { name: string; kind: string; start_line: number; end_line: number }[];
    chunks: { start_line: number; end_line: number; symbol_name: string | null; content: string }[];
  }[];
  overview_hints: {
    readme_excerpt: string | null;
    entry_points: string[];
    key_folders: string[];
  };
};

export async function analyzeFiles(files: AnalyzerFile[]): Promise<AnalyzerResult> {
  const base = process.env.ANALYZER_URL ?? "http://localhost:8001";
  let last = new Error("Analyzer unavailable");
  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(`${base}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Analyzer failed: ${res.status} ${text}`);
      }
      return (await res.json()) as AnalyzerResult;
    } catch (err) {
      last = err instanceof Error ? err : new Error(String(err));
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  throw last;
}
