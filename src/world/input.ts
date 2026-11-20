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
  /** 丟掉尚未處理的按鍵與點擊（切換場景時呼叫，避免上一個場景的按鍵在新場景觸發）。 */
  clearPressed(): void;
  dispose(): void;
}

/** 鍵盤狀態：按住中的鍵，以及「按下過、還沒被處理」的鍵。 */
export class KeyState {
  private down = new Set<string>();
  private pressed = new Set<string>();
  keyDown(code: string): void {
    if (!this.down.has(code)) this.pressed.add(code);
    this.down.add(code);
  }
  keyUp(code: string): void {
    this.down.delete(code);
  }
  isDown(code: string): boolean {
    return this.down.has(code);
  }
  consumePressed(code: string): boolean {
    const had = this.pressed.has(code);
    this.pressed.delete(code);
    return had;
  }
  clearPressed(): void {
    this.pressed.clear();
  }
  clear(): void {
    this.down.clear();
    this.pressed.clear();
  }
}

export function createInput(canvas: HTMLCanvasElement): Input {
  const keys = new KeyState();
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
    keys.keyDown(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.keyUp(e.code);
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
    keys.clear();
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
    isDown: (c) => enabled && keys.isDown(c),
    consumePressed: (c) => keys.consumePressed(c) && enabled,
    clearPressed() {
      keys.clearPressed();
      clicked = false;
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
      keys.clear();
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
