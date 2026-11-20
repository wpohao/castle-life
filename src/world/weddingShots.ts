export type V3 = [number, number, number];

export interface Shot {
  duration: number;
  from: V3;
  to: V3;
  lookAt: V3;
  caption: string;
}

/** 婚禮在廣場北側（水井與城主府之間）舉行，新人站在 (0, 0, -6) 附近。 */
export const WEDDING_SPOT: V3 = [0, 0, -6];

export function weddingShots(playerName: string, ladyName: string): Shot[] {
  return [
    { duration: 4, from: [0, 8, 14], to: [0, 5, 6], lookAt: [0, 1.5, -6], caption: '這一天，整座城的人都來到了廣場。' },
    { duration: 4, from: [-5, 2, -2], to: [-3, 1.8, -3.6], lookAt: [0, 1.5, -6], caption: `${ladyName}穿著綠色的禮服，在花拱門下等著你。` },
    { duration: 4, from: [3, 1.7, -3], to: [1.6, 1.7, -4.3], lookAt: [0, 1.45, -6], caption: '「我願意。」' },
    { duration: 4, from: [0, 3, 4], to: [0, 12, 16], lookAt: [0, 1.5, -6], caption: '鐘聲響起，祝福聲傳遍了整座城。' },
    { duration: 4, from: [6, 6, 2], to: [-6, 6, 2], lookAt: [0, 1, -6], caption: `從此，${playerName}與${ladyName}在城裡過著幸福的日子。` },
  ];
}

export function shotAt(shots: Shot[], t: number): { index: number; local: number } | null {
  let acc = 0;
  for (let i = 0; i < shots.length; i++) {
    const d = shots[i]!.duration;
    if (t < acc + d) return { index: i, local: t - acc };
    acc += d;
  }
  return null;
}
