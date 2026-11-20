/** 建立元素；文字一律走 textContent，永不使用 innerHTML。 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string; title?: string; disabled?: boolean; onClick?: (e: MouseEvent) => void; style?: Partial<CSSStyleDeclaration> } = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.className) el.className = props.className;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.title) el.title = props.title;
  if (props.disabled !== undefined) (el as HTMLButtonElement).disabled = props.disabled;
  if (props.onClick) el.addEventListener('click', props.onClick as EventListener);
  if (props.style) Object.assign(el.style, props.style);
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/** Esc 關面板；輸入法選字中（isComposing）的 Esc 是取消選字，不關面板。 */
export function isPanelCloseKey(e: { code: string; isComposing: boolean }): boolean {
  return e.code === 'Escape' && !e.isComposing;
}

export interface PanelHost {
  /** 開啟面板（會先關掉目前的面板）。回傳關閉函式。 */
  open(
    title: string,
    render: (body: HTMLElement, close: () => void) => void,
    opts?: { className?: string; onClose?: () => void; canClose?: () => boolean },
  ): () => void;
  isOpen(): boolean;
  close(): void;
}

export function createPanelHost(root: HTMLElement, onOpenChange: (open: boolean) => void): PanelHost {
  let current: { el: HTMLElement; onClose?: () => void; canClose?: () => boolean } | null = null;
  const onKey = (e: KeyboardEvent) => {
    if (current && isPanelCloseKey(e)) {
      e.stopPropagation();
      close();
    }
  };
  window.addEventListener('keydown', onKey, true);

  function close(force = false): void {
    if (!current) return;
    if (!force && current.canClose && !current.canClose()) return;
    const c = current;
    current = null;
    c.el.remove();
    c.onClose?.();
    onOpenChange(false);
  }

  return {
    open(title, render, opts = {}) {
      close(true);
      const el = h('div', { className: `panel ${opts.className ?? ''}` });
      el.append(h('button', { className: 'close', text: '✕', onClick: () => close() }), h('h2', { text: title }));
      const body = h('div');
      el.append(body);
      root.append(el);
      current = { el, onClose: opts.onClose, canClose: opts.canClose };
      onOpenChange(true);
      render(body, () => close(true));
      return close;
    },
    isOpen: () => current !== null,
    close: () => close(),
  };
}
