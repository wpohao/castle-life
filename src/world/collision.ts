export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

const ITERATIONS = 4;

/** 把 xz 平面上的圓從所有盒子裡推出去（多次迭代處理相鄰盒子的角落）。 */
export function resolveCircleVsBoxes(p: Vec2, radius: number, boxes: Box[]): Vec2 {
  let x = p.x;
  let z = p.z;
  for (let it = 0; it < ITERATIONS; it++) {
    let moved = false;
    for (const b of boxes) {
      const inside = x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ;
      if (inside) {
        // 圓心在盒內：從最近的一邊推出
        const dl = x - b.minX;
        const dr = b.maxX - x;
        const dt = z - b.minZ;
        const db = b.maxZ - z;
        const m = Math.min(dl, dr, dt, db);
        if (m === dl) x = b.minX - radius;
        else if (m === dr) x = b.maxX + radius;
        else if (m === dt) z = b.minZ - radius;
        else z = b.maxZ + radius;
        moved = true;
        continue;
      }
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius - 1e-9) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, z };
}
