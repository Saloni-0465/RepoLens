import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteFrame } from "../components/SiteFrame";
import { analyzeRepo } from "../lib/api";

const EXAMPLES = [
  { label: "facebook/react", url: "https://github.com/facebook/react" },
  { label: "vuejs/vue", url: "https://github.com/vuejs/vue" },
  { label: "microsoft/vscode", url: "https://github.com/microsoft/vscode" },
  { label: "django/django", url: "https://github.com/django/django" },
];

export function HomePage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await analyzeRepo(url);
      navigate(`/r/${result.repositoryId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start analysis");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteFrame>
      <div className="home-page">
        <section className="home-hero">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-mark" />A field guide to unfamiliar code</p>
            <h1>Find your way<br />around <em>any codebase.</em></h1>
            <p className="hero-description">
              Get a clear picture of how a public repository is put together. Explore its files, see the tools it uses, and ask questions with source evidence close at hand.
            </p>
            <form onSubmit={onSubmit} className="repo-form">
              <label htmlFor="repo-url">Start with a repository URL</label>
              <div className="repo-input-row">
                <span className="input-glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.06c-3.1.68-3.76-1.32-3.76-1.32-.5-1.3-1.24-1.65-1.24-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 .1.76 2.06 3.22 1.45.1-.72.4-1.22.7-1.5-2.48-.28-5.08-1.25-5.08-5.53 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.42.11-2.96 0 0 .95-.3 3.05 1.15a10.6 10.6 0 0 1 5.56 0c2.11-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.12 2.96.72.78 1.15 1.78 1.15 3.01 0 4.29-2.6 5.24-5.09 5.52.4.35.75 1.03.75 2.08V22c0 .3.2.64.77.53A11.1 11.1 0 0 0 12 .9Z" /></svg>
                </span>
                <input
                  id="repo-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  autoComplete="off"
                />
                <button type="submit" disabled={busy}>
                  {busy ? "Taking a look…" : "Explore repository"}<span aria-hidden="true">→</span>
                </button>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="example-row">
                <span>Try these examples:</span>
                {EXAMPLES.map((ex) => (
                  <button key={ex.url} type="button" onClick={() => setUrl(ex.url)}>{ex.label}<span aria-hidden="true">↗</span></button>
                ))}
              </div>
            </form>
          </div>

          <aside className="hero-visual" aria-label="Illustration of a repository explorer with source-grounded answers">
            <div className="hero-mockup" aria-hidden="true">
              <div className="mock-orbit mock-orbit-one" />
              <div className="mock-orbit mock-orbit-two" />
              <div className="mock-spark spark-one" /><div className="mock-spark spark-two" />
              <div className="mock-tech-tags">
                <span><i className="tech-react">R</i>React</span>
                <span><i className="tech-node">N</i>Node.js</span>
                <span><i className="tech-db">◉</i>PostgreSQL</span>
              </div>
              <div className="mock-window">
                <div className="mock-titlebar"><span className="window-dots"><i /><i /><i /></span><span>repository explorer</span><b>···</b></div>
                <div className="mock-window-body">
                  <div className="mock-file-tree">
                    <strong>EXPLORER</strong>
                    <span className="tree-folder">⌄ &nbsp; src</span>
                    <span className="tree-file active">◈ &nbsp; app.tsx</span>
                    <span className="tree-file">◈ &nbsp; auth.ts</span>
                    <span className="tree-folder">› &nbsp; components</span>
                    <span className="tree-folder">› &nbsp; routes</span>
                    <span className="tree-file">▤ &nbsp; package.json</span>
                  </div>
                  <div className="mock-code">
                    <div className="mock-code-tab">src / auth.ts</div>
                    <div className="code-lines">
                      <span><i>1</i><b className="code-purple">import</b> {"{ createSession }"}</span>
                      <span><i>2</i><b className="code-blue">from</b> <em>'./session'</em></span>
                      <span><i>3</i></span>
                      <span><i>4</i><b className="code-purple">export async function</b></span>
                      <span><i>5</i> &nbsp; authenticate(request) {"{"}</span>
                      <span><i>6</i> &nbsp; <b className="code-purple">const</b> user = <b className="code-blue">await</b></span>
                      <span><i>7</i> &nbsp; &nbsp; verifyCredentials(request)</span>
                      <span><i>8</i> &nbsp; <b className="code-purple">return</b> createSession(user)</span>
                      <span><i>9</i>{"}"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mock-floating-mark">⌘</div>
              <div className="mock-answer-card">
                <div className="answer-heading"><span className="answer-avatar">◉</span><strong>How does the authentication<br />flow work in this project?</strong></div>
                <div className="answer-row"><i>↪</i><span>Authentication flow</span><b>›</b></div>
                <div className="answer-row"><i>▧</i><span>Relevant files</span><b>›</b></div>
                <div className="answer-row"><i>‹›</i><span>Code snippets</span><b>›</b></div>
                <div className="answer-row"><i>⌕</i><span>Source references</span><b>›</b></div>
              </div>
              <div className="mock-blue-tile">↗</div>
            </div>
          </aside>
        </section>

        <section id="how-it-works" className="how-it-works" aria-labelledby="how-title">
          <div className="section-intro"><div><p className="eyebrow">A clearer first read</p><h2 id="how-title">From URL to understanding.</h2></div><p>Useful context, with a trail back to the code.</p></div>
          <div className="steps-grid">
            {[
              ["01", "Get the lay of the land", "A navigable view of the project, its key files and the places worth opening first."],
              ["02", "See what it's built with", "Technologies are tied to dependency manifests and configuration evidence."],
              ["03", "Follow the source", "Ask a question and inspect the matching files and line references."],
            ].map(([n, t, d]) => (
              <article className="step-card" key={n}><span className="step-number">{n}</span><h3>{t}</h3><p>{d}</p><span className="step-arrow" aria-hidden="true">↗</span></article>
            ))}
          </div>
        </section>
      </div>
    </SiteFrame>
  );
}
