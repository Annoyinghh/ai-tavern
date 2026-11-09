// ============================================================
// AI 酒馆 - 核心类型定义
// ============================================================

import type { Appearance } from './appearance';
import type { ChapterEncounter } from './combat/types';

// --- 骰子系统 ---
export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface DiceRoll {
  type: DiceType;
  count: number;
  modifier: number;
}

export interface DiceResult {
  rolls: number[];
  total: number;
  modifier: number;
  type: DiceType;
  advantage: 'none' | 'advantage' | 'disadvantage';
  explorationOutcome?: OutcomeTier;
}

// --- 角色属性 ---
export type AttributeKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力',
};

export interface Attributes {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export function getModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function getProficiencyBonus(level: number): number {
  return level >= 5 ? 3 : 2;
}

export interface Skill {
  name: string;
  attribute: AttributeKey;
  proficient: boolean;
  bonus: number; // 额外加值
}

// --- 职业技能与法术系统 ---
export interface Spell {
  id: string;
  name: string;
  level: number; // 0 = 环位/招式, 1-3 = 阶级
  class: string;
  description: string;
  dice: { count: number; sides: number; type: DiceType };
  attribute: AttributeKey;
  cooldownTurns?: number;
  icon: string;
}

// --- Galgame 立绘与表情系统 ---
export type CharacterExpression = 'normal' | 'smile' | 'serious' | 'surprised';

export const EXPRESSION_LABELS: Record<CharacterExpression, string> = {
  normal: '普通',
  smile: '微笑',
  serious: '严肃',
  surprised: '惊讶',
};

export interface CharacterPortraitConfig {
  id: string;
  name: string;
  title: string;
  avatarUrl: string;
  portraitUrl: string;
  themeColor: string;
  description: string;
  expressions: Record<CharacterExpression, string>;
  prompt: string;          // AI 绘图/建模生成英文 Prompt (Midjourney / Banana)
  promptZh: string;        // AI 绘图/建模生成中文 Prompt
  negativePrompt?: string; // 负向提示词
  modelTags?: string[];    // 建模风格标签
  voiceActor?: string;     // 声线设定
}

export interface Character {
  id: string;
  name: string;
  race: string;
  speciesTraits?: boolean;
  class: string;
  level: number;
  attributes: Attributes;
  skills: Skill[];
  hp: { current: number; max: number };
  ac: number; // 护甲等级
  inventory: string[];
  backstory: string;
  notes: string;
  spells?: string[]; // 已准备法术 ID
  portraitId?: string; // 立绘编号: 'old_tom' | 'eileen' | 'selene' | 'traveler'
  avatarUrl?: string;  // 自定义个人立绘/头像图片 URL 或 Base64
  portraitPoses?: { talk?: string; action?: string };
  currentExpression?: CharacterExpression;
  appearance?: Appearance;
  voiceId?: string;
  themeColor?: string;
  hunger?: number;     // 饱腹度 (0 - 100，默认 100)
  fatigue?: number;    // 疲劳度 (0 - 100，默认 0)
  gold?: number;       // 金币资产 (默认 50)
  buffs?: string[];    // 实时状态特质 (如 ["潜行中", "神圣护体"])
}

export interface LiveEventLog {
  id: string;
  timestamp: number;
  type: 'dice' | 'damage' | 'hunger' | 'event' | 'reward' | 'info';
  text: string;
  tier?: 'normal' | 'crit' | 'danger' | 'warning';
}

export { createDefaultCharacter } from './characters';

// --- 四阶检定体系与受控随机变动 ---
export type OutcomeTier = 'crit_success' | 'success' | 'failure' | 'crit_failure';

export interface TieredDCCheck {
  attribute: AttributeKey;
  skill?: string;
  dc: number;
  required?: boolean;            // 明确要求通过本检定结算，才能继续剧情
  successChapter: string;       // 成功跳转章节 ID
  failureChapter: string;       // 失败跳转章节 ID
  critSuccessChapter?: string;  // 暴击大成功专属跃迁章节 (可选)
  critFailureChapter?: string;  // 灾难大失败专属困境章节 (可选)
  rewardItem?: string;          // 大成功 / 成功额外战利品
  dangerDamage?: number;        // 失败 / 大失败扣除 HP
  milestoneOnSuccess?: string;  // 成功解锁的长线剧情信标
  outcomeText?: Partial<Record<OutcomeTier, string>>;
}

// --- 场景深度探索行动 ---
export type ExplorationType = 'investigation' | 'dialogue' | 'stealth' | 'arcana' | 'special';

export interface ExplorationAction {
  id: string;
  title: string;
  description: string;
  type?: ExplorationType;
  attribute: AttributeKey;
  skill?: string;
  dc: number;
  discoveredClue?: string;
  discoveredSecret?: string;
  rewardItem?: string;
  lootItem?: string;
  targetChapterOnDiscover?: string;
  outcomeText?: Partial<Record<OutcomeTier, string>>;
}

// --- 剧本系统 ---
export interface ScriptChapter {
  id: string;
  title: string;
  content: string;                 // DM 旁白 / 场景描述
  choices: ScriptChoice[];         // 玩家主线分支选项
  dcCheck?: TieredDCCheck;         // 四阶核心 DC 检定挑战
  explorationActions?: ExplorationAction[]; // 场景可探索互动卡
  clues?: string[];                // 场景隐藏线索/环境背景
  sceneType?: string;
  ending?: boolean;
  encounter?: ChapterEncounter;
  reward?: ChapterReward;
}

export interface ChapterReward {
  gold: number;
  items: string[];
}

export interface ScriptChoice {
  text: string;
  nextChapter: string;
  check?: { attribute: AttributeKey; skill?: string; dc: number; successChapter?: string; failureChapter?: string };
}

export interface Script {
  id: string;
  title: string;
  author: string;
  description: string;
  genre: string;
  chapters: Record<string, ScriptChapter>;
  startChapter: string; // 起始章节 ID
  createdAt: string;
  updatedAt: string;
  worldSetting?: string;
  backgroundProfile?: string;
  knowledge?: { id: string; title: string; content: string; chapterIds?: string[]; requiresSecret?: string }[];
  allowedEnemies?: ('bandit' | 'wolf' | 'skeleton' | 'cultist' | 'aberration' | 'drone')[];
}

// --- 昼夜系统 ---
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: '清晨',
  afternoon: '午后',
  evening: '黄昏',
  night: '深夜',
};

