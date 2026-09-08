// Local two-tab collaboration over BroadcastChannel. This proves prototype interaction in one
// browser profile; it is not deployed multi-user infrastructure, a lock service or CRDT editing.
// Messages carry identifiers and awareness only — never field values, drafts or hidden data.
// Each tab reads committed state from the shared simulated server under its own persona's grants.
import type { ContactId, PersonaId, PresenceEntry, VariantId } from './types';

export type CollabMessage =
  | { type: 'hello'; tabId: string }
  | { type: 'committed'; tabId: string; contactId: ContactId; entityVersion: number; unitStamp: string | null; actorId: PersonaId }
  | { type: 'presence'; tabId: string; entry: PresenceEntry }
  | { type: 'bye'; tabId: string }
  | { type: 'note'; tabId: string; contactId: ContactId }
  | { type: 'reset'; tabId: string; story: 'full' | 'rehearsal' };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export interface Collab {
  tabId: string;
  /** (Re)open the channel; safe to call repeatedly. */
  open(): void;
  post(message: DistributiveOmit<CollabMessage, 'tabId'>): void;
  subscribe(handler: (message: CollabMessage) => void): () => void;
  close(): void;
}

export function createCollab(variant: VariantId, tenantId: string): Collab {
  const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const name = `omb:v1:${variant}:${tenantId}`;
  const handlers = new Set<(m: CollabMessage) => void>();
  let channel: BroadcastChannel | null = null;

  const open = () => {
    if (channel || typeof BroadcastChannel === 'undefined') return;
    channel = new BroadcastChannel(name);
    channel.onmessage = (e: MessageEvent<CollabMessage>) => {
      const m = e.data;
      if (!m || m.tabId === tabId) return;
      handlers.forEach((h) => h(m));
    };
  };

  const post = (message: DistributiveOmit<CollabMessage, 'tabId'>) => {
    if (!channel) return;
    try {
      channel.postMessage({ ...message, tabId } as CollabMessage);
    } catch {
      /* channel closed by teardown; ignore */
    }
  };

  return {
    tabId,
    open,
    post,
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close() {
      if (!channel) return;
      post({ type: 'bye' });
      channel.close();
      channel = null;
    },
  };
}
