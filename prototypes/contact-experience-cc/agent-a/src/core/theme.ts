import { Store, useStore } from './store';

export type Theme = 'light' | 'dark';
const KEY = 'overmind-cc-a:theme';

function read(): Theme {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

export const themeStore = new Store<Theme>(typeof document === 'undefined' ? 'light' : read());

export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
}
export function setTheme(t: Theme): void {
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyTheme(t);
  themeStore.set(() => t);
}
export function initTheme(): void {
  // Light by default regardless of OS preference; only an explicit choice persists.
  applyTheme(themeStore.get());
}
export function useTheme(): [Theme, (t: Theme) => void] {
  return [useStore(themeStore), setTheme];
}