export const TIME_ICONS: Record<TimeOfDay, string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌆',
  night: '🌙',
};

export interface GameTime {
  day: number;    // 第几天
  timeOfDay: TimeOfDay;
}

// --- 消息系统 ---
export interface ChatMessage {
  id: string;
  role: 'system' | 'narrator' | 'player' | 'dice';
  sender: string;       // 发送者名称
  content: string;
  timestamp: number;
  diceResult?: DiceResult; // 可选骰子结果
  characterId?: string;    // 立绘角色 ID ('old_tom' | 'eileen' | 'selene' | 'traveler')
  expression?: CharacterExpression; // 当前表情
  speakerTitle?: string;   // 称号 (如 "酒馆老板兼DM")
}

// --- AI 设置 ---
export type DMPersonality = 'classic' | 'dark' | 'humorous' | 'epic' | 'strict';

export interface AISettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  dmPersonality: DMPersonality;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  apiKey: '',
  baseUrl: '',
  model: '', // 留空时使用后端为当前服务配置的模型
  temperature: 0.8,
  dmPersonality: 'classic',
};

// --- 冒险日志 & 编年史 ---
export interface JournalEntry {
  id: string;
  timestamp: number;
  day: number;
  title: string;
  summary: string;
  category: 'quest' | 'check' | 'story' | 'combat';
}

// --- 长线战役全局状态与记忆中枢 (支持超长剧本无损上下文) ---
export interface StoryMemory {
  milestones: string[];             // 已达成的重大剧情信标 (e.g. "RESCUED_SHADOWHEART", "FOUND_EVERBURN")
  storySummary: string;             // 跨章节高浓度叙事摘要
  companionAffinity: Record<string, number>; // 同伴好感度与好恶度 (0-100)
  discoveredSecrets: string[];      // 已破译的密文、暗道与弱点
  activeBuffsDebuffs: string[];     // 当前状态与特质 (e.g. "灵能觉醒", "莎尔祝福")
  questLog: string[];               // 进行中与已完成的任务目标
}

export function createInitialStoryMemory(): StoryMemory {
  return {
    milestones: [],
    storySummary: '冒险旅程刚刚启程……',
    companionAffinity: {},
    discoveredSecrets: [],
    activeBuffsDebuffs: [],
    questLog: [],
  };
}

// --- 酒馆状态 ---
export interface TavernState {
  gameTime: GameTime;
  currentScript: Script | null;
  currentChapter: string | null;
  character: Character | null;
  messages: ChatMessage[];
  isOpen: boolean;  // 酒馆是否营业
  journal?: JournalEntry[];
  memory?: StoryMemory; // 全局长线战役状态与记忆中枢
}



