import { getGift, getHorse, getWeapon } from '../config/items';
import type { GameState } from './state';

export type EconomyError = 'not_enough_gold' | 'already_owned' | 'unknown_item' | 'not_owned';
export type EconomyResult = { ok: true; state: GameState } | { ok: false; reason: EconomyError };

const fail = (reason: EconomyError): EconomyResult => ({ ok: false, reason });

export function buyWeapon(s: GameState, id: string): EconomyResult {
  const w = getWeapon(id);
  if (!w) return fail('unknown_item');
  if (s.ownedWeapons.includes(id)) return fail('already_owned');
  if (s.gold < w.price) return fail('not_enough_gold');
  return { ok: true, state: { ...s, gold: s.gold - w.price, ownedWeapons: [...s.ownedWeapons, id] } };
}

export function buyHorse(s: GameState, id: string): EconomyResult {
  const h = getHorse(id);
  if (!h) return fail('unknown_item');
  if (s.ownedHorses.includes(id)) return fail('already_owned');
  if (s.gold < h.price) return fail('not_enough_gold');
  return { ok: true, state: { ...s, gold: s.gold - h.price, ownedHorses: [...s.ownedHorses, id] } };
}

export function buyGift(s: GameState, id: string): EconomyResult {
  const g = getGift(id);
  if (!g) return fail('unknown_item');
  if (s.gold < g.price) return fail('not_enough_gold');
  return { ok: true, state: { ...s, gold: s.gold - g.price, gifts: { ...s.gifts, [id]: (s.gifts[id] ?? 0) + 1 } } };
}

export function equipWeapon(s: GameState, id: string): EconomyResult {
  if (!s.ownedWeapons.includes(id)) return fail('not_owned');
  return { ok: true, state: { ...s, equippedWeapon: id } };
}

export function setActiveHorse(s: GameState, id: string | null): EconomyResult {
  if (id !== null && !s.ownedHorses.includes(id)) return fail('not_owned');
  return { ok: true, state: { ...s, activeHorse: id } };
}
