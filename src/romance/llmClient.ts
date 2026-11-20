import type { ChatMessage } from './prompt';

export type LlmStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; progress: number; text: string }
  | { kind: 'ready' }
  | { kind: 'generating' }
  | { kind: 'error'; message: string };

export interface Engine {
  chat(messages: ChatMessage[]): Promise<string>;
  /** 釋放模型與 worker（交還顯示卡記憶體） */
  dispose?(): Promise<void>;
}

export type EngineFactory = (modelId: string, onProgress: (p: number, text: string) => void) => Promise<Engine>;

export const MODEL_STANDARD_F16 = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
export const MODEL_STANDARD_F32 = 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC';
export const MODEL_SMART_F16 = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';
export const MODEL_SMART_F32 = 'Qwen2.5-3B-Instruct-q4f32_1-MLC';

export type ModelTier = 'standard' | 'smart';

export function pickModel(features: ReadonlySet<string>, tier: ModelTier): string {
  const f16 = features.has('shader-f16');
  if (tier === 'smart') return f16 ? MODEL_SMART_F16 : MODEL_SMART_F32;
  return f16 ? MODEL_STANDARD_F16 : MODEL_STANDARD_F32;
}

/** 管理 AI 模型的載入狀態與對話呼叫。引擎由 factory 注入（測試時用假引擎）。 */
export class LlmClient {
  private _status: LlmStatus = { kind: 'idle' };
  private engine: Engine | null = null;
  private listeners = new Set<(s: LlmStatus) => void>();

  constructor(private readonly factory: EngineFactory) {}

  get status(): LlmStatus {
    return this._status;
  }

  private set(s: LlmStatus): void {
    this._status = s;
    for (const l of this.listeners) l(s);
  }

  onStatus(cb: (s: LlmStatus) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** 每次載入遞增；舊載入或舊對話的結果若不是最新一代就丟棄，不改狀態。 */
  private generation = 0;
  private loading: Promise<void> | null = null;
  private pendingModel: string | null = null;

  /**
   * 載入模型。會先釋放舊引擎（終止舊 worker、交還顯示卡記憶體）。
   * 載入中又要求別的模型時，排到目前這次之後，最後一定是最後要求的那個。
   */
  load(modelId: string): Promise<void> {
    this.pendingModel = modelId;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      while (this.pendingModel) {
        const id = this.pendingModel;
        this.pendingModel = null;
        await this.loadOnce(id);
      }
    })().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async loadOnce(modelId: string): Promise<void> {
    const gen = ++this.generation;
    const old = this.engine;
    this.engine = null;
    this.set({ kind: 'loading', progress: 0, text: '準備中' });
    try {
      await old?.dispose?.();
    } catch (e) {
      console.warn('[castle-life] 釋放舊模型失敗', e);
    }
    try {
      const engine = await this.factory(modelId, (progress, text) => {
        if (gen === this.generation) this.set({ kind: 'loading', progress, text });
      });
      this.engine = engine;
      this.set({ kind: 'ready' });
    } catch (e) {
      console.error('[castle-life] AI 模型載入失敗', e);
      const detail = e instanceof Error ? e.message : String(e);
      this.set({ kind: 'error', message: `對話模型載入失敗（${detail.slice(0, 80)}）。可能是網路中斷或顯示卡記憶體不足，請按「重試」，或到設定改用較小的模型。` });
    }
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const engine = this.engine;
    if (!engine || this._status.kind !== 'ready') throw new Error('模型尚未就緒');
    const gen = this.generation;
    this.set({ kind: 'generating' });
    try {
      const out = await engine.chat(messages);
      if (gen === this.generation) this.set({ kind: 'ready' });
      return out;
    } catch (e) {
      if (gen === this.generation) {
        const detail = e instanceof Error ? e.message : String(e);
        this.set({ kind: 'error', message: `對話模型發生錯誤（${detail.slice(0, 80)}），請按「重試」重新載入。` });
      }
      throw e;
    }
  }
}

export const REPLY_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    reply: { type: 'string' },
    nudge: { type: 'integer', enum: [-1, 0, 1] },
  },
  required: ['reply', 'nudge'],
});

/** 正式環境：WebLLM 在 Web Worker 中執行。 */
export const webWorkerEngineFactory: EngineFactory = async (modelId, onProgress) => {
  const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
  const worker = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' });
  let engine: Awaited<ReturnType<typeof CreateWebWorkerMLCEngine>>;
  try {
    engine = await CreateWebWorkerMLCEngine(worker, modelId, {
      initProgressCallback: (r) => onProgress(r.progress, r.text),
    });
  } catch (e) {
    // 載入失敗（例如顯示卡記憶體不足）時終止 worker，否則重試時舊的還占著記憶體
    worker.terminate();
    throw e;
  }
  // 暖機：第一次生成要編譯 GPU 著色器與語法比對器，先跑一次，玩家第一句話就不會等很久
  onProgress(1, '暖機中');
  try {
    await engine.chat.completions.create({
      messages: [{ role: 'user', content: '你好' }],
      max_tokens: 8,
      response_format: { type: 'json_object', schema: REPLY_SCHEMA },
    });
  } catch {
    /* 暖機失敗不影響使用 */
  }
  return {
    async chat(messages) {
      const res = await engine.chat.completions.create({
        messages,
        temperature: 0.8,
        max_tokens: 140,
        // WebLLM 的 json_object 需要以「字串」提供 schema，否則語法比對器初始化會失敗
        response_format: { type: 'json_object', schema: REPLY_SCHEMA },
      });
      return res.choices[0]?.message?.content ?? '';
    },
    async dispose() {
      try {
        await engine.unload();
      } finally {
        worker.terminate();
      }
    },
  };
};
