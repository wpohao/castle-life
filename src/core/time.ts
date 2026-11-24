import type { GameState } from './state';

export function restUntilNextDay(s: GameState): GameState {
  return {
    ...s,
    day: s.day + 1,
    romance: { ...s.romance, giftGivenToday: false },
  };
}
