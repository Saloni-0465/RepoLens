import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SiteFrame, WorkspaceSection } from "../components/SiteFrame";
import {
  askQuestion,
  Citation,
  FileMeta,
  getFile,
  getRepository,
  getSource,
  getTree,
  RepoView,
  TreeNode,
} from "../lib/api";

const QUESTIONS = [
  "How does authentication work?",
  "Where is the database connection initialized?",
  "Which files would I inspect to add a new API endpoint?",
  "What is the project entry point?",
];

export function WorkspacePage() {
  const { id } = useParams();
  const [repo, setRepo] = useState<RepoView | null>(null);
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FileMeta | null>(null);
  const [fileBody, setFileBody] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [sessionId] = useState(() => `sess_${Math.random().toString(36).slice(2, 10)}`);
  const [thread, setThread] = useState<{ q: string; a: string; citations: Citation[]; insufficient: boolean }[]>([]);
  const [asking, setAsking] = useState(false);
  const [section, setSection] = useState<WorkspaceSection>("overview");

  const status = repo?.analysis?.status;

  useEffect(() => {
    if (!id) return;
    let stop = false;
    async function load() {
      try {
        const data = await getRepository(id!);
        if (stop) return;
        setRepo(data);
        if (data.analysis?.status === "completed") {
          const t = await getTree(id!);
          if (stop) return;
          setFiles(t.files);
          setTree(t.tree);
        }
        if (data.analysis?.status === "pending" || data.analysis?.status === "running") {
          setTimeout(load, 1400);
        }
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : "Failed to load");
      }
    }
    load();
    return () => {
      stop = true;
    };
  }, [id]);

  async function openFile(file: FileMeta | Pick<TreeNode, "path">) {
    if (!id) return;
    const indexed = "id" in file;
    const path = file.path;
    setSelected(indexed ? file : { id: "", path, language: null, fileRole: null, sizeBytes: 0, summary: null, parseStatus: "on-demand" });
    setFileBody("Loading…");
    try {
      const full = indexed ? await getFile(id, file.id) : await getSource(id, path);
      setFileBody(full.content ?? "(content was not indexed)");
    } catch (err) {
      setFileBody(err instanceof Error ? err.message : "Unable to load file");
    }
  }

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    if (!id || !question.trim()) return;
    setAsking(true);
    try {
      const res = await askQuestion(id, question.trim(), sessionId);
      setThread((prev) => [
        { q: question.trim(), a: res.answer, citations: res.citations, insufficient: res.insufficient },
        ...prev,
      ]);
      setQuestion("");
    } catch (err) {
      setThread((prev) => [
        {
          q: question.trim(),
          a: err instanceof Error ? err.message : "Question failed",
          citations: [],
          insufficient: true,
        },
        ...prev,
      ]);
    } finally {
      setAsking(false);
    }
  }

  const techs = repo?.analysis?.technologies ?? [];
  const uniqueTechs = useMemo(() => {
    const map = new Map<string, (typeof techs)[number]>();
    for (const t of techs) {
      const key = `${t.category.toLowerCase()}::${t.name.toLowerCase()}`;
      const current = map.get(key);
      const depth = (path: string) => path.split("/").length;
      // Prefer the shallowest manifest for a compact, useful evidence link.
      if (!current || depth(t.evidenceFile) < depth(current.evidenceFile) || (depth(t.evidenceFile) === depth(current.evidenceFile) && t.evidenceFile.length < current.evidenceFile.length)) {
        map.set(key, t);
      }
    }
    return [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [techs]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof uniqueTechs>();
    for (const t of uniqueTechs) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return [...map.entries()];
  }, [uniqueTechs]);

  const keyFiles = useMemo(() => {
    const priority = ["entry", "manifest", "config", "docs", "source"];
    return [...files]
      .sort((a, b) => (priority.indexOf(a.fileRole ?? "other") < 0 ? priority.length : priority.indexOf(a.fileRole ?? "other")) - (priority.indexOf(b.fileRole ?? "other") < 0 ? priority.length : priority.indexOf(b.fileRole ?? "other")) || a.path.localeCompare(b.path))
      .slice(0, 5);
  }, [files]);

  const sourceLines = fileBody?.split(/\r?\n/) ?? [];

  return (
    <SiteFrame activeSection={section} onSectionChange={setSection} workspaceReady={status === "completed"}>
      <div className="workspace-page">
      <div className="workspace-heading">
        <div className="workspace-title-group">
          <Link to="/" className="back-link"><span aria-hidden="true">←</span> New survey</Link>
          <div className="repo-title-line"><div className="repo-monogram" aria-hidden="true">{repo?.fullName?.slice(0, 1).toUpperCase() ?? "R"}</div><div><p className="repo-context">PUBLIC REPOSITORY</p><h1>{repo?.fullName ?? "Loading repository…"}</h1></div></div>
          {repo?.description && <p className="workspace-description">{repo.description}</p>}
        </div>
        {repo && (
          <div className="analysis-badge-row">
            <span className={`status-pill status-${status ?? "unknown"}`}><i />{status ?? "—"}</span>
            <span className="branch-pill"><span aria-hidden="true">⑂</span>{repo.defaultBranch}</span>
            {repo.analyzedRevision && <span className="revision-pill">{repo.analyzedRevision.slice(0, 7)}</span>}
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-copper">{error}</p>}

      {(status === "pending" || status === "running") && (
        <div className="plate mb-6 p-5">
          <div className="stamp text-brass">In progress</div>
          <p className="mt-2 font-display text-2xl">Walking the tree and reading manifests.</p>
          <p className="mt-1 text-sm text-muted">Nothing in the repository is executed. Source is treated as data.</p>
        </div>
      )}

      {status === "failed" && (
        <div className="plate mb-6 border-copper p-5">
          <div className="stamp text-copper">{repo?.analysis?.errorCode ?? "failed"}</div>
          <p className="mt-2">{repo?.analysis?.errorMessage}</p>
        </div>
      )}

      {status === "completed" && repo?.analysis && <>
        <nav className="workspace-tabs" aria-label="Repository views">
          {([
            ["overview", "Overview"], ["stack", "Tech stack"], ["explorer", "File explorer"], ["questions", "Ask questions"],
          ] as [WorkspaceSection, string][]).map(([view, label]) => (
            <button key={view} type="button" className={section === view ? "selected" : ""} onClick={() => setSection(view)}>{label}</button>
          ))}
        </nav>

        {section === "overview" && <section id="workspace-overview" className="overview-screen">
          <div className="repo-facts">
            <div><span>Last analyzed</span><strong>{repo.analysis.completedAt ? new Date(repo.analysis.completedAt).toLocaleDateString() : "Just now"}</strong></div>
            <div><span>Files indexed</span><strong>{repo.analysis.indexedFiles.toLocaleString()}</strong></div>
            <div><span>Primary language</span><strong>{repo.primaryLanguage ?? "Not detected"}</strong></div>
            <div><span>Stars</span><strong>{repo.stars?.toLocaleString() ?? "—"}</strong></div>
          </div>
          <div className="overview-grid">
            <section className="workspace-card overview-tech-card">
              <div className="card-heading"><div><span className="card-kicker">EVIDENCE FROM MANIFESTS</span><h2>Tech stack</h2></div><button type="button" className="card-link" onClick={() => setSection("stack")}>View all →</button></div>
              {uniqueTechs.length ? <ul className="overview-tech-list">{uniqueTechs.slice(0, 6).map((tech, index) => <li key={`${tech.category}-${tech.name}`}><span className={`tech-bullet tone-${index % 5}`}>{tech.name.slice(0, 1).toUpperCase()}</span><span className="overview-tech-name">{tech.name}</span><span className="overview-tech-category">{tech.category}</span><button type="button" className="evidence-mini-link" title={`Open ${tech.evidenceFile}`} onClick={() => { const file = files.find((item) => item.path === tech.evidenceFile); if (file) { void openFile(file); setSection("explorer"); } }}>↗</button></li>)}</ul> : <p className="empty-message">No supported manifests were indexed.</p>}
              <button type="button" className="subtle-link" onClick={() => setSection("stack")}>See all technologies <span>→</span></button>
            </section>

            <section className="workspace-card overview-summary-card">
              <div className="card-heading"><div><span className="card-kicker">PROJECT SUMMARY</span><h2>What this repository does</h2></div><span className="card-mark">01</span></div>
              <p className="overview-summary">{repo.analysis.summary}</p>
              <div className="summary-divider" />
              <div className="key-files-heading"><strong>Key files</strong><button type="button" className="card-link" onClick={() => setSection("explorer")}>Browse files →</button></div>
              <ul className="key-files-list">{keyFiles.slice(0, 4).map((file) => <li key={file.id}><button type="button" onClick={() => { void openFile(file); setSection("explorer"); }}><span className="file-type-mark">{file.path.endsWith(".json") ? "{}" : file.path.endsWith(".md") ? "M" : "⌘"}</span><span className="key-file-path">{file.path}</span><span className="key-file-role">{file.fileRole ?? "source"}</span><span className="key-file-arrow">›</span></button></li>)}</ul>
            </section>

          </div>
        </section>}

        {section === "stack" && <section id="workspace-stack" className="detail-screen">
          <div className="section-title-row"><div><span className="card-kicker">DECLARED IN THE REPOSITORY</span><h2>Technology stack</h2></div><span className="section-count">{uniqueTechs.length} technologies</span></div>
          {grouped.length ? <div className="stack-page-grid">{grouped.map(([cat, items]) => <article className="workspace-card stack-category-card" key={cat}><div className="stack-category-heading"><span className="tech-category-icon">{cat.slice(0, 1).toUpperCase()}</span><div><span className="card-kicker">CATEGORY</span><h3>{cat.charAt(0).toUpperCase() + cat.slice(1)}</h3></div><span className="category-count">{items.length}</span></div><ul className="stack-detail-list">{items.map((tech) => <li key={`${tech.category}-${tech.name}`}><div className="stack-detail-name"><strong>{tech.name}</strong><span className={`confidence-chip confidence-${tech.confidence.toLowerCase()}`}>{tech.confidence} confidence</span></div><p>{tech.evidenceDetail}</p><button type="button" className="stack-evidence-button" onClick={() => { const file = files.find((item) => item.path === tech.evidenceFile); if (file) { void openFile(file); setSection("explorer"); } }}><span>Evidence</span><code>{tech.evidenceFile}</code><span>Open source →</span></button></li>)}</ul></article>)}</div> : <div className="workspace-card empty-state"><span className="empty-state-icon">◈</span><h3>No stack evidence found</h3><p>No supported dependency manifests were indexed for this repository.</p></div>}
        </section>}

        {section === "explorer" && <section id="workspace-explorer" className="explorer-screen">
          <div className="section-title-row"><div><span className="card-kicker">BROWSE THE PROJECT</span><h2>File explorer</h2><p>Choose a file to preview its indexed source.</p></div><span className="section-count">{files.length} files</span></div>
          <div className="explorer-grid">
            <div className="workspace-card tree-card"><div className="card-heading"><div><span className="card-kicker">REPOSITORY TREE</span><h2>Files</h2></div><span className="card-mark">{files.length}</span></div><div className="tree-container">{tree.length ? <TreeView nodes={tree} files={files} onOpen={openFile} selectedPath={selected?.path} /> : <p>No tree stored.</p>}</div></div>
            <div className="workspace-card source-card">
              <div className="source-ide-toolbar">
                <div className="source-tab">
                  <span className={`source-tab-icon ${fileIconTone(selected?.path)}`}>{fileIconLabel(selected?.path)}</span>
                  <strong>{selected?.path.split("/").pop() ?? "Select a file"}</strong>
                  {selected && <span className="source-tab-close">×</span>}
                </div>
                <div className="source-editor-status"><span><i /> Indexed source</span><b>READ ONLY</b></div>
              </div>
              <div className="source-crumb-row">
                <div className="source-breadcrumb">{selected ? <><span>repository</span>{selected.path.split("/").map((part, index) => <span key={`${part}-${index}`}><i>/</i>{part}</span>)}</> : <span>repository / source</span>}</div>
                {selected && <span className="source-language-tag">{languageLabel(selected.path)}</span>}
              </div>
              {selected?.summary && <div className="source-summary">{selected.summary}</div>}
              <div className={`source-editor ${fileBody ? "has-source" : "is-empty"}`}>
                {fileBody ? <>
                  <div className="source-line-numbers" aria-hidden="true">{sourceLines.map((_, index) => <span key={index}>{index + 1}</span>)}</div>
                  <pre className="source-code" aria-label={`Source code: ${selected?.path ?? "file"}`}><code>{sourceLines.map((line, index) => <span className="source-line" key={index}>{highlightSourceLine(line)}</span>)}</code></pre>
                </> : <div className="source-empty-state"><span>⌘</span><strong>Select a file to open it</strong><p>Choose a file from the repository tree to inspect its indexed source.</p></div>}
              </div>
            </div>
          </div>
        </section>}

        {section === "questions" && <section id="workspace-questions" className="questions-screen">
          <div className="section-title-row"><div><span className="card-kicker">SOURCE-GROUNDED Q&amp;A</span><h2>Ask the codebase</h2><p>Ask about this repository and follow each answer back to its cited lines.</p></div><span className="question-mark">?</span></div>
          <div className="questions-layout"><div className="workspace-card question-card"><div className="question-panel-title"><span className="assistant-icon">✳</span><div><strong>Repository assistant</strong><small>Answers are based on indexed source</small></div><i /></div><form onSubmit={onAsk} className="question-form"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} className="question-input" placeholder="How does request routing work?" /><div className="question-suggestions">{QUESTIONS.map((q) => <button key={q} type="button" className="suggestion-chip" onClick={() => setQuestion(q)}>{q}</button>)}</div><button type="submit" disabled={asking} className="ask-button">{asking ? "Retrieving…" : "Ask with citations"}<span aria-hidden="true">→</span></button></form>
              <div className="answer-thread">{thread.length === 0 ? <div className="question-empty"><span>⌘</span><strong>Start with a question about how the project works.</strong><p>Answers include relevant files and source line ranges when evidence is available.</p></div> : thread.map((item, i) => <article key={i} className="answer-item"><div className="question-asked"><span aria-hidden="true">Q</span>{item.q}</div>{item.insufficient && <div className="insufficient-label">Insufficient evidence</div>}<pre className="answer-copy">{item.a}</pre>{item.citations.length > 0 && <ul className="citation-list">{item.citations.map((c, j) => <li key={j} className="citation-item"><button type="button" className="citation-link" onClick={() => { const file = files.find((f) => f.path === c.path); if (file) { void openFile(file); setSection("explorer"); } }}>{c.path}:{c.startLine}–{c.endLine}</button>{c.snippet && <pre className="citation-snippet">{c.snippet}</pre>}</li>)}</ul>}</article>)}</div>
            </div><aside className="workspace-card question-guide"><span className="card-kicker">GOOD QUESTIONS TO START WITH</span><div className="question-guide-list">{QUESTIONS.map((q, index) => <button type="button" key={q} onClick={() => setQuestion(q)}><span>{String(index + 1).padStart(2, "0")}</span>{q}<b>↗</b></button>)}</div><p>RepoLens will say when the indexed code doesn’t contain enough evidence.</p></aside></div>
        </section>}
      </>}
      </div>
    </SiteFrame>
  );
}

function TreeView({
  nodes,
  files,
  onOpen,
  selectedPath,
  depth = 0,
}: {
  nodes: TreeNode[];
  files: FileMeta[];
  onOpen: (f: FileMeta | Pick<TreeNode, "path">) => void;
  selectedPath?: string;
  depth?: number;
}) {
  return (
    <ul>
      {nodes.map((n) => {
        const meta = files.find((f) => f.path === n.path);
        return (
          <li key={n.path} style={{ paddingLeft: depth * 12 }}>
            {n.type === "dir" ? (
              <details open={depth < 1}>
                <summary className="cursor-pointer text-pine"><span className="tree-folder-glyph" aria-hidden="true" />{n.name}/</summary>
                {n.children && <TreeView nodes={n.children} files={files} onOpen={onOpen} selectedPath={selectedPath} depth={depth + 1} />}
              </details>
            ) : meta ? (
              <button type="button" className={`tree-file-button ${selectedPath === meta.path ? "selected" : ""}`} onClick={() => onOpen(meta)}>
                <span className={`tree-file-icon ${fileIconTone(meta.path)}`} aria-hidden="true">{fileIconLabel(meta.path)}</span>
                <span className="tree-file-name">{n.name}</span>
                {meta.fileRole && meta.fileRole !== "other" ? (
                  <span className="tree-file-role">{meta.fileRole}</span>
                ) : null}
              </button>
            ) : (
              <button type="button" className={`tree-file-button tree-file-on-demand ${selectedPath === n.path ? "selected" : ""}`} title="Load this file from the analyzed repository snapshot" onClick={() => onOpen(n)}>
                <span className={`tree-file-icon ${fileIconTone(n.path)}`} aria-hidden="true">{fileIconLabel(n.path)}</span>
                <span className="tree-file-name">{n.name}</span>
                <span className="tree-file-role">load on open</span>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function fileExtension(path?: string) {
  return path?.split("/").pop()?.split(".").pop()?.toLowerCase() ?? "";
}

function fileIconLabel(path?: string) {
  const ext = fileExtension(path);
  const labels: Record<string, string> = { ts: "TS", tsx: "TS", js: "JS", jsx: "JS", mjs: "JS", py: "PY", json: "{}", md: "M", toml: "T", yml: "Y", yaml: "Y", css: "#", scss: "#", html: "<>" , rs: "RS", go: "GO", lock: "L" };
  return labels[ext] ?? (ext ? ext.slice(0, 2).toUpperCase() : "<>" );
}

function fileIconTone(path?: string) {
  const ext = fileExtension(path);
  if (["ts", "tsx"].includes(ext)) return "tone-typescript";
  if (["js", "jsx", "mjs"].includes(ext)) return "tone-javascript";
  if (ext === "py") return "tone-python";
  if (ext === "json") return "tone-json";
  if (ext === "md") return "tone-markdown";
  return "tone-config";
}

const CODE_KEYWORDS = new Set("as async await break case catch class const continue def del elif else enum export extends finally for from function if import in interface let match new of package private protected public return static struct switch throw try type var while yield self None True False null undefined true false fn impl pub use mod mut where async await move trait crate super match loop dyn ref".split(/\s+/));
const CODE_TOKEN = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/.*|#.*|\b[A-Za-z_$][\w$]*\b|\b\d+(?:\.\d+)?\b)/g;

function highlightSourceLine(line: string) {
  const tokens: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  CODE_TOKEN.lastIndex = 0;
  while ((match = CODE_TOKEN.exec(line)) !== null) {
    if (match.index > cursor) tokens.push(line.slice(cursor, match.index));
    const token = match[0];
    const next = line.slice(match.index + token.length).match(/^\s*([=(])/);
    let tone = "";
    if (/^(\/\/|#)/.test(token)) tone = "syntax-comment";
    else if (/^["'`]/.test(token)) tone = "syntax-string";
    else if (/^\d/.test(token)) tone = "syntax-number";
    else if (CODE_KEYWORDS.has(token)) tone = "syntax-keyword";
    else if (next?.[1] === "(") tone = "syntax-function";
    tokens.push(<span className={tone} key={`${match.index}-${token}`}>{token}</span>);
    cursor = match.index + token.length;
  }
  if (cursor < line.length) tokens.push(line.slice(cursor));
  return tokens.length ? tokens : " ";
}

function languageLabel(path: string) {
  const ext = fileExtension(path);
  const labels: Record<string, string> = { ts: "TypeScript", tsx: "TypeScript React", js: "JavaScript", jsx: "JavaScript React", py: "Python", json: "JSON", md: "Markdown", toml: "TOML", yml: "YAML", yaml: "YAML", css: "CSS", scss: "SCSS", html: "HTML", rs: "Rust", go: "Go" };
  return labels[ext] ?? (ext ? ext.toUpperCase() : "Plain text");
}
