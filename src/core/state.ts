import { START_GOLD, STARTER_WEAPON_ID } from '../config/items';

export const SAVE_VERSION = 1;
export const PLAYER_NAME_MAX = 12;

export interface GameState {
  version: 1;
  playerName: string;
  gold: number;
  day: number;
  ownedWeapons: string[];
  equippedWeapon: string;
  ownedHorses: string[];
  activeHorse: string | null;
  gifts: Record<string, number>;
  arena: { nextOpponent: number; champion: boolean };
  romance: {
    affection: number;
    giftGivenToday: boolean;
    married: boolean;
  };
}

export function createNewState(playerName: string): GameState {
  return {
    version: SAVE_VERSION,
    playerName,
    gold: START_GOLD,
    day: 1,
    ownedWeapons: [STARTER_WEAPON_ID],
    equippedWeapon: STARTER_WEAPON_ID,
    ownedHorses: [],
    activeHorse: null,
    gifts: {},
    arena: { nextOpponent: 0, champion: false },
    romance: { affection: 0, giftGivenToday: false, married: false },
  };
}

/** 去頭尾空白，空白回傳 null，以字元（碼位）計算截到 12 字。 */
export function sanitizePlayerName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return Array.from(trimmed).slice(0, PLAYER_NAME_MAX).join('');
}
