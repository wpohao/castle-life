import { createNewState, type GameState } from '../../src/core/state';
import { talk } from '../../src/romance/conversation';
import { FALLBACK_REPLIES } from '../../src/romance/prompt';
import type { LlmStatus } from '../../src/romance/llmClient';

function fakeLlm(replies: string[], status: LlmStatus = { kind: 'ready' }) {
  const chat = vi.fn(async () => replies.shift() ?? '');
  return { status, chat };
}

test('空白訊息不呼叫模型、不扣次數', async () => {
  const llm = fakeLlm(['{"reply":"嗯","nudge":0}']);
  expect(await talk(() => createNewState('a'), '   ', llm)).toEqual({ kind: 'rejected', reason: 'empty' });
  expect(llm.chat).not.toHaveBeenCalled();
});

test('生成中再送出回 busy', async () => {
  const llm = fakeLlm([], { kind: 'generating' });
  expect(await talk(() => createNewState('a'), '你好', llm)).toEqual({ kind: 'rejected', reason: 'busy' });
});

test('模型未就緒回 llm_unavailable', async () => {
  const llm = fakeLlm([], { kind: 'loading', progress: 0.3, text: '' });
  expect(await talk(() => createNewState('a'), '你好', llm)).toEqual({ kind: 'rejected', reason: 'llm_unavailable' });
});

test('達每日上限不呼叫模型', async () => {
  const s = createNewState('a');
  s.romance = { ...s.romance, chatsToday: 8 };
  const llm = fakeLlm(['{"reply":"嗯","nudge":0}']);
  expect(await talk(() => s, '你好', llm)).toEqual({ kind: 'rejected', reason: 'daily_limit' });
  expect(llm.chat).not.toHaveBeenCalled();
});

test('簡體回覆會先轉成正體，不必重試', async () => {
  const llm = fakeLlm(['{"reply":"我们一起看星星吧","nudge":0}']);
  const r = await talk(() => createNewState('a'), '你好', llm);
  expect(r.kind === 'reply' && r.reply).toBe('我們一起看星星吧');
  expect(llm.chat).toHaveBeenCalledTimes(1);
});

test('回覆不合格會重試一次，再不合格用備用句', async () => {
  const llm = fakeLlm(['As an AI, I cannot.', 'not json at all']);
  const r = await talk(() => createNewState('a'), '你好', llm);
  expect(llm.chat).toHaveBeenCalledTimes(2);
  expect(r.kind === 'reply' && FALLBACK_REPLIES.includes(r.reply)).toBe(true);
});

test('第一次不合格、第二次合格就用第二次', async () => {
  const llm = fakeLlm(['garbage', '{"reply":"謝謝你。","nudge":1}']);
  const r = await talk(() => createNewState('a'), '你好', llm);
  expect(r.kind === 'reply' && r.reply).toBe('謝謝你。');
});

test('模型丟例外時不消耗聊天次數，回報 llm_unavailable', async () => {
  const s = createNewState('a');
  const llm = { status: { kind: 'ready' } as LlmStatus, chat: vi.fn(async () => { throw new Error('GPU lost'); }) };
  expect(await talk(() => s, '你好', llm)).toEqual({ kind: 'rejected', reason: 'llm_unavailable' });
});

test('生成期間狀態改變（買東西、結婚），回覆套用在最新狀態上', async () => {
  let s = createNewState('a');
  const llm = { status: { kind: 'ready' } as LlmStatus, chat: vi.fn(async () => { s = { ...s, gold: 999, romance: { ...s.romance, married: true } }; return '{"reply":"嗯。","nudge":0}'; }) };
  const r = await talk(() => s, '你好', llm);
  if (r.kind !== 'reply') throw new Error('expected reply');
  expect(r.state.gold).toBe(999);
  expect(r.state.romance.married).toBe(true);
  expect(r.state.romance.chatsToday).toBe(1);
});

test('正常回覆套用好感與記憶', async () => {
  const llm = fakeLlm(['{"reply":"謝謝你送的花","nudge":1}']);
  const r = await talk(() => createNewState('a'), '我帶了花給你', llm);
  if (r.kind !== 'reply') throw new Error('expected reply');
  expect(r.delta).toBe(4);
  const s: GameState = r.state;
  expect(s.romance.affection).toBe(4);
  expect(s.romance.memory.at(-1)).toEqual({ role: 'lady', text: '謝謝你送的花' });
});
