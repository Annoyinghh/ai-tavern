// ============================================================
// AI 酒馆 - 剧本系统 (D&D 5e 史诗长篇篇章 + 预设剧本库)
// ============================================================

import { v4 as uuid } from 'uuid';
import type { ChapterReward, Script, ScriptChapter } from './types';
import { isChapterEncounter } from './combat/catalog';

function createChapter(title: string, content = ''): ScriptChapter {
  return { id: uuid(), title, content, choices: [] };
}

export function isChapterReward(value: unknown): value is ChapterReward {
  if (!value || typeof value !== 'object') return false;
  const { gold, items } = value as Partial<ChapterReward>;
  return typeof gold === 'number' && Number.isInteger(gold) && gold >= 0 && gold <= 10000
    && Array.isArray(items) && items.length <= 8
    && items.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= 80);
}

/** 创建空白剧本 */
export function createEmptyScript(title: string = '新剧本'): Script {
  const startChapter = createChapter('序章', '冒险从这里开始……');
  const startId = startChapter.id;

  return {
    id: uuid(),
    title,
    author: '我自己',
    description: '',
    genre: '奇幻',
    chapters: { [startId]: startChapter },
    startChapter: startId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** 添加章节 */
export function addChapter(script: Script, title: string = '新章节'): Script {
  const chapter = createChapter(title);

  return {
    ...script,
    chapters: { ...script.chapters, [chapter.id]: chapter },
    updatedAt: new Date().toISOString(),
  };
}

/** 更新章节 */
export function updateChapter(
  script: Script,
  chapterId: string,
  updates: Partial<ScriptChapter>
): Script {
  const chapter = script.chapters[chapterId];
  if (!chapter) return script;

  return {
    ...script,
    chapters: {
      ...script.chapters,
      [chapterId]: { ...chapter, ...updates },
    },
    updatedAt: new Date().toISOString(),
  };
}

/** 删除章节 */
export function deleteChapter(script: Script, chapterId: string): Script {
  if (chapterId === script.startChapter) return script; // 不能删起始章节

  const chaptersCopy = { ...script.chapters };
  delete chaptersCopy[chapterId];
  return {
    ...script,
    chapters: chaptersCopy,
    updatedAt: new Date().toISOString(),
  };
}

export type PresetKey = 'baldurs_gate' | 'dungeon' | 'mystery' | 'tavern' | 'eldritch' | 'cyberpunk';

// Presets build a fresh script and keep the generated IDs for wiring branches.
function addPresetChapter(script: Script, title: string): string {
  const chapter = createChapter(title);
  script.chapters[chapter.id] = chapter;
  return chapter.id;
}

/** 预设剧本模板 */
export function createPresetScript(preset: PresetKey): Script {
  const create = {
    baldurs_gate: createBaldursGatePreset, dungeon: createDungeonPreset, mystery: createMysteryPreset,
    tavern: createTavernPreset, eldritch: createEldritchPreset, cyberpunk: createCyberpunkPreset,
  }[preset];
  return { ...create(), backgroundProfile: preset };
}

/** 获取全部预设剧本集合 */
export function getDefaultScripts(): Script[] {
  return [
    createPresetScript('baldurs_gate'),
    createPresetScript('dungeon'),
    createPresetScript('mystery'),
    createPresetScript('eldritch'),
    createPresetScript('cyberpunk'),
    createPresetScript('tavern'),
  ];
}

/** 
 * 博德之门：至高主脑之降临 (D&D 5e 核心史诗巨型长篇剧本) 
 * 包含完整的 5 幕长篇、34 个精密互联章节、多分支抉择与 D20 DC 挑战！
 */
function createBaldursGatePreset(): Script {
  let s = createEmptyScript('博德之门：至高主脑降临');
  s.description = '龙与地下城 5e 费伦大陆史诗长篇：从阿弗纳斯地狱逃亡、剑湾荒野、翠绿林地、幽暗地域、月出之塔直至博德之门至高主脑决战！包含 34 个极度详尽的章节与四重结局！';
  s.genre = 'D&D 5e / 史诗长篇';

  // 1. 初始化全部 34 个章节 ID 节点
  const c0_1 = s.startChapter;

  const c0_2 = addPresetChapter(s, '序章·第二节：救赎暗影神官·星界三棱镜初鸣');

  const c0_3 = addPresetChapter(s, '序章·第三节：吉斯洋基利刃·莱埃泽尔的休战誓约');

  const c0_4 = addPresetChapter(s, '序章·第四节：螺壳舰舵室血战·指挥官扎尔克');

  const c0_5 = addPresetChapter(s, '序章·第五节：异界应答机跃迁·烈焰坠向剑湾');

  const c1_1 = addPresetChapter(s, '第一章·第一节：浪涛残骸·剑湾沙滩与影心重逢');

  const c1_2 = addPresetChapter(s, '第一章·第二节：草丛埋伏·白发盗贼阿斯代伦的匕首');

  const c1_3 = addPresetChapter(s, '第一章·第三节：失控古法阵·深水城法师盖尔');

  const c1_4 = addPresetChapter(s, '第一章·第四节：耶格苍白神殿·机关陷阱与盗墓贼');

  const c1_5 = addPresetChapter(s, '第一章·第五节：石棺启示·神秘守墓老人的灵魂追问');

  const c1_6 = addPresetChapter(s, '第一章·第六节：营地篝火长休·幼虫的心灵低语');

  const c2_1 = addPresetChapter(s, '第二章·第一节：林地大门围攻战·边境之刃威尔');

  const c2_2 = addPresetChapter(s, '第二章·第二节：空谷绝境·提夫林首领泽夫洛的求援');

  const c2_3 = addPresetChapter(s, '第二章·第三节：圣池阴谋·卡哈的暗影德鲁伊荆棘仪式');

  const c2_4 = addPresetChapter(s, '第二章·第四节：染疫村落伏击·食人魔三兄弟同盟契约');

  const c2_5 = addPresetChapter(s, '第二章·第五节：地精要塞·潜入破碎圣所');

  const c2_6 = addPresetChapter(s, '第二章·第六节：座狼兽栏·巨熊大德鲁伊哈尔辛破笼');

  const c2_7 = addPresetChapter(s, '第二章·第七节：蛛后信徒·真魂者明萨拉的宿命决断');

  const c2_8 = addPresetChapter(s, '第二章·第八节：林地庆典狂欢夜·星空誓约与篝火夜谈');

  const c3_1 = addPresetChapter(s, '第三章·第一节：幽暗地域·发光真菌与蕈人王国的请托');

  const c3_2 = addPresetChapter(s, '第三章·第二节：古代精金熔炉·岩浆巨像兵格瑞姆');

  const c3_3 = addPresetChapter(s, '第三章·第三节：暗影诅咒之地·终焉光芒旅店与月之庇护');

  const c3_4 = addPresetChapter(s, '第三章·第四节：月出之塔·死灵将军凯瑟里克与不死军团');

  const c3_5 = addPresetChapter(s, '第三章·第五节：塔底肉池·夺心魔殖民地与耐色石之秘');

  const c3_6 = addPresetChapter(s, '第三章·第六节：星界棱镜深处·揭示君主真实身份');

  const c4_1 = addPresetChapter(s, '第四章·第一节：踏入博德之门·钢铁卫士巡逻与暴政危机');

  const c4_2 = addPresetChapter(s, '第四章·第二节：精灵之歌酒馆·吟游诗人绝唱与地下作战本部');

  const c4_3 = addPresetChapter(s, '第四章·第三节：卡扎多尔宫殿·阿斯代伦的飞升与复仇');

  const c4_4 = addPresetChapter(s, '第四章·第四节：贡德工匠反抗军·爆破钢铁卫士铸造厂');

  const c4_5 = addPresetChapter(s, '第四章·第五节：耐色主脑冲破港湾·上城区灵能末日');

  const cEnd1 = addPresetChapter(s, '终章：剑湾传奇·博德之门的破晓');

  const cEnd2 = addPresetChapter(s, '终章：至高主脑·夺心帝国的新生');

  const cEnd3 = addPresetChapter(s, '终章：暗夜血王·阿斯代伦飞升血誓');

  const cEnd4 = addPresetChapter(s, '终章：星界隐修·成为永恒的牺牲守护者');

  // 2. 详细填入各个章节的内容与分支抉择
  s = updateChapter(s, c0_1, {
    title: '序章·第一节：阿弗纳斯之火·养殖舱苏醒与异化之虫',
    content: "你在夺心魔螺壳舰（Nautiloid）半透明的软骨肉质养殖舱中骤然苏醒。黏稠冰冷的生物营养液顺着你的额头与面颊滑落。透过舱壁的玻璃倒影，你目睹了一幕令灵魂战栗的噩梦：\n\n一条泛着妖异银紫色灵能光芒的夺心魔幼虫（Mind Flayer Tadpole）正在你的右眼眶中剧烈扭动，在刺骨的剧痛中彻底钻入了你的视神经深处！\n\n轰隆——！巨大的震爆将你震翻在舱内。透过破裂的生物外窗，外侧并非凡世的天空，而是九层地狱第一层——阿弗纳斯（Avernus）咆哮的红莲火海与滚烫岩浆！数骑驾驭着赤色巨龙的吉斯洋基红龙骑士正在追击巨舰，烈焰与地狱劣魔的利爪将螺壳舰撕裂出无数火洞！\n\n养殖舱的维生系统正在崩溃，你必须立刻脱困！",
    choices: [
      { text: "[力量 DC 14]运动检定：奋起全身力气，暴力锤爆养殖舱钢化玻璃", nextChapter: c0_2 },
      { text: "[智力 DC 13]奥秘检定：接入舱壁神经突触，反向引发灵能过载爆开舱门", nextChapter: c0_2 },
      { text: "[敏捷 DC 12]巧手检定：利用护甲上的金属搭扣撬开生物压力阀门", nextChapter: c0_2 },
    ],
    dcCheck: {
      attribute: 'str',
      skill: '运动',
      dc: 14,
      successChapter: c0_2,
      failureChapter: c0_2,
      dangerDamage: 2,
      outcomeText: {
        crit_success: '舱锁干净地脱开。你趁维生系统还在运转翻出养殖舱，避开了飞溅的营养液。',
        success: '舱门终于松开，你撑着湿滑的舱壁从养殖舱脱身。',
        failure: '主锁卡死，你改从震松的舱壁缝隙挤出去，擦过滚烫的舱框。',
        crit_failure: '第二次震爆撕裂舱壁，滚烫的液体涌进来。你在警报声中从裂口爬出。',
      },
    },
  });

  s = updateChapter(s, c0_2, {
    content: "你成功脱离养殖舱！在隔壁舱室中，一位身穿暗紫色暗影神官铠甲的半高精女性（影心 Shadowheart）正被困在另一个庞大的生物舱中。她死死抱抱着一枚泛着古老符文的黑铜色多面体三棱镜，焦急敲击舱壁。\n\n影心：“救救我！求你了！”",
    choices: [
      { text: "[奥秘 DC 14]调查舱旁符文控制台，按正确顺序激活解封神经元", nextChapter: c0_3 },
      { text: "[巧手 DC 13]用撬棍暴力砸开控制台盖板，强行断开锁死电极", nextChapter: c0_3 },
      { text: "无视救呼，任由影心被困，径直前往前线舱室（抛弃同伴）", nextChapter: 'AI_DYNAMIC' },
    ],
    dcCheck: {
      attribute: 'int',
      skill: '奥秘',
      dc: 14,
      successChapter: c0_3,
      failureChapter: c0_3,
      dangerDamage: 2,
      rewardItem: '失落的神圣三棱镜庇护',
      milestoneOnSuccess: '解救影心·获得星界三棱镜初鸣',
      outcomeText: {
        crit_success: '你稳住符文台，彻底切断束缚。影心带着三棱镜利落地跃出养殖舱。',
        success: '你断开锁死的电极，影心抱紧三棱镜，从松开的舱门脱身。',
        failure: '控制台没能解锁。舰体一震，舱门松动，影心从缝隙挣脱，你们绕过仍在放电的控制台。',
        crit_failure: '控制台冒烟，舱门卡在半开。你和影心合力挤过变形的门框，尖锐的警报已经响彻舱室。',
      },
    },
    clues: ['舱边的放电声随舰体震动起伏，震动间歇是通过这段走廊的最好时机。'],
  });

  s = updateChapter(s, c0_3, {
    content: "穿过燃烧的肉质通道，一位身披黄金精致板甲、手持九尺锯齿大剑的吉斯洋基女战士（莱埃泽尔 Lae'zel）从天而降，斩飞了一头地狱劣魔！\n\n她冷酷的黄褐色猫眼锁定你。\n\n莱埃泽尔：“异形！你也被植入了胚胎！在我们蜕变成夺心魔前，先随我杀向控制室！”",
    choices: [
      { text: "[魅力/游说 DC 12]“我们共同的敌人是夺心魔与地狱魔鬼，并肩作战才是唯一的活路”", nextChapter: c0_4 },
      { text: "[威吓/力量 DC 14]反手拔剑相对：“收起你的大剑，我可不是你的下属”", nextChapter: c0_4 },
      { text: "点头默许，紧随其后杀入主控舱", nextChapter: c0_4 },
    ],
    dcCheck: {
      attribute: 'cha',
      skill: '说服',
      dc: 12,
      successChapter: c0_4,
      failureChapter: c0_4,
      milestoneOnSuccess: '吉斯利刃·与莱埃泽尔缔结求生盟约',
    },
  });

  s = updateChapter(s, c0_4, {
    content: "你们推开庞大的括约肌神经巨门，踏入了螺壳舰舵室。坎比翁指挥官扎尔克正与夺心魔交战，两道身影在火光中撞向舱壁。控制台前，一只从破损舱体中钻出的畸变体转向你们。\n\n莱埃泽尔：“它挡在转导线前。把路清出来！”",
    encounter: { title: '螺壳舰舵室 · 抢通控制台', enemyKind: 'aberration', count: 1,
      aftermath: '畸变体倒下，控制台前露出一条空隙。火光越过舵窗，转导线仍在有规律地收缩。\n\n莱埃泽尔：“现在！接上转导线！”' },
    choices: [
      { text: "[智力 DC 12]连接转导线，启动螺壳舰星界跃迁", nextChapter: c0_5 },
    ],
    dcCheck: {
      attribute: 'int',
      skill: '奥秘',
      dc: 12,
      successChapter: c0_5,
      failureChapter: c0_5,
    },
  });

  s = updateChapter(s, c0_5, {
    content: "在最后一秒，你纵身一跃抓住了异次元神经变位器的两根发光触须！\n\n嗡——！整艘螺壳舰爆发出刺目的白光，空间如镜面般剧烈碎裂。九层地狱阿弗纳斯的炽热烈焰骤然消失，取而代之的是费伦大陆上空狂暴的暴风雨！巨舰在重力拉扯下断成数截，裹挟着冲天烈焰，如流星般狠狠砸向剑湾荒野海岸……",
    choices: [
      { text: "抱紧身旁的同伴与遗物，迎接毁灭性的撞击", nextChapter: c1_1 },
    ],
  });

  s = updateChapter(s, c1_1, {
    content: "咸涩冰冷的海浪一遍遍冲刷着你的面颊。你咳出喉咙里的海水，发现自己躺在剑湾（Sword Coast）金色的海滩上。不远处，螺壳舰庞大的残骸正燃烧着紫色的烟雾。\n\n几步之外，暗影神官影心正昏迷在湿润的沙滩上，双手依然死死抱着那枚多面体星界三棱镜。",
    choices: [
      { text: "[医药/感知 DC 10]检查影心的伤势并递上一壶清水扶她起来", nextChapter: c1_2 },
      { text: "[奥秘/智力 DC 14]探查星界三棱镜表面的神圣与灵能双重符文律动", nextChapter: c1_2 },
      { text: "搜索沙滩上的散落补给箱，收集药水与防身短剑", nextChapter: c1_2 },
    ],
    dcCheck: {
      attribute: 'wis',
      skill: '医药',
      dc: 10,
      successChapter: c1_2,
      failureChapter: c1_2,
    },
  });

  s = updateChapter(s, c1_2, {
    content: "沿着悬崖边的林间小径前进，在灌木丛后方，一名身着华丽褶边刺绣衬衫、拥有一头银白色卷发的高等精灵正焦急呼救。\n\n阿斯代伦：“喂！请帮帮我！那里有一头可怕的怪物！亲爱的。”\n\n他优雅而带着戏谑的声音中透着杀气。此时，你敏锐察觉到了他唇角若隐若现的尖牙！",
    choices: [
      { text: "[说服/魅力 DC 13]通过幼虫心灵共鸣向他展示螺壳舰同难者的记忆", nextChapter: c1_3 },
      { text: "[特技/敏捷 DC 15]反手扣住他的手腕，一个凌空过肩摔制伏匕首", nextChapter: c1_3 },
      { text: "[威吓/力量 DC 14]拔出兵刃直接将其刺伤并驱逐（拒绝阿斯代伦入队）", nextChapter: 'AI_DYNAMIC' },
    ],
    dcCheck: {
      attribute: 'cha',
      skill: '说服',
      dc: 13,
      successChapter: c1_3,
      failureChapter: c1_3,
    },
  });

  s = updateChapter(s, c1_3, {
    content: "解除误会后阿斯代伦加入了队伍。前方路旁的一处古代崖壁石刻上传来噼啪作响的紫色奥术电弧，一个古代传送法阵正在剧烈紊乱，虚空裂隙中竟然伸出了一只人类的手在空中胡乱挥舞！\n\n盖尔：“咳咳！外面的过路英雄！能不能拉一把？这里的空间折跃矩阵出现了一点小小的……意外偏差！”\n\n一个充满深水城博学学者口吻的声音从岩石内部传来。",
    choices: [
      { text: "[运动/力量 DC 13]抓住他的手臂，双脚蹬住岩石，一口气将法师盖尔拽出裂隙", nextChapter: c1_4 },
      { text: "[奥秘/智力 DC 14]念动解构咒语，逆转传送法阵的魔网乱流", nextChapter: c1_4 },
      { text: "谨慎拔出兵器，确认不是异怪或变形怪伪装后再行施救", nextChapter: c1_4 },
    ],
    dcCheck: {
      attribute: 'str',
      skill: '运动',
      dc: 13,
      successChapter: c1_4,
      failureChapter: c1_4,
    },
  });

  s = updateChapter(s, c1_4, {
    content: "深水城法师盖尔（Gale）优雅致谢并入队。队伍来到了一座隐秘的古老悬崖遗迹——远古死亡与终结之神「耶格」（Jergal）的湿滑地宫。\n\n昏暗的神殿内，一伙全副武装的强盗盗墓贼正在试图撬开沉重的石门。地面上刻画着古老的喷火孔陷阱，中央供奉着一尊手持羊皮纸与天平的古神雕像。空气中弥漫着尘封数千年的死寂。",
    choices: [
      { text: "[巧手/敏捷 DC 14]悄无声息拆除地面喷火孔引线，抢先发动暗影突袭", nextChapter: c1_5 },
      { text: "[欺瞒/魅力 DC 13]假冒至高神教的高阶审判官，以神威吓退盗墓贼", nextChapter: c1_5 },
      { text: "[历史/智力 DC 12]研读耶格祭坛上的古代耐色瑞尔文字，寻找密室暗门机关", nextChapter: c1_5 },
    ],
    dcCheck: {
      attribute: 'dex',
      skill: '巧手',
      dc: 14,
      successChapter: c1_5,
      failureChapter: c1_5,
    },
  });

  s = updateChapter(s, c1_5, {
    content: "击退盗墓贼后，神殿最深处的沉重石棺发出低沉的轰鸣缓缓移开。漫天灰尘中，一位身穿古朴长袍、头戴黄金骨饰面具的枯槁老者（守墓老人 Withers）自棺中缓缓站起。\n\n他空洞而深邃的眼窝注视着你，声音如同来自冥河彼岸的寒风：\n\n守墓老人：“正如预言所昭示……回答我，凡人：一条生命的价值，究竟几何？”",
    choices: [
      { text: "[魅力/游说 DC 14]“生命无价，每一个凡人灵魂都有其不可剥夺的尊严”", nextChapter: c1_6 },
      { text: "[感知/洞悉 DC 13]“生命的价值在于其在既定命运中所作出的抉择与抗争”", nextChapter: c1_6 },
      { text: "“取决于他在世间能为我带来多少利益与力量”", nextChapter: c1_6 },
    ],
    dcCheck: {
      attribute: 'wis',
      skill: '洞悉',
      dc: 13,
      successChapter: c1_6,
      failureChapter: c1_6,
    },
  });

  s = updateChapter(s, c1_6, {
    content: "守墓老人微微点头。\n\n守墓老人：“记录已定。在未来的长路上，当你需要唤醒逝去的同伴时，我将在营地等候。”\n\n夜幕低垂，你们在海湾森林空地上升起篝火。长休之际，万籁俱寂。当你闭上双眼沉入梦乡，脑海中的幼虫突然泛起温暖如阳光般的灵能潮汐。\n\n在星界迷雾的梦境中，一位神秘而威严的“梦境守护者”向你现身。\n\n梦境守护者：“不要抗拒体内的异变。黑暗的大军已在剑湾集结，唯有掌控这股力量，你才能成为救世之人……”",
    choices: [
      { text: "[感知 DC 14]意志豁免：坚守本心，在脑海中筑起精神屏障戒备诱惑", nextChapter: c2_1 },
      { text: "[智力 DC 13]奥秘求索：尝试向守护者探询耐色瑞尔古魔法与主脑之谜", nextChapter: c2_1 },
    ],
    dcCheck: {
      attribute: 'wis',
      skill: '洞悉',
      dc: 14,
      successChapter: c2_1,
      failureChapter: c2_1,
    },
  });

  s = updateChapter(s, c2_1, {
    content: "清晨，队伍抵达山谷入口「翠绿林地」（Emerald Grove）。凄厉的警报号角骤然撕破宁静！数十头全副武装的地精斥候、凶暴座狼与熊地精正在强攻林地木门！\n\n威尔：“为了受苦之人！”\n\n伴随着一声清啸，一位手持精钢细剑、身手宛若飞燕的人类游侠从悬崖飞跃斩落敌将。\n\n威尔：“「边境之刃」威尔（Wyll）在此，邪祟受死！”",
    choices: [
      { text: "[力量 DC 14]运动检定：冲上要塞城墙推下巨型滚石，阻断座狼冲锋梯", nextChapter: c2_2 },
      { text: "[敏捷 DC 13]射击检定：在百步之外精准射杀后方指挥攻城的地精巫师", nextChapter: c2_2 },
      { text: "[施法 DC 14]范围轰炸：吟唱火焰法术轰击地精阵列，配合威尔肃清残敌", nextChapter: c2_2 },
    ],
    dcCheck: {
      attribute: 'str',
      skill: '运动',
      dc: 14,
      successChapter: c2_2,
      failureChapter: c2_2,
    },
  });

  s = updateChapter(s, c2_2, {
    content: "全歼攻城地精后，你们走入林地内谷。数百名头生双角、拖家带口的提夫林难民挤在狭窄的岩洞中。难民领袖泽夫洛（Zevlor）满面愁容地迎上来：\n\n泽夫洛：“恩人！林地的德鲁伊们要举行封锁仪式把我们驱逐出去！外面全是至高神教的地精大军，如果不能救回被俘虏的大德鲁伊哈尔辛（Halsin），我们所有人都会死！”",
    choices: [
      { text: "[魅力 DC 13]说服检定：答应泽夫洛的恳求，承诺铲除地精三大统帅救回哈尔辛", nextChapter: c2_3 },
      { text: "[感知 DC 12]洞悉检定：深入询问德鲁伊内部突然变得冷血排外的真正隐情", nextChapter: c2_3 },
    ],
    dcCheck: {
      attribute: 'cha',
      skill: '说服',
      dc: 13,
      successChapter: c2_3,
      failureChapter: c2_3,
    },
  });

  s = updateChapter(s, c2_3, {
    content: "你们潜入林地深处圣池。代代理大德鲁伊卡哈（Kagha）眼神冰冷，正高声督导德鲁伊们吟唱「荆棘封印仪式」。\n\n在圣池后方的书房阴暗密室中，你翻出了一封隐藏在沼泽木盒里的密信——卡哈竟然早已投靠了致力于毁灭一切文明的“暗影德鲁伊”（Shadow Druids）！",
    choices: [
      { text: "[魅力 DC 14]揭发罪证：在全体德鲁伊面前当众痛斥卡哈的叛逆背叛，当场将她击杀", nextChapter: c2_4 },
      { text: "[说服 DC 15]劝谏挽救：唤醒卡哈最初守护自然的本心，劝她当众悔过断绝暗影契约", nextChapter: c2_4 },
      { text: "[暗影路线]与卡哈同流合污，完成荆棘仪式将所有难民驱逐甚至屠杀", nextChapter: 'AI_DYNAMIC' },
    ],
    dcCheck: {
      attribute: 'cha',
      skill: '说服',
      dc: 14,
      successChapter: c2_4,
      failureChapter: c2_4,
    },
  });

  s = updateChapter(s, c2_4, {
    content: "解决林地危机后，队伍向西挺进，来到了被地精强盗洗劫一空的「染疫村落」。古老破败的风车前，三个庞大臃肿、散发着恶臭的食人魔正围在篝火旁大啖烤肉。\n\n食人魔首领「开悟者卢姆」佩戴着充满智慧光辉的知识头带，口吐优雅的通用语。\n\n开悟者卢姆：“啊，新鲜美味的凡人……你是想成为我们的餐后甜点，还是想聘请我们作为雇佣兵？”",
    choices: [
      { text: "[欺瞒 DC 14]凭借高超口才伪装成真魂者使者，空手套白狼招募食人魔三兄弟", nextChapter: c2_5 },
      { text: "[力量 DC 15]拔剑斩杀食人魔首领，夺取他头上的「开悟食人魔头带」", nextChapter: c2_5 },
    ],
    dcCheck: {
      attribute: 'cha',
      skill: '欺瞒',
      dc: 14,
      successChapter: c2_5,
      failureChapter: c2_5,
    },
  });

  s = updateChapter(s, c2_5, {
    content: "深入地精大本营「破碎圣所」。宏伟的复仇之神废墟遗迹中，数以百计的地精正在围着篝火狂饮麦酒、跳着荒诞的舞蹈。强悍的大地精罗刹与地精女祭司格特正在神殿深处审讯俘虏。",
    choices: [
      { text: "[隐匿 DC 15]从悬崖暗道潜入地牢兽栏，优先营救大德鲁伊哈尔辛", nextChapter: c2_6 },
      { text: "[欺瞒 DC 13]伪装成至高神教狂信徒，堂而皇之地走入指挥本部", nextChapter: c2_6 },
    ],
    dcCheck: {
      attribute: 'dex',
      skill: '隐匿',
      dc: 15,
      successChapter: c2_6,
      failureChapter: c2_6,
    },
  });

  s = updateChapter(s, c2_6, {
    content: "在臭气熏天的座狼兽栏深处，一头体型如象般巨大的巨熊正用锋利的巨爪撕碎铁笼！随着一阵璀璨的绿色自然法术微光，巨熊褪去形态，化作了一位高大魁梧、气宇轩昂的大德鲁伊哈尔辛（Halsin）！\n\n他抹去脸上的血迹。\n\n哈尔辛：“勇敢的冒险者！随我杀出去，彻底肃清这群污浊的地精魔头！”",
    choices: [
      { text: "[战斗/力量 DC 15]与大德鲁伊哈尔辛并肩作战，将座狼与地精守卫全数剿灭", nextChapter: c2_7 },
    ],
    dcCheck: {
      attribute: 'str',
      skill: '运动',
      dc: 15,
      successChapter: c2_7,
      failureChapter: c2_7,
    },
  });

  s = updateChapter(s, c2_7, {
    content: "在要塞最核心的祭坛前，你们终于直面了第三位真魂者——冷艳而致命的卓尔圣武士「明萨拉」（Minthara）。她身披暗色金属战甲，猩红的眸子中流露出狂热的杀意。\n\n明萨拉：“至高神教的敌人……唯有献祭你们的鲜血，才能平息神灵的怒火！”",
    choices: [
      { text: "[力量 DC 16]决战明萨拉：斩杀卓尔战圣，彻底解除翠绿林地的覆灭危机", nextChapter: c2_8 },
      { text: "[魅力 DC 15]佯装投靠：诱骗明萨拉率军进攻林地，在伏击圈中关门打狗", nextChapter: c2_8 },
      { text: "[背叛路线]向明萨拉奉上林地布防图，引大军血洗林地（踏上黑暗真魂者之路）", nextChapter: 'AI_DYNAMIC' },
    ],
    dcCheck: {
      attribute: 'str',
      skill: '运动',
      dc: 16,
      successChapter: c2_8,
      failureChapter: c2_8,
    },
  });

  s = updateChapter(s, c2_8, {
    content: "首领被消灭，地精大军瓦解！你们回到了翠绿林地，整个村落化为了欢庆的海洋！提夫林难民们在夜空下弹奏着手风琴，篝火烤肉与麦酒的香气弥漫全场。\n\n影心、阿斯代伦、盖尔、威尔与哈尔辛围坐在篝火旁向你举杯欢呼。漫天繁星洒下璀璨的月光，属于你们的传奇序章在这一刻达到了高潮……",
    choices: [
      { text: "向同伴举杯，踏上通往博德之门与幽暗地域的传奇长路", nextChapter: c3_1 },
    ],
  });

  s = updateChapter(s, c3_1, {
    content: "乘古老升降机降入万丈深渊——波澜壮阔的「幽暗地域」（The Underdark）展现在眼前！巨大幽蓝的荧光真菌如森林般繁茂。巨大的蕈人王斯鲍（Sovereign Spaw）释放出心灵孢子连接了你的神识：\n\n斯鲍：“异邦的旅行者，灰矮人奴隶主屠戮了菌落。为我们复仇，母树将赐予你暗影视界与通向千年前失落「精金熔炉」的古老钥匙。”",
    choices: [
      { text: "[感知 DC 14]自然检定：吸收蕈人王的共生孢子，获得幽暗地域全黑视界强化", nextChapter: c3_2 },
      { text: "[敏捷 DC 15]潜行突袭：利用幽暗掩护潜行刺杀灰矮人督军葛法", nextChapter: c3_2 },
      { text: "[魅力 DC 13]策反交涉：说服受压迫的灰矮人矿工发动暴动反抗奴隶主", nextChapter: c3_2 },
    ],
    dcCheck: {
      attribute: 'wis',
      skill: '自然',
      dc: 14,
      successChapter: c3_2,
      failureChapter: c3_2,
    },
  });

  s = updateChapter(s, c3_2, {
    content: "穿过幽暗湖泊，你们踏入了千年前矮人建造的传奇「精金熔炉」（Adamantine Forge）。当你将矿石放入坩埚并拉动重锤巨阀时，滚烫耀眼的岩浆瞬间注满铁砧！\n\n轰隆！一尊高达五丈、浑身由不朽精金打造的古老守护巨神「格瑞姆」（Grym）从沸腾的岩浆瀑布中站起，震耳欲聋的重步令整个地下神殿摇摇欲坠！",
    choices: [
      { text: "[智力 DC 15]战术布局：引诱巨像站上熔炉中央砧台，拉动数万斤锻造重锤一击重创", nextChapter: c3_3 },
      { text: "[力量 DC 16]正面硬撼：利用重型战锤猛击魔像被岩浆加热软化的核心弱点", nextChapter: c3_3 },
      { text: "[敏捷 DC 14]特技走位：在滚烫浮石间灵巧跳跃，吸引仇恨保护后排法师输出", nextChapter: c3_3 },
    ],
    dcCheck: {
      attribute: 'int',
      skill: '调查',
      dc: 15,
      successChapter: c3_3,
      failureChapter: c3_3,
    },
  });

  s = updateChapter(s, c3_3, {
    content: "锻造出精金神装后，你们重返地表，踏入了被数百年死灵浓雾吞噬的「暗影诅咒之地」。任何火把都会被黑暗瞬间吞噬。在湖心废墟中，「终焉光芒旅店」正散发着纯洁神圣的银色月光——\n\n塞伦涅月之祭司伊索贝尔（Isobel）正以一人之力维持着巨大的神圣结界，庇护着贾希拉（Jaheira）率领的竖琴手同盟最后的力量！",
    choices: [
      { text: "[智力 DC 14]宗教检定：接受伊索贝尔的塞伦涅月光神圣祝福，获得免受深度诅咒护盾", nextChapter: c3_4 },
      { text: "[感知 DC 15]洞悉察觉：敏锐识破潜伏在旅店中的至高神教内鬼翼龙刺客并击杀之", nextChapter: c3_4 },
      { text: "[巧手 DC 14]捕捉并解救被囚禁在提灯中的月精灵，制作永恒暗影行者提灯", nextChapter: c3_4 },
    ],
    dcCheck: {
      attribute: 'int',
      skill: '宗教',
      dc: 14,
      successChapter: c3_4,
      failureChapter: c3_4,
    },
  });

  s = updateChapter(s, c3_4, {
    content: "在竖琴手联军的掩护下，你们潜入了至高神教的军事要塞「月出之塔」（Moonrise Towers）。\n\n王座之上，曾经的圣武士、如今投向死神米尔寇的死灵将军「凯瑟里克·索姆」（Ketheric Thorm）冷酷俯瞰着世人。令人骇然的是，无论神圣巨剑如何刺穿他的胸膛，他由暗夜之歌提供的不死之身都能在黑雾中瞬间复原！",
    choices: [
      { text: "[敏捷 DC 16]潜行渗透：潜入塔顶暗影牢狱，寻找斩断凯瑟里克不死神力的关键羁绊", nextChapter: c3_5 },
      { text: "[魅力 DC 15]伪装斡旋：以高阶真魂者特使身份探听至高神教核心三大耐色石的情报", nextChapter: c3_5 },
      { text: "[投诚路线]臣服于索姆将军，交出星界三棱镜宣誓效忠死神米尔寇", nextChapter: 'AI_DYNAMIC' },
    ],
    dcCheck: {
      attribute: 'dex',
      skill: '隐匿',
      dc: 16,
      successChapter: c3_5,
      failureChapter: c3_5,
    },
  });

  s = updateChapter(s, c3_5, {
    content: "随着凯瑟里克败退，你们跃入月出之塔底部的深渊，坠入了令人毛骨悚然的庞大夺心魔殖民地！无数血肉囊泡与幼虫池沸腾。\n\n在核心祭坛前，三位神选者（索姆、戈塔什、奥林）正手持「耐色王冠控制石」，操控着宛若浮岛般巨大的至高主脑（The Netherbrain）！他们企图用心灵网络将全费伦的人类统统转化为夺心魔奴隶！",
    choices: [
      { text: "[智力 DC 16]奥秘检定：解析耐色石对主脑的魔网禁锢符文，寻找夺取控制权的核心契机", nextChapter: c3_6 },
      { text: "[敏捷 DC 15]潜行突袭：趁三巨头产生内讧裂隙，暗中救出被囚禁在生化肉舱的同伴", nextChapter: c3_6 },
      { text: "[感知 DC 15]意志抗衡：顶住至高主脑席卷而来的百万级心灵震爆冲击波", nextChapter: c3_6 },
    ],
    dcCheck: {
      attribute: 'int',
      skill: '奥秘',
      dc: 16,
      successChapter: c3_6,
      failureChapter: c3_6,
    },
  });

  s = updateChapter(s, c3_6, {
    content: "空间剧烈扭曲！在主脑的反噬下，星界三棱镜将你强行吸入了悬浮在虚空中的深层星界！\n\n在破碎的精金神殿内，一直以幻象指引你的“梦境守护者”终于褪去了伪装——他竟然是一位身披华贵法袍、目光深邃且拥有完全独立意志的夺心魔「君主」（The Emperor）！而在他脚下的灵能锁链中，囚禁着的正是吉斯洋基的传奇救世王子「奥菲斯」（Prince Orpheus）！",
    choices: [
      { text: "[感知 DC 15]洞悉检定：认同君主共同对抗主脑的生存契约，维持至关重要的星界同盟", nextChapter: c4_1 },
      { text: "[智力 DC 16]历史求索：质问他作为博德之门传奇缔造者博德安的过往", nextChapter: c4_1 },
      { text: "拔剑质问他为何要囚禁吉斯洋基王子，誓要寻找两全其美的解放之路", nextChapter: c4_1 },
    ],
    dcCheck: {
      attribute: 'wis',
      skill: '洞悉',
      dc: 15,
      successChapter: c4_1,
      failureChapter: c4_1,
    },
  });

  s = updateChapter(s, c4_1, {
    content: "走出漫长阴暗的地下通道，波澜壮阔、宏伟繁华的传奇都市「博德之门」（Baldur's Gate）终于出现在眼前！\n\n然而，青石板铺就的下城区街道上笼罩着前所未有的暴政阴霾：高大沉重的「钢铁卫士」（Steel Watchers）机甲迈着轰鸣的步伐巡逻，独裁执政官戈塔什正在飞龙关加冕，巴尔的刺客在暗巷中制造连环血案，幼虫寄生者的恐慌蔓延至每一个角落。",
    choices: [
      { text: "[欺瞒/魅力 DC 14]伪装成行商队伍，巧妙避开城门钢铁卫士的奥术魔眼扫描", nextChapter: c4_2 },
      { text: "[调查/智力 DC 14]追查下水道血迹，寻找巴尔谋杀裁判所与刺客首领奥林的据点", nextChapter: c4_2 },
      { text: "[敏捷 DC 13]顺着房顶与暗巷穿行，直奔下城区核心据点", nextChapter: c4_2 },
    ],
    dcCheck: {
      attribute: 'int',
      skill: '调查',
      dc: 14,
      successChapter: c4_2,
      failureChapter: c4_2,
    },
  });

  s = updateChapter(s, c4_2, {
    content: "你们来到了下城区闻名遐迩的「精灵之歌酒馆」（Elfsong Tavern）。空灵哀婉的精灵歌声在温暖的壁炉与麦酒香气中回荡。\n\n你们租下了整个宽敞的地下室作为大决战的反抗军指挥本部。三大耐色石的最终战役目标已经明确：铲除飞升吸血鬼卡扎多尔、炸毁钢铁卫士铸造厂、汇聚全城联军直面至高主脑！",
    choices: [
      { text: "[个人宿命]前往上城区卡扎多尔宫殿，帮助阿斯代伦了结两百年的血仇与飞升仪式", nextChapter: c4_3 },
      { text: "[战略瘫痪]潜入下城区海港铸造厂，彻底瘫痪全城所有钢铁卫士魔导机甲", nextChapter: c4_4 },
      { text: "[决战冲锋]集结全部同盟军团与耐色石，直接向主脑据点发起总攻", nextChapter: c4_5 },
    ],
  });

  s = updateChapter(s, c4_3, {
    content: "踏入阴森奢华的卡扎多尔吸血鬼地下宫殿。黑曜石祭坛上，七千名被奴役的吸血鬼衍体被锁在巨大的鲜血法阵中！卡扎多尔狂笑着准备完成「飞升仪式」。\n\n阿斯代伦双眼猩红，将匕首狠狠刺入卡扎多尔胸膛！面对七千亡魂的庞大力量，阿斯代伦浑身颤抖地望向你。\n\n阿斯代伦：“我可以完成仪式……成为不受阳光束缚的真正神明！帮我，还是阻止我？”",
    choices: [
      { text: "[魅力 DC 17]说服检定：唤醒阿斯代伦心中的良知与羁绊，劝他放弃血祭，成为真正自由的英雄", nextChapter: c4_4 },
      { text: "[奥秘 DC 15]协助刻画飞升符文，助阿斯代伦登临「日行吸血鬼真祖」王座", nextChapter: c4_4 },
      { text: "[力量 DC 16]一剑刺穿卡扎多尔心脏，释放七千无辜衍体进入幽暗地域", nextChapter: c4_4 },
    ],
    dcCheck: {
      attribute: 'cha',
      skill: '说服',
      dc: 17,
      successChapter: c4_4,
      failureChapter: c4_4,
    },
  });

  s = updateChapter(s, c4_4, {
    content: "潜入重兵把守的钢铁卫士铸造厂。盲眼的贡德侏儒工匠们在绝望中被迫制造机甲。你们获取了古代鲁尼克符文炸弹，中央控制室中高达数十丈的「钢铁卫士泰坦巨神」正在充能苏醒！",
    choices: [
      { text: "[敏捷 DC 16]巧手检定：在泰坦锁定前将符文炸弹精准嵌入反应堆核心并全员撤离", nextChapter: c4_5 },
      { text: "[力量 DC 17]近战硬撼：正面斩杀泰坦巨神机甲，掩护所有侏儒工匠平安逃离", nextChapter: c4_5 },
      { text: "[智力 DC 15]黑客协议：重写中枢控制矩阵，令全城钢铁卫士机甲集体当场自毁", nextChapter: c4_5 },
    ],
    dcCheck: {
      attribute: 'dex',
      skill: '巧手',
      dc: 16,
      successChapter: c4_5,
      failureChapter: c4_5,
    },
  });

  s = updateChapter(s, c4_5, {
    content: "轰隆————！耐色王冠的力量彻底挣脱了束缚！\n\n博德之门港湾激起滔天狂澜，「至高耐色主脑」冲破海面，升入高空。你带队登上它的脊梁，脚下不断传来灵能震动。两只畸变体从骨刺后现身，堵住通往王冠的脊道。\n\n耐色主脑：“渺小的凡人！在绝对的耐色王冠面前跪拜吧！”",
    encounter: { title: '耐色主脑 · 王冠防线', enemyKind: 'aberration', count: 2,
      aftermath: '灵能守卫倒下，脊道尽头的耐色王冠显露在眼前。港湾在脚下翻涌，王冠仍连着主脑。你们只有一次决定如何处置它的机会。' },
    choices: [
      { text: "[感知 DC 18]极道意志：以凡人之躯统领全军突破灵能风暴，一剑刺穿耐色王冠！", nextChapter: cEnd1 },
      { text: "[智力 DC 18]灵能奴役：背刺所有人，用三颗耐色石强行奴役主脑，建立夺心帝国！", nextChapter: cEnd2 },
      { text: "[魅力 DC 17]血王降临：唤醒阿斯代伦飞升血族军团发动暗夜狂潮，掌控博德之门！", nextChapter: cEnd3 },
      { text: "[体质 DC 18]自我牺牲：为了打破主脑的绝对神力防御，毅然选择化身夺心魔英雄！", nextChapter: cEnd4 },
    ],
    dcCheck: {
      attribute: 'wis',
      skill: '洞悉',
      dc: 18,
      successChapter: cEnd1,
      failureChapter: cEnd2,
    },
  });

  s = updateChapter(s, cEnd1, {
    content: "你的意志坚逾精金！在伙伴们舍生忘死的掩护下，你顶住狂暴的精神震爆，将附魔神兵深深刺入了耐色主脑的核心中枢！\n\n轰然巨响中，耐色王冠崩解成无数金色碎片，庞大的主脑轰然坠入海湾深渊，全城的夺心魔幼虫瞬间灰飞烟灭！\n\n破晓的万丈朝阳穿透硝烟，温柔地洒在博德之门的古老城墙上。提夫林的孩子在欢笑，竖琴手的高歌响彻街巷。影心、阿斯代伦、盖尔、威尔与哈尔辛微笑着向你举杯。\n\n🏆 **【剑湾传奇·博德之门的救赎】**\n你拯救了博德之门与整个费伦大陆！你的传奇将被吟游诗人们世代传唱，永载史册！",
    choices: [
      { text: "🏆 【全剧终】在酒馆里与伙伴们共饮庆功酒（开启 AI 动态后日谈）", nextChapter: "AI_DYNAMIC" },
      { text: "🔄 【重温史诗】重新开始《博德之门：至高主脑降临》", nextChapter: c0_1 },
      { text: "📜 【换个口味】挑选其他史诗剧本模组", nextChapter: "open_presets" },
    ],
  });

  s = updateChapter(s, cEnd2, {
    content: "在最后的刹那，你微笑着放下了所有的抵抗与伪装，将三颗闪耀着暗紫光芒的耐色石狠狠嵌入王冠！\n\n至高主脑发出一声欢愉的共鸣，眼眶中的幼虫在狂暴的灵能中完成蜕变。你的面颊上生长出优雅而致命的触须，心灵网络瞬间覆压了整个剑湾百万生灵！\n\n“为新时代的主宰献上灵魂！”\n\n🦑 **【至高主脑·夺心帝国的新生】**\n博德之门乃至整个费伦大陆，都将沦为你所统御的伟大夺心帝国！在永恒的灵能网络中，一切归于一统！",
    choices: [
      { text: "🦑 【夺心帝国】统治这片大陆并开启 AI 动态延伸篇章", nextChapter: "AI_DYNAMIC" },
      { text: "🔄 重新开始此剧本", nextChapter: c0_1 },
      { text: "📜 挑选其他史诗剧本", nextChapter: "open_presets" },
    ],
  });

  s = updateChapter(s, cEnd3, {
    content: "伴随着阿斯代伦飞升血族军团的暗夜狂潮，主脑在漫天猩红法阵中被彻底撕碎吞噬！\n\n博德之门下城区换上了血色战旗，阿斯代伦坐在金碧辉煌的暗夜王座上，微笑着将盛满美酒的金杯递向你：\n\n阿斯代伦：“亲爱的……整个城邦与永恒的黑夜，都是我们的囊中之物了。”\n\n🩸 **【暗夜血王·血色永夜统治】**\n你们在暗夜的血色王座上并肩而立，博德之门迎来了永恒的夜之统治！",
    choices: [
      { text: "🩸 【暗夜王座】与阿斯代伦统治夜之城邦（AI 动态后日谈）", nextChapter: "AI_DYNAMIC" },
      { text: "🔄 重新开始此剧本", nextChapter: c0_1 },
      { text: "📜 挑选其他史诗剧本", nextChapter: "open_presets" },
    ],
  });

  s = updateChapter(s, cEnd4, {
    content: "为了打破主脑的绝对神级防御，你毅然选择完成了夺心魔蜕变。在最后一击斩碎主脑后，你没有在人们敬畏与恐惧交织的目光中停留，而是默默披上斗篷，踏上了吉斯洋基的星界巨舰。\n\n在无尽的星海与银色虚空中，你将作为凡世永远不为人知的隐秘守护者，默默注视着大地的安宁。\n\n🌌 **【星界隐修·牺牲者的永恒守望】**\n真正的英雄无需凡人的赞歌，星河璀璨，你的灵魂永世闪耀。",
    choices: [
      { text: "🌌 【星界守望】巡航深邃星界并开启 AI 动态异界冒险", nextChapter: "AI_DYNAMIC" },
      { text: "🔄 重新开始此剧本", nextChapter: c0_1 },
      { text: "📜 挑选其他史诗剧本", nextChapter: "open_presets" },
    ],
  });

  return s;
}

function createEldritchPreset(): Script {
  let s = createEmptyScript('古宅诡影');
  s.description = '充满克苏鲁古老恐惧与异变悬疑的探险剧本';
  s.genre = '克苏鲁/惊悚';

  s = updateChapter(s, s.startChapter, {
    title: '阴云下的维克多古宅',
    content: "暴风雨夜，你应邀来到悬崖边的维克多古宅。巨大的木门轰然关闭，空气中散发着咸湿的黑海泥土味与陈年羊皮纸的气息。书房方向传来细碎的低语声……",
    choices: [],
  });

  const c2Id = addPresetChapter(s, '禁忌书房');
  const c3Id = addPresetChapter(s, '深渊真相');

  s = updateChapter(s, s.startChapter, {
    choices: [
      { text: "走向发出低语声的书房", nextChapter: c2Id },
      { text: "检查客厅中覆盖着黑布的油画", nextChapter: c2Id },
    ],
  });

  s = updateChapter(s, c2Id, {
    content: "书房桌上摆放着一本散发着幽蓝光芒的皮质手稿《拉莱耶古卷》。墙壁上的符文开始如蛇般蠢蠢欲动，直觉告诉你理智正受到侵蚀！",
    choices: [
      { text: "尝试破译古卷符文", nextChapter: c3Id },
      { text: "合上古卷迅速逃离", nextChapter: c3Id },
    ],
    dcCheck: {
      attribute: 'wis',
      skill: '洞悉',
      dc: 15,
      successChapter: c3Id,
      failureChapter: c2Id,
    },
  });

  s = updateChapter(s, c3Id, {
    content: "你终于勘破了古宅的秘密！主人早已献祭了灵魂，而你用坚强的意志斩断了异界仪式！\n\n👁️ **大危机解除！** 你迎着清晨的第一缕晨曦离开了古宅。",
    choices: [
      { text: "👁️ 【探索后续】调查古宅未解的地下秘道（开启 AI 动态延伸）", nextChapter: "AI_DYNAMIC" },
      { text: "🔄 【重玩剧本】重新开始《古宅诡影》", nextChapter: s.startChapter },
      { text: "📜 【换个口味】挑选其他史诗剧本", nextChapter: "open_presets" },
    ],
  });

  return s;
}

function createCyberpunkPreset(): Script {
  let s = createEmptyScript('霓虹追捕');
  s.description = '赛博朋克风格的高科技潜入与数据黑客剧本';
  s.genre = '赛博朋克';

  s = updateChapter(s, s.startChapter, {
    title: '不夜城雨夜吧台',
    content: "霓虹灯光透过酸雨洒在酒吧的金属吧台上。你的义眼收到了一条加密信息：“荒坂塔顶层有一块机密芯片，事成之后 100,000 信用点。“\n\n你喝完杯中的合成酒精，握紧了腰间的电磁手枪。",
    choices: [],
  });

  const c2Id = addPresetChapter(s, '数据核心');
  const c3Id = addPresetChapter(s, '撤离高空');

  s = updateChapter(s, s.startChapter, {
    choices: [
      { text: "从通风管道潜入荒坂塔", nextChapter: c2Id },
      { text: "黑入大楼安全系统假冒保洁员", nextChapter: c2Id },
    ],
  });

  s = updateChapter(s, c2Id, {
    content: "警报声骤然响彻！一台警戒机堵住数据核心的接入门，传感器逐一锁定你们。机密终端在它身后的玻璃隔断里亮起，数据芯片还在读写。",
    encounter: { title: '数据核心 · 警戒机拦截', enemyKind: 'drone', count: 1,
      aftermath: '警戒机坠地，接入门仍然开着。你们走到机密终端前，上传进度还没到头，现在能决定怎么截断数据流。' },
    choices: [
      { text: "进行脑机协议强行过载破坏", nextChapter: c3Id },
      { text: "扔出电磁脉冲手雷掩护跳窗", nextChapter: c3Id },
    ],
    dcCheck: {
      attribute: 'int',
      skill: '黑客',
      dc: 16,
      successChapter: c3Id,
      failureChapter: c2Id,
    },
  });

  s = updateChapter(s, c3Id, {
    content: "你在千钧一发之际破译了数据芯片，跳上浮空车冲入雨夜！\n\n🏙️ **任务完成！** 100,000 信用点已打入你的隐蔽账户。",
    choices: [
      { text: "🏙️ 【追查真相】探寻黑市买家的真实身份（开启 AI 动态延伸）", nextChapter: "AI_DYNAMIC" },
      { text: "🔄 【重玩剧本】重新开始《霓虹追捕》", nextChapter: s.startChapter },
      { text: "📜 【换个口味】挑选其他史诗剧本", nextChapter: "open_presets" },
    ],
  });

  return s;
}

function createDungeonPreset(): Script {
  let s = createEmptyScript('地牢探险');
  s.description = '经典的地下城探险剧本，适合1-4级冒险者';
  s.genre = '奇幻';

  s = updateChapter(s, s.startChapter, {
    title: '酒馆召集',
    content: "你坐在「流浪者之憩」酒馆的角落，壁炉里的火焰噼啪作响。一个戴着兜帽的陌生人走到你桌前，低声说道：“我听说东边的古老墓穴里藏着一件神器。我需要勇敢的人去取回它。报酬是500金币。“\n\n酒馆老板在吧台后面擦拭着杯子，朝你点了点头。外面的天色已近黄昏。",
  });

  const c2Id = addPresetChapter(s, '墓穴入口');
  const c3Id = addPresetChapter(s, '陷阱走廊');
  const c4Id = addPresetChapter(s, '宝藏室');

  s = updateChapter(s, s.startChapter, {
    choices: [
      { text: "接受任务，出发前往墓穴", nextChapter: c2Id },
      { text: "先和酒馆老板聊聊", nextChapter: s.startChapter },
      { text: "拒绝任务", nextChapter: s.startChapter },
    ],
  });

  s = updateChapter(s, c2Id, {
    content: "你来到了东边的古老墓穴。巨大的石门半掩着，上面刻着磨损的符文。空气中弥漫着潮湿的泥土气息和某种……更古老的东西。",
    choices: [
      { text: "推门进入", nextChapter: c3Id },
      { text: "检查符文", nextChapter: c2Id },
    ],
    dcCheck: {
      attribute: 'int',
      skill: '奥秘',
      dc: 13,
      successChapter: c3Id,
      failureChapter: c2Id,
    },
  });

  s = updateChapter(s, c3Id, {
    content: "走廊两侧的墙壁上布满机关孔，烧焦的石板一路延伸到宝藏室门前。你们刚跨进走廊，一具守墓骷髅就从石龛里站起来，搭箭挡住了通路。",
    encounter: { title: '陷阱走廊 · 守墓骷髅', enemyKind: 'skeleton', count: 1,
      aftermath: '骷髅的短弓摔在地上，箭矢散落一地。前方的石门已无遮拦，只有墙上的机关孔仍朝着走廊。' },
    choices: [
      { text: "小心翼翼地通过", nextChapter: c4Id },
      { text: "寻找解除陷阱的机关", nextChapter: c4Id },
    ],
    dcCheck: {
      attribute: 'dex',
      skill: '特技',
      dc: 15,
      successChapter: c4Id,
      failureChapter: c3Id,
    },
  });

  s = updateChapter(s, c4Id, {
    content: "宝藏室！黄金、珠宝和魔法物品堆满了石台。在正中央，一把泛着蓝光的长剑悬浮在空中。这就是传说中的「霜月之刃」。\n\n🏆 **冒险成功！** 你带着宝藏和神器回到了酒馆，成为了当晚的英雄。",
    reward: { gold: 500, items: ['霜月之刃'] },
    choices: [
      { text: "🏆 【后日谈】在酒馆向同伴炫耀并准备下一场探险（开启 AI 动态延伸）", nextChapter: "AI_DYNAMIC" },
      { text: "🔄 【重玩剧本】重新开始《地牢探险》", nextChapter: s.startChapter },
      { text: "📜 【换个口味】挑选其他史诗剧本", nextChapter: "open_presets" },
    ],
  });

  return s;
}

function createMysteryPreset(): Script {
  let s = createEmptyScript('小镇谜案');
  s.description = '侦探风格的推理剧本，揭开小镇的秘密';
  s.genre = '推理';

  s = updateChapter(s, s.startChapter, {
    title: '雨夜来客',
    content: "雨夜，酒馆的门被猛地推开。镇长的女儿气喘吁吁地冲进来：“帮帮我！我父亲……他不见了！他的书房里有打斗的痕迹！“\n\n酒馆里的客人们纷纷转过头来。炉火在潮湿的空气中发出嘶嘶声。",
    choices: [],
  });

  const c2Id = addPresetChapter(s, '镇长书房');
  const c3Id = addPresetChapter(s, '线索追踪');

  s = updateChapter(s, s.startChapter, {
    choices: [
      { text: "跟去镇长家调查", nextChapter: c2Id },
      { text: "先问问酒馆里的客人", nextChapter: s.startChapter },
    ],
  });

  s = updateChapter(s, c2Id, {
    content: "书房里一片狼藉。书桌抽屉被拉开，文件散落一地。但奇怪的是，值钱的物品都还在。墙上挂着一幅奇怪的地图，上面用红笔标记了一个地点——废弃的磨坊。",
    choices: [
      { text: "前往废弃磨坊", nextChapter: c3Id },
      { text: "仔细搜索书房", nextChapter: c2Id },
    ],
    dcCheck: {
      attribute: 'wis',
      skill: '调查',
      dc: 14,
      successChapter: c3Id,
      failureChapter: c2Id,
    },
  });

  s = updateChapter(s, c3Id, {
    content: "在磨坊的地下室里，你找到了被绑起来的镇长——还有一封勒索信。原来镇长的商业对手策划了这一切！你解救了镇长，谜案告破。\n\n🔍 **案件解决！** 回到酒馆，镇长请大家喝了一轮。",
    choices: [
      { text: "🔍 【延伸追查】审问背后的幕后黑手（开启 AI 动态延伸）", nextChapter: "AI_DYNAMIC" },
      { text: "🔄 【重玩剧本】重新开始《小镇谜案》", nextChapter: s.startChapter },
      { text: "📜 【换个口味】挑选其他史诗剧本", nextChapter: "open_presets" },
    ],
  });

  return s;
}

function createTavernPreset(): Script {
  let s = createEmptyScript('酒馆风波');
  s.description = '轻松的酒馆日常剧本，适合暖场和角色扮演';
  s.genre = '日常';

  s = updateChapter(s, s.startChapter, {
    title: '热闹的夜晚',
    content: "今晚的酒馆格外热闹。一群半身人吟游诗人在角落弹着鲁特琴，几个矮人在比谁喝得多，老汤姆在吧台后忙着招呼客人。\n\n突然，一个醉醺醺的冒险者开始大声吹嘘他屠龙的经历，但你知道他连地精都没打过。",
    choices: [],
  });

  const c2Id = addPresetChapter(s, '真相大白');

  s = updateChapter(s, c2Id, {
    content: "你的话让整个酒馆安静了一秒——然后爆发出哄堂大笑。那个吹牛的冒险者脸红得像个番茄，灰溜溜地逃出了酒馆。\n\n🍻 **酒馆恢复了热闹！** 吟游诗人弹起了欢快的曲子，大家都为这个愉快的夜晚举杯。",
    choices: [
      { text: "🍻 【留在酒馆】继续倾听客人讲奇闻（开启 AI 动态延伸）", nextChapter: "AI_DYNAMIC" },
      { text: "🔄 【重玩剧本】重新开始《酒馆风波》", nextChapter: s.startChapter },
      { text: "📜 【换个口味】挑选其他史诗剧本", nextChapter: "open_presets" },
    ],
  });

  s = updateChapter(s, s.startChapter, {
    choices: [
      { text: "拆穿他的谎言", nextChapter: c2Id },
      { text: "给他再来一杯", nextChapter: c2Id },
      { text: "让吟游诗人编首歌嘲讽他", nextChapter: c2Id },
    ],
  });

  return s;
}

/** 从 JSON 导入剧本 */
export function importScript(json: string): Script | null {
  try {
    const data = JSON.parse(json);
    if (!data.title || !data.chapters || !data.startChapter) return null;
    if (Object.values(data.chapters as Record<string, ScriptChapter>).some(chapter =>
      (chapter?.encounter !== undefined && !isChapterEncounter(chapter.encounter))
      || (chapter?.reward !== undefined && !isChapterReward(chapter.reward)))) return null;
    return {
      ...data,
      id: data.id || uuid(),
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** 导出剧本为 JSON */
export function exportScript(script: Script): string {
  return JSON.stringify(script, null, 2);
}
