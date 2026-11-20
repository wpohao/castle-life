import { LlmClient, MODEL_SMART_F32, MODEL_STANDARD_F16, pickModel, type LlmStatus } from '../../src/romance/llmClient';

test('載入中回報進度，完成後 ready', async () => {
  const seen: LlmStatus[] = [];
  const c = new LlmClient(async (_id, onProgress) => {
    onProgress(0.5, '下載中');
    return { chat: async () => '{}' };
  });
  c.onStatus((s) => seen.push(s));
  await c.load('m');
  expect(seen).toContainEqual({ kind: 'loading', progress: 0.5, text: '下載中' });
  expect(c.status.kind).toBe('ready');
});

test('載入失敗 → error，重試成功 → ready', async () => {
  let fail = true;
  const c = new LlmClient(async () => {
    if (fail) throw new Error('OOM');
    return { chat: async () => '{}' };
  });
  await c.load('m');
  expect(c.status.kind).toBe('error');
  if (c.status.kind === 'error') expect(c.status.message).toMatch(/重試/);
  fail = false;
  await c.load('m');
  expect(c.status.kind).toBe('ready');
});

test('chat 期間為 generating，結束回 ready', async () => {
  let release!: (v: string) => void;
  const c = new LlmClient(async () => ({ chat: () => new Promise<string>((r) => (release = r)) }));
  await c.load('m');
  const p = c.chat([{ role: 'user', content: 'hi' }]);
  expect(c.status.kind).toBe('generating');
  release('ok');
  expect(await p).toBe('ok');
  expect(c.status.kind).toBe('ready');
});

test('chat 失敗回 ready 並拋出', async () => {
  const c = new LlmClient(async () => ({ chat: async () => { throw new Error('boom'); } }));
  await c.load('m');
  await expect(c.chat([])).rejects.toThrow('boom');
  expect(c.status.kind).toBe('ready');
});

test('未載入就 chat 會拋出', async () => {
  const c = new LlmClient(async () => ({ chat: async () => '' }));
  await expect(c.chat([])).rejects.toThrow();
});

test('pickModel 依 shader-f16 選版本', () => {
  expect(pickModel(new Set(['shader-f16']), 'standard')).toBe(MODEL_STANDARD_F16);
  expect(pickModel(new Set(), 'smart')).toBe(MODEL_SMART_F32);
});
