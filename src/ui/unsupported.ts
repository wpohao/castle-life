export type UnsupportedReason = 'no_api' | 'no_adapter' | 'not_webgpu_backend';

const DETAIL: Record<UnsupportedReason, string> = {
  no_api: '你的瀏覽器沒有提供 WebGPU。',
  no_adapter: '瀏覽器有 WebGPU，但找不到可用的顯示卡（可能被停用或驅動程式太舊）。',
  not_webgpu_backend: '3D 引擎無法以 WebGPU 啟動。',
};

export function showUnsupported(root: HTMLElement, reason: UnsupportedReason): void {
  root.replaceChildren();
  const wrap = document.createElement('div');
  wrap.className = 'fullscreen-msg';
  const box = document.createElement('div');
  box.className = 'box';
  const h1 = document.createElement('h1');
  h1.textContent = '這個遊戲需要 WebGPU';
  const p1 = document.createElement('p');
  p1.textContent = DETAIL[reason];
  const p2 = document.createElement('p');
  p2.textContent =
    '請使用 Chrome 113 以上版本（或新版 Edge）。可以在網址列輸入 chrome://gpu 確認「WebGPU」是否顯示為 Hardware accelerated；若被停用，請更新顯示卡驅動程式後再試。';
  box.append(h1, p1, p2);
  wrap.append(box);
  root.append(wrap);
}
