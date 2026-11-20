import { resolveCircleVsBoxes } from '../../src/world/collision';
import { PLAYER_RADIUS, turnToward } from '../../src/world/player';
import { TOWN_LAYOUT, townColliders, townZones } from '../../src/world/townLayout';

test('六個互動區都存在', () => {
  expect(townZones().map((z) => z.id).sort()).toEqual(['arena', 'gift_stall', 'inn', 'manor', 'stable', 'weapon_shop']);
});

test('只有競技場與城主府是可進入的 3D 場景', () => {
  const enterable = townZones().filter((z) => z.enterable).map((z) => z.id).sort();
  expect(enterable).toEqual(['arena', 'manor']);
});

test('每個互動區中心都站得到（不在碰撞盒裡）', () => {
  const boxes = townColliders();
  for (const z of townZones()) {
    const p = resolveCircleVsBoxes({ x: z.x, z: z.z }, PLAYER_RADIUS, boxes);
    expect({ id: z.id, x: p.x, z: p.z }).toEqual({ id: z.id, x: z.x, z: z.z });
  }
});

test('出生點站得到且在城牆內', () => {
  const s = TOWN_LAYOUT.spawn;
  expect(resolveCircleVsBoxes(s, PLAYER_RADIUS, townColliders())).toEqual({ x: s.x, z: s.z });
  expect(Math.abs(s.x)).toBeLessThan(TOWN_LAYOUT.halfSize);
  expect(Math.abs(s.z)).toBeLessThan(TOWN_LAYOUT.halfSize);
});

test('城牆封閉：從城內往外走不出去', () => {
  const boxes = townColliders();
  let p = { x: 0, z: 40 };
  for (let i = 0; i < 400; i++) p = resolveCircleVsBoxes({ x: p.x, z: p.z + 0.1 }, PLAYER_RADIUS, boxes);
  expect(p.z).toBeLessThan(TOWN_LAYOUT.halfSize);
});

test('turnToward 走最短方向並受限於最大步長', () => {
  expect(turnToward(0, 0.1, 1)).toBeCloseTo(0.1);
  expect(turnToward(0, 2, 0.5)).toBeCloseTo(0.5);
  expect(turnToward(3, -3, 0.1)).toBeCloseTo(3.1);
});
