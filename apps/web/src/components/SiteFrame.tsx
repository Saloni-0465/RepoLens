import { Link, useLocation } from "react-router-dom";
import { CompassMark } from "./CompassMark";

export type WorkspaceSection = "overview" | "stack" | "architecture" | "explorer" | "questions";

export function SiteFrame({
  children,
  activeSection = "overview",
  onSectionChange,
  workspaceReady = true,
}: {
  children: React.ReactNode;
  activeSection?: WorkspaceSection;
  onSectionChange?: (section: WorkspaceSection) => void;
  workspaceReady?: boolean;
}) {
  const { pathname } = useLocation();
  const isWorkspace = pathname.startsWith("/r/");
  const brand = (
    <Link to="/" className="brand-lockup">
      <CompassMark size={42} />
      <div>
        <div className="brand-name">Repolens</div>
        <div className="brand-caption">Repository intelligence</div>
      </div>
    </Link>
  );

  return (
    <div className={`site-frame ${isWorkspace ? "workspace-shell" : "home-shell"}`}>
      {isWorkspace && (
        <aside className="app-sidebar">
          {brand}
          <p className="sidebar-label">WORKSPACE</p>
          <nav className="workspace-nav" aria-label="Workspace sections">
            {([
              ["overview", "⌂", "Overview"],
              ["stack", "◈", "Tech stack"],
              ["architecture", "⌘", "Architecture"],
              ["explorer", "▤", "File explorer"],
              ["questions", "◎", "Ask questions"],
            ] as [WorkspaceSection, string, string][]).map(([section, icon, label]) => (
              <button
                key={section}
                type="button"
                className={activeSection === section ? "active" : ""}
                disabled={!workspaceReady && section !== "overview"}
                onClick={() => onSectionChange?.(section)}
              ><span>{icon}</span>{label}</button>
            ))}
          </nav>
          <div className="sidebar-spacer" />
          <Link to="/" className="sidebar-new"><span>＋</span> Analyze another repository</Link>
        </aside>
      )}
      <div className="site-main">
        <header className="site-header">
          {isWorkspace ? <div className="workspace-top-brand"><Link to="/">← Repositories</Link><span className="top-divider">/</span><span className="top-location">Workspace</span></div> : brand}
          {!isWorkspace ? (
            <nav className="home-nav" aria-label="Main navigation">
              <a href="#top">Home</a><a href="#repo-url">Explore</a><a href="#how-it-works">How it works</a>
              <span className="public-badge"><i />Public repositories</span>
            </nav>
          ) : (
            <div className="workspace-top-actions"><span className="header-dot" /> Public GitHub access</div>
          )}
        </header>
        <main id="top" className={isWorkspace ? "workspace-main" : "home-main"}>{children}</main>
      </div>
    </div>
  );
}
