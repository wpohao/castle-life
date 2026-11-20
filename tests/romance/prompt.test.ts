import { createNewState } from '../../src/core/state';
import { LADY } from '../../src/config/romance';
import { buildMessages, FALLBACK_REPLIES, isAcceptableReply, parseModelReply, toTraditional, validatePlayerMessage } from '../../src/romance/prompt';

test('validatePlayerMessage：空白回 null', () => {
  expect(validatePlayerMessage('   ')).toBeNull();
});

test('validatePlayerMessage：去頭尾空白、截 200 字', () => {
  expect(validatePlayerMessage('  你好  ')).toBe('你好');
  expect(Array.from(validatePlayerMessage('字'.repeat(300))!).length).toBe(200);
});

test('parseModelReply 解析 JSON', () => {
  expect(parseModelReply('{"reply":"你好","nudge":1}')).toEqual({ reply: '你好', nudge: 1 });
});

test('parseModelReply 容忍前後雜訊與程式碼區塊', () => {
  expect(parseModelReply('好的：{"reply":"嗯","nudge":0} ')).toEqual({ reply: '嗯', nudge: 0 });
  expect(parseModelReply('```json\n{"reply":"嗯嗯","nudge":-1}\n```')).toEqual({ reply: '嗯嗯', nudge: -1 });
});

test('parseModelReply nudge 缺少或非數字時為 0', () => {
  expect(parseModelReply('{"reply":"嗯"}')).toEqual({ reply: '嗯', nudge: 0 });
  expect(parseModelReply('{"reply":"嗯","nudge":"很好"}')).toEqual({ reply: '嗯', nudge: 0 });
});

test('parseModelReply 格式錯回 null', () => {
  expect(parseModelReply('just text')).toBeNull();
  expect(parseModelReply('{"text":"x"}')).toBeNull();
});

test('isAcceptableReply 接受正體中文', () => {
  expect(isAcceptableReply('今晚的星空真美呢。')).toBe(true);
});

test('isAcceptableReply 擋簡體、英文、空白、過長', () => {
  expect(isAcceptableReply('我们去看星星吧')).toBe(false);
  expect(isAcceptableReply('Sure! As an AI language model...')).toBe(false);
  expect(isAcceptableReply('')).toBe(false);
  expect(isAcceptableReply('好'.repeat(301))).toBe(false);
});

test('isAcceptableReply 擋自稱 AI', () => {
  expect(isAcceptableReply('身為一個人工智慧，我無法回答。')).toBe(false);
});

test('toTraditional 轉換常見簡體字', () => {
  expect(toTraditional('我们这里说话时，还没来过')).toBe('我們這裡說話時，還沒來過');
  expect(isAcceptableReply(toTraditional('我们去看星星吧'))).toBe(true);
});

test('system 提示含名字、階段、戰績、武器、天數與正體中文規則；名字原文不被轉義', () => {
  const s = { ...createNewState('<b>亞瑟</b>'), arena: { nextOpponent: 3, champion: false }, day: 5 };
  const sys = buildMessages(s, LADY, '你好')[0]!;
  expect(sys.role).toBe('system');
  expect(sys.content).toContain('<b>亞瑟</b>');
  expect(sys.content).toContain('陌生');
  expect(sys.content).toContain('正體中文');
  expect(sys.content).toContain('3 位');
  expect(sys.content).toContain('生鏽的劍');
  expect(sys.content).toContain('第 5 天');
  expect(sys.content).toContain('艾琳娜');
});

test('已婚時提示改為妻子身分', () => {
  const s = createNewState('亞瑟');
  s.romance = { ...s.romance, married: true, affection: 90 };
  expect(buildMessages(s, LADY, '我回來了')[0]!.content).toContain('妻子');
});

test('歷史訊息依序帶入，最後一則是玩家這句', () => {
  const s = createNewState('亞瑟');
  s.romance = { ...s.romance, memory: [{ role: 'player', text: 'A' }, { role: 'lady', text: 'B' }] };
  const m = buildMessages(s, LADY, 'C');
  expect(m.slice(1).map((x) => [x.role, x.content])).toEqual([['user', 'A'], ['assistant', 'B'], ['user', 'C']]);
});

test('備用回覆都符合規範', () => {
  expect(FALLBACK_REPLIES.length).toBeGreaterThanOrEqual(5);
  for (const r of FALLBACK_REPLIES) expect(isAcceptableReply(r)).toBe(true);
});
