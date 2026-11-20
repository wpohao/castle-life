// 下載遊戲用的 CC0 素材到 public/assets/。已存在的檔案會略過。
// 用法（本機 Avast 攔截 HTTPS，需讓 Node 使用系統憑證）：
//   NODE_OPTIONS=--use-system-ca node scripts/fetch-assets.mjs
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
const UA = { 'User-Agent': 'castle-life-asset-fetcher' };

/** 遊戲材質名稱 → Poly Haven 材質 ID（皆為 CC0）。 */
export const TEXTURES = {
  grass: 'leafy_grass',
  dirt: 'stony_dirt_path',
  cobble: 'cobblestone_floor_04',
  plaster: 'grey_plaster_02',
  stoneWall: 'stone_wall',
  castleStone: 'castle_wall_slates',
  roofTile: 'clay_roof_tiles_02',
  wood: 'brown_planks_05',
  darkWood: 'dark_wooden_planks',
  sand: 'dense_sand',
};
const TEXTURE_RES = '1k';
const MAPS = { Diffuse: 'diff', nor_gl: 'nor', Rough: 'rough' };

export const HDRI = { id: 'kloofendal_48d_partly_cloudy_puresky', res: '2k' };

/** Quaternius（CC0）模型，經 poly.pizza 取得。 */
export const MODELS = {
  'characters/adventurer_male.glb': 'https://static.poly.pizza/bbe369ee-a686-42c7-adad-14356f5f2f15.glb',
  'characters/adventurer_female.glb': 'https://static.poly.pizza/69689495-028d-4b81-8678-792338a5693e.glb',
  'characters/lady_green_dress.glb': 'https://static.poly.pizza/46d6db5a-3c9f-4238-8cdf-8eb7194498dc.glb',
  'characters/king.glb': 'https://static.poly.pizza/29a3436b-3b06-4dbf-a236-bcec18f3351a.glb',
  'horses/horse_brown.glb': 'https://static.poly.pizza/d37dbc87-ca61-4b2c-a2da-d2f0c4240bef.glb',
  'horses/horse_white.glb': 'https://static.poly.pizza/3edc2bd9-3378-4b43-a50d-d5e1f858562b.glb',
};

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  if (await exists(dest)) return 'skip';
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return 'ok';
}

async function main() {
  for (const [name, id] of Object.entries(TEXTURES)) {
    const files = await (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA })).json();
    for (const [key, short] of Object.entries(MAPS)) {
      const url = files[key]?.[TEXTURE_RES]?.jpg?.url;
      if (!url) throw new Error(`${id} 沒有 ${key} ${TEXTURE_RES} jpg`);
      console.log(name, short, await download(url, join(ROOT, 'textures', name, `${short}.jpg`)));
    }
  }
  const h = await (await fetch(`https://api.polyhaven.com/files/${HDRI.id}`, { headers: UA })).json();
  console.log('hdri', await download(h.hdri[HDRI.res].hdr.url, join(ROOT, 'hdri', 'sky.hdr')));
  for (const [path, url] of Object.entries(MODELS)) console.log(path, await download(url, join(ROOT, path)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
