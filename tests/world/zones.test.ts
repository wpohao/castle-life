import { findInteraction, type Zone } from '../../src/world/zones';

const zones: Zone[] = [
  { id: 'inn', label: '旅店', x: 0, z: 0, radius: 2, enterable: false },
  { id: 'stable', label: '馬廄', x: 3, z: 0, radius: 2, enterable: false },
];

test('取最近的區域', () => {
  expect(findInteraction({ x: 2, z: 0 }, zones)?.id).toBe('stable');
  expect(findInteraction({ x: 1, z: 0 }, zones)?.id).toBe('inn');
});

test('範圍外回傳 null', () => {
  expect(findInteraction({ x: 10, z: 0 }, zones)).toBeNull();
});

test('剛好在半徑邊界上算在範圍內', () => {
  expect(findInteraction({ x: 0, z: -2 }, zones)?.id).toBe('inn');
});
