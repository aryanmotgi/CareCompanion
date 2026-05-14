// Versioned localStorage adapter for the onboarding draft.
// Falls through to sessionStorage, then in-memory map when localStorage is unavailable
// or quota-exceeded (private browsing, fresh device limits, etc).

import type { PhaseState } from './phase-machine';

const KEY = 'cc-onboarding-draft';
const VERSION = 1 as const;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Envelope {
  version: typeof VERSION;
  savedAt: number;
  state: PhaseState;
}

const memory = new Map<string, string>();

function tryWrite(store: Storage | null, key: string, value: string): boolean {
  if (!store) return false;
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function tryRead(store: Storage | null, key: string): string | null {
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function tryRemove(store: Storage | null, key: string): void {
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // ignore
  }
}

function getStores(): { local: Storage | null; session: Storage | null } {
  if (typeof window === 'undefined') return { local: null, session: null };
  let local: Storage | null = null;
  let session: Storage | null = null;
  try { local = window.localStorage; } catch { /* SecurityError in some sandboxes */ }
  try { session = window.sessionStorage; } catch { /* same */ }
  return { local, session };
}

export function saveDraft(state: PhaseState): void {
  const envelope: Envelope = { version: VERSION, savedAt: Date.now(), state };
  const raw = JSON.stringify(envelope);
  const { local, session } = getStores();
  if (tryWrite(local, KEY, raw)) return;
  if (tryWrite(session, KEY, raw)) return;
  memory.set(KEY, raw);
}

export function loadDraft(): PhaseState | null {
  const { local, session } = getStores();
  const raw = tryRead(local, KEY) ?? tryRead(session, KEY) ?? memory.get(KEY) ?? null;
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Envelope;
    if (env.version !== VERSION) {
      clearDraft();
      return null;
    }
    if (Date.now() - env.savedAt > TTL_MS) {
      clearDraft();
      return null;
    }
    return env.state;
  } catch {
    clearDraft();
    return null;
  }
}

export function clearDraft(): void {
  const { local, session } = getStores();
  tryRemove(local, KEY);
  tryRemove(session, KEY);
  memory.delete(KEY);
}
