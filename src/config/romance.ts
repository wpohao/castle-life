export interface Persona {
  name: string;
  title: string;
  favoriteGiftTags: string[];
  likedGiftTags: string[];
  dislikedGiftTags: string[];
}

/** 城主府的艾琳娜（原創角色，成年）。 */
export const LADY: Persona = {
  name: '艾琳娜',
  title: '城主之女',
  favoriteGiftTags: ['stars'],
  likedGiftTags: ['poetry', 'flower', 'sweets'],
  dislikedGiftTags: ['weapon'],
};

export type StageId = 'stranger' | 'acquainted' | 'friendly' | 'smitten' | 'ready';

export const STAGES: { id: StageId; name: string; min: number }[] = [
  { id: 'stranger', name: '陌生', min: 0 },
  { id: 'acquainted', name: '熟識', min: 15 },
  { id: 'friendly', name: '友好', min: 35 },
  { id: 'smitten', name: '傾心', min: 60 },
  { id: 'ready', name: '可以求婚', min: 85 },
];

export const GIFT_DELTA = { favorite: 8, liked: 4, neutral: 1, disliked: -3 } as const;
export const PROPOSAL_REJECT_PENALTY = -5;
