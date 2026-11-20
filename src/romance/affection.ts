import { getGift, RING_GIFT_ID } from '../config/items';
import {
  DAILY_CHAT_LIMIT, DISLIKE_TOPIC_PENALTY, GIFT_DELTA, LADY, LIKE_TOPIC_BONUS, MEMORY_LIMIT, MESSAGE_DELTA_MAX,
  MESSAGE_DELTA_MIN, NUDGE_LIMIT, PROPOSAL_REJECT_PENALTY, STAGES, type Persona,
} from '../config/romance';
import type { GameState } from '../core/state';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function getStage(affection: number): (typeof STAGES)[number] {
  let s = STAGES[0]!;
  for (const st of STAGES) if (affection >= st.min) s = st;
  return s;
}

export function scoreMessage(text: string, p: Persona, topicsToday: string[]): { delta: number; matchedLikes: string[]; matchedDislikes: string[] } {
  const matchedLikes = p.likes.filter((t) => !topicsToday.includes(t.id) && t.keywords.some((k) => text.includes(k))).map((t) => t.id);
  const matchedDislikes = p.dislikes.filter((t) => t.keywords.some((k) => text.includes(k))).map((t) => t.id);
  return { delta: matchedLikes.length * LIKE_TOPIC_BONUS + matchedDislikes.length * DISLIKE_TOPIC_PENALTY, matchedLikes, matchedDislikes };
}

function withAffection(s: GameState, change: number): { state: GameState; delta: number } {
  const before = s.romance.affection;
  const after = clamp(before + change, 0, 100);
  return { state: { ...s, romance: { ...s.romance, affection: after } }, delta: after - before };
}

/** 套用一回合聊天：規則計分＋AI 微調（±1），單句總和 ±4。delta 為實際變化量。 */
export function applyChat(s: GameState, playerText: string, ladyReply: string, nudge: number): { state: GameState; delta: number } | { error: 'daily_limit' } {
  if (!s.romance.married && s.romance.chatsToday >= DAILY_CHAT_LIMIT) return { error: 'daily_limit' };
  const rule = scoreMessage(playerText, LADY, s.romance.topicsToday);
  const n = clamp(Math.round(Number.isFinite(nudge) ? nudge : 0), -NUDGE_LIMIT, NUDGE_LIMIT);
  const total = clamp(rule.delta + n, MESSAGE_DELTA_MIN, MESSAGE_DELTA_MAX);
  const memory = [...s.romance.memory, { role: 'player' as const, text: playerText }, { role: 'lady' as const, text: ladyReply }].slice(-MEMORY_LIMIT);
  const next: GameState = {
    ...s,
    romance: {
      ...s.romance,
      chatsToday: s.romance.chatsToday + 1,
      topicsToday: [...s.romance.topicsToday, ...rule.matchedLikes],
      memory,
    },
  };
  return withAffection(next, total);
}

export type GiftError = 'not_owned' | 'already_gifted_today' | 'ring_is_for_proposal';

export function giftReaction(giftId: string, p: Persona = LADY): keyof typeof GIFT_DELTA {
  const tags = getGift(giftId)?.tags ?? [];
  if (tags.some((t) => p.favoriteGiftTags.includes(t))) return 'favorite';
  if (tags.some((t) => p.dislikedGiftTags.includes(t))) return 'disliked';
  if (tags.some((t) => p.likedGiftTags.includes(t))) return 'liked';
  return 'neutral';
}

export function giveGift(s: GameState, giftId: string): { state: GameState; delta: number; reaction: keyof typeof GIFT_DELTA } | { error: GiftError } {
  if (giftId === RING_GIFT_ID) return { error: 'ring_is_for_proposal' };
  if ((s.gifts[giftId] ?? 0) <= 0) return { error: 'not_owned' };
  if (s.romance.giftGivenToday) return { error: 'already_gifted_today' };
  const reaction = giftReaction(giftId);
  const next: GameState = {
    ...s,
    gifts: { ...s.gifts, [giftId]: s.gifts[giftId]! - 1 },
    romance: { ...s.romance, giftGivenToday: true },
  };
  return { ...withAffection(next, GIFT_DELTA[reaction]), reaction };
}

export function propose(s: GameState): { state: GameState; accepted: boolean; reason: 'accepted' | 'no_ring' | 'not_ready' | 'already_married' } {
  if (s.romance.married) return { state: s, accepted: false, reason: 'already_married' };
  if ((s.gifts[RING_GIFT_ID] ?? 0) <= 0) return { state: s, accepted: false, reason: 'no_ring' };
  if (getStage(s.romance.affection).id !== 'ready') {
    return { state: withAffection(s, PROPOSAL_REJECT_PENALTY).state, accepted: false, reason: 'not_ready' };
  }
  return {
    state: {
      ...s,
      gifts: { ...s.gifts, [RING_GIFT_ID]: s.gifts[RING_GIFT_ID]! - 1 },
      romance: { ...s.romance, married: true },
    },
    accepted: true,
    reason: 'accepted',
  };
}
