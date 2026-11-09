import type { EnemyKind } from './combat/types';
import type { Script, ScriptChapter } from './types';

export function isEndingChapter(script: Script, chapter: ScriptChapter) {
  if (chapter.ending !== undefined) return chapter.ending;
  // Built-in endings in older saves use an epilogue, replay and commission choice.
  const targets = chapter.choices.map(choice => choice.nextChapter);
  return ['AI_DYNAMIC', script.startChapter, 'open_presets'].every(target => targets.includes(target))
    && targets.every(target => target === 'AI_DYNAMIC' || target === script.startChapter || target === 'open_presets');
}

type SceneEvent = { key: string; title: string; description: string; enemy?: EnemyKind; followUp?: string };
type Scene = { label: string; lore: string; events: SceneEvent[] };

const scenes = {
  quiet: { label: '保留剧情节奏', lore: '承接当前场景的既有目标和人物。由玩家决定下一步。', events: [] },
  ship: {
    label: '螺壳舰舱室', lore: '夺心魔舰船的门和控制台带有有机组织与灵能符文。附近震动、舱体或设备异响可能来自舰船损坏；救援和逃生依剧本推进。',
    events: [
      { key: 'bulkhead', title: '舱壁震颤', description: '舱壁轻轻抽动，几滴盐水从管路落下。' },
      { key: 'aberration', title: '舱道中的畸变体', description: '一只触须畸变体从附近的检修缝隙爬出，挡在侦察队前。', enemy: 'aberration' },
    ],
  },
  coast: {
    label: '剑湾海岸', lore: '剑湾沿岸有礁石、风化小径和被潮水卷上岸的残骸。只叙述本地可见的海岸环境；残骸上的东西不自动成为战利品。',
    events: [
      { key: 'tide', title: '浪过残木', description: '一阵浪拍翻浅水里的残木，露出一道浅浅的潮痕。', followUp: '留在岸上，观察潮痕与残木' },
      { key: 'rope', title: '漂来的绳索', description: '湿透的断绳被潮水拖过礁石，随下一阵浪退去。' },
    ],
  },
  forest: {
    label: '林地与荒野', lore: '林中有兽径、折枝和猎食动物。普通野兽或道路上的匪徒只适合确有威胁的探索，营地和受保护的林地聚落单独处理。',
    events: [
      { key: 'leaves', title: '林间窸窣', description: '风翻过落叶，灌木一阵窸窣，随后恢复平静。' },
      { key: 'wolf', title: '兽径上的狼', description: '侦察队在兽径拐弯处碰上一只警觉的狼，它低伏着挡住去路。', enemy: 'wolf' },
      { key: 'bandit', title: '林道上的匪徒', description: '侦察队看见一名持弯刀的匪徒守在路边。他发现了你们。', enemy: 'bandit' },
    ],
  },
  ruins: {
    label: '墓穴与古代遗迹', lore: '残旧石门、磨损符文和机关属于这处遗迹。机关是否触发、门能否打开、墓主人是谁都由章节与检定决定。',
    events: [
      { key: 'dust', title: '石缝落尘', description: '冷风穿过墙缝，石阶上的细灰被吹成一条灰线。' },
      { key: 'skeleton', title: '廊道中的骷髅', description: '侦察队在支廊碰见一具被唤起的骷髅，它的短弓转向了你们。', enemy: 'skeleton' },
    ],
  },
  underdark: {
    label: '幽暗地域', lore: '这片地下环境缺少自然光，局部能见度取决于照明、发光菌类和石壁遮挡。附近异常不等于发现了新入口或阵营秘密。',
    events: [{ key: 'spores', title: '菌光微动', description: '微亮的孢子在石壁边飘过，远处落下一滴水。' }],
  },
  shadow: {
    label: '暗影诅咒区域', lore: '按剧本记录光源和已知庇护范围。暗影诅咒的效果、触发与解除由剧情和规则确定。',
    events: [{ key: 'flame', title: '摇曳的光', description: '近处的光晕抖动了一下，边缘的影子又落回原处。' }],
  },
  town: {
    label: '镇街与聚落', lore: '街坊只知道亲历的事，传闻不能作为证据。人物关系、证词和物证以剧本及玩家已调查的内容为准。',
    events: [{ key: 'shutters', title: '街边动静', description: '街角传来合上窗扇的声音，脚步很快远去。', followUp: '向街坊问问刚才是谁经过' }],
  },
  tavern: {
    label: '酒馆与安全休整', lore: '这里适合闲聊、收集公开传闻和休整。嘈杂、杯碟或普通客人的反应是环境细节，不自动开战或承诺报酬。',
    events: [{ key: 'cups', title: '吧台杯响', description: '吧台传来杯碟轻碰的声响，周围的交谈很快接了回去。' }],
  },
  manor: {
    label: '古宅', lore: '古宅的惊悚来自风雨、旧物、低语和难以解释的痕迹。低语和异象不直接证明凶手、仪式真相或超自然存在。',
    events: [{ key: 'hinge', title: '廊道回声', description: '远处传来一声像旧铰链摩擦的响动，很快混入风声。', followUp: '留在原地，辨别回声的来向' }],
  },
  mill: {
    label: '偏僻磨坊', lore: '旧磨坊有回音、磨盘与灰尘。绑架线索和嫌犯身份由剧本与检定确认。',
    events: [
      { key: 'boards', title: '旧木板回响', description: '旧木板在风里响了一下，灰尘从边缘落下。' },
      { key: 'lookout', title: '磨坊外的持械人', description: '一名持械望风者发现了侦察队，提着短刀挡住了路。', enemy: 'bandit' },
    ],
  },
  neon: {
    label: '霓虹街区', lore: '这里的设备依赖供电、权限和网络。终端警报、摄像头和义体是技术，不能当成魔法或让黑客尝试自动成功。',
    events: [{ key: 'sign', title: '霓虹闪烁', description: '近处的霓虹招牌闪了几下，颜色映进雨水里。' }],
  },
  security: {
    label: '高科技警戒区', lore: '警戒机和门禁服从所在安保网络。没有权限就不能声称读到了保密数据。',
    events: [
      { key: 'light', title: '待机指示灯', description: '一盏旧指示灯跳了一下，随即恢复原来的颜色。' },
      { key: 'drone', title: '巡逻警戒机', description: '侦察队拐过转角，一台巡逻警戒机转动传感器，对准了队伍。', enemy: 'drone' },
    ],
  },
} satisfies Record<string, Scene>;

