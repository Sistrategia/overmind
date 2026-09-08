import { Component, lazy, StrictMode, Suspense, useEffect, useMemo, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import { initTheme } from './core/theme';
import { useRoute } from './core/router';
import { VARIANTS, Workspace, WorkspaceContext, type VariantId } from './core/workspace';
import { ThemeToggle } from './shared/ui';

initTheme();

const apps: Record<VariantId, React.LazyExoticComponent<ComponentType>> = {
  desk: lazy(() => import('./variants/desk/App')),
  console: lazy(() => import('./variants/console/App')),
  strata: lazy(() => import('./variants/strata/App'))
};

function Gallery() {
  useEffect(() => { document.title = 'Overmind contact experience · Agent A prototypes'; }, []);
  return (
    <main className="gallery">
      <div className="col" style={{ gap: 6 }}>
        <span className="badge accent">Agent A · operational clarity</span>
        <h1>Three ways to work a contact and its evidence</h1>
        <p className="muted" style={{ maxWidth: 720 }}>
          Interactive prototypes for Overmind's contact workspace, revision history and tenant activity, built on one shared
          simulated server so the same story (Vértice Demo, Lina Torres, Norte Taller) runs in each. Pick a variant; every
          one supports the same journeys so they compare fairly.
        </p>
      </div>
      <div className="cards">
        {VARIANTS.map(v => (
          <article key={v.id} className="card">
            <div className="row"><h2>{v.name}</h2><span className="badge lower">{v.tagline}</span></div>
            <p className="small">{v.thesis}</p>
            <div className="links">
              <a className="btn primary" href={`#/${v.id}/contact/lina`} data-testid={`open-${v.id}`}>Open {v.name}</a>
              <a className="btn" href={`#/${v.id}/history/lina?rev=4&compare=3`}>History</a>
              <a className="btn" href={`#/${v.id}/activity`}>Activity</a>
            </div>
          </article>
        ))}
      </div>
      <div className="note">
        Everything here is local: the server, the two-tab collaboration channel and the sidekick are simulated in the browser.
        No backend, issuer or API key is used. The demo drawer inside each variant switches persona, theme, latency and failure modes.
      </div>
      <div className="row wrap small muted">
        <ThemeToggle />
        <span>Second tab for collaboration: open the same variant URL in another tab and choose a different persona there.</span>
      </div>
    </main>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, maxWidth: 720 }} className="col">
          <div className="problem" role="alert"><strong>The prototype hit a rendering error.</strong><div className="small mono">{this.state.error.message}</div></div>
          <div className="row"><button className="btn" onClick={() => this.setState({ error: null })}>Try again</button><a className="btn" href="#/">Back to gallery</a></div>
        </div>
      );
    }
    return this.props.children;
  }
}

function VariantHost({ variant }: { variant: VariantId }) {
  const ws = useMemo(() => new Workspace(variant), [variant]);
  useEffect(() => {
    ws.connect();
    (window as unknown as { __overmind?: Workspace }).__overmind = ws; // inspection hook for tests and reviewers
    return () => ws.disconnect();
  }, [ws]);
  useEffect(() => { document.title = `${VARIANTS.find(v => v.id === variant)?.name} · Overmind prototype`; }, [variant]);
  const App = apps[variant];
  return (
    <WorkspaceContext.Provider value={ws}>
      <ErrorBoundary>
        <Suspense fallback={<div style={{ padding: 24 }} className="muted">Loading {variant}…</div>}>
          <App />
        </Suspense>
      </ErrorBoundary>
    </WorkspaceContext.Provider>
  );
}

function Root() {
  const route = useRoute();
  const variant = VARIANTS.find(v => v.id === route.variant)?.id;
  if (!variant) return <Gallery />;
  return <VariantHost key={variant} variant={variant} />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
