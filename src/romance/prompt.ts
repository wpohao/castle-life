import { getHorse, getWeapon } from '../config/items';
import { MARRIED_ATTITUDE, type Persona } from '../config/romance';
import type { GameState } from '../core/state';
import { getStage } from './affection';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export const PLAYER_MESSAGE_MAX = 200;
export const REPLY_MAX = 300;

export function validatePlayerMessage(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return Array.from(t).slice(0, PLAYER_MESSAGE_MAX).join('');
}

function arenaRecord(s: GameState): string {
  if (s.arena.champion) return '他是本城競技場的冠軍，全城都在談論他';
  if (s.arena.nextOpponent === 0) return '他還沒在競技場比試過';
  return `他已在競技場擊敗 ${s.arena.nextOpponent} 位對手`;
}

export function buildMessages(s: GameState, p: Persona, userText: string): ChatMessage[] {
  const stage = getStage(s.romance.affection);
  const attitude = s.romance.married ? MARRIED_ATTITUDE : stage.attitude;
  const weapon = getWeapon(s.equippedWeapon)?.name ?? '無';
  const horse = s.activeHorse ? getHorse(s.activeHorse)?.name : null;
  const system = [
    `你是「${p.name}」，${p.title}，${p.age} 歲。${p.bio}`,
    `說話風格：${p.speechStyle}`,
    `正在和你說話的人叫「${s.playerName}」，是來到這座城的旅人。${arenaRecord(s)}；他目前佩帶的武器是${weapon}${horse ? `，坐騎是${horse}` : ''}。今天是他來到城裡的第 ${s.day} 天。`,
    `你對他目前的關係：${s.romance.married ? '妻子' : stage.name}。態度：${attitude}`,
    `你喜歡的事物：星空、詩與故事、花、甜點。你討厭：炫耀殺戮與流血、炫富、粗魯無禮。`,
    '規則：',
    '1. 只用正體中文（台灣用字）回答，絕對不要用簡體字或英文。',
    `2. 永遠以${p.name}的身分說話，不要提到自己是 AI、模型或助理，也不要跳出角色。`,
    '3. 每次回覆 1～3 句，自然口語，可以描述一點小動作（用括號）。',
    '4. 你是城主之女，不是僕人或店員：不要問「有什麼可以幫你」「需要什麼」，要像在跟朋友或心儀的人聊天，可以分享自己的想法或反問他的事。',
    '5. 輸出格式只能是 JSON：{"reply": "你的回覆", "nudge": -1 或 0 或 1}。nudge 表示他這句話是否有禮貌、用心（用心為 1，普通為 0，無禮為 -1）。',
    '範例：',
    '他說「今天天氣真好」→ {"reply": "（她推開窗，深吸一口氣）是呀，這樣的晚上，星星一定看得很清楚。", "nudge": 0}',
    '他說「我帶了一些蜂蜜蛋糕來」→ {"reply": "（她眼睛一亮，又趕緊裝作鎮定）咳……既然你都帶來了，我就嚐一口吧。", "nudge": 1}',
  ].join('\n');
  const history: ChatMessage[] = s.romance.memory.map((m) => ({ role: m.role === 'player' ? 'user' : 'assistant', content: m.text }));
  return [{ role: 'system', content: system }, ...history, { role: 'user', content: userText }];
}

export function parseModelReply(raw: string): { reply: string; nudge: number } | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(raw.slice(start, end + 1)) as { reply?: unknown; nudge?: unknown };
    if (typeof j.reply !== 'string' || !j.reply.trim()) return null;
    const n = typeof j.nudge === 'number' && Number.isFinite(j.nudge) ? j.nudge : 0;
    return { reply: j.reply.trim(), nudge: n };
  } catch {
    return null;
  }
}

