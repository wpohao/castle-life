export type WebGPUCheck =
  | { ok: true; adapter: GPUAdapter }
  | { ok: false; reason: 'no_api' | 'no_adapter' };

export async function detectWebGPU(nav: Navigator = navigator): Promise<WebGPUCheck> {
  if (!nav.gpu) return { ok: false, reason: 'no_api' };
  try {
    const adapter = await nav.gpu.requestAdapter();
    return adapter ? { ok: true, adapter } : { ok: false, reason: 'no_adapter' };
  } catch {
    return { ok: false, reason: 'no_adapter' };
  }
}
