// ============================================================
// AI 酒馆 - 冒险编年史 & 存档管理
// ============================================================

import type { TavernState } from './types';

/** 将整个跑团历程导出为格式精致的 Markdown 冒险史诗书 */
export function exportAdventureChronicle(state: TavernState): string {
  const char = state.character;
  const script = state.currentScript;
  const charName = char?.name || '未知勇者';

  let md = `# 📖 《${charName} 的流浪者之憩冒险史诗》\n\n`;
  md += `> *在「流浪者之憩」酒馆记录的奇幻诗篇*\n\n`;

  // 英雄画卷
  md += `## 🛡️ 英雄传记\n`;
  if (char) {
    md += `- **姓名**：${char.name}\n`;
    md += `- **种族与职业**：${char.race} ${char.class} (Lv.${char.level})\n`;
    md += `- **生命/护甲**：HP ${char.hp.current}/${char.hp.max} | AC ${char.ac}\n`;
    md += `- **核心属性**：力量 ${char.attributes.str} | 敏捷 ${char.attributes.dex} | 体质 ${char.attributes.con} | 智力 ${char.attributes.int} | 感知 ${char.attributes.wis} | 魅力 ${char.attributes.cha}\n`;
    if (char.backstory) {
      md += `- **背景梗概**：${char.backstory}\n`;
    }
  } else {
    md += `*角色未登记*\n`;
  }
  md += `\n---\n\n`;

  // 剧本信息
  if (script) {
    md += `## 📜 历经剧本：《${script.title}》\n`;
    md += `*${script.description}*\n\n`;
  }

  // 跑团消息记录
  md += `## 🎭 冒险纪实\n\n`;
  state.messages.forEach(msg => {
    const timeStr = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (msg.role === 'narrator') {
      md += `### 🎭 DM 叙事 (${timeStr})\n${msg.content}\n\n`;
    } else if (msg.role === 'player') {
      md += `> 🗡️ **${msg.sender}**：${msg.content}\n\n`;
    } else if (msg.role === 'dice') {
      md += `🎲 *${msg.content}*\n\n`;
    } else if (msg.role === 'system') {
      md += `📌 *${msg.content}*\n\n`;
    }
  });

  md += `\n---\n*—— 记录于 第 ${state.gameTime.day} 天 | AI 酒馆「流浪者之憩」*\n`;

  return md;
}

// ------------------------------------------------------------
// 存档位系统 (Multi Save Slots)
// ------------------------------------------------------------

export interface SaveSlotMetadata {
  slotId: string;
  name: string;
  updatedAt: string;
  charName: string;
  day: number;
}

const SAVE_SLOTS_KEY = 'ai-tavern-slots';

export function listSaveSlots(): SaveSlotMetadata[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVE_SLOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStateToSlot(slotId: string, slotName: string, state: TavernState): void {
  if (typeof window === 'undefined') return;
  const key = `ai-tavern-slot-${slotId}`;
  localStorage.setItem(key, JSON.stringify(state));

  const slots = listSaveSlots();
  const existingIdx = slots.findIndex(s => s.slotId === slotId);

  const meta: SaveSlotMetadata = {
    slotId,
    name: slotName,
    updatedAt: new Date().toLocaleDateString('zh-CN') + ' ' + new Date().toLocaleTimeString('zh-CN'),
    charName: state.character?.name || '未命名',
    day: state.gameTime.day,
  };

  if (existingIdx >= 0) {
    slots[existingIdx] = meta;
  } else {
    slots.push(meta);
  }

  localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots));
}

export function loadStateFromSlot(slotId: string): TavernState | null {
  if (typeof window === 'undefined') return null;
  const key = `ai-tavern-slot-${slotId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function deleteSaveSlot(slotId: string): void {
  if (typeof window === 'undefined') return;
  const key = `ai-tavern-slot-${slotId}`;
  localStorage.removeItem(key);

  const slots = listSaveSlots().filter(s => s.slotId !== slotId);
  localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots));
}
