import { detectWebGPU } from '../../src/boot/webgpu';

test('沒有 navigator.gpu 回報 no_api', async () => {
  expect(await detectWebGPU({} as Navigator)).toEqual({ ok: false, reason: 'no_api' });
});

test('requestAdapter 回傳 null 回報 no_adapter', async () => {
  const nav = { gpu: { requestAdapter: async () => null } } as unknown as Navigator;
  expect(await detectWebGPU(nav)).toEqual({ ok: false, reason: 'no_adapter' });
});

test('requestAdapter 丟例外也回報 no_adapter', async () => {
  const nav = { gpu: { requestAdapter: async () => { throw new Error('x'); } } } as unknown as Navigator;
  expect(await detectWebGPU(nav)).toEqual({ ok: false, reason: 'no_adapter' });
});

test('有 adapter 回報 ok', async () => {
  const adapter = {} as GPUAdapter;
  const nav = { gpu: { requestAdapter: async () => adapter } } as unknown as Navigator;
  expect(await detectWebGPU(nav)).toEqual({ ok: true, adapter });
});
