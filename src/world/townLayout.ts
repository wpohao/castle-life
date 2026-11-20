import type { Box } from './collision';
import type { Zone, ZoneId } from './zones';

export type Door = 'n' | 's' | 'e' | 'w';

export interface Building {
  id: ZoneId;
  label: string;
  x: number;
  z: number;
  /** x 方向寬度 */
  w: number;
  /** z 方向深度 */
  d: number;
  /** 牆高 */
  h: number;
  door: Door;
  enterable: boolean;
  shape: 'house' | 'stall' | 'arena' | 'manor';
}

const ZONE_OFFSET = 2.5;
const ZONE_RADIUS = 2.5;
const WALL_THICKNESS = 2;

export const TOWN_LAYOUT = {
  halfSize: 50,
  wallHeight: 9,
  spawn: { x: 0, z: 42 },
  /** 面向北方（-z） */
  spawnFacing: Math.PI,
  well: { x: 0, z: 0, size: 2.2 },
  plazaRadius: 11,
  buildings: [
    { id: 'weapon_shop', label: '武器鋪', x: -22, z: -2, w: 10, d: 8, h: 6, door: 'e', enterable: false, shape: 'house' },
    { id: 'gift_stall', label: '禮品攤', x: -20, z: 14, w: 5, d: 3, h: 3, door: 'e', enterable: false, shape: 'stall' },
    { id: 'stable', label: '馬廄', x: 22, z: -4, w: 12, d: 8, h: 5, door: 'w', enterable: false, shape: 'house' },
    { id: 'inn', label: '旅店', x: -12, z: 26, w: 10, d: 8, h: 7, door: 'e', enterable: false, shape: 'house' },
    { id: 'arena', label: '競技場', x: 26, z: 26, w: 18, d: 18, h: 7, door: 'w', enterable: true, shape: 'arena' },
    { id: 'manor', label: '城主府', x: 0, z: -34, w: 24, d: 14, h: 10, door: 's', enterable: true, shape: 'manor' },
  ] satisfies Building[] as Building[],
};

export function buildingBox(b: Building): Box {
  return { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 };
}

export function doorPoint(b: Building, extra = 0): { x: number; z: number } {
  const o = ZONE_OFFSET + extra;
  switch (b.door) {
    case 'n': return { x: b.x, z: b.z - b.d / 2 - o };
    case 's': return { x: b.x, z: b.z + b.d / 2 + o };
    case 'e': return { x: b.x + b.w / 2 + o, z: b.z };
    case 'w': return { x: b.x - b.w / 2 - o, z: b.z };
  }
}

/** 門口朝外的方向角（給角色出場時面向用）。 */
export function doorFacing(b: Building): number {
  switch (b.door) {
    case 'n': return Math.PI;
    case 's': return 0;
    case 'e': return Math.PI / 2;
    case 'w': return -Math.PI / 2;
  }
}

export function townColliders(): Box[] {
  const H = TOWN_LAYOUT.halfSize;
  const T = WALL_THICKNESS;
  const walls: Box[] = [
    { minX: -H - T, maxX: H + T, minZ: -H - T, maxZ: -H },
    { minX: -H - T, maxX: H + T, minZ: H, maxZ: H + T },
    { minX: -H - T, maxX: -H, minZ: -H, maxZ: H },
    { minX: H, maxX: H + T, minZ: -H, maxZ: H },
  ];
  const w = TOWN_LAYOUT.well;
  const well: Box = { minX: w.x - w.size / 2, maxX: w.x + w.size / 2, minZ: w.z - w.size / 2, maxZ: w.z + w.size / 2 };
  return [...walls, well, ...TOWN_LAYOUT.buildings.map(buildingBox)];
}

export function townZones(): Zone[] {
  return TOWN_LAYOUT.buildings.map((b) => {
    const p = doorPoint(b);
    return { id: b.id, label: b.label, x: p.x, z: p.z, radius: ZONE_RADIUS, enterable: b.enterable };
  });
}
