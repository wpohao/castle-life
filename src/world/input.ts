export interface Input {
  isDown(code: string): boolean;
  /** 該鍵自上次 consume 以來是否被按下過（只回報一次）。 */
  consumePressed(code: string): boolean;
  /** 取出並清空累積的滑鼠位移。 */
  mouseDelta(): { x: number; y: number };
  mouseButtons(): { left: boolean; right: boolean };
  /** 取出並清空左鍵「按下」事件。 */
  consumeClick(): boolean;
  readonly locked: boolean;
  /** false 時（例如面板開啟）忽略所有遊戲輸入並釋放滑鼠鎖定。 */
  setEnabled(v: boolean): void;
  dispose(): void;
}

export function createInput(canvas: HTMLCanvasElement): Input {
  const down = new Set<string>();
  const pressed = new Set<string>();
  let dx = 0;
  let dy = 0;
  let left = false;
  let right = false;
  let clicked = false;
  let enabled = true;

  const isTyping = (e: Event) => {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    if (e.code === 'Tab') e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    down.delete(e.code);
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!enabled || document.pointerLockElement !== canvas) return;
    dx += e.movementX;
    dy += e.movementY;
  };
  const onMouseDown = (e: MouseEvent) => {
    if (!enabled) return;
    if (document.pointerLockElement !== canvas) {
      const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => {});
    }
    if (e.button === 0) {
      left = true;
      clicked = true;
    }
    if (e.button === 2) right = true;
  };
  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) left = false;
    if (e.button === 2) right = false;
  };
  const onContext = (e: Event) => e.preventDefault();
  const onBlur = () => {
    down.clear();
    left = right = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContext);
  window.addEventListener('blur', onBlur);

  return {
    isDown: (c) => enabled && down.has(c),
    consumePressed: (c) => {
      const had = pressed.has(c);
      pressed.delete(c);
      return enabled && had;
    },
    mouseDelta: () => {
      const d = { x: dx, y: dy };
      dx = dy = 0;
      return d;
    },
    mouseButtons: () => ({ left: enabled && left, right: enabled && right }),
    consumeClick: () => {
      const c = clicked;
      clicked = false;
      return enabled && c;
    },
    get locked() {
      return document.pointerLockElement === canvas;
    },
    setEnabled(v) {
      enabled = v;
      pressed.clear();
      down.clear();
      left = right = clicked = false;
      dx = dy = 0;
      if (!v && document.pointerLockElement === canvas) document.exitPointerLock();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContext);
      window.removeEventListener('blur', onBlur);
    },
  };
}
