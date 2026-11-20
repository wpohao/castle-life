export interface Hud {
  setBackend(label: string): void;
  setGold(n: number): void;
  setDay(n: number): void;
  setPrompt(text: string | null): void;
  setStatus(text: string | null): void;
  toast(text: string): void;
  setVisible(v: boolean): void;
}

export function createHud(root: HTMLElement): Hud {
  const corner = el('div', 'hud-corner');
  const stats = el('div', 'hud-stats');
  const day = el('span');
  const gold = el('span');
  const status = el('span');
  stats.append(day, gold, status);
  const prompt = el('div', 'hud-prompt');
  prompt.style.display = 'none';
  const toastEl = el('div', 'hud-toast');
  toastEl.style.opacity = '0';
  const hint = el('div', 'hud-hint');
  hint.textContent = 'WASD 移動｜Shift 奔跑｜E 互動｜F 上下馬｜I 裝備｜Esc 設定｜點畫面鎖定滑鼠';
  root.append(corner, stats, prompt, toastEl, hint);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  return {
    setBackend: (l) => { corner.textContent = `渲染：${l}`; },
    setGold: (n) => { gold.textContent = `金幣 ${n}`; },
    setDay: (n) => { day.textContent = `第 ${n} 天`; },
    setPrompt: (t) => {
      prompt.style.display = t ? '' : 'none';
      prompt.textContent = t ?? '';
    },
    setStatus: (t) => { status.textContent = t ?? ''; },
    toast: (t) => {
      toastEl.textContent = t;
      toastEl.style.opacity = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 2200);
    },
    setVisible: (v) => {
      for (const e of [stats, prompt, hint]) e.style.visibility = v ? '' : 'hidden';
    },
  };
}

function el(tag: string, cls?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
