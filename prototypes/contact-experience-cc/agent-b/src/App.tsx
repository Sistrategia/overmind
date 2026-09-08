import React, { Suspense, lazy } from 'react';
import { useHashRoute } from './core/router';
import { WorkspaceProvider } from './core/store';
import type { VariantId } from './core/types';

const CasefileApp = lazy(() => import('./variants/casefile/CasefileApp'));
const StudioApp = lazy(() => import('./variants/studio/StudioApp'));
const ThreadApp = lazy(() => import('./variants/thread/ThreadApp'));

export const VARIANTS: { id: VariantId; name: string; style: string; thesis: string; bold: string }[] = [
  {
    id: 'casefile',
    name: 'Casefile',
    style: 'Fluent 2 (Microsoft) visual language',
    thesis:
      'Investigation as a shared dossier. The contact record and its revision ribbon live in one continuous document; a Copilot-style pane shows what the sidekick is using and stages edits as a visible pending tray. Activity is a dense, filterable grid with a detail drawer that always links back to the revision it explains.',
    bold: 'Pending-changes tray that narrates the Save in plain words before it happens.',
  },
  {
    id: 'studio',
    name: 'Studio',
    style: 'macOS / iPadOS 26 direction (restrained glass, inspector, ⌘K)',
    thesis:
      'A native-feeling three-pane studio: source list, content sheet, inspector. History is a revision scrubber under the record: drag across time and the sheet morphs into that state, pin a second point to compare. The sidekick is a ⌘K palette whose results are answers, evidence and staged edits.',
    bold: 'Time scrubber with pinned comparison; the record itself becomes the diff surface.',
  },
  {
    id: 'thread',
    name: 'Thread',
    style: 'Material 3 Expressive direction (tonal surfaces, expressive type, big shapes)',
    thesis:
      'Investigation as a shared narrative. A per-contact thread is the primary surface: people post notes, the sidekick replies with evidence cards, revisions and activity queries unfold inline, and edit proposals are cards anyone in the thread can see being applied. A board keeps the pinned evidence at hand.',
    bold: 'Thread-first workspace where every artifact (revision, diff, query, proposal) is a card in one narrative.',
  },
];

function Gallery() {
  return (
    <main className="gallery">
      <header className="gallery__head">
        <p className="gallery__eyebrow">Overmind · contact experience prototypes · agent B</p>
        <h1>Three ways to investigate a contact together</h1>
        <p className="gallery__lead">
          Lens: <strong>collaborative investigation</strong>. Same fixture story in every variant (tenant Vértice Demo, Lina Torres, Norte Taller,
          Mariana, Bruno, Sofía, Diego). Light by default, dark mode designed throughout, simulated local backend, no API keys.
        </p>
      </header>
      <section className="gallery__grid">
        {VARIANTS.map((v, i) => (
          <a key={v.id} className={`gcard gcard--${v.id}`} href={`#/${v.id}`}>
            <span className="gcard__num">0{i + 1}</span>
            <h2>{v.name}</h2>
            <p className="gcard__style">{v.style}</p>
            <p className="gcard__thesis">{v.thesis}</p>
            <p className="gcard__bold">
              <strong>Bolder choice:</strong> {v.bold}
            </p>
            <span className="gcard__cta">Open {v.name} →</span>
          </a>
        ))}
      </section>
      <footer className="gallery__foot">
        <p>
          Direct routes: <code>#/casefile</code> · <code>#/studio</code> · <code>#/thread</code>. Two-tab collaboration: open the same variant in a second tab
          and pick another persona in its demo controls. See README.md for the five-minute script.
        </p>
      </footer>
    </main>
  );
}

export function App() {
  const { route } = useHashRoute();
  const variant = VARIANTS.find((v) => v.id === route.variant)?.id;
  if (!variant) return <Gallery />;
  const Component = variant === 'casefile' ? CasefileApp : variant === 'studio' ? StudioApp : ThreadApp;
  return (
    <WorkspaceProvider key={variant} variant={variant}>
      <Suspense fallback={<div className="gallery__loading">Loading {variant}…</div>}>
        <Component />
      </Suspense>
    </WorkspaceProvider>
  );
}
