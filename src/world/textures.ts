import * as THREE from 'three/webgpu';
import { materialsFor, type MaterialName } from './materials';

/** 有 Poly Haven PBR 貼圖的材質（public/assets/textures/<name>/diff|nor|rough.jpg）。 */
export const TEXTURED: MaterialName[] = [
  'grass', 'dirt', 'cobble', 'plaster', 'stoneWall', 'castleStone', 'roofTile', 'wood', 'darkWood', 'sand',
];

/** 套貼圖後保留的色調（大多是白色＝原色；草地稍微壓暗避免過亮）。 */
const TINT: Partial<Record<MaterialName, number>> = {
  grass: 0xb4c88c,
  plaster: 0xf2ece0,
};

/**
 * 載入所有 PBR 貼圖並套到共用材質上。失敗的貼圖會略過，材質保留純色。
 * maxAnisotropy 讓斜看地面時貼圖不糊。
 */
export async function applySceneTextures(maxAnisotropy = 8): Promise<{ loaded: number; failed: string[] }> {
  const loader = new THREE.TextureLoader();
  const base = import.meta.env.BASE_URL;
  const failed: string[] = [];
  let loaded = 0;
  await Promise.all(
    TEXTURED.map(async (name) => {
      try {
        const [diff, nor, rough] = await Promise.all(
          ['diff', 'nor', 'rough'].map((k) => loader.loadAsync(`${base}assets/textures/${name}/${k}.jpg`)),
        );
        diff!.colorSpace = THREE.SRGBColorSpace;
        for (const t of [diff!, nor!, rough!]) {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = maxAnisotropy;
        }
        for (const m of materialsFor(name)) {
          m.map = diff!;
          m.normalMap = nor!;
          m.roughnessMap = rough!;
          m.roughness = 1;
          m.color.setHex(TINT[name] ?? 0xffffff);
          m.needsUpdate = true;
        }
        loaded++;
      } catch (e) {
        console.warn(`[castle-life] 貼圖 ${name} 載入失敗`, e);
        failed.push(name);
      }
    }),
  );
  return { loaded, failed };
}