/** 常見簡體字 → 正體字（每組兩個字：簡、繁）。只收不會誤傷正體文字的字。 */
const S2T_PAIRS =
  '们們 这這 说說 话話 时時 为為 对對 过過 还還 没沒 么麼 让讓 给給 门門 问問 间間 听聽 见見 东東 车車 钱錢 实實 觉覺 谢謝 欢歡 爱愛 来來 个個 会會 吗嗎 样樣 ' +
  '里裡 后後 发發 开開 关關 长長 头頭 边邊 远遠 进進 动動 学學 书書 写寫 读讀 诗詩 语語 认認 识識 请請 谁誰 该該 记記 讲講 论論 许許 试試 设設 计計 谈談 ' +
  '调調 课課 诉訴 词詞 热熱 恋戀 怀懷 忆憶 应應 总總 无無 与與 专專 业業 两兩 严嚴 乐樂 习習 乡鄉 买買 乱亂 争爭 云雲 亲親 从從 价價 众眾 优優 伟偉 传傳 ' +
  '伤傷 体體 余餘 儿兒 兰蘭 兴興 养養 内內 军軍 农農 决決 况況 净淨 凉涼 别別 剑劍 剧劇 办辦 务務 劳勞 势勢 区區 医醫 华華 单單 卖賣 卫衛 却卻 历歷 压壓 ' +
  '参參 双雙 变變 叶葉 号號 叹嘆 吓嚇 员員 响響 团團 园園 围圍 图圖 圆圓 圣聖 场場 坏壞 块塊 坚堅 声聲 处處 备備 够夠 夸誇 夺奪 奖獎 妈媽 孙孫 宁寧 宝寶 ' +
  '审審 宫宮 宽寬 宾賓 寻尋 导導 寿壽 将將 尔爾 尘塵 尝嘗 层層 属屬 岁歲 岛島 师師 带帶 帮幫 广廣 庆慶 库庫 废廢 异異 弃棄 张張 弯彎 弹彈 归歸 当當 录錄 ' +
  '忧憂 怜憐 恶惡 恼惱 惊驚 惧懼 惨慘 惯慣 愿願 懒懶 戏戲 战戰 户戶 执執 扫掃 扬揚 护護 报報 担擔 拥擁 择擇 挂掛 挥揮 换換 据據 摇搖 敌敵 数數 断斷 旧舊 ' +
  '显顯 晓曉 暂暫 术術 机機 杀殺 杂雜 权權 条條 极極 构構 枪槍 标標 树樹 桥橋 梦夢 检檢 残殘 毁毀 气氣 汉漢 汤湯 泪淚 洁潔 浅淺 测測 浓濃 涨漲 渐漸 温溫 ' +
  '湾灣 湿濕 满滿 滚滾 灭滅 灯燈 灵靈 灾災 点點 烂爛 烛燭 烟煙 烦煩 烧燒 爷爺 牵牽 犹猶 独獨 猎獵 猪豬 献獻 环環 现現 电電 画畫 疗療 疯瘋 盐鹽 盖蓋 盘盤 ' +
  '着著 确確 礼禮 祸禍 离離 种種 积積 称稱 稳穩 穷窮 竞競 笔筆 签簽 简簡 粮糧 紧緊 红紅 纪紀 约約 级級 纯純 纸紙 线線 练練 组組 细細 织織 终終 经經 结結 ' +
  '绕繞 绘繪 络絡 绝絕 统統 继繼 续續 维維 缘緣 编編 缓緩 罗羅 罚罰 职職 联聯 聪聰 肤膚 胆膽 胜勝 脏髒 脑腦 脚腳 脱脫 艺藝 节節 苏蘇 苹蘋 范範 荣榮 药藥 ' +
  '莲蓮 获獲 营營 蓝藍 虑慮 虽雖 补補 装裝 观觀 规規 视視 览覽 誉譽 训訓 议議 访訪 证證 评評 译譯 诚誠 询詢 详詳 误誤 诸諸 谊誼 谋謀 贝貝 负負 财財 责責 ' +
  '败敗 货貨 质質 贫貧 购購 贴貼 贵貴 费費 贺賀 资資 赏賞 赔賠 赖賴 赚賺 赛賽 赞讚 赠贈 赶趕 跃躍 践踐 轮輪 软軟 轻輕 载載 较較 辉輝 输輸 辞辭 达達 迈邁 ' +
  '运運 违違 连連 迟遲 适適 选選 递遞 遗遺 邮郵 邻鄰 释釋 针針 钟鐘 钢鋼 铁鐵 铃鈴 银銀 链鏈 锁鎖 锅鍋 错錯 锦錦 键鍵 镜鏡 闪閃 闭閉 闯闖 闲閒 闷悶 闹鬧 ' +
  '闻聞 阁閣 阅閱 队隊 阳陽 阴陰 阵陣 阶階 际際 陆陸 陈陳 险險 随隨 隐隱 难難 雾霧 页頁 顶頂 项項 顺順 须須 顾顧 顿頓 预預 领領 频頻 题題 颜顏 额額 风風 ' +
  '飞飛 饭飯 饮飲 饰飾 饱飽 饼餅 馆館 马馬 驱驅 驾駕 验驗 骑騎 骗騙 鱼魚 鲜鮮 鸟鳥 鸡雞 鸣鳴 麦麥 齐齊 龙龍 龟龜 欧歐 汇匯 晒曬 吃吃 叙敘';

const S2T = new Map<string, string>();
for (const pair of S2T_PAIRS.split(/\s+/)) {
  const [s, t] = Array.from(pair);
  if (s && t && s !== t) S2T.set(s, t);
}
/** 只出現在簡體中文的字（排除在正體中也合法的「里后发余范云叶」）。 */
const SIMPLIFIED_ONLY = new Set([...S2T.keys()].filter((c) => !'里后发余范云叶'.includes(c)));

export function toTraditional(text: string): string {
  let out = '';
  for (const ch of text) out += S2T.get(ch) ?? ch;
  return out;
}

const AI_SELF = /(?:\bAI\b|人工智慧|人工智能|語言模型|语言模型|助理|assistant|language model)/i;

export function isAcceptableReply(reply: string): boolean {
  const t = reply.trim();
  if (!t || Array.from(t).length > REPLY_MAX) return false;
  if (AI_SELF.test(t)) return false;
  for (const ch of t) if (SIMPLIFIED_ONLY.has(ch)) return false;
  const han = (t.match(/\p{Script=Han}/gu) ?? []).length;
  const latin = (t.match(/[A-Za-z]/g) ?? []).length;
  return han >= 1 && han / (han + latin) >= 0.7;
}

export const FALLBACK_REPLIES: string[] = [
  '（艾琳娜輕輕眨了眨眼）抱歉，我剛剛走神了……你可以再說一次嗎？',
  '嗯……（她望向窗外的天空）今天的風好舒服呢。',
  '（她微微一笑）你總是有很多話想說呢，我在聽。',
  '這句話讓我想了好一會兒……我們換個話題好嗎？',
  '（她撥了撥頭髮）府裡今天有點忙，不過能和你聊天，我很開心。',
];
