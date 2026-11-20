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

test('未載入就 chat 會拋出', async () => {
  const c = new LlmClient(async () => ({ chat: async () => '' }));
  await expect(c.chat([])).rejects.toThrow();
});

test('pickModel 依 shader-f16 選版本', () => {
  expect(pickModel(new Set(['shader-f16']), 'standard')).toBe(MODEL_STANDARD_F16);
  expect(pickModel(new Set(), 'smart')).toBe(MODEL_SMART_F32);
});

test('重新載入時會先釋放舊引擎（避免舊 worker 占著顯示卡）', async () => {
  const disposed: string[] = [];
  const c = new LlmClient(async (id) => ({ chat: async () => '{}', dispose: async () => { disposed.push(id); } }));
  await c.load('small');
  await c.load('big');
  expect(disposed).toEqual(['small']);
  expect(c.status.kind).toBe('ready');
});

test('生成中呼叫 load：舊的 chat 結束時不會把狀態改回 ready', async () => {
  let release!: (v: string) => void;
  let finishLoad!: () => void;
  let n = 0;
  const c = new LlmClient(async () => {
    n++;
    if (n === 2) await new Promise<void>((r) => (finishLoad = r));
    return { chat: () => new Promise<string>((r) => (release = r)) };
  });
  await c.load('a');
  const p = c.chat([]);
  const l = c.load('b');
  expect(c.status.kind).toBe('loading');
  release('x');
  await p.catch(() => {});
  expect(c.status.kind).toBe('loading');
  await vi.waitFor(() => expect(finishLoad).toBeTypeOf('function'));
  finishLoad();
  await l;
  expect(c.status.kind).toBe('ready');
});

test('載入中再 load 另一個模型，完成後會換成最後要求的模型', async () => {
  const loaded: string[] = [];
  let finishFirst!: () => void;
  const c = new LlmClient(async (id) => {
    if (id === 'a') await new Promise<void>((r) => (finishFirst = r));
    loaded.push(id);
    return { chat: async () => id };
  });
  const first = c.load('a');
  const second = c.load('b');
  await vi.waitFor(() => expect(finishFirst).toBeTypeOf('function'));
  finishFirst();
  await first;
  await second;
  expect(loaded).toEqual(['a', 'b']);
  expect(await c.chat([])).toBe('b');
});

test('chat 丟例外：狀態變成 error（顯示重試），並往外拋', async () => {
  const c = new LlmClient(async () => ({ chat: async () => { throw new Error('device lost'); } }));
  await c.load('m');
  await expect(c.chat([])).rejects.toThrow('device lost');
  expect(c.status.kind).toBe('error');
});
