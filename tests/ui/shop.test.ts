import { createNewState } from '../../src/core/state';
import { giftRows, horseRows, weaponRows } from '../../src/ui/shopRows';

test('武器列：已擁有標 owned', () => {
  const rows = weaponRows(createNewState('a'));
  expect(rows.find((r) => r.id === 'rusty_sword')).toMatchObject({ owned: true, action: 'owned' });
});

test('武器列：買不起標 affordable=false', () => {
  const rows = weaponRows(createNewState('a'));
  expect(rows.find((r) => r.id === 'knight_sword')).toMatchObject({ affordable: false, action: 'buy' });
});

test('武器列：數值文字包含傷害與攻擊距離', () => {
  const r = weaponRows(createNewState('a')).find((r) => r.id === 'knight_sword')!;
  expect(r.stats).toContain('傷害 20');
  expect(r.stats).toContain('距離 1.8');
});

test('馬匹列：速度與擁有狀態', () => {
  const s = { ...createNewState('a'), ownedHorses: ['chestnut_pony'] };
  const rows = horseRows(s);
  expect(rows.find((r) => r.id === 'chestnut_pony')).toMatchObject({ owned: true, action: 'owned' });
  expect(rows.find((r) => r.id === 'dapple_grey')!.stats).toContain('速度 10');
});

test('禮物列：永遠可買，顯示持有數量', () => {
  const s = { ...createNewState('a'), gold: 1000, gifts: { wildflowers: 3 } };
  const r = giftRows(s).find((r) => r.id === 'wildflowers')!;
  expect(r).toMatchObject({ action: 'buy', affordable: true, owned: false });
  expect(r.stats).toContain('持有 3');
});
