import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SiteFrame, WorkspaceSection } from "../components/SiteFrame";
import {
  askQuestion,
  Citation,
  FileMeta,
  getFile,
  getRepository,
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

  async function openFile(file: FileMeta) {
    if (!id) return;
    setSelected(file);
    setFileBody("Loading…");
    try {
      const full = await getFile(id, file.id);
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
  const grouped = useMemo(() => {
    const map = new Map<string, typeof techs>();
    for (const t of techs) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return [...map.entries()];
  }, [techs]);

  const architecture = useMemo(() => {
    const folders = new Map<string, FileMeta[]>();
    for (const file of files) {
      const parts = file.path.split("/");
      if (parts.length < 2) continue;
      const folder = parts[0];
      const list = folders.get(folder) ?? [];
      list.push(file);
      folders.set(folder, list);
    }
    const nodes = [...folders.entries()]
      .map(([name, entries]) => ({
        name,
        entries,
        representative: entries.find((f) => f.fileRole === "entry") ?? entries.find((f) => f.fileRole === "source") ?? entries[0],
      }))
      .sort((a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name))
      .slice(0, 4);
    return {
      entry: files.find((f) => f.fileRole === "entry") ?? files.find((f) => f.fileRole === "manifest") ?? files[0],
      nodes,
    };
  }, [files]);

  const keyFiles = useMemo(() => {
    const priority = ["entry", "manifest", "config", "docs", "source"];
    return [...files]
      .sort((a, b) => (priority.indexOf(a.fileRole ?? "other") < 0 ? priority.length : priority.indexOf(a.fileRole ?? "other")) - (priority.indexOf(b.fileRole ?? "other") < 0 ? priority.length : priority.indexOf(b.fileRole ?? "other")) || a.path.localeCompare(b.path))
      .slice(0, 5);
  }, [files]);

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
            ["overview", "Overview"], ["stack", "Tech stack"], ["architecture", "Architecture"], ["explorer", "File explorer"], ["questions", "Ask questions"],
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
              {techs.length ? <ul className="overview-tech-list">{techs.slice(0, 6).map((tech, index) => <li key={tech.id}><span className={`tech-bullet tone-${index % 5}`}>{tech.name.slice(0, 1).toUpperCase()}</span><span className="overview-tech-name">{tech.name}</span><span className="overview-tech-category">{tech.category}</span><button type="button" className="evidence-mini-link" title={`Open ${tech.evidenceFile}`} onClick={() => { const file = files.find((item) => item.path === tech.evidenceFile); if (file) { void openFile(file); setSection("explorer"); } }}>↗</button></li>)}</ul> : <p className="empty-message">No supported manifests were indexed.</p>}
              <button type="button" className="subtle-link" onClick={() => setSection("stack")}>See all technologies <span>→</span></button>
            </section>

            <section className="workspace-card overview-summary-card">
              <div className="card-heading"><div><span className="card-kicker">PROJECT SUMMARY</span><h2>What this repository does</h2></div><span className="card-mark">01</span></div>
              <p className="overview-summary">{repo.analysis.summary}</p>
              <div className="summary-divider" />
              <div className="key-files-heading"><strong>Key files</strong><button type="button" className="card-link" onClick={() => setSection("explorer")}>Browse files →</button></div>
              <ul className="key-files-list">{keyFiles.slice(0, 4).map((file) => <li key={file.id}><button type="button" onClick={() => { void openFile(file); setSection("explorer"); }}><span className="file-type-mark">{file.path.endsWith(".json") ? "{}" : file.path.endsWith(".md") ? "M" : "⌘"}</span><span className="key-file-path">{file.path}</span><span className="key-file-role">{file.fileRole ?? "source"}</span><span className="key-file-arrow">›</span></button></li>)}</ul>
            </section>

            <section className="workspace-card quick-actions-card">
              <div className="card-heading"><div><span className="card-kicker">KEEP EXPLORING</span><h2>Quick actions</h2></div><span className="card-mark">↗</span></div>
              <div className="quick-actions-list">
                {([["explorer", "▤", "View file explorer", "Browse folders and source"], ["questions", "◎", "Ask a question", "Get answers with citations"], ["architecture", "⌘", "View architecture", "Map folders and entry points"]] as [WorkspaceSection, string, string, string][]).map(([view, icon, label, detail]) => <button type="button" key={view} onClick={() => setSection(view)}><span className="quick-action-icon">{icon}</span><span className="quick-action-copy"><strong>{label}</strong><small>{detail}</small></span><span className="quick-action-arrow">›</span></button>)}
              </div>
              <div className="overview-counts"><div><strong>{repo.analysis.skippedFiles}</strong><span>Skipped by filters</span></div><div><strong>{techs.length}</strong><span>Stack findings</span></div></div>
            </section>
          </div>
        </section>}

        {section === "stack" && <section id="workspace-stack" className="detail-screen">
          <div className="section-title-row"><div><span className="card-kicker">DECLARED IN THE REPOSITORY</span><h2>Technology stack</h2><p>Detected from dependency manifests and configuration files, with evidence for every finding.</p></div><span className="section-count">{techs.length} findings</span></div>
          {grouped.length ? <div className="stack-page-grid">{grouped.map(([cat, items]) => <article className="workspace-card stack-category-card" key={cat}><div className="stack-category-heading"><span className="tech-category-icon">{cat.slice(0, 1)}</span><div><span className="card-kicker">CATEGORY</span><h3>{cat}</h3></div><span className="category-count">{items.length}</span></div><ul className="stack-detail-list">{items.map((tech) => <li key={tech.id}><div className="stack-detail-name"><strong>{tech.name}</strong><span className={`confidence-chip confidence-${tech.confidence.toLowerCase()}`}>{tech.confidence} confidence</span></div><p>{tech.evidenceDetail}</p><button type="button" className="stack-evidence-button" onClick={() => { const file = files.find((item) => item.path === tech.evidenceFile); if (file) { void openFile(file); setSection("explorer"); } }}><span>Evidence</span><code>{tech.evidenceFile}</code><span>Open source →</span></button></li>)}</ul></article>)}</div> : <div className="workspace-card empty-state"><span className="empty-state-icon">◈</span><h3>No stack evidence found</h3><p>No supported dependency manifests were indexed for this repository.</p></div>}
        </section>}

        {section === "architecture" && <section id="workspace-architecture" className="architecture-screen">
          <div className="section-title-row"><div><span className="card-kicker">PROJECT STRUCTURE</span><h2>Architecture map</h2><p>Explore the main folders and entry point identified in this repository.</p></div><div className="architecture-summary"><strong>{architecture.nodes.length}</strong><span>folders</span><b>·</b><strong>{files.filter((file) => file.fileRole === "entry").length}</strong><span>entry points</span></div></div>
          <section className="workspace-card architecture-map-card">
              <div className="architecture-card-heading"><div><span className="card-kicker">REPOSITORY</span><h3>{repo.fullName}</h3></div><span className="evidence-chip"><i />Based on indexed files</span></div>
              <p className="architecture-disclaimer">This map groups indexed files by folder. Lines mean “contains”; they do not show function calls or runtime dependencies.</p>
              {architecture.entry && <button type="button" className="architecture-entry-summary" onClick={() => { void openFile(architecture.entry!); setSection("explorer"); }}><span className="architecture-node-icon">⌘</span><span><small>DETECTED ENTRY POINT</small><strong>{architecture.entry.path}</strong></span><span className="entry-open">Open source →</span></button>}
              <div className="architecture-map">
                <svg className="architecture-connectors" viewBox="0 0 1000 390" preserveAspectRatio="none" aria-hidden="true">
                  <defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="#a7baf0" strokeWidth="1.4" /></marker></defs>
                  {architecture.nodes.map((node, index) => {
                    const positions = architecture.nodes.length === 1 ? [500] : architecture.nodes.length === 2 ? [300, 700] : architecture.nodes.length === 3 ? [180, 500, 820] : [110, 370, 630, 890];
                    return <path key={node.name} d={`M500 65 C500 105 ${positions[index]} 110 ${positions[index]} 190`} />;
                  })}
                </svg>
                <button type="button" className="architecture-node architecture-root" onClick={() => setSection("overview")}><span className="architecture-node-icon root-icon">⌂</span><span><strong>Repository</strong><small>{repo.fullName}</small></span></button>
                <div className="architecture-modules">
                  {architecture.nodes.length ? architecture.nodes.map((node) => <button type="button" className="architecture-node architecture-module" key={node.name} onClick={() => { void openFile(node.representative); setSection("explorer"); }}><span className="architecture-node-icon folder-icon">▰</span><span><strong>{node.name}/</strong><small>{node.entries.length} indexed {node.entries.length === 1 ? "file" : "files"}</small></span><span className="module-open">↗</span></button>) : <div className="architecture-empty">No top-level directories were included in the indexed source.</div>}
                </div>
              </div>
              <div className="architecture-legend"><span><i className="legend-folder" />Directory</span><span><i className="legend-entry" />Entry point / manifest</span><span><i className="legend-connection" />Contains</span></div>
          </section>
        </section>}

        {section === "explorer" && <section id="workspace-explorer" className="explorer-screen">
          <div className="section-title-row"><div><span className="card-kicker">BROWSE THE PROJECT</span><h2>File explorer</h2><p>Choose a file to preview its indexed source.</p></div><span className="section-count">{files.length} files</span></div>
          <div className="explorer-grid">
            <div className="workspace-card tree-card"><div className="card-heading"><div><span className="card-kicker">REPOSITORY TREE</span><h2>Files</h2></div><span className="card-mark">{files.length}</span></div><div className="tree-container">{tree.length ? <TreeView nodes={tree} files={files} onOpen={openFile} /> : <p>No tree stored.</p>}</div></div>
            <div className="workspace-card source-card"><div className="card-heading"><div><span className="card-kicker">SOURCE PREVIEW</span><h2>{selected?.path ?? "Choose a file"}</h2></div><span className="source-file-mark" aria-hidden="true">{selected ? "{ }" : "⌘"}</span></div>{selected?.summary && <p className="source-summary">{selected.summary}</p>}<pre className="source-code"><code>{fileBody ?? "Choose a path from the file explorer to read its indexed contents."}</code></pre></div>
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
  depth = 0,
}: {
  nodes: TreeNode[];
  files: FileMeta[];
  onOpen: (f: FileMeta) => void;
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
                <summary className="cursor-pointer text-pine">{n.name}/</summary>
                {n.children && <TreeView nodes={n.children} files={files} onOpen={onOpen} depth={depth + 1} />}
              </details>
            ) : meta ? (
              <button type="button" className="text-left hover:text-copper" onClick={() => onOpen(meta)}>
                {n.name}
                {meta.fileRole && meta.fileRole !== "other" ? (
                  <span className="ml-2 stamp text-muted">{meta.fileRole}</span>
                ) : null}
              </button>
            ) : (
              <span className="text-muted">{n.name}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
