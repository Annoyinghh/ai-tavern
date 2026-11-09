// ============================================================
// AI 酒馆 - 游戏状态管理 & 昼夜系统
// ============================================================

import { v4 as uuid } from 'uuid';
import {
  TavernState,
  GameTime,
  TimeOfDay,
  ChatMessage,
  Character,
  CharacterExpression,
  Script,
  TIME_LABELS,
  TIME_ICONS,
  createInitialStoryMemory,
} from './types';

/** 时间推进顺序 */
const TIME_ORDER: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

/** 酒馆营业时间 */
export function isTavernOpen(timeOfDay: TimeOfDay): boolean {
  return timeOfDay !== 'night';
}

/** 创建初始游戏状态 */
export function createInitialState(): TavernState {
  return {
    gameTime: { day: 1, timeOfDay: 'morning' },
    currentScript: null,
    currentChapter: null,
    character: null,
    messages: [],
    isOpen: true,
    memory: createInitialStoryMemory(),
  };
}

/** 推进时间 */
export function advanceTime(state: TavernState): TavernState {
  const { day, timeOfDay } = state.gameTime;
  const currentIndex = TIME_ORDER.indexOf(timeOfDay);

  let newTimeOfDay: TimeOfDay;
  let newDay = day;

  if (currentIndex < TIME_ORDER.length - 1) {
    newTimeOfDay = TIME_ORDER[currentIndex + 1];
  } else {
    newTimeOfDay = TIME_ORDER[0];
    newDay = day + 1;
  }

  const newTime: GameTime = { day: newDay, timeOfDay: newTimeOfDay };
  const isOpen = isTavernOpen(newTimeOfDay);

  // 进入夜晚：酒馆打烊（仅当从营业转入打烊时）
  let messages = state.messages;
  if (newTimeOfDay === 'night') {
    const alreadyNightClosed = messages.length > 0 &&
      messages[messages.length - 1].content.includes('酒馆打烊');
    if (state.isOpen && !alreadyNightClosed) {
      messages = [
        ...messages,
        createSystemMessage(
          `🌙 夜深了，酒馆打烊了。炉火渐渐熄灭，是时候整理今天的收获，或者写写新剧本了。`
        ),
      ];
    }
  }
  // 进入清晨：酒馆开门（仅当从打烊转入营业时）
  if (newTimeOfDay === 'morning') {
    const alreadyMorningOpen = messages.length > 0 &&
      messages[messages.length - 1].content.includes('酒馆重新开门');
    if (!state.isOpen && !alreadyMorningOpen) {
      messages = [
        ...messages,
        createSystemMessage(
          `🌅 第 ${newDay} 天的清晨到来了。酒馆重新开门营业，空气中飘着新鲜面包和麦酒的香气。`
        ),
      ];
    }
  }

  return {
    ...state,
    gameTime: newTime,
    isOpen,
    messages,
  };
}

/** 推进到指定时间 */
export function setTimeOfDay(state: TavernState, timeOfDay: TimeOfDay): TavernState {
  let s = state;
  const target = TIME_ORDER.indexOf(timeOfDay);
  const current = TIME_ORDER.indexOf(s.gameTime.timeOfDay);

  // 如果目标时间在当前时间之前，先跳到第二天
  if (target <= current) {
    s = {
      ...s,
      gameTime: { ...s.gameTime, day: s.gameTime.day + 1 },
    };
  }

  while (s.gameTime.timeOfDay !== timeOfDay) {
    s = advanceTime(s);
  }

  return s;
}

/** 创建系统消息 */
export function createSystemMessage(content: string): ChatMessage {
  return {
    id: uuid(),
    role: 'system',
    sender: '系统通知',
    content,
    timestamp: Date.now(),
  };
}

/** 创建旁白/NPC/DM 消息 */
export function createNarratorMessage(
  content: string,
  options?: {
    sender?: string;
    characterId?: string;
    expression?: CharacterExpression;
    speakerTitle?: string;
  }
): ChatMessage {
  return {
    id: uuid(),
    role: 'narrator',
    sender: options?.sender || '老汤姆',
    content,
    timestamp: Date.now(),
    characterId: options?.characterId || 'old_tom',
    expression: options?.expression || 'normal',
    speakerTitle: options?.speakerTitle || '酒馆老板兼 DM',
  };
}

/** 创建玩家消息 */
export function createPlayerMessage(
  content: string,
  character?: { name?: string; portraitId?: string; currentExpression?: CharacterExpression } | null
): ChatMessage {
  return {
    id: uuid(),
    role: 'player',
    sender: character?.name || '无名旅者',
    content,
    timestamp: Date.now(),
    characterId: character?.portraitId || 'traveler',
    expression: character?.currentExpression || 'normal',
    speakerTitle: '冒险者',
  };
}

/** 创建骰子消息 */
export function createDiceMessage(content: string): ChatMessage {
  return {
    id: uuid(),
    role: 'dice',
    sender: '命运之骰',
    content,
    timestamp: Date.now(),
  };
}

/** 获取当前时间的描述 */
export function getTimeDescription(gameTime: GameTime): string {
  const icon = TIME_ICONS[gameTime.timeOfDay];
  const label = TIME_LABELS[gameTime.timeOfDay];
  const openStatus = isTavernOpen(gameTime.timeOfDay)
    ? '🟢 营业中'
    : '🔴 已打烊';
  return `${icon} 第 ${gameTime.day} 天 · ${label} · ${openStatus}`;
}

/** 本地存储：保存状态 */
const STORAGE_KEY = 'ai-tavern-state';

export function saveState(state: TavernState): boolean {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('saveState failed:', e);
    }
  }
  return false;
}

export function loadState(): TavernState | null {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.memory) {
          parsed.memory = createInitialStoryMemory();
        }
        return parsed;
      }
    } catch (e) {
      console.warn('loadState failed:', e);
      return null;
    }
  }
  return null;
}

/** 本地存储：保存/加载角色 */
const CHAR_KEY = 'ai-tavern-character';

export function saveCharacter(char: Character): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CHAR_KEY, JSON.stringify(char));
    } catch (e) {
      console.warn('saveCharacter failed:', e);
    }
  }
}

export function loadCharacter(): Character | null {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CHAR_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('loadCharacter failed:', e);
      return null;
    }
  }
  return null;
}

/** 本地存储：保存/加载剧本列表 */
const SCRIPTS_KEY = 'ai-tavern-scripts';

export function saveScripts(scripts: Script[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SCRIPTS_KEY, JSON.stringify(scripts));
  }
}

export function loadScripts(): Script[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SCRIPTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