type SceneKey = keyof typeof scenes;
const fantasy = ['forest', 'ruins', 'town', 'tavern'] as const;
const worlds = {
  baldurs_gate: { title: '费伦 · 博德之门剧本背景', lore: '这场冒险发生在被遗忘的国度。剑湾有沿岸城镇和荒野，神术、奥术和灵能各有来处。用本剧本版本的人物、阵营与章节状态，不能从其他模组或原作补写未到达的桥段。', scenes: [...fantasy, 'ship', 'coast', 'underdark', 'shadow'] },
  dungeon: { title: '地牢探险背景', lore: '这是低等级队伍的地牢冒险。东边墓穴与酒馆委托是本剧本的范围。传说不是已知事实，神器、陷阱和报酬以章节为准。', scenes: fantasy },
  mystery: { title: '小镇谜案背景', lore: '这是靠证词与物证推进的小镇失踪案。证词会受视角和利益影响，不能用法术、预知或巧合跳过调查。', scenes: ['tavern', 'town', 'mill'] },
  eldritch: { title: '古宅诡影背景', lore: '维克多古宅与风暴是已知舞台。以悬疑和有限感官信息铺陈恐惧；异界现象的起因与后果以本剧本揭示为准。', scenes: ['manor'] },
  cyberpunk: { title: '霓虹追捕背景', lore: '赛博朋克都市里的身份、企业安保、监控与数据交易决定行动后果。技术受权限与资源约束，魔法与古典怪物不属于这里。', scenes: ['neon', 'security'] },
  tavern: { title: '酒馆风波背景', lore: '酒馆是本地日常场所。闲谈、传闻、乐曲和人情是重点，吹嘘的故事只是角色自述。', scenes: ['tavern'] },
  dnd: { title: 'D&D 风格世界', lore: '冒险采用 D&D 风格的队伍、检定和战斗规则。地理、宗教与阵营由当前剧本定义，不能用另一部冒险的世界设定替代。', scenes: fantasy },
  custom: { title: '自定义剧本背景', lore: '以本剧本的固定世界设定和已到达场景为准。未给出的时代、能力、地理与重大背景保持未知。', scenes: fantasy },
} satisfies Record<string, { title: string; lore: string; scenes: readonly SceneKey[] }>;

