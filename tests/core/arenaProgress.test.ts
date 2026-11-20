import { createNewState, type GameState } from '../../src/core/state';
import { currentOpponentIndex, recordBout } from '../../src/core/arenaProgress';

const at = (next: number, extra: Partial<GameState> = {}): GameState => ({ ...createNewState('a'), arena: { nextOpponent: next, champion: false }, ...extra });

test('勝利拿獎金、晉級、加好感', () => {
  const r = recordBout(createNewState('a'), 'win');
  expect(r).toMatchObject({ prize: 30, affectionBonus: 2 });
  expect(r.state.gold).toBe(80);
  expect(r.state.arena.nextOpponent).toBe(1);
  expect(r.state.romance.affection).toBe(2);
});

test('擊敗冠軍成為冠軍並加 12 好感', () => {
  const r = recordBout(at(6), 'win');
  expect(r.state.arena).toEqual({ nextOpponent: 6, champion: true });
  expect(r.affectionBonus).toBe(12);
  expect(r.prize).toBe(500);
});

test('冠軍後再戰：獎金減半、不加好感、關卡停在冠軍', () => {
  const s = { ...at(6), arena: { nextOpponent: 6, champion: true } };
  const r = recordBout(s, 'win');
  expect(r).toMatchObject({ prize: 250, affectionBonus: 0 });
  expect(r.state.arena.nextOpponent).toBe(6);
});

test('落敗不扣錢不晉級，狀態完全不變', () => {
  const s = at(3, { gold: 77 });
  const r = recordBout(s, 'loss');
  expect(r.prize).toBe(0);
  expect(r.affectionBonus).toBe(0);
  expect(r.state).toEqual(s);
});

test('好感不超過 100', () => {
  const s = at(6);
  s.romance = { ...s.romance, affection: 95 };
  expect(recordBout(s, 'win').state.romance.affection).toBe(100);
});

test('目前對手索引', () => {
  expect(currentOpponentIndex(at(2))).toBe(2);
  expect(currentOpponentIndex({ ...at(6), arena: { nextOpponent: 6, champion: true } })).toBe(6);
});
