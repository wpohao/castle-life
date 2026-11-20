import { createNewState } from '../../src/core/state';
import { canEnter, canMount, horseAnim, moveSpeed } from '../../src/world/horse';
import type { Zone } from '../../src/world/zones';

const arenaZone: Zone = { id: 'arena', label: '競技場', x: 0, z: 0, radius: 2.5, enterable: true };
const shopZone: Zone = { id: 'weapon_shop', label: '武器鋪', x: 10, z: 0, radius: 2.5, enterable: false };
const withHorse = { ...createNewState('a'), ownedHorses: ['dapple_grey'], activeHorse: 'dapple_grey' };

test('沒有坐騎不能上馬', () => {
  expect(canMount(createNewState('a'), { x: 50, z: 50 }, [arenaZone])).toEqual({ ok: false, reason: 'no_horse' });
});

test('在競技場門口不能上馬', () => {
  expect(canMount(withHorse, { x: 0.5, z: 0 }, [arenaZone])).toEqual({ ok: false, reason: 'in_zone' });
});

test('商店門口可以上馬', () => {
  const r = canMount(withHorse, { x: 10, z: 0 }, [arenaZone, shopZone]);
  expect(r.ok && r.horse.id).toBe('dapple_grey');
});

test('步行與奔跑速度', () => {
  const s = createNewState('a');
  expect(moveSpeed(s, false, false)).toBe(3);
  expect(moveSpeed(s, false, true)).toBe(6);
});

test('騎乘速度取自馬，Shift 再乘 1.3', () => {
  expect(moveSpeed(withHorse, true, false)).toBe(10);
  expect(moveSpeed(withHorse, true, true)).toBeCloseTo(13);
});

test('騎馬時不能進入競技場與城主府，可以開商店面板', () => {
  expect(canEnter(arenaZone, true)).toBe(false);
  expect(canEnter(arenaZone, false)).toBe(true);
  expect(canEnter(shopZone, true)).toBe(true);
});

test('馬的動畫依速度切換', () => {
  expect(horseAnim(0)).toBe('Idle');
  expect(horseAnim(3)).toBe('Walk');
  expect(horseAnim(9)).toBe('Gallop');
});