function worldKey(script: Script): keyof typeof worlds {
  if (isBackgroundProfile(script.backgroundProfile)) return script.backgroundProfile;
  if (script.title === '博德之门：至高主脑降临') return 'baldurs_gate';
  if (script.title === '地牢探险') return 'dungeon';
  if (script.title === '酒馆风波') return 'tavern';
  if (script.title === '小镇谜案' || /悬疑|侦探|推理/.test(script.genre)) return 'mystery';
  if (script.title === '古宅诡影' || /恐怖|克苏鲁|惊悚/.test(script.genre)) return 'eldritch';
  if (script.title === '霓虹追捕' || /科幻|赛博|cyber|sci.?fi/i.test(script.genre)) return 'cyberpunk';
  return /D\s*&\s*D|龙与地下城/i.test(script.genre) ? 'dnd' : 'custom';
}

export function getWorldProfile(script: Script) {
  const key = worldKey(script);
  return { ...worlds[key], key };
}

export function isBackgroundProfile(value: unknown): value is keyof typeof worlds {
  return typeof value === 'string' && Object.hasOwn(worlds, value);
}

export function sceneOptions(script: Script) {
  const keys: SceneKey[] = ['quiet', ...getWorldProfile(script).scenes];
  return keys.map(key => ({ key, label: scenes[key].label }));
}

export function isSceneType(value: unknown): value is SceneKey {
  return typeof value === 'string' && Object.hasOwn(scenes, value);
}

function presetScene(script: Script, title: string): SceneKey {
  switch (worldKey(script)) {
    case 'baldurs_gate':
      if (/^序章·第[一二三四]节/.test(title)) return 'ship';
      if (title.includes('剑湾沙滩')) return 'coast';
      if (title.includes('草丛埋伏')) return 'forest';
      if (title.includes('耶格苍白神殿')) return 'ruins';
      if (title.includes('幽暗地域')) return 'underdark';
      if (title.includes('暗影诅咒之地')) return 'shadow';
      if (/营地篝火|林地庆典|精灵之歌酒馆/.test(title)) return 'tavern';
      break;
    case 'dungeon': if (title === '酒馆召集') return 'tavern';
      if (title === '墓穴入口') return 'ruins';
      break;
    case 'mystery': if (title === '雨夜来客') return 'tavern'; break;
    case 'eldritch': if (title === '阴云下的维克多古宅' || title === '禁忌书房') return 'manor'; break;
    case 'cyberpunk': if (title === '不夜城雨夜吧台') return 'neon';
      if (title === '数据核心') return 'security';
      break;
    case 'tavern': return 'tavern';
  }
  return 'quiet';
}

export function getSceneProfile(script: Script, chapter: ScriptChapter) {
  const world = getWorldProfile(script);
  const requested = chapter.sceneType ?? presetScene(script, chapter.title);
  const key = isSceneType(requested) && (requested === 'quiet' || (world.scenes as readonly SceneKey[]).includes(requested)) ? requested : 'quiet';
  const scene: Scene = scenes[key];
  return { ...scene, key, events: scene.events.filter(event => !event.enemy || script.allowedEnemies?.includes(event.enemy) !== false) };
}

export function sceneEventId(scriptId: string, chapterId: string, kind: 'ambience' | 'encounter') {
  return `scene:${JSON.stringify([scriptId, chapterId, kind])}`;
}
