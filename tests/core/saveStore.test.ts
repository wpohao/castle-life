import 'fake-indexeddb/auto';
import { createNewState, type GameState } from '../../src/core/state';
import { createAutosave, deleteSave, loadSave, writeSave } from '../../src/core/saveStore';

afterEach(() => {
  vi.useRealTimers();
});

test('沒有存檔時回傳 null', async () => {
  await deleteSave();
  expect(await loadSave()).toBeNull();
});

test('寫入後讀回相同內容', async () => {
  const s = { ...createNewState('亞瑟'), gold: 321 };
  await writeSave(s);
  expect(await loadSave()).toEqual(s);
});

test('刪除後為 null', async () => {
  await writeSave(createNewState('a'));
  await deleteSave();
  expect(await loadSave()).toBeNull();
});

test('autosave 去抖：多次 notify 只寫一次最後狀態', async () => {
  vi.useFakeTimers();
  const write = vi.fn(async (_s: GameState) => {});
  const a = createAutosave(write, 500);
  a.notify({ ...createNewState('a'), gold: 1 });
  a.notify({ ...createNewState('a'), gold: 2 });
  await vi.advanceTimersByTimeAsync(600);
  expect(write).toHaveBeenCalledTimes(1);
  expect(write.mock.calls[0]![0].gold).toBe(2);
});

test('autosave flush 立即寫入且不會再重複寫', async () => {
  vi.useFakeTimers();
  const write = vi.fn(async (_s: GameState) => {});
  const a = createAutosave(write, 500);
  a.notify({ ...createNewState('a'), gold: 9 });
  await a.flush();
  expect(write).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(600);
  expect(write).toHaveBeenCalledTimes(1);
});

test('autosave 沒有待寫內容時 flush 不寫', async () => {
  const write = vi.fn(async (_s: GameState) => {});
  await createAutosave(write, 500).flush();
  expect(write).not.toHaveBeenCalled();
});
