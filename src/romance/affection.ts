import { getGift, RING_GIFT_ID } from '../config/items';
import { GIFT_DELTA, LADY, PROPOSAL_REJECT_PENALTY, STAGES, type Persona } from '../config/romance';
import type { GameState } from '../core/state';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function getStage(affection: number): (typeof STAGES)[number] {
  let s = STAGES[0]!;
  for (const st of STAGES) if (affection >= st.min) s = st;
  return s;
}

function withAffection(s: GameState, change: number): { state: GameState; delta: number } {
  const before = s.romance.affection;
  const after = clamp(before + change, 0, 100);
  return { state: { ...s, romance: { ...s.romance, affection: after } }, delta: after - before };
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
