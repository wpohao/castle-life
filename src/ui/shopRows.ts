import { GIFTS, HORSES, WEAPONS, type Weapon } from '../config/items';
import type { GameState } from '../core/state';

export interface ShopRow {
  id: string;
  name: string;
  price: number;
  stats: string;
  owned: boolean;
  affordable: boolean;
  action: 'buy' | 'owned';
}

const KIND_NAME: Record<Weapon['kind'], string> = { sword: '劍', axe: '斧', mace: '錘', spear: '長柄' };

export function weaponStats(w: Weapon): string {
  return `${KIND_NAME[w.kind]}｜傷害 ${w.damage}｜出手 ${w.windup.toFixed(2)} 秒｜距離 ${w.reach.toFixed(1)} 公尺`;
}

export function weaponRows(s: GameState): ShopRow[] {
  return WEAPONS.map((w) => {
    const owned = s.ownedWeapons.includes(w.id);
    return { id: w.id, name: w.name, price: w.price, stats: weaponStats(w), owned, affordable: s.gold >= w.price, action: owned ? 'owned' : 'buy' };
  });
}

export function horseRows(s: GameState): ShopRow[] {
  return HORSES.map((h) => {
    const owned = s.ownedHorses.includes(h.id);
    return { id: h.id, name: h.name, price: h.price, stats: `速度 ${h.speed} 公尺／秒`, owned, affordable: s.gold >= h.price, action: owned ? 'owned' : 'buy' };
  });
}

export function giftRows(s: GameState): ShopRow[] {
  return GIFTS.map((g) => ({
    id: g.id,
    name: g.name,
    price: g.price,
    stats: `持有 ${s.gifts[g.id] ?? 0}`,
    owned: false,
    affordable: s.gold >= g.price,
    action: 'buy' as const,
  }));
}
