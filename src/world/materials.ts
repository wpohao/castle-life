import * as THREE from 'three/webgpu';

/**
 * 集中管理場景材質。先以純色建立，素材載入後（Task 5 / 14）只要把貼圖掛到同一個材質物件上，
 * 所有使用它的網格都會一起更新。
 */
export type MaterialName =
  | 'grass' | 'dirt' | 'cobble' | 'plaster' | 'stoneWall' | 'castleStone' | 'roofTile'
  | 'wood' | 'darkWood' | 'cloth' | 'clothBlue' | 'sand' | 'iron' | 'water' | 'gold';

const BASE: Record<MaterialName, { color: number; roughness: number; metalness?: number }> = {
  grass: { color: 0x5d7f3a, roughness: 1 },
  dirt: { color: 0x7a6248, roughness: 1 },
  cobble: { color: 0x8a8378, roughness: 0.95 },
  plaster: { color: 0xd8cdb4, roughness: 0.95 },
  stoneWall: { color: 0x9c958a, roughness: 0.92 },
  castleStone: { color: 0x8d877d, roughness: 0.95 },
  roofTile: { color: 0x8a3f2b, roughness: 0.85 },
  wood: { color: 0x7a5434, roughness: 0.85 },
  darkWood: { color: 0x4a3322, roughness: 0.85 },
  cloth: { color: 0xa8312a, roughness: 1 },
  clothBlue: { color: 0x2f4d7a, roughness: 1 },
  sand: { color: 0xc8b48a, roughness: 1 },
  iron: { color: 0x55575a, roughness: 0.5, metalness: 0.8 },
  water: { color: 0x2d4a5a, roughness: 0.15, metalness: 0.1 },
  gold: { color: 0xc9a23a, roughness: 0.35, metalness: 1 },
};

const cache = new Map<MaterialName, THREE.MeshStandardMaterial>();

export function mat(name: MaterialName): THREE.MeshStandardMaterial {
  let m = cache.get(name);
  if (!m) {
    const b = BASE[name];
    m = new THREE.MeshStandardMaterial({ color: b.color, roughness: b.roughness, metalness: b.metalness ?? 0 });
    m.name = name;
    cache.set(name, m);
  }
  return m;
}

const doubleCache = new Map<MaterialName, THREE.MeshStandardMaterial>();

/** 雙面版本（布幔、井壁等薄片用）。貼圖套用時會同時更新。 */
export function matDouble(name: MaterialName): THREE.MeshStandardMaterial {
  let m = doubleCache.get(name);
  if (!m) {
    m = mat(name).clone();
    m.side = THREE.DoubleSide;
    doubleCache.set(name, m);
  }
  return m;
}

/** 某個材質名稱的所有實體（單面＋雙面），貼圖載入時逐一套用。 */
export function materialsFor(name: MaterialName): THREE.MeshStandardMaterial[] {
  const list = [mat(name)];
  const d = doubleCache.get(name);
  if (d) list.push(d);
  return list;
}

export const MATERIAL_NAMES = Object.keys(BASE) as MaterialName[];

/** 依物件世界尺寸設定 box 的 UV，讓貼圖以每 `tile` 公尺重複一次，不會被拉伸。 */
export function worldScaleUV(geo: THREE.BufferGeometry, tile = 2): THREE.BufferGeometry {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    if (ny >= nx && ny >= nz) uv.setXY(i, x / tile, z / tile);
    else if (nx >= nz) uv.setXY(i, z / tile, y / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  uv.needsUpdate = true;
  return geo;
}
