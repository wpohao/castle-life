import { CHAMPION_INDEX, OPPONENTS } from '../config/arena';
import type { GameState } from './state';

export const ARENA_WIN_AFFECTION = 2;
export const ARENA_CHAMPION_AFFECTION = 10;
export const REMATCH_PRIZE_FACTOR = 0.5;

export function currentOpponentIndex(s: GameState): number {
  return Math.min(s.arena.nextOpponent, CHAMPION_INDEX);
}

export function recordBout(s: GameState, result: 'win' | 'loss'): { state: GameState; prize: number; affectionBonus: number } {
  if (result === 'loss') return { state: s, prize: 0, affectionBonus: 0 };
  const idx = currentOpponentIndex(s);
  const opp = OPPONENTS[idx]!;
  if (s.arena.champion) {
    const prize = Math.floor(opp.prize * REMATCH_PRIZE_FACTOR);
    return { state: { ...s, gold: s.gold + prize }, prize, affectionBonus: 0 };
  }
  const becameChampion = idx === CHAMPION_INDEX;
  const affectionBonus = ARENA_WIN_AFFECTION + (becameChampion ? ARENA_CHAMPION_AFFECTION : 0);
  return {
    state: {
      ...s,
      gold: s.gold + opp.prize,
      arena: { nextOpponent: becameChampion ? CHAMPION_INDEX : idx + 1, champion: becameChampion },
      romance: { ...s.romance, affection: Math.min(100, s.romance.affection + affectionBonus) },
    },
    prize: opp.prize,
    affectionBonus,
  };
}
