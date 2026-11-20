import { resolveCircleVsBoxes, type Box } from '../../src/world/collision';

const unit: Box = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };

function distToBox(p: { x: number; z: number }, b: Box): number {
  const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
  return Math.hypot(p.x - cx, p.z - cz);
}

test('圓在盒外不動', () => {
  expect(resolveCircleVsBoxes({ x: 5, z: 0 }, 0.4, [unit])).toEqual({ x: 5, z: 0 });
});

test('圓壓進盒子右側被推到邊界外', () => {
  const r = resolveCircleVsBoxes({ x: 1.2, z: 0 }, 0.4, [unit]);
  expect(r.x).toBeCloseTo(1.4);
  expect(r.z).toBeCloseTo(0);
});

test('圓心在盒子裡面時從最近的邊推出', () => {
  const r = resolveCircleVsBoxes({ x: 0, z: 0.9 }, 0.4, [unit]);
  expect(r.x).toBeCloseTo(0);
  expect(r.z).toBeCloseTo(1.4);
});

test('壓到盒子角落時沿對角推出', () => {
  const r = resolveCircleVsBoxes({ x: 1.1, z: 1.1 }, 0.4, [unit]);
  expect(distToBox(r, unit)).toBeCloseTo(0.4);
});

test('卡在兩個相鄰盒子的角落也會被推出', () => {
  const a: Box = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
  const b: Box = { minX: 1, maxX: 3, minZ: -1, maxZ: 1 };
  const c: Box = { minX: -1, maxX: 1, minZ: 1, maxZ: 3 };
  const r = resolveCircleVsBoxes({ x: 1.2, z: 1.2 }, 0.4, [a, b, c]);
  for (const box of [a, b, c]) expect(distToBox(r, box)).toBeGreaterThanOrEqual(0.4 - 1e-6);
});
