import { isPanelCloseKey } from '../../src/ui/dom';
import { KeyState } from '../../src/world/input';

test('Esc 關面板', () => {
  expect(isPanelCloseKey({ code: 'Escape', isComposing: false })).toBe(true);
});

test('注音／拼音選字中按 Esc 不關面板', () => {
  expect(isPanelCloseKey({ code: 'Escape', isComposing: true })).toBe(false);
});

test('其他鍵不關面板', () => {
  expect(isPanelCloseKey({ code: 'KeyE', isComposing: false })).toBe(false);
});

test('按下過的鍵只回報一次', () => {
  const k = new KeyState();
  k.keyDown('KeyF');
  expect(k.consumePressed('KeyF')).toBe(true);
  expect(k.consumePressed('KeyF')).toBe(false);
});

test('按住不放不會重複觸發', () => {
  const k = new KeyState();
  k.keyDown('KeyF');
  k.consumePressed('KeyF');
  k.keyDown('KeyF');
  expect(k.consumePressed('KeyF')).toBe(false);
  expect(k.isDown('KeyF')).toBe(true);
});

test('切換場景時清掉還沒被處理的按鍵（避免回城後自動開設定或上馬）', () => {
  const k = new KeyState();
  k.keyDown('Escape');
  k.keyUp('Escape');
  k.keyDown('KeyF');
  k.clearPressed();
  expect(k.consumePressed('Escape')).toBe(false);
  expect(k.consumePressed('KeyF')).toBe(false);
  expect(k.isDown('KeyF')).toBe(true);
});
