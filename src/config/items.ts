export type WeaponKind = 'sword' | 'axe' | 'mace' | 'spear';

export interface Weapon {
  id: string;
  name: string;
  kind: WeaponKind;
  price: number;
  damage: number;
  /** 揮砍前搖（秒） */
  windup: number;
  /** 揮砍後硬直（秒） */
  recover: number;
  /** 攻擊距離（公尺） */
  reach: number;
  model: string;
}

export interface Horse {
  id: string;
  name: string;
  price: number;
  /** 騎乘速度（公尺／秒） */
  speed: number;
  color: number;
}

export interface Gift {
  id: string;
  name: string;
  price: number;
  tags: string[];
}

export const WEAPONS: Weapon[] = [
  { id: 'rusty_sword', name: '生鏽的劍', kind: 'sword', price: 0, damage: 8, windup: 0.45, recover: 0.35, reach: 1.6, model: 'sword_rusty' },
  { id: 'iron_sword', name: '鐵劍', kind: 'sword', price: 120, damage: 12, windup: 0.45, recover: 0.35, reach: 1.7, model: 'sword_iron' },
  { id: 'mace', name: '釘頭錘', kind: 'mace', price: 160, damage: 15, windup: 0.6, recover: 0.45, reach: 1.5, model: 'mace' },
  { id: 'battle_axe', name: '戰斧', kind: 'axe', price: 220, damage: 19, windup: 0.7, recover: 0.5, reach: 1.5, model: 'axe' },
  { id: 'spear', name: '長槍', kind: 'spear', price: 240, damage: 13, windup: 0.5, recover: 0.4, reach: 2.4, model: 'spear' },
  { id: 'knight_sword', name: '騎士長劍', kind: 'sword', price: 480, damage: 20, windup: 0.42, recover: 0.32, reach: 1.8, model: 'sword_knight' },
];

export const HORSES: Horse[] = [
  { id: 'chestnut_pony', name: '栗色小馬', price: 150, speed: 8, color: 0x8b4a24 },
  { id: 'dapple_grey', name: '灰斑馬', price: 320, speed: 10, color: 0x9a9a96 },
  { id: 'black_destrier', name: '黑色戰馬', price: 650, speed: 12, color: 0x1e1a18 },
];

export const GIFTS: Gift[] = [
  { id: 'wildflowers', name: '野花束', price: 10, tags: ['flower'] },
  { id: 'honey_cake', name: '蜂蜜蛋糕', price: 25, tags: ['sweets'] },
  { id: 'poetry_book', name: '詩集', price: 40, tags: ['poetry'] },
  { id: 'silver_hairpin', name: '銀髮簪', price: 80, tags: ['jewelry'] },
  { id: 'astrolabe', name: '星象儀', price: 120, tags: ['stars'] },
  { id: 'dagger', name: '短劍', price: 60, tags: ['weapon'] },
  { id: 'engagement_ring', name: '訂婚戒指', price: 500, tags: ['ring'] },
];

export const STARTER_WEAPON_ID = 'rusty_sword';
export const START_GOLD = 50;
export const RING_GIFT_ID = 'engagement_ring';

export const getWeapon = (id: string): Weapon | undefined => WEAPONS.find((w) => w.id === id);
export const getHorse = (id: string): Horse | undefined => HORSES.find((h) => h.id === id);
export const getGift = (id: string): Gift | undefined => GIFTS.find((g) => g.id === id);
