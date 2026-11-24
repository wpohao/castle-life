import { createNewState } from '../../src/core/state';
import { parseSave, serialize } from '../../src/core/save';

const base = createNewState('亞瑟');

test('serialize → parseSave 來回一致', () => {
  const s = { ...base, gold: 77, gifts: { wildflowers: 2 }, romance: { ...base.romance, affection: 30, giftGivenToday: true } };
  expect(parseSave(serialize(s))).toEqual({ ok: true, state: s });
});

test('舊存檔的聊天欄位會被忽略，仍可讀取', () => {
  const old = { ...base, romance: { ...base.romance, chatsToday: 3, topicsToday: ['stars'], memory: [{ role: 'player', text: '你好' }] } };
  expect(parseSave(JSON.stringify(old))).toEqual({ ok: true, state: base });
});

test.each([
  ['不是 JSON', '{oops'],
  ['不是物件', '42'],
  ['版本不符', JSON.stringify({ ...base, version: 99 })],
  ['金錢為負', JSON.stringify({ ...base, gold: -5 })],
  ['金錢不是整數', JSON.stringify({ ...base, gold: 1.5 })],
  ['天數小於 1', JSON.stringify({ ...base, day: 0 })],
  ['未知武器', JSON.stringify({ ...base, ownedWeapons: ['laser'] })],
  ['裝備未擁有的武器', JSON.stringify({ ...base, equippedWeapon: 'spear' })],
  ['坐騎未擁有', JSON.stringify({ ...base, activeHorse: 'chestnut_pony' })],
  ['未知禮物', JSON.stringify({ ...base, gifts: { bomb: 1 } })],
  ['禮物數量為負', JSON.stringify({ ...base, gifts: { wildflowers: -1 } })],
  ['競技場關卡超出範圍', JSON.stringify({ ...base, arena: { nextOpponent: 99, champion: false } })],
  ['好感超出範圍', JSON.stringify({ ...base, romance: { ...base.romance, affection: 999 } })],
  ['送禮狀態格式錯誤', JSON.stringify({ ...base, romance: { ...base.romance, giftGivenToday: 'yes' } })],
  ['名字空白', JSON.stringify({ ...base, playerName: '  ' })],
  ['缺欄位', JSON.stringify({ version: 1 })],
])('拒絕損壞存檔：%s', (_, json) => {
  const r = parseSave(json);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
});
