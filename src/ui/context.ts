import type { GameState } from '../core/state';
import type { PanelHost } from './dom';

/** UI 面板共用的遊戲操作介面。 */
export interface UiContext {
  panels: PanelHost;
  getState(): GameState;
  setState(s: GameState): void;
  toast(text: string): void;
}

export const ECONOMY_ERROR_TEXT = {
  not_enough_gold: '金幣不夠。',
  already_owned: '你已經有這個了。',
  unknown_item: '沒有這項商品。',
  not_owned: '你還沒有這個。',
} as const;
