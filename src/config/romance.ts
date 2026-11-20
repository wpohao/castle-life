export interface Topic {
  id: string;
  keywords: string[];
}

export interface Persona {
  name: string;
  title: string;
  age: number;
  bio: string;
  speechStyle: string;
  likes: Topic[];
  dislikes: Topic[];
  favoriteGiftTags: string[];
  likedGiftTags: string[];
  dislikedGiftTags: string[];
}

/** 城主府的艾琳娜（原創角色，成年）。 */
export const LADY: Persona = {
  name: '艾琳娜',
  title: '城主之女',
  age: 24,
  bio: '城主的獨生女，在城主府長大。喜歡在夜裡登上塔樓觀星、讀詩、照顧府裡的小花園，也偷偷愛吃甜點。個性溫柔但有主見，對只會炫耀武力或財富的人沒有好感。母親早逝，父親公務繁忙，她常一個人待在花園或書房。',
  speechStyle: '說話溫和有禮、帶一點俏皮，偶爾會用星星或花來比喻事情；不會說粗話。',
  likes: [
    { id: 'stars', keywords: ['星', '月亮', '夜空', '銀河', '流星'] },
    { id: 'poetry', keywords: ['詩', '書', '故事', '文字'] },
    { id: 'flower', keywords: ['花', '玫瑰', '薔薇', '鈴蘭'] },
    { id: 'sweets', keywords: ['甜點', '蛋糕', '蜂蜜', '點心', '糖'] },
  ],
  dislikes: [
    { id: 'violence', keywords: ['血', '殺', '宰了', '砍死', '屍體'] },
    { id: 'wealth', keywords: ['錢多', '有錢', '炫富', '很富', '金幣多'] },
    { id: 'rude', keywords: ['蠢', '滾', '閉嘴', '笨蛋', '白痴'] },
  ],
  favoriteGiftTags: ['stars'],
  likedGiftTags: ['poetry', 'flower', 'sweets'],
  dislikedGiftTags: ['weapon'],
};

export type StageId = 'stranger' | 'acquainted' | 'friendly' | 'smitten' | 'ready';

export const STAGES: { id: StageId; name: string; min: number; attitude: string }[] = [
  { id: 'stranger', name: '陌生', min: 0, attitude: '有禮貌但保持距離，對眼前這位旅人還不熟悉，回答簡短客氣。' },
  { id: 'acquainted', name: '熟識', min: 15, attitude: '認得對方，願意多聊幾句，偶爾分享自己的小事。' },
  { id: 'friendly', name: '友好', min: 35, attitude: '把對方當朋友，語氣輕鬆，會主動問對方近況、開些小玩笑。' },
  { id: 'smitten', name: '傾心', min: 60, attitude: '對對方有好感，見到對方會開心、有點害羞，話語裡帶著在意。' },
  { id: 'ready', name: '可以求婚', min: 85, attitude: '明顯喜歡對方，語氣溫柔親近，會暗示希望一直在一起。' },
];

export const MARRIED_ATTITUDE = '已經和對方結婚，是對方的妻子。語氣親暱自然，會關心對方的生活與安危。';

export const DAILY_CHAT_LIMIT = 8;
export const LIKE_TOPIC_BONUS = 3;
export const DISLIKE_TOPIC_PENALTY = -3;
export const MESSAGE_DELTA_MIN = -4;
export const MESSAGE_DELTA_MAX = 4;
export const NUDGE_LIMIT = 1;
export const GIFT_DELTA = { favorite: 8, liked: 4, neutral: 1, disliked: -3 } as const;
export const PROPOSAL_REJECT_PENALTY = -5;
export const MEMORY_LIMIT = 12;
