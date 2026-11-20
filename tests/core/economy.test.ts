import { createNewState, type GameState } from '../../src/core/state';
import { buyGift, buyHorse, buyWeapon, equipWeapon, setActiveHorse } from '../../src/core/economy';

function ok(r: ReturnType<typeof buyWeapon>): GameState {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

test('錢剛好等於價格可以買', () => {
  const s = { ...createNewState('a'), gold: 120 };
  const n = ok(buyWeapon(s, 'iron_sword'));
  expect(n.gold).toBe(0);
  expect(n.ownedWeapons).toContain('iron_sword');
});

test('錢不夠被拒', () => {
  expect(buyWeapon(createNewState('a'), 'knight_sword')).toEqual({ ok: false, reason: 'not_enough_gold' });
});

test('重複購買被拒', () => {
  expect(buyWeapon(createNewState('a'), 'rusty_sword')).toEqual({ ok: false, reason: 'already_owned' });
  const s = ok(buyHorse({ ...createNewState('a'), gold: 1000 }, 'chestnut_pony'));
  expect(buyHorse(s, 'chestnut_pony')).toEqual({ ok: false, reason: 'already_owned' });
});

test('未知物品被拒', () => {
  expect(buyHorse(createNewState('a'), 'unicorn')).toEqual({ ok: false, reason: 'unknown_item' });
  expect(buyGift(createNewState('a'), 'nope')).toEqual({ ok: false, reason: 'unknown_item' });
});

test('失敗時原狀態不變', () => {
  const s = createNewState('a');
  buyWeapon(s, 'knight_sword');
  expect(s.gold).toBe(50);
  expect(s.ownedWeapons).toEqual(['rusty_sword']);
});

test('成功購買不修改原狀態', () => {
  const s = { ...createNewState('a'), gold: 500 };
  ok(buyWeapon(s, 'spear'));
  expect(s.ownedWeapons).toEqual(['rusty_sword']);
  expect(s.gold).toBe(500);
});

test('買馬扣錢並加入馬廄', () => {
  const n = ok(buyHorse({ ...createNewState('a'), gold: 150 }, 'chestnut_pony'));
  expect(n.gold).toBe(0);
  expect(n.ownedHorses).toEqual(['chestnut_pony']);
});

test('禮物可堆疊', () => {
  let s: GameState = { ...createNewState('a'), gold: 100 };
  s = ok(buyGift(s, 'wildflowers'));
  s = ok(buyGift(s, 'wildflowers'));
  expect(s.gifts.wildflowers).toBe(2);
  expect(s.gold).toBe(80);
});

test('只能裝備已擁有的武器', () => {
  expect(equipWeapon(createNewState('a'), 'spear')).toEqual({ ok: false, reason: 'not_owned' });
  const s = ok(buyWeapon({ ...createNewState('a'), gold: 500 }, 'spear'));
  expect(ok(equipWeapon(s, 'spear')).equippedWeapon).toBe('spear');
});

test('只能騎乘已擁有的馬；坐騎可設為 null', () => {
  const s = createNewState('a');
  expect(setActiveHorse(s, 'chestnut_pony')).toEqual({ ok: false, reason: 'not_owned' });
  const owned = ok(buyHorse({ ...s, gold: 200 }, 'chestnut_pony'));
  expect(ok(setActiveHorse(owned, 'chestnut_pony')).activeHorse).toBe('chestnut_pony');
  expect(ok(setActiveHorse(owned, null)).activeHorse).toBeNull();
});
