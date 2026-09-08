// Local two-tab collaboration bus. BroadcastChannel proves prototype interaction between
// tabs of one browser profile; it is not deployed multi-user infrastructure or CRDT
// collaboration. Presence is awareness only, never a lock or a permission.
import { Emitter } from './store';

export interface PresenceInfo {
  tabId: string;
  personaKey: string;
  contactKey: string | null;
  area: string | null;       // human-readable part being edited, e.g. "Office phone"; never a value
  editing: boolean;
  draftCount: number;
  at: number;                // epoch ms of last heartbeat (sender clock)
}

export type BusMessage =
  | { type: 'hello'; tabId: string }
  | { type: 'presence'; info: PresenceInfo }
  | { type: 'leave'; tabId: string }
  | { type: 'committed'; contactKey: string; entityVersion: number; unitId: string; actorKey: string }
  | { type: 'reset' }
  | { type: 'operational' };

const STALE_MS = 20_000;
const HEARTBEAT_MS = 6_000;

export class CollabBus {
  private channel: BroadcastChannel | null = null;
  readonly messages = new Emitter<BusMessage>();
  readonly presence = new Emitter<PresenceInfo[]>();
  private peers = new Map<string, PresenceInfo>();
  private mine: PresenceInfo;
  private timer: number | null = null;
  private storageKey: string;

  constructor(readonly channelName: string, readonly tabId: string, personaKey: string) {
    this.storageKey = `${channelName}:signal`;
    this.mine = { tabId, personaKey, contactKey: null, area: null, editing: false, draftCount: 0, at: Date.now() };
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(channelName);
      this.channel.onmessage = (ev: MessageEvent<BusMessage>) => this.receive(ev.data);
    }
    // Fallback signal for browsers without BroadcastChannel: a storage ping carrying the message.
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('beforeunload', () => this.close());
    this.post({ type: 'hello', tabId });
    this.timer = window.setInterval(() => { this.beat(); this.prune(); }, HEARTBEAT_MS);
  }

  private onStorage = (ev: StorageEvent): void => {
    if (ev.key !== this.storageKey || !ev.newValue || this.channel) return;
    try { this.receive(JSON.parse(ev.newValue).msg as BusMessage); } catch { /* ignore */ }
  };

  private receive(msg: BusMessage): void {
    if ('tabId' in msg && msg.tabId === this.tabId) return;
    if (msg.type === 'presence' && msg.info.tabId === this.tabId) return;
    if (msg.type === 'hello') { this.beat(); }
    else if (msg.type === 'presence') { this.peers.set(msg.info.tabId, msg.info); this.presence.emit(this.list()); }
    else if (msg.type === 'leave') { this.peers.delete(msg.tabId); this.presence.emit(this.list()); }
    this.messages.emit(msg);
  }

  post(msg: BusMessage): void {
    if (this.channel) this.channel.postMessage(msg);
    else { try { localStorage.setItem(this.storageKey, JSON.stringify({ n: Math.random(), msg })); } catch { /* ignore */ } }
  }

  update(patch: Partial<Omit<PresenceInfo, 'tabId' | 'at'>>): void {
    this.mine = { ...this.mine, ...patch, at: Date.now() };
    this.post({ type: 'presence', info: this.mine });
  }
  beat(): void { this.mine = { ...this.mine, at: Date.now() }; this.post({ type: 'presence', info: this.mine }); }
  private prune(): void {
    const now = Date.now();
    let changed = false;
    for (const [id, p] of this.peers) if (now - p.at > STALE_MS) { this.peers.delete(id); changed = true; }
    if (changed) this.presence.emit(this.list());
  }
  list(): PresenceInfo[] { return [...this.peers.values()].sort((a, b) => a.at - b.at); }
  me(): PresenceInfo { return this.mine; }

  close(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    this.post({ type: 'leave', tabId: this.tabId });
    window.removeEventListener('storage', this.onStorage);
    this.channel?.close();
    this.channel = null;
  }
}

export function tabIdentity(namespace: string): string {
  const key = `${namespace}:tab`;
  try {
    let id = sessionStorage.getItem(key);
    if (!id) { id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8); sessionStorage.setItem(key, id); }
    return id;
  } catch { return Math.random().toString(36).slice(2, 10); }
}
