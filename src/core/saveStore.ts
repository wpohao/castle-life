import { del, get, set } from 'idb-keyval';
import { parseSave, serialize } from './save';
import type { GameState } from './state';

const KEY = 'castle-life/save';

export async function loadSave(): Promise<GameState | null> {
  const raw = await get<string>(KEY);
  if (typeof raw !== 'string') return null;
  const r = parseSave(raw);
  if (!r.ok) {
    console.warn('[castle-life] 存檔損壞，忽略：', r.error);
    return null;
  }
  return r.state;
}

export async function writeSave(s: GameState): Promise<void> {
  await set(KEY, serialize(s));
}

export async function deleteSave(): Promise<void> {
  await del(KEY);
}

export function downloadSaveFile(s: GameState): void {
  const blob = new Blob([serialize(s)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `castle-life-save-day${s.day}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface Autosave {
  notify(s: GameState): void;
  flush(): Promise<void>;
}

export function createAutosave(write: (s: GameState) => Promise<void>, debounceMs = 500): Autosave {
  let pending: GameState | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    clearTimeout(timer);
    timer = undefined;
    const s = pending;
    pending = null;
    if (s) await write(s);
  };
  return {
    notify(s) {
      pending = s;
      clearTimeout(timer);
      timer = setTimeout(() => void run(), debounceMs);
    },
    flush: run,
  };
}
