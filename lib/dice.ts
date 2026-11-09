// ============================================================
// AI 酒馆 - 骰子系统
// 支持 D4/D6/D8/D10/D12/D20/D100，优势/劣势，DC 检定
// ============================================================

import { DiceResult, DiceType } from './types';

/** 投一个指定面数的骰子 */
export function rollDie(sides: number, random = Math.random): number {
  return Math.min(sides, Math.max(1, Math.floor(random() * sides) + 1));
}

/** 投 N 个指定面数的骰子 */
export function rollDice(count: number, sides: number, random = Math.random): number[] {
  return Array.from({ length: count }, () => rollDie(sides, random));
}

/** 获取骰子面数 */
export function getDiceSides(type: DiceType): number {
  const map: Record<DiceType, number> = {
    d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100,
  };
  return map[type];
}

/** 完整的骰子检定 */
export function performDiceRoll(
  type: DiceType,
  count: number = 1,
  modifier: number = 0,
  advantage: 'none' | 'advantage' | 'disadvantage' = 'none'
): DiceResult {
  const sides = getDiceSides(type);

  if (type === 'd20' && advantage !== 'none') {
    // 优势/劣势：投两个 d20
    const [r1, r2] = [rollDie(20), rollDie(20)];
    const keep = advantage === 'advantage' ? Math.max(r1, r2) : Math.min(r1, r2);
    const discarded = keep === r1 ? r2 : r1;
    const total = keep + modifier;
    return { rolls: [keep, discarded], total, modifier, type, advantage };
  } else {
    const rolls = rollDice(count, sides);
    const total = rolls.reduce((a, b) => a + b, 0) + modifier;
    return { rolls, total, modifier, type, advantage };
  }
}

/** 格式化检定结果文本 */
export function formatDiceResult(result: DiceResult): string {
  const parts: string[] = [];
  parts.push(`🎲 ${result.type.toUpperCase()} 检定`);

  if (result.advantage === 'advantage') parts.push('(优势)');
  if (result.advantage === 'disadvantage') parts.push('(劣势)');

  parts.push(`投出: [${result.rolls.join(', ')}]`);

  if (result.modifier !== 0) {
    const sign = result.modifier > 0 ? '+' : '';
    parts.push(`调整: ${sign}${result.modifier}`);
  }

  parts.push(`= ${result.total}`);
  return parts.join(' ');
}

