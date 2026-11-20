import { DAILY_CHAT_LIMIT, LADY } from '../config/romance';
import type { GameState } from '../core/state';
import { applyChat } from './affection';
import type { LlmClient } from './llmClient';
import { buildMessages, FALLBACK_REPLIES, isAcceptableReply, parseModelReply, toTraditional, validatePlayerMessage } from './prompt';

export type TalkResult =
  | { kind: 'reply'; reply: string; delta: number; state: GameState }
  | { kind: 'rejected'; reason: 'empty' | 'busy' | 'daily_limit' | 'llm_unavailable' };

const MAX_ATTEMPTS = 2;

class ModelFailure extends Error {}

/** 問模型，不合格重試一次；兩次都不合格回 null（用備用句）；模型本身出錯則拋 ModelFailure。 */
async function ask(llm: Pick<LlmClient, 'chat'>, messages: ReturnType<typeof buildMessages>): Promise<{ reply: string; nudge: number } | null> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    let raw: string;
    try {
      raw = await llm.chat(messages);
    } catch (e) {
      console.warn('[castle-life] AI 回覆失敗', e);
      throw new ModelFailure();
    }
    const parsed = parseModelReply(raw);
    if (parsed) {
      const reply = toTraditional(parsed.reply);
      if (isAcceptableReply(reply)) return { reply, nudge: parsed.nudge };
    }
    console.warn('[castle-life] AI 回覆不合格，重試', raw);
  }
  return null;
}

/**
 * 一次聊天回合：檢查 → 問模型（不合格重試一次）→ 備用句 → 套用好感。
 * getState 會在模型回覆後再讀一次：等待期間玩家做的事（買東西、送禮、結婚）不會被覆蓋。
 */
export async function talk(getState: () => GameState, rawText: string, llm: Pick<LlmClient, 'status' | 'chat'>): Promise<TalkResult> {
  const text = validatePlayerMessage(rawText);
  if (!text) return { kind: 'rejected', reason: 'empty' };
  if (llm.status.kind === 'generating') return { kind: 'rejected', reason: 'busy' };
  if (llm.status.kind !== 'ready') return { kind: 'rejected', reason: 'llm_unavailable' };
  const before = getState();
  if (!before.romance.married && before.romance.chatsToday >= DAILY_CHAT_LIMIT) return { kind: 'rejected', reason: 'daily_limit' };

  let got: { reply: string; nudge: number } | null;
  try {
    got = await ask(llm, buildMessages(before, LADY, text));
  } catch (e) {
    if (e instanceof ModelFailure) return { kind: 'rejected', reason: 'llm_unavailable' };
    throw e;
  }
  const reply = got?.reply ?? FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)]!;
  const r = applyChat(getState(), text, reply, got?.nudge ?? 0);
  if ('error' in r) return { kind: 'rejected', reason: 'daily_limit' };
  return { kind: 'reply', reply, delta: r.delta, state: r.state };
}
