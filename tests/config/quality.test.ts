import { loadQualityLevel, QUALITY } from '../../src/config/quality';

test('沒有設定時預設中畫質', () => {
  expect(loadQualityLevel({ getItem: () => null })).toBe('medium');
});

test('不合法的值退回中畫質', () => {
  expect(loadQualityLevel({ getItem: () => 'ultra' })).toBe('medium');
});

test('讀取已存的畫質', () => {
  expect(loadQualityLevel({ getItem: () => 'low' })).toBe('low');
  expect(loadQualityLevel({ getItem: () => 'high' })).toBe('high');
});

test('高畫質比低畫質陰影解析度高、草多', () => {
  expect(QUALITY.high.shadowMapSize).toBeGreaterThan(QUALITY.low.shadowMapSize);
  expect(QUALITY.high.grassCount).toBeGreaterThan(QUALITY.medium.grassCount);
  expect(QUALITY.medium.grassCount).toBeGreaterThan(QUALITY.low.grassCount);
});

test('低畫質關閉 AO 與 bloom', () => {
  expect(QUALITY.low.ao).toBe(false);
  expect(QUALITY.low.bloom).toBe(false);
});

test('讀取 storage 丟例外（隱私模式）也不會壞', () => {
  expect(loadQualityLevel({ getItem: () => { throw new Error('denied'); } })).toBe('medium');
});
