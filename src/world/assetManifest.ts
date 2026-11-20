/** 所有外部模型素材的路徑（相對於 public/）。來源與授權見 CREDITS.md。 */
export const ASSETS = {
  player: 'assets/characters/adventurer_male.glb',
  adventurerFemale: 'assets/characters/adventurer_female.glb',
  lady: 'assets/characters/lady_green_dress.glb',
  king: 'assets/characters/king.glb',
  horseBrown: 'assets/horses/horse_brown.glb',
  horseWhite: 'assets/horses/horse_white.glb',
} as const;

export type AssetKey = keyof typeof ASSETS;

/** 模型在世界中的目標高度（公尺），載入後依包圍盒縮放。 */
export const ASSET_HEIGHT: Record<AssetKey, number> = {
  player: 1.8,
  adventurerFemale: 1.72,
  lady: 1.68,
  king: 1.85,
  horseBrown: 2.25,
  horseWhite: 2.25,
};

export function assetUrl(key: AssetKey): string {
  const base = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.BASE_URL : '/';
  return base + ASSETS[key];
}
