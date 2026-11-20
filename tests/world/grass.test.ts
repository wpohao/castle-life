import { scatterGrass } from '../../src/world/grassScatter';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const area = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
const hole = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };

test('數量正確（每根草 x、z 兩個值）', () => {
  expect(scatterGrass(area, [hole], 500, mulberry32(1)).length).toBe(1000);
});

test('草不會長在排除區（建築、道路）裡', () => {
  const p = scatterGrass(area, [hole], 500, mulberry32(1));
  for (let i = 0; i < p.length; i += 2) {
    const inside = p[i]! >= -2 && p[i]! <= 2 && p[i + 1]! >= -2 && p[i + 1]! <= 2;
    expect(inside).toBe(false);
  }
});

test('草都在區域內', () => {
  const p = scatterGrass(area, [], 300, mulberry32(2));
  for (let i = 0; i < p.length; i += 2) {
    expect(p[i]!).toBeGreaterThanOrEqual(-10);
    expect(p[i]!).toBeLessThanOrEqual(10);
  }
});

test('相同種子結果相同', () => {
  expect(Array.from(scatterGrass(area, [hole], 50, mulberry32(9)))).toEqual(Array.from(scatterGrass(area, [hole], 50, mulberry32(9))));
});

test('排除區佔滿整個區域時回傳空陣列而不是無窮迴圈', () => {
  expect(scatterGrass(area, [{ minX: -20, maxX: 20, minZ: -20, maxZ: 20 }], 100, mulberry32(3)).length).toBe(0);
});
