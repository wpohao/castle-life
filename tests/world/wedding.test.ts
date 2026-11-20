import { shotAt, weddingShots } from '../../src/world/weddingShots';

const total = (shots: ReturnType<typeof weddingShots>) => shots.reduce((a, s) => a + s.duration, 0);

test('鏡頭 4～6 鏡、總長 15～25 秒', () => {
  const shots = weddingShots('亞瑟', '艾琳娜');
  expect(shots.length).toBeGreaterThanOrEqual(4);
  expect(shots.length).toBeLessThanOrEqual(6);
  expect(total(shots)).toBeGreaterThanOrEqual(15);
  expect(total(shots)).toBeLessThanOrEqual(25);
});

test('最後一句字幕帶兩人名字', () => {
  expect(weddingShots('亞瑟', '艾琳娜').at(-1)!.caption).toBe('從此，亞瑟與艾琳娜在城裡過著幸福的日子。');
});

test('shotAt 切換正確', () => {
  const shots = weddingShots('亞瑟', '艾琳娜');
  expect(shotAt(shots, 0)).toEqual({ index: 0, local: 0 });
  const r = shotAt(shots, shots[0]!.duration + 0.01)!;
  expect(r.index).toBe(1);
  expect(r.local).toBeCloseTo(0.01);
});

test('shotAt 超過總長回 null', () => {
  const shots = weddingShots('亞瑟', '艾琳娜');
  expect(shotAt(shots, total(shots) + 1)).toBeNull();
});
