import type { WeaponKind } from './items';

export interface Opponent {
  id: string;
  name: string;
  title: string;
  hp: number;
  damage: number;
  windup: number;
  recover: number;
  reach: number;
  /** 玩家揮砍時選擇格擋的機率 */
  blockChance: number;
  /** 0～1，越高越常主動進攻 */
  aggression: number;
  prize: number;
  weaponKind: WeaponKind;
}

export const PLAYER_HP = 100;

export const OPPONENTS: Opponent[] = [
  { id: 'farm_boy', name: '湯姆', title: '農家小子', hp: 40, damage: 6, windup: 0.8, recover: 0.6, reach: 1.5, blockChance: 0.05, aggression: 0.3, prize: 30, weaponKind: 'mace' },
  { id: 'tavern_brawler', name: '巴克', title: '酒館打手', hp: 55, damage: 8, windup: 0.7, recover: 0.55, reach: 1.5, blockChance: 0.1, aggression: 0.4, prize: 50, weaponKind: 'mace' },
  { id: 'mercenary', name: '維克', title: '傭兵', hp: 70, damage: 10, windup: 0.65, recover: 0.5, reach: 1.7, blockChance: 0.2, aggression: 0.5, prize: 80, weaponKind: 'sword' },
  { id: 'guard_captain', name: '羅蘭', title: '城衛隊長', hp: 85, damage: 12, windup: 0.6, recover: 0.45, reach: 1.8, blockChance: 0.3, aggression: 0.55, prize: 120, weaponKind: 'spear' },
  { id: 'wandering_blade', name: '塞拉斯', title: '流浪劍客', hp: 100, damage: 14, windup: 0.5, recover: 0.4, reach: 1.8, blockChance: 0.4, aggression: 0.65, prize: 180, weaponKind: 'sword' },
  { id: 'northern_axeman', name: '烏爾夫', title: '北境斧手', hp: 120, damage: 18, windup: 0.65, recover: 0.5, reach: 1.6, blockChance: 0.35, aggression: 0.75, prize: 250, weaponKind: 'axe' },
  { id: 'champion', name: '加雷斯', title: '競技場冠軍', hp: 150, damage: 18, windup: 0.45, recover: 0.35, reach: 2.0, blockChance: 0.5, aggression: 0.8, prize: 500, weaponKind: 'sword' },
];

export const CHAMPION_INDEX = OPPONENTS.length - 1;
