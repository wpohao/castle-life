import { createNewState } from '../../src/core/state';
import { restUntilNextDay } from '../../src/core/time';

test('休息到隔天重置每日限制', () => {
  const s = createNewState('a');
  s.romance = { ...s.romance, giftGivenToday: true, affection: 40 };
  const n = restUntilNextDay(s);
  expect(n.day).toBe(2);
  expect(n.romance).toMatchObject({ giftGivenToday: false, affection: 40 });
  expect(s.day).toBe(1);
});
