export type QualityLevel = 'high' | 'medium' | 'low';

export interface QualityPreset {
  label: string;
  pixelRatioCap: number;
  shadowMapSize: number;
  ao: boolean;
  bloom: boolean;
  grassCount: number;
}

/** 草量依 Intel Iris Xe 實測調整：4 萬根仍維持 60 FPS。 */
export const QUALITY: Record<QualityLevel, QualityPreset> = {
  high: { label: '高（陰影細緻、環境光遮蔽、光暈）', pixelRatioCap: 2, shadowMapSize: 2048, ao: true, bloom: true, grassCount: 60000 },
  medium: { label: '中（建議）', pixelRatioCap: 1.5, shadowMapSize: 2048, ao: false, bloom: true, grassCount: 40000 },
  low: { label: '低（筆電省電）', pixelRatioCap: 1, shadowMapSize: 1024, ao: false, bloom: false, grassCount: 15000 },
};

export const QUALITY_KEY = 'castle-life/quality';

export function loadQualityLevel(storage: Pick<Storage, 'getItem'>): QualityLevel {
  try {
    const v = storage.getItem(QUALITY_KEY);
    return v === 'high' || v === 'medium' || v === 'low' ? v : 'medium';
  } catch {
    return 'medium';
  }
}
