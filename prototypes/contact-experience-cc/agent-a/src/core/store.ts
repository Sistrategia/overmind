import { useSyncExternalStore } from 'react';

type Listener = () => void;

export class Store<T> {
  private listeners = new Set<Listener>();
  constructor(private state: T) {}
  get(): T { return this.state; }
  set(next: Partial<T> | ((prev: T) => T)): void {
    const value = typeof next === 'function' ? (next as (prev: T) => T)(this.state) : { ...this.state, ...next };
    if (value === this.state) return;
    this.state = value;
    for (const l of [...this.listeners]) l();
  }
  subscribe = (l: Listener): (() => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, () => store.get(), () => store.get());
}

/** Tiny event emitter for cross-module notifications. */
export class Emitter<E> {
  private handlers = new Set<(e: E) => void>();
  on(h: (e: E) => void): () => void { this.handlers.add(h); return () => { this.handlers.delete(h); }; }
  emit(e: E): void { for (const h of [...this.handlers]) h(e); }
}
