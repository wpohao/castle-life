import * as THREE from 'three/webgpu';
import {
  Fn, instancedArray, instanceIndex, uniform, vec2, vec3, float, sin, cos, mix, smoothstep, distance, normalize,
  positionLocal, max, color, hash,
} from 'three/tsl';

/**
 * Compute shader 草地：
 * - base（vec4）：每根草的 x、z、隨機相位、高度，只寫入一次。
 * - bend（vec2）：每根草草尖的 xz 彎曲量，每幀由 compute shader 依風與玩家位置更新。
 * - 繪製時 positionNode 讀這兩個 storage buffer，把葉片放到位置並往彎曲方向彎。
 */
export interface Grass {
  mesh: THREE.InstancedMesh;
  update(time: number, player: { x: number; z: number }): void;
}

/** 單一葉片：底部寬、往上收尖，y 範圍 0～1（實際高度在 shader 中乘上）。 */
function bladeGeometry(): THREE.BufferGeometry {
  const w = 0.045;
  const rows = [0, 0.35, 0.7];
  const pos: number[] = [];
  for (const y of rows) {
    const half = w * (1 - y * 0.85);
    pos.push(-half, y, 0, half, y, 0);
  }
  pos.push(0, 1, 0);
  const idx: number[] = [];
  for (let r = 0; r < rows.length - 1; r++) {
    const a = r * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (rows.length - 1) * 2;
  idx.push(last, last + 1, last + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createGrass(renderer: THREE.WebGPURenderer, positions: Float32Array, rng: () => number): Grass {
  const count = positions.length / 2;
  const baseData = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    baseData[i * 4] = positions[i * 2]!;
    baseData[i * 4 + 1] = positions[i * 2 + 1]!;
    baseData[i * 4 + 2] = rng() * Math.PI * 2;
    baseData[i * 4 + 3] = 0.28 + rng() * 0.3;
  }
  const base = instancedArray(baseData, 'vec4');
  const bend = instancedArray(count, 'vec2');

  const uTime = uniform(0);
  const uPlayer = uniform(new THREE.Vector2());
  const uWindDir = uniform(new THREE.Vector2(0.8, 0.6).normalize());

  const computeBend = Fn(() => {
    const b = base.element(instanceIndex);
    const p = b.xy;
    const phase = b.z;
    // 兩層正弦疊加的風：大範圍的陣風＋每根草自己的小幅擺動
    const gust = sin(uTime.mul(0.9).add(p.x.mul(0.08)).add(p.y.mul(0.05))).mul(0.5).add(0.5);
    const flutter = sin(uTime.mul(3.1).add(phase)).mul(0.25);
    const wind = uWindDir.mul(gust.mul(0.28).add(flutter.mul(0.12)));
    // 玩家附近的草被推開
    const d = distance(p, uPlayer);
    const away = normalize(p.sub(uPlayer).add(vec2(0.0001, 0)));
    const push = away.mul(smoothstep(float(1.3), float(0.2), d).mul(0.55));
    const target = wind.add(push);
    const cur = bend.element(instanceIndex);
    cur.assign(mix(cur, target, 0.18));
  })().compute(count);

  const material = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
  material.positionNode = Fn(() => {
    const b = base.element(instanceIndex);
    const bd = bend.element(instanceIndex);
    const h = b.w;
    const y = positionLocal.y;
    const ca = cos(b.z);
    const sa = sin(b.z);
    const lx = positionLocal.x;
    const k = y.mul(y); // 越靠近草尖彎越多
    return vec3(lx.mul(ca).add(b.x).add(bd.x.mul(k)), y.mul(h).mul(max(float(0.55), float(1).sub(bd.length().mul(0.6)))), lx.mul(sa).add(b.y).add(bd.y.mul(k)));
  })();
  const tint = hash(instanceIndex).mul(0.3).add(0.85);
  material.colorNode = mix(color(0x2f4a1c), color(0x8fb35a).mul(tint), positionLocal.y);

  const mesh = new THREE.InstancedMesh(bladeGeometry(), material, count);
  const identity = new THREE.Matrix4();
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, identity);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.name = 'grass';

  return {
    mesh,
    update(time, player) {
      uTime.value = time;
      uPlayer.value.set(player.x, player.z);
      renderer.compute(computeBend);
    },
  };
}
