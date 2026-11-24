import { CHAMPION_INDEX } from '../config/arena';
import { getGift, getHorse, getWeapon } from '../config/items';
import { SAVE_VERSION, type GameState } from './state';

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export type ParseResult = { ok: true; state: GameState } | { ok: false; error: string };

class Invalid extends Error {}

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Invalid(msg);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** 解析並逐欄驗證存檔；任何不合法都回傳正體中文錯誤訊息。 */
export function parseSave(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: '存檔不是有效的 JSON 檔案。' };
  }
  try {
    return { ok: true, state: validate(raw) };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: `存檔內容不正確：${e.message}` };
    throw e;
  }
}

function validate(raw: unknown): GameState {
  check(isObj(raw), '格式不是物件');
  check(raw.version === SAVE_VERSION, `版本不支援（需要 ${SAVE_VERSION}）`);
  check(typeof raw.playerName === 'string' && raw.playerName.trim().length > 0, '名字無效');
  check(isInt(raw.gold, 0), '金幣數值無效');
  check(isInt(raw.day, 1), '天數無效');

  check(isStrArr(raw.ownedWeapons) && raw.ownedWeapons.length > 0, '武器清單無效');
  for (const id of raw.ownedWeapons) check(getWeapon(id), `未知的武器 ${id}`);
  check(typeof raw.equippedWeapon === 'string' && raw.ownedWeapons.includes(raw.equippedWeapon), '裝備的武器不在背包內');

  check(isStrArr(raw.ownedHorses), '馬匹清單無效');
  for (const id of raw.ownedHorses) check(getHorse(id), `未知的馬 ${id}`);
  check(raw.activeHorse === null || (typeof raw.activeHorse === 'string' && raw.ownedHorses.includes(raw.activeHorse)), '坐騎不在馬廄內');

  check(isObj(raw.gifts), '禮物清單無效');
  for (const [id, n] of Object.entries(raw.gifts)) {
    check(getGift(id), `未知的禮物 ${id}`);
    check(isInt(n, 0), `禮物 ${id} 數量無效`);
  }

  const arena = raw.arena;
  check(isObj(arena), '競技場資料無效');
  check(isInt(arena.nextOpponent, 0, CHAMPION_INDEX), '競技場關卡無效');
  check(typeof arena.champion === 'boolean', '冠軍狀態無效');

  const r = raw.romance;
  check(isObj(r), '好感資料無效');
  check(isInt(r.affection, 0, 100), '好感度無效');
  check(typeof r.giftGivenToday === 'boolean', '送禮狀態無效');
  check(typeof r.married === 'boolean', '婚姻狀態無效');

  return {
    version: SAVE_VERSION,
    playerName: raw.playerName,
    gold: raw.gold,
    day: raw.day,
    ownedWeapons: [...raw.ownedWeapons],
    equippedWeapon: raw.equippedWeapon,
    ownedHorses: [...raw.ownedHorses],
    activeHorse: raw.activeHorse as string | null,
    gifts: { ...(raw.gifts as Record<string, number>) },
    arena: { nextOpponent: arena.nextOpponent, champion: arena.champion },
    romance: {
      affection: r.affection,
      giftGivenToday: r.giftGivenToday,
      married: r.married,
    },
  };
}
