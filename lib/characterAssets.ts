// ============================================================
// AI 酒馆 - 原创二次元角色立绘与表情差分
// ============================================================

import type { CharacterPortraitConfig } from './types';

// 4 名原创角色完整配置 (包含 AI 绘图/建模 Prompt 与风格参数)
export const CHARACTER_PORTRAITS: Record<string, CharacterPortraitConfig> = {
  old_tom: {
    id: 'old_tom',
    name: '老汤姆',
    title: '酒馆老板兼 DM',
    avatarUrl: '/characters/old_tom.png?v=32',
    portraitUrl: '/characters/old_tom.png?v=32',
    themeColor: '#E6A85C', // 烛火金
    description: '银灰短发、蓄着修整得当短须的成熟前冒险者。眼神沉稳风趣，通晓大陆秘闻。',
    expressions: {
      normal: '温和沉稳',
      smile: '爽朗大笑',
      serious: '严肃警惕',
      surprised: '眉毛高挑/惊愕',
    },
    prompt: '1man, mature handsome fantasy tavern master, retired legendary adventurer, short silver-grey neat hair, neatly groomed short beard, warm amber-brown eyes, gentle confident smile, wearing dark brown leather vest over rolled-sleeve cream linen shirt, brass pocketwatch chain, high quality anime visual novel bust portrait, Fate Grand Order aesthetic, Genshin Impact lighting, crisp clean lines, detailed character art, 8k resolution, masterpiece.',
    promptZh: '1位成熟英俊的奇幻酒馆老板兼退役传奇冒险者，银灰色利落短发，修剪整齐的短胡须，温暖的琥珀棕色眼眸，温和自信的微笑，穿着深棕色皮马甲与卷袖米白亚麻衬衫，黄铜怀表链，背景为温暖壁炉火光与橡木桶的奇幻酒馆吧台，高质量二次元视觉小说半身立绘，型月/原神质感，精细线稿，大师级插画。',
    negativePrompt: 'lowres, bad anatomy, bad hands, text, error, extra digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name',
    modelTags: ['二次元 Galgame', '退役老兵', '成熟酒馆老板', '厚涂立绘', '暖金烛火'],
    voiceActor: '沉稳磁性大叔音 · 历经风霜且富幽默感',
  },
  eileen: {
    id: 'eileen',
    name: '艾琳',
    title: '酒馆看板娘 · 冒险接待员',
    avatarUrl: '/characters/eileen.png?v=32',
    portraitUrl: '/characters/eileen.png?v=32',
    themeColor: '#E27D60', // 暖珊瑚红
    description: '系着绿蝴蝶结的金发双马尾、明亮绿眼的开朗接待员。对冒险公会的委托与情报了如指掌。',
    expressions: {
      normal: '元气微笑',
      smile: '灿烂得意',
      serious: '认真思索',
      surprised: '掩嘴吃惊',
    },
    prompt: 'Cheerful adult fantasy tavern receptionist with blonde twin ponytails tied with forest-green bows, bright green eyes, a cream puff-sleeve blouse and emerald tavern uniform with a brown leather vest, polished anime visual novel illustration, soft warm tavern lighting.',
    promptZh: '开朗的成年奇幻酒馆接待员，金色双马尾系着深绿蝴蝶结，明亮的绿眼，身穿奶白泡袖衬衣、翡翠绿酒馆制服和棕色皮质背心。细腻的二次元视觉小说立绘，柔和温暖的酒馆灯光。',
    negativePrompt: 'lowres, bad anatomy, bad hands, extra digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, blurry',
    modelTags: ['二次元 Galgame', '元气', '金发双马尾', '绿蝴蝶结', '公会接待员'],
    voiceActor: '清脆元气少女音 · 热情洋溢具亲和力',
  },
  selene: {
    id: 'selene',
    name: '塞勒涅',
    title: '月影旅人 · 星象占卜师',
    avatarUrl: '/heroes/selene.webp',
    portraitUrl: '/heroes/selene.webp',
    themeColor: '#8296D8', // 月光星蓝
    description: '银蓝长发、尖耳、冷艳神秘的高等精灵法师。身披星辉斗篷，手中常握着星盘与古籍。',
    expressions: {
      normal: '清冷从容',
      smile: '浅笑微抿',
      serious: '冷峻凝视',
      surprised: '微睁星眸',
    },
    prompt: '1girl, ethereal high elf astrologer and lunar mage, glowing silver-blue long flowing hair, pointed elf ears, calm deep sapphire glowing eyes with star reflections, silver crescent moon hairpin, wearing midnight blue celestial starry velvet hooded cloak with glowing gold constellation runes embroidery, holding glowing crystal orb, high quality anime visual novel bust portrait, TYPE-MOON style, luminous details, masterpiece.',
    promptZh: '1位空灵冷艳的高等精灵星象占卜师兼月系法师，流淌微光的银蓝渐变长发，修长尖耳，深邃清冷散发微光的蓝宝石眼眸带星芒反光，银色新月发簪，身披缀满金色发光星座符文刺绣的午夜蓝天鹅绒兜帽斗篷，手捧微光水晶天球仪，高质量二次元视觉小说半身立绘，型月史诗质感，空灵星辉。',
    negativePrompt: 'lowres, bad anatomy, bad hands, extra digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, blurry',
    modelTags: ['二次元 Galgame', '高等精灵', '银蓝长发', '星象占卜师', '月光法师'],
    voiceActor: '清冷优雅御姐音 · 空灵神秘略带知性',
  },
  traveler: {
    id: 'traveler',
    name: '无名旅者',
    title: '新晋冒险者 (玩家角色)',
    avatarUrl: '/heroes/traveler.webp',
    portraitUrl: '/heroes/traveler.webp',
    themeColor: '#52B788', // 翡翠绿
    description: '身着轻便游侠皮甲与旅人深蓝风衣的年轻冒险者，眼神清澈而坚定，正踏上未知征程。',
    expressions: {
      normal: '坚定专注',
      smile: '自信从容',
      serious: '拔剑临战',
      surprised: '警惕震惊',
    },
    prompt: '1boy/1young man, handsome fantasy protagonist adventurer, dark swept hair with subtle green undertones, sharp determined emerald green eyes, confident heroic expression, wearing stylish ranger leather armor with deep navy blue traveler hooded cloak, silver winged cloak clasps, high quality anime visual novel bust portrait, modern JRPG aesthetic, sharp cinematic lighting, masterpiece illustration.',
    promptZh: '1位英俊的新晋冒险者主角，微带暗绿光泽的黑发，锐利坚毅的翡翠绿眼眸，自信从容的冒险者神态，穿着精制游侠皮甲与深蓝旅人连帽斗篷，银质飞翼搭扣，充满冒险史诗感氛围，高质量二次元视觉小说半身立绘，现代 JRPG 质感，清晰光影。',
    negativePrompt: 'lowres, bad anatomy, bad hands, extra digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, blurry',
    modelTags: ['二次元 Galgame', '玩家主角', '年轻冒险者', '游侠皮甲', '翡翠绿瞳'],
    voiceActor: '沉稳少年英气音 · 坚定果敢意气风发',
  },
  shadow_rogue: {
    id: 'shadow_rogue',
    name: '瓦尔特',
    title: '暗影游荡者 (玩家角色)',
    avatarUrl: '/heroes/human-rogue.webp',
    portraitUrl: '/heroes/human-rogue.webp',
    themeColor: '#E67E22', // 琥珀红橙
    description: '银发紫瞳、面带神秘微笑的暗影游荡者。擅长潜行、解锁机关与致命伏击。',
    expressions: {
      normal: '斜视戏谑',
      smile: '玩味坏笑',
      serious: '潜行警惕',
      surprised: '微愣拔刃',
    },
    prompt: '1boy/1young man, handsome fantasy rogue assassin, silver white sharp styled hair, mysterious glowing violet purple eyes, playful smirk expression, wearing dark leather rogue coat with hood and silver dagger straps, high quality anime visual novel bust portrait, Fate Stay Night assassin style, masterwork illustration.',
    promptZh: '1位英俊的奇幻暗影游荡者刺客，银白色凌厉短发，神秘散发紫光的眼眸，带有玩味坏笑的表情，穿着深色刺客皮衣与连帽带银匕首皮带，高质量二次元视觉小说半身立绘，精美插画。',
    negativePrompt: 'lowres, bad anatomy, bad hands, extra digits, cropped, worst quality, low quality, jpeg artifacts',
    modelTags: ['二次元 Galgame', '玩家主角', '暗影游荡者', '银发紫瞳'],
    voiceActor: '邪魅风趣青年音 · 游刃有余',
  },
  paladin_arthur: {
    id: 'paladin_arthur',
    name: '亚瑟',
    title: '圣殿骑士 (玩家角色)',
    avatarUrl: '/heroes/paladin_arthur.webp',
    portraitUrl: '/heroes/paladin_arthur.webp',
    themeColor: '#F1C40F', // 圣光金
    description: '金发蓝瞳、身披耀明精钢板甲的骑士团护卫。誓言守护同伴，心怀浩然正义。',
    expressions: {
      normal: '庄严端庄',
      smile: '温和包容',
      serious: '神圣誓言',
      surprised: '提盾震惊',
    },
    prompt: '1boy/1young man, handsome paladin knight hero, golden blonde hair, noble azure blue eyes, solemn righteous expression, wearing polished silver steel plate armor with golden holy sun emblem, blue cape with gold trim, high quality anime visual novel bust portrait, Fate Fate Grand Order saber style, heroic lighting, masterpiece illustration.',
    promptZh: '1位英俊的正义圣殿骑士英雄，金色辉煌短发，高贵蔚蓝眼眸，庄严虔诚的表情，身着耀亮银色钢板甲与金太阳徽记，蓝天鹅绒斗篷，高质量二次元视觉小说半身立绘，型月 Saber 风格，圣光氛围。',
    negativePrompt: 'lowres, bad anatomy, bad hands, extra digits, cropped, worst quality, low quality, jpeg artifacts',
    modelTags: ['二次元 Galgame', '玩家主角', '圣殿骑士', '金发蓝瞳'],
    voiceActor: '庄严高洁骑士音 · 正直坚定',
  },
};

