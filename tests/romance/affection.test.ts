import { createNewState, type GameState } from '../../src/core/state';
import { LADY } from '../../src/config/romance';
import { applyChat, getStage, giveGift, propose, scoreMessage } from '../../src/romance/affection';

const withRomance = (r: Partial<GameState['romance']>, extra: Partial<GameState> = {}): GameState => {
  const s = createNewState('亞瑟');
  return { ...s, ...extra, romance: { ...s.romance, ...r } };
};

function chat(s: GameState, text: string, nudge = 0) {
  const r = applyChat(s, text, '嗯。', nudge);
  if ('error' in r) throw new Error(r.error);
  return r;
}

test('階段門檻', () => {
  expect(getStage(0).id).toBe('stranger');
  expect(getStage(14).id).toBe('stranger');
  expect(getStage(15).id).toBe('acquainted');
  expect(getStage(35).id).toBe('friendly');
  expect(getStage(60).id).toBe('smitten');
  expect(getStage(85).id).toBe('ready');
  expect(getStage(100).id).toBe('ready');
});

test('喜好話題加分', () => {
  const a = scoreMessage('昨晚的星空好美', LADY, []);
  expect(a.delta).toBe(3);
  expect(a.matchedLikes).toEqual(['stars']);
});

test('同一個喜好話題每天只加一次', () => {
  const b = scoreMessage('又看到星星了', LADY, ['stars']);
  expect(b.delta).toBe(0);
});

test('禁忌話題扣分', () => {
  const r = scoreMessage('我在競技場把對手打到見血', LADY, []);
  expect(r.delta).toBeLessThan(0);
  expect(r.matchedDislikes.length).toBeGreaterThan(0);
});

test('無關話題不加不減', () => {
  expect(scoreMessage('今天天氣不錯', LADY, []).delta).toBe(0);
});

test('AI 微調被限制在 ±1', () => {
  expect(chat(createNewState('a'), '你好', 9).delta).toBe(1);
  expect(chat(createNewState('a'), '你好', -9).delta).toBe(0); // 好感最低為 0
  expect(chat(withRomance({ affection: 50 }), '你好', -9).delta).toBe(-1);
});

test('單句總和限制在 ±4', () => {
  // 星空 + 詩（兩個喜好，+6）+ nudge 1 → 4
  expect(chat(createNewState('a'), '想和你一起看星空、讀詩', 1).delta).toBe(4);
});

test('聊天會增加次數、記住話題、寫入記憶', () => {
  const r = chat(createNewState('a'), '星星好亮');
  expect(r.state.romance.chatsToday).toBe(1);
  expect(r.state.romance.topicsToday).toEqual(['stars']);
  expect(r.state.romance.memory).toEqual([
    { role: 'player', text: '星星好亮' },
    { role: 'lady', text: '嗯。' },
  ]);
});

test('每日上限 8 句', () => {
  expect(applyChat(withRomance({ chatsToday: 8 }), '你好', '嗯', 0)).toEqual({ error: 'daily_limit' });
});

test('已婚不受每日上限', () => {
  expect('state' in applyChat(withRomance({ chatsToday: 8, married: true }), '你好', '嗯', 0)).toBe(true);
});

test('記憶只保留最近 12 筆', () => {
  let s = createNewState('a');
  for (let i = 0; i < 8; i++) s = chat(s, `第${i}句`).state;
  s = { ...s, romance: { ...s.romance, chatsToday: 0 } };
  for (let i = 0; i < 2; i++) s = chat(s, `再${i}句`).state;
  expect(s.romance.memory.length).toBe(12);
  expect(s.romance.memory.at(-2)).toEqual({ role: 'player', text: '再1句' });
});

test('送最愛的禮物 +8，消耗一個', () => {
  const s = withRomance({}, { gifts: { astrolabe: 2 } });
  const r = giveGift(s, 'astrolabe');
  if ('error' in r) throw new Error(r.error);
  expect(r.delta).toBe(8);
  expect(r.state.gifts.astrolabe).toBe(1);
  expect(r.state.romance.giftGivenToday).toBe(true);
});

test('送喜歡的禮物 +4、普通 +1、討厭 −3', () => {
  const d = (id: string) => {
    const r = giveGift(withRomance({ affection: 20 }, { gifts: { [id]: 1 } }), id);
    if ('error' in r) throw new Error(r.error);
    return r.delta;
  };
  expect(d('poetry_book')).toBe(4);
  expect(d('silver_hairpin')).toBe(1);
  expect(d('dagger')).toBe(-3);
});

test('一天只能送一次禮', () => {
  expect(giveGift(withRomance({ giftGivenToday: true }, { gifts: { wildflowers: 1 } }), 'wildflowers')).toEqual({ error: 'already_gifted_today' });
});

test('沒有的禮物不能送', () => {
  expect(giveGift(createNewState('a'), 'wildflowers')).toEqual({ error: 'not_owned' });
});

test('戒指不能當禮物送', () => {
  expect(giveGift(withRomance({}, { gifts: { engagement_ring: 1 } }), 'engagement_ring')).toEqual({ error: 'ring_is_for_proposal' });
});

test('求婚：沒有戒指', () => {
  const r = propose(withRomance({ affection: 90 }));
  expect(r.accepted).toBe(false);
  expect(r.reason).toBe('no_ring');
  expect(r.state.romance.affection).toBe(90);
});

test('求婚：好感不足會被婉拒，扣 5 好感，戒指保留', () => {
  const r = propose(withRomance({ affection: 50 }, { gifts: { engagement_ring: 1 } }));
  expect(r).toMatchObject({ accepted: false, reason: 'not_ready' });
  expect(r.state.romance.affection).toBe(45);
  expect(r.state.gifts.engagement_ring).toBe(1);
});

test('求婚：成功結婚並消耗戒指', () => {
  const r = propose(withRomance({ affection: 85 }, { gifts: { engagement_ring: 1 } }));
  expect(r).toMatchObject({ accepted: true, reason: 'accepted' });
  expect(r.state.romance.married).toBe(true);
  expect(r.state.gifts.engagement_ring ?? 0).toBe(0);
});

test('求婚：已婚不能再求婚', () => {
  const r = propose(withRomance({ affection: 100, married: true }, { gifts: { engagement_ring: 1 } }));
  expect(r).toMatchObject({ accepted: false, reason: 'already_married' });
});
