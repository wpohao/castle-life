import { DAILY_CHAT_LIMIT, LADY } from '../config/romance';
import type { GameState } from '../core/state';
import { applyChat } from './affection';
import type { LlmClient } from './llmClient';
import { buildMessages, FALLBACK_REPLIES, isAcceptableReply, parseModelReply, toTraditional, validatePlayerMessage } from './prompt';

export type TalkResult =
  | { kind: 'reply'; reply: string; delta: number; state: GameState }
  | { kind: 'rejected'; reason: 'empty' | 'busy' | 'daily_limit' | 'llm_unavailable' };

const MAX_ATTEMPTS = 2;

async function ask(llm: Pick<LlmClient, 'chat'>, messages: ReturnType<typeof buildMessages>): Promise<{ reply: string; nudge: number } | null> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const raw = await llm.chat(messages);
      const parsed = parseModelReply(raw);
      if (parsed) {
        const reply = toTraditional(parsed.reply);
        if (isAcceptableReply(reply)) return { reply, nudge: parsed.nudge };
      }
      console.warn('[castle-life] AI 回覆不合格，重試', raw);
    } catch (e) {
      console.warn('[castle-life] AI 回覆失敗', e);
      return null;
    }
  }
  return null;
}

/** 一次聊天回合：檢查 → 問模型（不合格重試一次）→ 備用句 → 套用好感。 */
export async function talk(s: GameState, rawText: string, llm: Pick<LlmClient, 'status' | 'chat'>): Promise<TalkResult> {
  const text = validatePlayerMessage(rawText);
  if (!text) return { kind: 'rejected', reason: 'empty' };
  if (llm.status.kind === 'generating') return { kind: 'rejected', reason: 'busy' };
  if (llm.status.kind !== 'ready') return { kind: 'rejected', reason: 'llm_unavailable' };
  if (!s.romance.married && s.romance.chatsToday >= DAILY_CHAT_LIMIT) return { kind: 'rejected', reason: 'daily_limit' };

  const got = await ask(llm, buildMessages(s, LADY, text));
  const reply = got?.reply ?? FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)]!;
  const r = applyChat(s, text, reply, got?.nudge ?? 0);
  if ('error' in r) return { kind: 'rejected', reason: 'daily_limit' };
  return { kind: 'reply', reply, delta: r.delta, state: r.state };
}