/** 全表角色字典 (包含 DM 与玩家角色) */
export const ALL_CHARACTERS = Object.values(CHARACTER_PORTRAITS);

/** 仅供玩家在角色卡页面创建/选用的二次元主角形象 (去除了老汤姆与看板娘艾琳等 NPC) */
export const PLAYER_CHARACTERS = [
  CHARACTER_PORTRAITS.traveler,
  CHARACTER_PORTRAITS.selene,
  CHARACTER_PORTRAITS.shadow_rogue,
  CHARACTER_PORTRAITS.paladin_arthur,
];

/** 获取指定角色配置（安全回退至无名旅者） */
export function getCharacterConfig(id?: string): CharacterPortraitConfig {
  if (!id) return CHARACTER_PORTRAITS.traveler;
  return CHARACTER_PORTRAITS[id] || CHARACTER_PORTRAITS.traveler;
}

/** 官方 D&D 5e 规则角色预设属性表（包含 4 位玩家主角与 2 位酒馆 NPC） */
export const DND_CHARACTER_PRESETS: Record<string, {
  name: string;
  race: string;
  class: string;
  level: number;
  attributes: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  skills: { name: string; attribute: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'; proficient: boolean; bonus: number }[];
  hp: { current: number; max: number };
  ac: number;
  inventory: string[];
  spells: string[];
  backstory: string;
  notes: string;
  themeColor: string;
}> = {
  paladin_arthur: {
    name: '亚瑟·瓦伦丁',
    race: '人类',
    class: '圣骑士',
    level: 1,
    attributes: { str: 16, dex: 10, con: 15, int: 9, wis: 12, cha: 14 },
    skills: [
      { name: '运动', attribute: 'str', proficient: true, bonus: 2 },
      { name: '宗教', attribute: 'int', proficient: true, bonus: 2 },
      { name: '洞悉', attribute: 'wis', proficient: true, bonus: 2 },
      { name: '说服', attribute: 'cha', proficient: true, bonus: 2 },
      { name: '威吓', attribute: 'cha', proficient: true, bonus: 2 },
    ],
    hp: { current: 12, max: 12 },
    ac: 18,
    inventory: [
      '精炼钢长剑 (1d8/1d10 挥砍)',
      '圣光重盾 (+2 AC)',
      '精钢全身链甲',
      '白银太阳圣徽',
      '标准治疗药水 x2',
      '火把 x2',
      '冒险者行囊',
    ],
    spells: ['paladin-divine-smite'],
    backstory: '银白之冠骑士团的圣誓守护者，遵从光明与秩序的正义誓言，愿为守护无辜同伴挥剑斩断黑暗。',
    notes: '【圣疗术】拥有 5 点每日圣疗生命池；【神圣感知】可感知 60 尺内的天界生物、邪魔与不死生物。',
    themeColor: '#F1C40F',
  },
  selene: {
    name: '塞勒涅·苍月',
    race: '高等精灵',
    class: '法师',
    level: 1,
    attributes: { str: 8, dex: 14, con: 13, int: 17, wis: 14, cha: 10 },
    skills: [
      { name: '奥秘', attribute: 'int', proficient: true, bonus: 2 },
      { name: '历史', attribute: 'int', proficient: true, bonus: 2 },
      { name: '调查', attribute: 'int', proficient: true, bonus: 2 },
      { name: '察觉', attribute: 'wis', proficient: true, bonus: 2 },
      { name: '洞悉', attribute: 'wis', proficient: true, bonus: 2 },
    ],
    hp: { current: 7, max: 7 },
    ac: 12,
    inventory: [
      '星辉奥术法杖 (1d6 钝击/施法触媒)',
      '古怪刻印法术书',
      '天鹅绒星宿斗篷',
      '奥术成分袋',
      '法力微光药水 x2',
      '黄铜星盘与羽毛笔',
      '学者背包',
    ],
    spells: ['wizard-magic-missile', 'wizard-fireball'],
    backstory: '来自月影秘境的高等精灵占星法师，观测到大陆星轨的偏斜与古老暗影的复苏，踏入红尘追寻星辰启示。',
    notes: '【精灵血统】对魅惑豁免具有优势，免疫魔法睡眠；拥有 60 尺黑暗视觉；【奥术回想】短休可恢复 1 环法术位。',
    themeColor: '#8296D8',
  },
  shadow_rogue: {
    name: '瓦尔特·影武',
    race: '人类',
    class: '游荡者',
    level: 1,
    attributes: { str: 10, dex: 17, con: 13, int: 13, wis: 12, cha: 14 },
    skills: [
      { name: '隐匿', attribute: 'dex', proficient: true, bonus: 4 },
      { name: '巧手', attribute: 'dex', proficient: true, bonus: 4 },
      { name: '特技', attribute: 'dex', proficient: true, bonus: 2 },
      { name: '察觉', attribute: 'wis', proficient: true, bonus: 2 },
      { name: '欺瞒', attribute: 'cha', proficient: true, bonus: 2 },
      { name: '调查', attribute: 'int', proficient: true, bonus: 2 },
    ],
    hp: { current: 9, max: 9 },
    ac: 14,
    inventory: [
      '双生暗影短刃 (1d6 灵巧/轻型/穿刺)',
      '轻弩与弩矢 x20 (1d8 穿刺)',
      '盗贼精工开锁工具包',
      '暗影皮甲',
      '烟雾催泪弹 x2',
      '黑市密令通行证',
      '50尺丝质飞索与抓钩',
    ],
    spells: ['rogue-sneak-attack'],
    backstory: '穿梭于地下黑市与贵族阴影之间的独行游荡者，身法鬼魅，虽看似玩世不恭，却恪守着盗亦有道的生存准则。',
    notes: '【偷袭 (Sneak Attack)】对处于劣势或有盟友邻近的目标造成额外 1d6 伤害；【盗贼黑话】知晓地下隐秘暗号。',
    themeColor: '#E67E22',
  },
  traveler: {
    name: '无名旅者',
    race: '木精灵',
    class: '游侠',
    level: 1,
    attributes: { str: 11, dex: 17, con: 14, int: 10, wis: 15, cha: 9 },
    skills: [
      { name: '察觉', attribute: 'wis', proficient: true, bonus: 2 },
      { name: '生存', attribute: 'wis', proficient: true, bonus: 2 },
      { name: '隐匿', attribute: 'dex', proficient: true, bonus: 2 },
      { name: '自然', attribute: 'int', proficient: true, bonus: 2 },
      { name: '驯兽', attribute: 'wis', proficient: true, bonus: 2 },
      { name: '特技', attribute: 'dex', proficient: true, bonus: 2 },
    ],
    hp: { current: 12, max: 12 },
    ac: 15,
    inventory: [
      '复合精灵长弓 (1d8 穿刺/射程150/600)',
      '羽箭筒 (精制羽箭 x30)',
      '斥候近战短匕 (1d4 穿刺/灵巧)',
      '游侠镶嵌皮甲',
      '林地羊皮手绘地图',
      '燧石与打火石',
      '猎人行囊与干粮 x5',
    ],
    spells: ['ranger-precision-shot'],
    backstory: '独自行走于文明边缘与幽暗森林的新生代游侠，在翡翠之冠的废墟中拾得一把铭刻符文的长弓，踏上了追寻自身身世的旅程。',
    notes: '【宿敌】对异怪与不死生物的追踪检定具有优势；【自然探索者】在森林与野外地形中不会迷路且移动不受减速。',
    themeColor: '#52B788',
  },
  old_tom: {
    name: '老汤姆',
    race: '人类老兵',
    class: '战士 / 吟游诗人',
    level: 8,
    attributes: { str: 16, dex: 12, con: 16, int: 14, wis: 16, cha: 15 },
    skills: [
      { name: '历史', attribute: 'int', proficient: true, bonus: 3 },
      { name: '洞悉', attribute: 'wis', proficient: true, bonus: 3 },
      { name: '察觉', attribute: 'wis', proficient: true, bonus: 3 },
      { name: '说服', attribute: 'cha', proficient: true, bonus: 3 },
      { name: '运动', attribute: 'str', proficient: true, bonus: 3 },
      { name: '表演', attribute: 'cha', proficient: true, bonus: 3 },
    ],
    hp: { current: 68, max: 68 },
    ac: 15,
    inventory: [
      '传奇退役斩龙重剑 (2d6 挥砍)',
      '精钢酒桶开瓶器',
      '老汤姆特调矮人烈酒',
      '流浪者之憩账本与密闻笔记',
    ],
    spells: ['warrior-heavy-strike', 'warrior-second-wind', 'bard-vicious-mockery'],
    backstory: '曾在宝剑湾与幽暗地域闯下赫赫威名的前冒险团团长，如今在流浪者之憩担任掌柜兼跑团 DM，为每一位踏入酒馆的年轻冒险者指引方向。',
    notes: '【老兵气场】威压与鼓励兼备；【传奇 DM】熟知大陆一切神话与地牢秘闻。',
    themeColor: '#E6A85C',
  },
  eileen: {
    name: '艾琳',
    race: '半精灵',
    class: '吟游诗人 / 游侠',
    level: 3,
    attributes: { str: 9, dex: 15, con: 12, int: 13, wis: 13, cha: 17 },
    skills: [
      { name: '说服', attribute: 'cha', proficient: true, bonus: 2 },
      { name: '表演', attribute: 'cha', proficient: true, bonus: 2 },
      { name: '欺瞒', attribute: 'cha', proficient: true, bonus: 2 },
      { name: '巧手', attribute: 'dex', proficient: true, bonus: 2 },
      { name: '洞悉', attribute: 'wis', proficient: true, bonus: 2 },
      { name: '察觉', attribute: 'wis', proficient: true, bonus: 2 },
    ],
    hp: { current: 20, max: 20 },
    ac: 13,
    inventory: [
      '冒险公会任务名册',
      '速记羽毛笔与羊皮纸',
      '隐藏防身短匕 (1d4)',
      '元气应援铜铃',
      '治疗药草包 x2',
    ],
    spells: ['bard-vicious-mockery', 'cleric-healing-word'],
    backstory: '冒险者公会最年轻优秀的接待书记官，对每一张悬赏委托单的来龙去脉倒背如流，是流浪者之憩酒馆最受欢迎的元气招牌。',
    notes: '【元气应援】可给予队友 1d6 诗人激励骰；【公会博学】知晓所有赏金任务的情报与危险评级。',
    themeColor: '#E27D60',
  },
};

