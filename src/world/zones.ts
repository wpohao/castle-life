import type { Vec2 } from './collision';

export type ZoneId = 'weapon_shop' | 'stable' | 'gift_stall' | 'inn' | 'arena' | 'manor';

export interface Zone {
  id: ZoneId;
  label: string;
  x: number;
  z: number;
  radius: number;
  /** true 表示會切換到 3D 場景（競技場、城主府），騎馬時不能進入 */
  enterable: boolean;
}

export function findInteraction(p: Vec2, zones: Zone[]): Zone | null {
  let best: Zone | null = null;
  let bestD = Infinity;
  for (const z of zones) {
    const d = Math.hypot(p.x - z.x, p.z - z.z);
    if (d <= z.radius && d < bestD) {
      best = z;
      bestD = d;
    }
  }
  return best;
}
