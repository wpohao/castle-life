import { WEAPONS, type Weapon, type WeaponKind } from '../config/items';
import type { AssetKey } from './assetManifest';

/** 每位對手的外觀：用哪個模型、哪些材質換色。 */
export const OPPONENT_LOOK: Record<string, { key: AssetKey; tint?: Record<string, number> }> = {
  farm_boy: { key: 'player', tint: { Green: 0xb59a6a, LightGreen: 0xcbb487, Hair: 0xc89a5a } },
  tavern_brawler: { key: 'player', tint: { Green: 0x5a2a22, LightGreen: 0x7a3a2c, Hair: 0x222222 } },
  mercenary: { key: 'player', tint: { Green: 0x4a4a4a, LightGreen: 0x6a6a6a, Brown: 0x3a2c22 } },
  guard_captain: { key: 'king', tint: { Gold: 0x7a7a7a, Blue: 0x2f4d7a, Hair_White: 0x4a3020 } },
  wandering_blade: { key: 'adventurerFemale', tint: { Green: 0x3a3a5a, LightGreen: 0x55557a } },
  northern_axeman: { key: 'player', tint: { Green: 0x6b5a48, LightGreen: 0x8a7a66, Hair: 0xc0803a } },
  champion: { key: 'king' },
};

const KIND_WEAPON: Record<WeaponKind, string> = { sword: 'iron_sword', axe: 'battle_axe', mace: 'mace', spear: 'spear' };

export function opponentWeapon(opponentId: string, kind: WeaponKind): Weapon {
  const id = opponentId === 'champion' ? 'knight_sword' : KIND_WEAPON[kind];
  return WEAPONS.find((w) => w.id === id)!;
}
