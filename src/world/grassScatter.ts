import type { Box } from './collision';

/** 在 area 內隨機灑 count 根草（避開 exclude），回傳 [x0, z0, x1, z1, ...]。 */
export function scatterGrass(area: Box, exclude: Box[], count: number, rng: () => number): Float32Array {
  const out = new Float32Array(count * 2);
  const maxTries = count * 30;
  let n = 0;
  for (let tries = 0; n < count && tries < maxTries; tries++) {
    const x = area.minX + rng() * (area.maxX - area.minX);
    const z = area.minZ + rng() * (area.maxZ - area.minZ);
    if (exclude.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ)) continue;
    out[n * 2] = x;
    out[n * 2 + 1] = z;
    n++;
  }
  return n === count ? out : out.slice(0, n * 2);
}
