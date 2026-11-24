import type { UiContext } from './context';
import { h } from './dom';

export interface SettingsActions {
  exportSave(): void;
  /** 回傳錯誤訊息；成功回傳 null */
  importSave(file: File): Promise<string | null>;
  resetGame(): Promise<void>;
  /** 額外的設定區塊（例如畫質） */
  extraSections?: ((body: HTMLElement) => void)[];
}

export function openSettings(ctx: UiContext, actions: SettingsActions): void {
  ctx.panels.open('設定', (body, close) => {
    const msg = h('p', { className: 'muted' });

    body.append(h('h3', { text: '存檔' }), h('p', { className: 'muted', text: '進度會自動存在這個瀏覽器裡。清除瀏覽器資料會讓存檔消失，建議偶爾匯出備份。' }));

    const file = h('input') as HTMLInputElement;
    file.type = 'file';
    file.accept = 'application/json,.json';
    file.style.display = 'none';
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f) return;
      const err = await actions.importSave(f);
      if (err) msg.textContent = err;
      else {
        close();
        ctx.toast('已匯入存檔。');
      }
    });

    let armed = false;
    const reset = h('button', {
      className: 'danger',
      text: '刪除存檔並重新開始',
      onClick: async () => {
        if (!armed) {
          armed = true;
          reset.textContent = '確定要刪除？再按一次';
          setTimeout(() => {
            armed = false;
            reset.textContent = '刪除存檔並重新開始';
          }, 4000);
          return;
        }
        await actions.resetGame();
      },
    });

    body.append(
      h('div', { className: 'row' },
        h('button', { text: '匯出存檔', onClick: () => actions.exportSave() }),
        h('button', { text: '匯入存檔', onClick: () => file.click() }),
        reset,
      ),
      file,
      msg,
    );
    for (const section of actions.extraSections ?? []) section(body);
  });
}
