import type { Character, ScriptChoice, AttributeKey, OutcomeTier } from './types';
import { ATTRIBUTE_LABELS, getModifier, getProficiencyBonus } from './types';
export type { OutcomeTier } from './types';

export const EXPLORATION_OUTCOME_LABELS: Record<OutcomeTier, string> = {
  crit_success: '大成功', success: '成功', failure: '失败', crit_failure: '大失败',
};

/** The four tiers apply to exploration totals only. Combat still follows its own rules. */
export function getExplorationOutcome(total: number, dc: number): OutcomeTier {
  const margin = total - dc;
  if (margin >= 5) return 'crit_success';
  if (margin >= 0) return 'success';
  return margin <= -5 ? 'crit_failure' : 'failure';
}

/** Shared by exploration and the action preview. Only explicit checks consume dice. */
export function getActionCheck(text: string, character: Character, explicit?: ScriptChoice['check'], useLeadingLabel = true) {
  const label = useLeadingLabel ? text.match(/^\s*[\[【]([^\]】]+)[\]】]/)?.[1] : undefined;
  const dcPattern = /(?:DC|难度)\s*[:：]?\s*(\d+)/i;
  const labelDC = label?.match(dcPattern)?.[1];
  const writtenDC = labelDC ?? text.match(dcPattern)?.[1];
  if (!explicit && writtenDC === undefined) return null;

  const rules: [AttributeKey, RegExp, string[]][] = [
    ['str', /力量|STR|运动|蛮力|破门|劈砍|砸|重击|挥剑/i, ['运动']],
    ['dex', /敏捷|DEX|巧手|特技|隐匿|潜行|开锁|翻滚|射击|盗取/i, ['巧手', '特技', '隐匿']],
    ['con', /体质|CON|硬抗|忍耐|毒素|憋气/i, []],
    ['int', /智力|INT|奥秘|调查|自然|宗教|历史|破解|符文/i, ['奥秘', '调查', '自然', '宗教', '历史']],
    ['cha', /魅力|CHA|说服|威吓|欺瞒|表演|交涉/i, ['说服', '威吓', '欺瞒', '表演']],
    ['wis', /感知|WIS|察觉|洞悉|生存|医药|医疗|观察|追踪/i, ['察觉', '洞悉', '生存', '医药']],
  ];
  const matched = (labelDC && label ? rules.find(([, pattern]) => pattern.test(label)) : undefined)
    ?? rules.find(([, pattern]) => pattern.test(text));
  const attribute = explicit?.attribute || matched?.[0];
  if (!attribute || !Object.hasOwn(ATTRIBUTE_LABELS, attribute)) return null;
  const skill = explicit?.skill || (labelDC && label ? matched?.[2].find(name => label.includes(name)) : undefined)
    || matched?.[2].find(name => text.includes(name));
  const trained = skill ? character.skills.find(s => s.name === skill && s.proficient) : undefined;
  const proficiency = getProficiencyBonus(character.level);
  const storedBonus = trained?.bonus || 0;
  const skillBonus = storedBonus === 2 ? proficiency : storedBonus === 4 ? proficiency * 2 : storedBonus;
  const bonus = getModifier(character.attributes[attribute]) + skillBonus;
  const dc = explicit?.dc ?? Number(writtenDC ?? 12);
  if (!Number.isFinite(bonus) || !Number.isFinite(dc)) return null;
  return { attribute, skill, bonus, dc: Math.max(5, Math.min(30, dc)), label: ATTRIBUTE_LABELS[attribute] };
}
