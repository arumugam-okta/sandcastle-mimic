// Browser-side persistence so a reload feels like resuming: edited files per sample, the last
// sample opened, and whether the app was running (so it can start again on load).
export type Session = { templateId?: string; autoStart: boolean; wasRunning: boolean };

const SESSION = "sandcastle:session";
const editsKey = (id: string) => `sandcastle:edits:${id}`;

export function loadSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION);
    if (raw) return { autoStart: false, wasRunning: false, ...JSON.parse(raw) };
  } catch {}
  return { autoStart: false, wasRunning: false };
}

export function saveSession(patch: Partial<Session>) {
  localStorage.setItem(SESSION, JSON.stringify({ ...loadSession(), ...patch }));
}

/** Template files with this browser's saved edits applied on top. */
export function withEdits(id: string, base: Record<string, string>): Record<string, string> {
  try {
    const raw = localStorage.getItem(editsKey(id));
    if (raw) return { ...base, ...JSON.parse(raw) };
  } catch {}
  return base;
}

/** Stores only the files that differ from the template. */
export function saveEdits(id: string, base: Record<string, string>, files: Record<string, string>) {
  const diff = Object.fromEntries(Object.entries(files).filter(([p, c]) => base[p] !== c));
  if (Object.keys(diff).length) localStorage.setItem(editsKey(id), JSON.stringify(diff));
  else localStorage.removeItem(editsKey(id));
}

export const clearEdits = (id: string) => localStorage.removeItem(editsKey(id));
