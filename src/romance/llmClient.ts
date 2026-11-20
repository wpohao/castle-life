import type { ChatMessage } from './prompt';

export type LlmStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; progress: number; text: string }
  | { kind: 'ready' }
  | { kind: 'generating' }
  | { kind: 'error'; message: string };

export interface Engine {
  chat(messages: ChatMessage[]): Promise<string>;
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

  async load(modelId: string): Promise<void> {
    if (this._status.kind === 'loading') return;
    this.engine = null;
    this.set({ kind: 'loading', progress: 0, text: '準備中' });
    try {
      this.engine = await this.factory(modelId, (progress, text) => this.set({ kind: 'loading', progress, text }));
      this.set({ kind: 'ready' });
    } catch (e) {
      console.error('[castle-life] AI 模型載入失敗', e);
      const detail = e instanceof Error ? e.message : String(e);
      this.set({ kind: 'error', message: `對話模型載入失敗（${detail.slice(0, 80)}）。可能是網路中斷或顯示卡記憶體不足，請按「重試」，或到設定改用較小的模型。` });
    }
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.engine || this._status.kind !== 'ready') throw new Error('模型尚未就緒');
    this.set({ kind: 'generating' });
    try {
      return await this.engine.chat(messages);
    } finally {
      this.set({ kind: 'ready' });
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
  const engine = await CreateWebWorkerMLCEngine(worker, modelId, {
    initProgressCallback: (r) => onProgress(r.progress, r.text),
  });
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
  };
};
