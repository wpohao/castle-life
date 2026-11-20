import { createNewState, sanitizePlayerName } from '../../src/core/state';

test('新遊戲初始值', () => {
  const s = createNewState('亞瑟');
  expect(s).toMatchObject({
    version: 1,
    playerName: '亞瑟',
    gold: 50,
    day: 1,
    ownedWeapons: ['rusty_sword'],
    equippedWeapon: 'rusty_sword',
    ownedHorses: [],
    activeHorse: null,
    gifts: {},
    arena: { nextOpponent: 0, champion: false },
  });
  expect(s.romance).toEqual({
    affection: 0,
    chatsToday: 0,
    giftGivenToday: false,
    topicsToday: [],
    married: false,
    memory: [],
  });
});

test('名字：去頭尾空白', () => {
  expect(sanitizePlayerName('  亞瑟 ')).toBe('亞瑟');
});

test('名字：全空白拒絕', () => {
  expect(sanitizePlayerName('   ')).toBeNull();
});

test('名字：超過 12 字截斷', () => {
  expect(sanitizePlayerName('一二三四五六七八九十甲乙丙')).toBe('一二三四五六七八九十甲乙');
});

test('名字：特殊字元保留原文', () => {
  expect(sanitizePlayerName('<script>')).toBe('<script>');
});

test('名字：不切斷 emoji 等多碼位字元', () => {
  expect(sanitizePlayerName('😀'.repeat(13))).toBe('😀'.repeat(12));
});
