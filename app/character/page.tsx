'use client';
// ============================================================
// AI 酒馆 - 角色档案与二次元立绘形象工坊 (Galgame 风格)
// ============================================================

import { useState, useEffect, useRef } from 'react';
import {
  Character, Attributes, AttributeKey, ATTRIBUTE_LABELS,
  createDefaultCharacter, getModifier,
} from '@/lib/types';
import { loadCharacter, saveCharacter, loadState, saveState } from '@/lib/gameState';
import { rollDice } from '@/lib/dice';
import type { CampaignState } from '@/lib/campaign';
import { createPartyMember } from '@/lib/combat/engine';
import { weaponFor } from '@/lib/combat/catalog';
import { getSpeciesTraits } from '@/lib/speciesTraits';
import { heroPortrait } from '@/lib/heroPortraits';
import { appearanceFor, defaultAppearance } from '@/lib/appearance';
import { voiceFor } from '@/lib/voiceAssets';
import { ALL_CHARACTERS, PLAYER_CHARACTERS, DND_CHARACTER_PRESETS } from '@/lib/characterAssets';
import CharacterPortraitRenderer from '@/components/CharacterPortraitRenderer';
import CharacterAvatarRenderer from '@/components/CharacterAvatarRenderer';
import CharacterCustomization from '@/components/CharacterCustomization';
import EileenAside from '@/components/EileenAside';
import Link from 'next/link';

const FANTASY_RACES = ['人类', '精灵', '木精灵', '高等精灵', '矮人', '半身人', '半兽人', '龙裔', '半精灵', '提夫林'];
const FANTASY_CLASSES = ['战士', '法师', '游荡者', '牧师', '游侠', '圣骑士', '德鲁伊', '吟游诗人', '术士', '邪术师'];
const PORTRAIT_POSES = [['idle', '待机'], ['talk', '交谈'], ['action', '出手']] as const;

const CTHULHU_RACES = ['人类', '近现代市民', '异界契约者', '秘教幸存者', '混血裔'];
const CTHULHU_CLASSES = ['私家侦探', '密大教授', '战地医师', '调查记者', '探险家', '神秘学者', '古董收藏家', '考古学家', '退伍军官'];

// 1. 种族基础加成规则表 (以全 10 点凡人属性为统一基准)
export const RACE_BONUSES: Record<string, { stats: Partial<Record<AttributeKey, number>>; desc: string }> = {
  '人类': { stats: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, desc: '全能进取：全核心属性 +1' },
  '精灵': { stats: { dex: 2, wis: 1 }, desc: '敏锐轻灵：敏捷 +2，感知 +1' },
  '木精灵': { stats: { dex: 2, wis: 1 }, desc: '林地旅者：敏捷 +2，感知 +1' },
  '高等精灵': { stats: { dex: 2, int: 1 }, desc: '奥术传承：敏捷 +2，智力 +1' },
  '矮人': { stats: { con: 2, str: 2 }, desc: '坚韧刚毅：体质 +2，力量 +2' },
  '半精灵': { stats: { cha: 2, dex: 1, con: 1 }, desc: '博采众长：魅力 +2，敏捷 +1，体质 +1' },
  '半身人': { stats: { dex: 2, cha: 1 }, desc: '灵巧机敏：敏捷 +2，魅力 +1' },
  '半兽人': { stats: { str: 2, con: 1 }, desc: '凶蛮强韧：力量 +2，体质 +1' },
  '提夫林': { stats: { cha: 2, int: 1 }, desc: '炼狱传承：魅力 +2，智力 +1' },
  '龙裔': { stats: { str: 2, cha: 1 }, desc: '巨龙威仪：力量 +2，魅力 +1' },
  // 克苏鲁背景种族
  '近现代市民': { stats: { wis: 1, int: 1, cha: 1 }, desc: '世俗洞察：感知 +1，智力 +1，魅力 +1' },
  '异界契约者': { stats: { int: 2, cha: 1, wis: 1 }, desc: '密契知识：智力 +2，魅力 +1，感知 +1' },
  '秘教幸存者': { stats: { wis: 2, con: 1 }, desc: '理智磨砺：感知 +2，体质 +1' },
  '混血裔': { stats: { con: 2, int: 1 }, desc: '深潜血裔：体质 +2，智力 +1' },
};

// 2. 职业职能配置与战斗基数表 (生命骰 Hit Die、护甲基础与职业专注加成)
export interface ClassConfig {
  hitDie: number; // 职业生命骰: d6 -> 6, d8 -> 8, d10 -> 10, d12 -> 12
  baseArmorName: string;
  baseArmorAC: number;
  armorType: 'light' | 'medium' | 'heavy' | 'unarmored';
  shieldBonus: number;
  statFocus: Record<AttributeKey, number>; // 职业专注分配增减
  desc: string;
}

export const CLASS_CONFIGS: Record<string, ClassConfig> = {
  '圣骑士': {
    hitDie: 10,
    baseArmorName: '圣殿精钢板甲',
    baseArmorAC: 16,
    shieldBonus: 2,
    armorType: 'heavy',
    statFocus: { str: 5, dex: -1, con: 4, int: -2, wis: 1, cha: 3 },
    desc: '重装护卫与神圣制裁 (生命骰 d10, 基础重甲 AC 16 + 盾牌 2 = 18)',
  },
  '游侠': {
    hitDie: 10,
    baseArmorName: '猎手轻灵皮甲',
    baseArmorAC: 12,
    shieldBonus: 0,
    armorType: 'light',
    statFocus: { str: 1, dex: 5, con: 3, int: -1, wis: 4, cha: -2 },
    desc: '荒野追踪与致命箭术 (生命骰 d10, 基础皮甲 AC 12 + 敏捷修正)',
  },
  '游荡者': {
    hitDie: 8,
    baseArmorName: '暗影镶嵌皮甲',
    baseArmorAC: 12,
    shieldBonus: 0,
    armorType: 'light',
    statFocus: { str: -2, dex: 6, con: 2, int: 3, wis: 1, cha: 3 },
    desc: '潜行暗杀与机关专家 (生命骰 d8, 基础皮甲 AC 12 + 敏捷修正)',
  },
  '法师': {
    hitDie: 6,
    baseArmorName: '法师布袍 / 占星丝袍',
    baseArmorAC: 10,
    shieldBonus: 0,
    armorType: 'unarmored',
    statFocus: { str: -3, dex: 2, con: 2, int: 6, wis: 3, cha: -1 },
    desc: '奥术掌控与广博秘识 (生命骰 d6, 基础 AC 10 + 敏捷修正)',
  },
  '战士': {
    hitDie: 10,
    baseArmorName: '重装精钢半身甲',
    baseArmorAC: 14,
    shieldBonus: 2,
    armorType: 'medium',
    statFocus: { str: 5, dex: 1, con: 4, int: -1, wis: 1, cha: -1 },
    desc: '百战老兵与钢铁意志 (生命骰 d10, 基础 AC 14 + 盾牌 2 + 敏捷)',
  },
  '牧师': {
    hitDie: 8,
    baseArmorName: '链甲胸甲 + 圣徽盾',
    baseArmorAC: 14,
    shieldBonus: 2,
    armorType: 'medium',
    statFocus: { str: 3, dex: -1, con: 3, int: 0, wis: 5, cha: 1 },
    desc: '神圣祷告与虔诚治愈 (生命骰 d8, 基础 AC 16)',
  },
  '德鲁伊': {
    hitDie: 8,
    baseArmorName: '生灵兽皮甲 + 木盾',
    baseArmorAC: 12,
    shieldBonus: 2,
    armorType: 'medium',
    statFocus: { str: 0, dex: 2, con: 3, int: 1, wis: 5, cha: -1 },
    desc: '自然盟友与荒野变形 (生命骰 d8, 基础皮甲 AC 12 + 敏捷)',
  },
  '吟游诗人': {
    hitDie: 8,
    baseArmorName: '华丽刺绣软甲',
    baseArmorAC: 11,
    shieldBonus: 0,
    armorType: 'light',
    statFocus: { str: -2, dex: 3, con: 2, int: 1, wis: 1, cha: 5 },
    desc: '博闻广识与声乐激励 (生命骰 d8, 基础软甲 AC 11 + 敏捷修正)',
  },
  '术士': {
    hitDie: 6,
    baseArmorName: '秘法便袍',
    baseArmorAC: 10,
    shieldBonus: 0,
    armorType: 'unarmored',
    statFocus: { str: -2, dex: 3, con: 3, int: 0, wis: 0, cha: 6 },
    desc: '血脉异能与狂乱魔力 (生命骰 d6, 基础 AC 10 + 敏捷修正)',
  },
  '邪术师': {
    hitDie: 8,
    baseArmorName: '漆黑皮革长袍',
    baseArmorAC: 11,
    shieldBonus: 0,
    armorType: 'light',
    statFocus: { str: -1, dex: 3, con: 3, int: 1, wis: 0, cha: 5 },
    desc: '异界契约与邪术魔能 (生命骰 d8, 基础 AC 11 + 敏捷修正)',
  },
  // 克苏鲁职业
  '私家侦探': {
    hitDie: 8,
    baseArmorName: '加厚防暴风衣',
    baseArmorAC: 11,
    shieldBonus: 0,
    armorType: 'light',
    statFocus: { str: 1, dex: 3, con: 2, int: 5, wis: 3, cha: 1 },
    desc: '密室勘验与持枪搜查 (生命骰 d8, 基础 AC 11 + 敏捷)',
  },
  '密大教授': {
    hitDie: 6,
    baseArmorName: '粗花呢学者大衣',
    baseArmorAC: 10,
    shieldBonus: 0,
    armorType: 'unarmored',
    statFocus: { str: -3, dex: 0, con: 1, int: 7, wis: 5, cha: 1 },
    desc: '神话研读与逻辑推理 (生命骰 d6, 基础 AC 10 + 敏捷)',
  },
  '战地医师': {
    hitDie: 8,
    baseArmorName: '军医护甲背心',
    baseArmorAC: 11,
    shieldBonus: 0,
    armorType: 'light',
    statFocus: { str: 0, dex: 2, con: 3, int: 4, wis: 6, cha: 0 },
    desc: '野战急救与解剖洞察 (生命骰 d8, 基础 AC 11 + 敏捷)',
  },
  '调查记者': {
    hitDie: 8,
    baseArmorName: '便携防风夹克',
    baseArmorAC: 10,
    shieldBonus: 0,
    armorType: 'unarmored',
    statFocus: { str: -1, dex: 4, con: 1, int: 3, wis: 2, cha: 5 },
    desc: '社交刺探与现场记录 (生命骰 d8, 基础 AC 10 + 敏捷)',
  },
  '探险家': {
    hitDie: 10,
    baseArmorName: '探险硬质皮衣',
    baseArmorAC: 12,
    shieldBonus: 0,
    armorType: 'light',
    statFocus: { str: 3, dex: 4, con: 4, int: 1, wis: 3, cha: -1 },
    desc: '遗迹求生与开路先锋 (生命骰 d10, 基础 AC 12 + 敏捷)',
  },
  '神秘学者': {
    hitDie: 6,
    baseArmorName: '占星长袍',
    baseArmorAC: 10,
    shieldBonus: 0,
    armorType: 'unarmored',
    statFocus: { str: -3, dex: 1, con: 1, int: 6, wis: 6, cha: 1 },
    desc: '禁忌仪式与古物通晓 (生命骰 d6, 基础 AC 10 + 敏捷)',
  },
  '古董收藏家': {
    hitDie: 8,
    baseArmorName: '高级西装外套',
    baseArmorAC: 10,
    shieldBonus: 0,
    armorType: 'unarmored',
    statFocus: { str: -1, dex: 1, con: 1, int: 5, wis: 4, cha: 4 },
    desc: '文物鉴定与黑市交易 (生命骰 d8, 基础 AC 10 + 敏捷)',
  },
  '考古学家': {
    hitDie: 8,
    baseArmorName: '耐磨工装皮甲',
    baseArmorAC: 11,
    shieldBonus: 0,
    armorType: 'light',
    statFocus: { str: 2, dex: 2, con: 3, int: 5, wis: 4, cha: 0 },
    desc: '地宫挖掘与机关破解 (生命骰 d8, 基础 AC 11 + 敏捷)',
  },
  '退伍军官': {
    hitDie: 10,
    baseArmorName: '军用防弹背心',
    baseArmorAC: 13,
    shieldBonus: 0,
    armorType: 'medium',
    statFocus: { str: 4, dex: 2, con: 4, int: 1, wis: 2, cha: 2 },
    desc: '战术指挥与精准射击 (生命骰 d10, 基础 AC 13 + 敏捷)',
  },
};

// 根据种族与职业计算标准属性值（基准统一全 10 点）
export function calcStandardAttributes(race: string, className: string): Attributes {
  const raceData = RACE_BONUSES[race] || { stats: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, desc: '' };
  const classData = CLASS_CONFIGS[className] || CLASS_CONFIGS['游侠'];

  const res: Attributes = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  (Object.keys(res) as AttributeKey[]).forEach(attr => {
    const rBonus = raceData.stats[attr] || 0;
    const cBonus = classData.statFocus[attr] || 0;
    res[attr] = Math.max(1, Math.min(30, 10 + rBonus + cBonus));
  });
  return res;
}

// 根据职业、体质、敏捷、等级计算生命值 HP 与护甲 AC
export function calcCombatStats(className: string, conScore: number, dexScore: number, level = 1, hpPerLevel = 0) {
  const classData = CLASS_CONFIGS[className] || CLASS_CONFIGS['游侠'];
  const conMod = getModifier(conScore);
  const dexMod = getModifier(dexScore);

  const hitDie = classData.hitDie;
  const avgDie = Math.floor(hitDie / 2) + 1;
  const maxHp = Math.max(1, (hitDie + conMod) + (level - 1) * Math.max(1, avgDie + conMod)) + hpPerLevel * level;

  let ac = 10;
  if (classData.armorType === 'heavy') {
    ac = classData.baseArmorAC + (classData.shieldBonus || 0);
  } else if (classData.armorType === 'medium') {
    ac = classData.baseArmorAC + Math.min(2, Math.max(0, dexMod)) + (classData.shieldBonus || 0);
  } else {
    ac = classData.baseArmorAC + dexMod + (classData.shieldBonus || 0);
  }

  return {
    maxHp,
    ac: Math.max(10, ac),
    hitDie,
    baseArmorName: classData.baseArmorName,
    shieldBonus: classData.shieldBonus,
    armorType: classData.armorType,
    conMod,
    dexMod,
  };
}

function statsFor(character: Character, attributes = character.attributes, level = character.level) {
  const bonus = character.speciesTraits ? getSpeciesTraits(character.race).hpPerLevel : 0;
  return calcCombatStats(character.class, attributes.con, attributes.dex, level, bonus);
}

const DEFAULT_SKILLS: { name: string; attribute: AttributeKey; desc: string }[] = [
  { name: '运动', attribute: 'str', desc: '攀爬、跳跃、游泳、破门与力量对抗' },
  { name: '特技', attribute: 'dex', desc: '保持平衡、翻滚脱身、高空着陆与杂技' },
  { name: '巧手', attribute: 'dex', desc: '开锁撬门、拆解陷阱、盗窃与藏匿细软' },
  { name: '隐匿', attribute: 'dex', desc: '潜行躲避视线、不发出声响、潜伏阴影' },
  { name: '奥秘', attribute: 'int', desc: '法术符文、魔法学派、异界位面与神器' },
  { name: '历史', attribute: 'int', desc: '古代帝国、传说战役、王朝秘辛与考据' },
  { name: '调查', attribute: 'int', desc: '搜查密室暗门、推演破案线索、识破机关' },
  { name: '自然', attribute: 'int', desc: '动植物识别、地理气候与野外生态常识' },
  { name: '宗教', attribute: 'int', desc: '诸神教义、祭祀仪式、神圣图腾与死灵' },
  { name: '察觉', attribute: 'wis', desc: '警觉埋伏、敏锐听觉视觉与发现细节' },
  { name: '洞悉', attribute: 'wis', desc: '辨识谎言、识破微表情与推测真正意图' },
  { name: '医药', attribute: 'wis', desc: '伤口包扎、诊断中毒与稳定濒死同伴' },
  { name: '生存', attribute: 'wis', desc: '野外追踪、寻觅水源食物、辨识方向' },
  { name: '驯兽', attribute: 'wis', desc: '安抚狂暴野兽、驾驭坐骑与理解动物' },
  { name: '说服', attribute: 'cha', desc: '以理服人、外交谈判、化解冲突与交涉' },
  { name: '欺瞒', attribute: 'cha', desc: '编造谎言、掩盖真相、假扮身份与误导' },
  { name: '威吓', attribute: 'cha', desc: '以武力或言语震慑、严讯逼问施加心理压力' },
  { name: '表演', attribute: 'cha', desc: '乐器演奏、戏剧歌唱、演讲鼓舞与博取喝彩' },
];

export default function CharacterPage() {
  const [character, setCharacter] = useState<Character>(createDefaultCharacter);
  const [previewPose, setPreviewPose] = useState<(typeof PORTRAIT_POSES)[number][0]>('idle');
  const [portraitError, setPortraitError] = useState('');
  const [saveNotice, setSaveNotice] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCampaignLocked, setIsCampaignLocked] = useState(false);
  const lastSavedCharacter = useRef<string | null>(null);
  const [genreTheme, setGenreTheme] = useState<'fantasy' | 'cthulhu'>('fantasy');
  const [skillFilter, setSkillFilter] = useState<AttributeKey | 'all'>('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      const state = loadState() as Partial<CampaignState> | null;
      const savedChar = state?.campaignVersion === 2 ? state.party?.[0] || state.character || loadCharacter() : loadCharacter() || state?.character;
      if (savedChar) {
        const defaultChar = createDefaultCharacter(savedChar.portraitId || 'traveler');
        const loaded = {
          ...defaultChar,
          ...savedChar,
          attributes: { ...defaultChar.attributes, ...(savedChar.attributes || {}) },
          hp: savedChar.hp && typeof savedChar.hp.max === 'number' ? { ...savedChar.hp } : { ...defaultChar.hp },
          ac: typeof savedChar.ac === 'number' ? savedChar.ac : defaultChar.ac,
          skills: Array.isArray(savedChar.skills) && savedChar.skills.length > 0 ? savedChar.skills : defaultChar.skills,
          inventory: Array.isArray(savedChar.inventory) ? savedChar.inventory : defaultChar.inventory,
        };
        lastSavedCharacter.current = JSON.stringify(loaded);
        setCharacter(loaded);
      } else {
        lastSavedCharacter.current = null;
        setCharacter(prev => ({ ...prev, appearance: defaultAppearance(prev.race) }));
      }
      setIsCampaignLocked(Boolean(state?.currentScript || state?.battle));
      if (state?.currentScript?.genre?.includes('克苏鲁') || state?.currentScript?.genre?.includes('推理') || state?.currentScript?.genre?.includes('悬疑')) {
        setGenreTheme('cthulhu');
      }
      setIsLoaded(true);
    }, 0);
    const syncLock = (event: StorageEvent) => {
      if (event.key !== 'ai-tavern-state') return;
      const state = loadState() as Partial<CampaignState> | null;
      setIsCampaignLocked(Boolean(state?.currentScript || state?.battle));
      const primary = state?.campaignVersion === 2 ? state.party?.[0] : null;
      if (primary) {
        lastSavedCharacter.current = JSON.stringify(primary);
        setCharacter(primary);
      }
    };
    window.addEventListener('storage', syncLock);
    return () => { clearTimeout(timer); window.removeEventListener('storage', syncLock); };
  }, []);

  useEffect(() => {
    if (!isLoaded || location.hash !== '#hero-build') return;
    document.getElementById('hero-build')?.scrollIntoView();
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || isCampaignLocked || !character.id) return;
    const serialized = JSON.stringify(character);
    if (serialized === lastSavedCharacter.current) return;
    const state = loadState() as CampaignState | null;
    if (state?.currentScript || state?.battle) return;
    if (state?.campaignVersion === 2 && state.party?.length) {
      const primary = state.party[0];
      if (primary.id !== character.id) return;
      const member = createPartyMember(character);
      const sameBuild = primary.class === member.class && primary.level === member.level;
      const updated = {
        ...member,
        experience: primary.experience,
        position: primary.position,
        resources: sameBuild ? primary.resources : member.resources,
        conditions: (primary.hp.current > 0) === (member.hp.current > 0) ? primary.conditions : member.conditions,
        deathSaves: (primary.hp.current > 0) === (member.hp.current > 0) ? primary.deathSaves : member.deathSaves,
        temporaryHp: primary.temporaryHp,
      };
      const nextState: CampaignState = { ...state, character: updated, party: [updated, ...state.party.slice(1)] };
      saveState(nextState);
      saveCharacter(updated);
    } else {
      saveCharacter(character);
    }
    lastSavedCharacter.current = serialized;
  }, [character, isLoaded, isCampaignLocked]);

  const update = (field: keyof Character, value: unknown) => {
    setCharacter(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectCharacter = (charId: string) => {
    if (charId === 'custom') {
      setCharacter(prev => ({ ...prev, portraitId: 'custom', voiceId: voiceFor(prev.portraitId, prev.voiceId) }));
      setSaveNotice(true);
      setTimeout(() => setSaveNotice(false), 2000);
      return;
    }
    const preset = DND_CHARACTER_PRESETS[charId];
    if (preset) {
      setCharacter(prev => ({
        ...prev,
        name: prev.name === '未命名冒险者' || Object.values(DND_CHARACTER_PRESETS).some(p => p.name === prev.name) ? preset.name : prev.name,
        race: preset.race,
        class: preset.class,
        level: preset.level,
        attributes: { ...preset.attributes },
        skills: [...preset.skills],
        hp: { ...preset.hp },
        ac: preset.ac,
        inventory: [...preset.inventory],
        spells: [...preset.spells],
        backstory: prev.backstory && !Object.values(DND_CHARACTER_PRESETS).some(p => p.backstory === prev.backstory) ? prev.backstory : preset.backstory,
        notes: preset.notes,
        portraitId: charId,
        appearance: prev.appearance && { ...prev.appearance, active: false },
        speciesTraits: undefined,
        themeColor: preset.themeColor,
        avatarUrl: '', // 切换到官方主角形象
        portraitPoses: undefined,
      }));
      setSaveNotice(true);
      setTimeout(() => setSaveNotice(false), 2000);
    } else {
      update('portraitId', charId);
    }
  };

  const updateAttr = (attr: AttributeKey, value: number) => {
    const clampedVal = Math.max(1, Math.min(30, value));
    setCharacter(prev => {
      const nextAttrs = { ...prev.attributes, [attr]: clampedVal };
      const combat = statsFor(prev, nextAttrs);
      return {
        ...prev,
        attributes: nextAttrs,
        hp: {
          max: combat.maxHp,
          current: Math.min(prev.hp?.current ?? combat.maxHp, combat.maxHp),
        },
        ac: combat.ac,
      };
    });
  };

  const changePortraitPose = (pose: 'talk' | 'action', url: string) => {
    setCharacter(prev => ({ ...prev, portraitPoses: { ...prev.portraitPoses, [pose]: url.trim() || undefined } }));
  };

  const loadPortraitFile = async (file: File | undefined, pose: 'idle' | 'talk' | 'action') => {
    if (!file || !file.type.startsWith('image/')) return;
    setPortraitError('');
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      if (!context) throw new Error('浏览器无法处理这张图片。');
      const url = canvas.toDataURL('image/webp', 0.8);
      if (url.length > 400_000) throw new Error('立绘压缩后仍过大，请换一张较小的图。');
      if (pose === 'idle') setCharacter(prev => ({ ...prev, avatarUrl: url, portraitId: 'custom',
        voiceId: voiceFor(prev.portraitId, prev.voiceId),
        appearance: prev.appearance && { ...prev.appearance, active: false } }));
      else changePortraitPose(pose, url);
    } catch (cause) {
      setPortraitError(cause instanceof Error && cause.name !== 'InvalidStateError' ? cause.message : '无法读取立绘，请使用 PNG、JPG 或 WebP。');
    }
  };

  const applyBuild = (race: string, className: string) => {
    setCharacter(prev => {
      const attributes = calcStandardAttributes(race, className);
      const build = { ...prev, race, class: className, attributes, speciesTraits: genreTheme === 'fantasy' && FANTASY_RACES.includes(race) };
      const combat = statsFor(build);
      return {
        ...build,
        appearance: prev.appearance?.body === prev.race && race !== prev.race
          ? { ...prev.appearance, body: defaultAppearance(race).body } : prev.appearance,
        hp: { max: combat.maxHp, current: combat.maxHp },
        ac: combat.ac,
      };
    });
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 2000);
  };

  const handleRaceChange = (race: string) => applyBuild(race, character.class);
  const handleClassChange = (className: string) => applyBuild(character.race, className);
  const handleApplyStandardAttributes = () => applyBuild(character.race, character.class);
  const enableSpeciesTraits = () => setCharacter(prev => {
    if (prev.speciesTraits) return prev;
    const bonus = getSpeciesTraits(prev.race).hpPerLevel * prev.level;
    return { ...prev, speciesTraits: true, hp: { max: prev.hp.max + bonus, current: prev.hp.current > 0 ? prev.hp.current + bonus : 0 } };
  });

  const handleLevelChange = (level: number) => {
    setCharacter(prev => {
      const { maxHp } = statsFor(prev, prev.attributes, level);
      return { ...prev, level, hp: { max: maxHp, current: Math.min(prev.hp.current, maxHp) } };
    });
  };

  // 一键按当前职业与体质/敏捷重算战斗数值
  const handleAutoRecalculateCombat = () => {
    setCharacter(prev => {
      const combat = statsFor(prev);
      return {
        ...prev,
        hp: { max: combat.maxHp, current: combat.maxHp },
        ac: combat.ac,
      };
    });
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 2000);
  };

  // 跑团 4d6 掷骰随机生成点数 (4d6 去掉最低值 + 种族加成)
  const handleRoll4d6Attributes = () => {
    const rollSingle = () => {
      const rolls = rollDice(4, 6).sort((a, b) => b - a);
      return rolls[0] + rolls[1] + rolls[2]; // 取前三高之和
    };

    const raceBonus = RACE_BONUSES[character.race] || { stats: {} };
    const rolled: Attributes = {
      str: rollSingle() + (raceBonus.stats.str || 0),
      dex: rollSingle() + (raceBonus.stats.dex || 0),
      con: rollSingle() + (raceBonus.stats.con || 0),
      int: rollSingle() + (raceBonus.stats.int || 0),
      wis: rollSingle() + (raceBonus.stats.wis || 0),
      cha: rollSingle() + (raceBonus.stats.cha || 0),
    };

    const combat = statsFor(character, rolled);
    setCharacter(prev => ({
      ...prev,
      attributes: rolled,
      hp: { max: combat.maxHp, current: combat.maxHp },
      ac: combat.ac,
    }));
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 2000);
  };

  // 全部重置为 10 点凡人基准
  const handleResetToBaseline = () => {
    const baseline: Attributes = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const combat = statsFor(character, { ...character.attributes, con: 10, dex: 10 });
    setCharacter(prev => ({
      ...prev,
      attributes: baseline,
      hp: { max: combat.maxHp, current: combat.maxHp },
      ac: combat.ac,
    }));
  };

  const toggleSkill = (skillName: string, skillAttr: AttributeKey) => {
    setCharacter(prev => {
      const skills = prev.skills || [];
      const existing = skills.find(s => s.name === skillName);
      if (!existing) {
        // 1. 未熟练 -> 升级为 ⭐ 熟练 (+2)
        return {
          ...prev,
          skills: [...skills, { name: skillName, attribute: skillAttr, proficient: true, bonus: 2 }],
        };
      } else if (existing.bonus === 2) {
        // 2. ⭐ 熟练 -> 升级为 👑 专家专精 (+4)
        return {
          ...prev,
          skills: skills.map(s => s.name === skillName ? { ...s, bonus: 4 } : s),
        };
      } else {
        // 3. 👑 专精 -> 降级恢复为 ⚪ 未熟练
        return {
          ...prev,
          skills: skills.filter(s => s.name !== skillName),
        };
      }
    });
  };

  const addItem = () => {
    const item = prompt('添加物品名称（例如：精制治疗药水 / 银质短剑 / 韦伯斯特左轮）：');
    if (!item?.trim()) return;
    setCharacter(prev => ({
      ...prev,
      inventory: [...prev.inventory, item.trim()],
    }));
  };

  const removeItem = (index: number) => {
    setCharacter(prev => ({
      ...prev,
      inventory: prev.inventory.filter((_, i) => i !== index),
    }));
  };

  // 奇幻 D&D 预设一键套用
  const handleApplyFantasyPreset = (archetype: 'warrior' | 'mage' | 'ranger' | 'rogue') => {
    const charMap = {
      warrior: 'paladin_arthur',
      ranger: 'traveler',
      mage: 'selene',
      rogue: 'shadow_rogue',
    };
    handleSelectCharacter(charMap[archetype]);
  };

  // 克苏鲁 / 近代悬疑调查预设
  const handleApplyCthulhuPreset = (archetype: 'detective' | 'scholar' | 'doctor' | 'journalist') => {
    if (archetype === 'detective') {
      setCharacter(prev => ({
        ...prev,
        name: prev.name === '未命名冒险者' || Object.values(DND_CHARACTER_PRESETS).some(p => p.name === prev.name) ? '爱德华·霍克' : prev.name,
        race: '人类',
        class: '私家侦探',
        portraitId: 'shadow_rogue',
        attributes: { str: 12, dex: 14, con: 13, int: 16, wis: 14, cha: 12 },
        skills: [
          { name: '调查', attribute: 'int', proficient: true, bonus: 4 },
          { name: '洞悉', attribute: 'wis', proficient: true, bonus: 2 },
          { name: '察觉', attribute: 'wis', proficient: true, bonus: 2 },
          { name: '巧手', attribute: 'dex', proficient: true, bonus: 2 },
          { name: '欺瞒', attribute: 'cha', proficient: true, bonus: 2 },
        ],
        hp: { current: 11, max: 11 },
        ac: 13,
        inventory: ['点38韦伯斯特左轮手枪 (1d10)', '调查铅笔速记本', '火柴与防风打火机', '防暴破门手套', '放大镜与勘查镊子'],
        spells: ['rogue-sneak-attack'],
        backstory: '在雾气弥漫的港口城市开办私家侦探事务所的前任警督，专接各种离奇未结悬案。',
        notes: '【密室演绎】调查与现场勘验检定具有优势；【冷酷直觉】不受一般惊吓效果影响。',
      }));
    } else if (archetype === 'scholar') {
      setCharacter(prev => ({
        ...prev,
        name: prev.name === '未命名冒险者' || Object.values(DND_CHARACTER_PRESETS).some(p => p.name === prev.name) ? '亨利·阿米蒂奇' : prev.name,
        race: '人类',
        class: '密大教授',
        portraitId: 'selene',
        attributes: { str: 8, dex: 10, con: 12, int: 18, wis: 16, cha: 12 },
        skills: [
          { name: '奥秘', attribute: 'int', proficient: true, bonus: 4 },
          { name: '历史', attribute: 'int', proficient: true, bonus: 4 },
          { name: '调查', attribute: 'int', proficient: true, bonus: 2 },
          { name: '洞悉', attribute: 'wis', proficient: true, bonus: 2 },
        ],
        hp: { current: 9, max: 9 },
        ac: 10,
        inventory: ['拉丁文禁忌古籍残卷', '手持黄铜放大镜', '密斯卡托尼克教职证', '镇静剂胶囊 x3', '牛皮公文包'],
        spells: ['wizard-magic-missile'],
        backstory: '密斯卡托尼克大学历史系终身教授，在破译古老星象泥版后深陷不可名状的超自然迷局。',
        notes: '【博闻强识】可解读多数古代死语言与禁忌文字；【理智抵抗】面对精神震慑获得专注加值。',
      }));
    } else if (archetype === 'doctor') {
      setCharacter(prev => ({
        ...prev,
        name: prev.name === '未命名冒险者' || Object.values(DND_CHARACTER_PRESETS).some(p => p.name === prev.name) ? '华生·约翰逊' : prev.name,
        race: '人类',
        class: '战地医师',
        portraitId: 'paladin_arthur',
        attributes: { str: 11, dex: 12, con: 14, int: 15, wis: 17, cha: 12 },
        skills: [
          { name: '医药', attribute: 'wis', proficient: true, bonus: 4 },
          { name: '洞悉', attribute: 'wis', proficient: true, bonus: 2 },
          { name: '察觉', attribute: 'wis', proficient: true, bonus: 2 },
          { name: '调查', attribute: 'int', proficient: true, bonus: 2 },
        ],
        hp: { current: 12, max: 12 },
        ac: 12,
        inventory: ['战地野战急救箱', '精钢手术刀具套组', '吗啡镇痛针剂 x2', '双筒听诊器', '消毒酒精与绷带'],
        spells: ['cleric-healing-word'],
        backstory: '曾在远洋战役中服役的退役军医，医术精湛，对各种诡异的非自然伤口有着敏锐的洞察。',
        notes: '【战场急救】治疗类检定具有优势；【解剖学识】攻击时可精准打击生物弱点。',
      }));
    } else if (archetype === 'journalist') {
      setCharacter(prev => ({
        ...prev,
        name: prev.name === '未命名冒险者' || Object.values(DND_CHARACTER_PRESETS).some(p => p.name === prev.name) ? '克洛伊·斯通' : prev.name,
        race: '人类',
        class: '调查记者',
        portraitId: 'traveler',
        attributes: { str: 10, dex: 15, con: 12, int: 14, wis: 13, cha: 16 },
        skills: [
          { name: '说服', attribute: 'cha', proficient: true, bonus: 2 },
          { name: '欺瞒', attribute: 'cha', proficient: true, bonus: 2 },
          { name: '察觉', attribute: 'wis', proficient: true, bonus: 2 },
          { name: '隐匿', attribute: 'dex', proficient: true, bonus: 2 },
          { name: '调查', attribute: 'int', proficient: true, bonus: 2 },
        ],
        hp: { current: 10, max: 10 },
        ac: 12,
        inventory: ['老式镁光照相机', '未曝光胶卷 x5', '《号角日报》高级记者证', '小巧柯尔特防身手枪 (1d6)', '速记密码本'],
        spells: ['ranger-precision-shot'],
        backstory: '大都会知名报社的深度特稿记者，为了揭露深潜教团与政客勾结的真相不惜孤身涉险。',
        notes: '【新闻嗅觉】善于从路人对话中捕捉关键线索；【社交伪装】可轻松混入各类封闭名流集会。',
      }));
    }
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 2000);
  };

  if (!isLoaded) {
    return (
      <div className="flex-1 min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-[#E6A85C] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm font-serif text-[#FFD485] animate-pulse">正在载入角色档案工坊...</div>
        </div>
      </div>
    );
  }

  const { attributes } = character;
  const totalAttr = Object.values(attributes || {}).reduce((a, b) => a + b, 0);
  const origin = getSpeciesTraits(character.race);
  const portrait = heroPortrait(character);
  const speed = character.speciesTraits ? origin.speed : 30;

  return (
    <div className="flex-1 max-w-5xl mx-auto p-4 sm:p-6 space-y-6 animate-fade-in-up">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex justify-between items-center flex-wrap gap-3 border-b border-[#8296D8]/20 pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif-title text-[#FFD485] flex items-center gap-2">
            <span>🛡️</span> 冒险者档案与形象工坊
          </h1>
          <p className="text-xs text-[#8296D8] mt-1">
            设定你的角色六维属性、立绘形象与技能专精，实时同步至跑团舞台。
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveNotice && (
            <span className="text-xs text-[#52B788] font-bold animate-pulse">✓ 已自动保存！</span>
          )}
          <Link
            href="/game"
            className="btn-gold px-5 py-2 rounded-xl text-xs font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-1.5"
          >
            <span>🎲</span>
            <span>启程进入跑团舞台</span>
          </Link>
        </div>
      </div>
      {!isCampaignLocked && <EileenAside context="hero" />}
      </div>

      {isCampaignLocked && (
        <div role="status" className="galgame-card rounded-xl border border-[#E6A85C]/50 p-4 text-sm text-[#FFD485] space-y-2">
          <p>战役进行中，角色档案已锁定。请先返回跑团舞台；战斗结束后使用「返回整备」，再修改角色。</p>
          <Link href="/game" className="underline font-bold">返回跑团舞台与队伍整备</Link>
        </div>
      )}
      <fieldset disabled={isCampaignLocked} className="min-w-0 space-y-6 disabled:opacity-70">
      {/* 快速预设流派与剧本题材切换 */}
      <div className="galgame-card p-4 rounded-2xl flex items-center justify-between flex-wrap gap-3 border border-[#8296D8]/20">
        <div className="flex items-center gap-3">
          <div className="text-xs">
            <span className="font-bold text-[#FFD485] mr-2">⚡ 剧本题材与流派预设:</span>
            <span className="text-[#8296D8]">根据所选剧本一键套用匹配的职能属性与装备</span>
          </div>

          {/* 题材切换模式按钮 */}
          <div className="flex bg-[#0E1424] p-1 rounded-xl border border-[#8296D8]/30">
            <button
              type="button"
              onClick={() => setGenreTheme('fantasy')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                genreTheme === 'fantasy'
                  ? 'bg-[#E6A85C] text-[#0B1020] shadow'
                  : 'text-[#8296D8] hover:text-[#FFD485]'
              }`}
            >
              ⚔️ 奇幻 D&D 跑团
            </button>
            <button
              type="button"
              onClick={() => setGenreTheme('cthulhu')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                genreTheme === 'cthulhu'
                  ? 'bg-[#E63946] text-[#FFF] shadow'
                  : 'text-[#8296D8] hover:text-[#FFD485]'
              }`}
            >
              👁️ 克苏鲁 / 悬疑调查
            </button>
          </div>
        </div>

        {/* 预设按钮组 */}
        <div className="flex gap-2 flex-wrap">
          {genreTheme === 'fantasy' ? (
            <>
              <button
                type="button"
                onClick={() => handleApplyFantasyPreset('warrior')}
                className="px-3 py-1 rounded-lg bg-[#151D30] hover:bg-[#1E2942] border border-[#E6A85C]/30 text-xs font-semibold text-[#FFD485] transition-all"
              >
                🛡️ 圣殿骑士
              </button>
              <button
                type="button"
                onClick={() => handleApplyFantasyPreset('ranger')}
                className="px-3 py-1 rounded-lg bg-[#151D30] hover:bg-[#1E2942] border border-[#52B788]/40 text-xs font-semibold text-[#52B788] transition-all"
              >
                🏹 翠绿游侠
              </button>
              <button
                type="button"
                onClick={() => handleApplyFantasyPreset('mage')}
                className="px-3 py-1 rounded-lg bg-[#151D30] hover:bg-[#1E2942] border border-[#8296D8]/40 text-xs font-semibold text-[#8296D8] transition-all"
              >
                🔮 银月法师
              </button>
              <button
                type="button"
                onClick={() => handleApplyFantasyPreset('rogue')}
                className="px-3 py-1 rounded-lg bg-[#151D30] hover:bg-[#1E2942] border border-[#E67E22]/40 text-xs font-semibold text-[#E67E22] transition-all"
              >
                🗡️ 暗影游荡者
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleApplyCthulhuPreset('detective')}
                className="px-3 py-1 rounded-lg bg-[#151D30] hover:bg-[#1E2942] border border-[#E63946]/40 text-xs font-semibold text-[#E63946] transition-all"
              >
                🕵️ 私家侦探
              </button>
              <button
                type="button"
                onClick={() => handleApplyCthulhuPreset('scholar')}
                className="px-3 py-1 rounded-lg bg-[#151D30] hover:bg-[#1E2942] border border-[#8296D8]/40 text-xs font-semibold text-[#8296D8] transition-all"
              >
                📖 密大教授
              </button>
              <button
                type="button"
                onClick={() => handleApplyCthulhuPreset('doctor')}
                className="px-3 py-1 rounded-lg bg-[#151D30] hover:bg-[#1E2942] border border-[#52B788]/40 text-xs font-semibold text-[#52B788] transition-all"
              >
                💉 战地医师
              </button>
              <button
                type="button"
                onClick={() => handleApplyCthulhuPreset('journalist')}
                className="px-3 py-1 rounded-lg bg-[#151D30] hover:bg-[#1E2942] border border-[#FFD485]/40 text-xs font-semibold text-[#FFD485] transition-all"
              >
                📰 调查记者
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ============================================================ */}
        {/* 左栏 (4/12): 属性、战斗数据、身份与六维体系                   */}
        {/* ============================================================ */}
        <div className="lg:col-span-4 space-y-4">
          {/* 基本身份与等级 */}
          <section id="hero-build" className="galgame-card scroll-mt-24 rounded-2xl p-4 space-y-3 border border-[#8296D8]/20">
            <div className="flex justify-between items-center flex-wrap gap-1 border-b border-[#8296D8]/15 pb-2">
              <h2 className="text-xs font-bold font-serif-title text-[#FFD485] flex items-center gap-1.5">
                自定义英雄
              </h2>
              <span className="text-[10px] text-[#8296D8] bg-[#0E1424] px-2 py-0.5 rounded border border-[#8296D8]/20">
                种族与职业搭配
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 items-end">
              <div>
                <label className="h-5 flex items-center text-[11px] text-[#8296D8] font-semibold mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                  冒险者姓名
                </label>
                <input
                  value={character.name}
                  onChange={e => update('name', e.target.value)}
                  className="w-full h-9 bg-[#0B1020] border border-[#8296D8]/30 text-[#F1E5CE] text-xs font-semibold rounded-lg px-2.5 focus:border-[#E6A85C] focus:outline-none"
                  placeholder="输入冒险者姓名"
                />
              </div>

              <div>
                <label className="h-5 flex items-center text-[11px] text-[#8296D8] font-semibold mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                  当前等级 (Level)
                </label>
                <div className="flex items-center gap-1 h-9">
                  <button
                    type="button"
                    onClick={() => handleLevelChange(Math.max(1, character.level - 1))}
                    className="w-8 h-9 bg-[#151D30] hover:bg-[#8296D8]/20 text-[#8296D8] rounded-lg flex items-center justify-center font-bold border border-[#8296D8]/30 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={character.level}
                    onChange={e => handleLevelChange(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                    className="w-full h-9 bg-[#0B1020] border border-[#8296D8]/30 text-[#F1E5CE] text-xs font-mono font-bold text-center rounded-lg px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-[#E6A85C]"
                  />
                  <button
                    type="button"
                    onClick={() => handleLevelChange(Math.min(20, character.level + 1))}
                    className="w-8 h-9 bg-[#151D30] hover:bg-[#8296D8]/20 text-[#8296D8] rounded-lg flex items-center justify-center font-bold border border-[#8296D8]/30 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="h-5 flex items-center text-[11px] text-[#8296D8] font-semibold mb-1 whitespace-nowrap overflow-hidden text-ellipsis" title="种族决定天生属性加成">
                  角色种族 <span className="text-[10px] text-[#8296D8]/60 ml-1">(属性加成)</span>
                </label>
                <select
                  aria-label="角色种族"
                  value={character.race}
                  onChange={e => handleRaceChange(e.target.value)}
                  className="w-full h-9 bg-[#0B1020] border border-[#8296D8]/30 text-[#F1E5CE] text-xs font-semibold rounded-lg px-2 focus:border-[#E6A85C] focus:outline-none cursor-pointer"
                >
                  {(genreTheme === 'cthulhu' ? CTHULHU_RACES : FANTASY_RACES).map(r => (
                    <option key={r} value={r} className="bg-[#0B1020] text-[#F1E5CE] py-1">{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="h-5 flex items-center text-[11px] text-[#8296D8] font-semibold mb-1 whitespace-nowrap overflow-hidden text-ellipsis" title="职业决定生命骰与护甲">
                  职业 / 身份 <span className="text-[10px] text-[#8296D8]/60 ml-1">(生命/护甲)</span>
                </label>
                <select
                  aria-label="职业或身份"
                  value={character.class}
                  onChange={e => handleClassChange(e.target.value)}
                  className="w-full h-9 bg-[#0B1020] border border-[#8296D8]/30 text-[#F1E5CE] text-xs font-semibold rounded-lg px-2 focus:border-[#E6A85C] focus:outline-none cursor-pointer"
                >
                  {(genreTheme === 'cthulhu' ? CTHULHU_CLASSES : FANTASY_CLASSES).map(c => (
                    <option key={c} value={c} className="bg-[#0B1020] text-[#F1E5CE] py-1">{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rounded-lg border border-[#aa855055] bg-[#211b16] p-3 text-xs leading-relaxed" aria-live="polite">
              <p className="font-bold text-[#f1d4a5]">{character.race} · {character.class}</p>
              <p className="mt-1 text-[#eadac1]">生命 {character.hp.max} · 护甲 {character.ac} · 移动 {speed} 尺 · {weaponFor(character.class, character.speciesTraits ? character.race : undefined).name}</p>
              {genreTheme === 'fantasy' && origin.description && <p className="mt-1 text-[#e8c99e]">{origin.description}</p>}
              {!character.speciesTraits && genreTheme === 'fantasy' && origin.description && <button type="button" className="mt-2 text-[#ffd596] underline underline-offset-4" onClick={enableSpeciesTraits}>启用种族特性</button>}
            </div>
          </section>

          {/* 战斗数据与护甲 */}
          {(() => {
            const combatCalc = statsFor(character);
            const curHp = character.hp?.current ?? combatCalc.maxHp;
            const maxHp = character.hp?.max ?? combatCalc.maxHp;
            const ac = character.ac ?? combatCalc.ac;
            const hpPct = Math.min(100, Math.max(0, Math.round((curHp / maxHp) * 100)));

            return (
              <section className="galgame-card rounded-2xl p-4 space-y-3 border border-[#8296D8]/20">
                <div className="flex justify-between items-center border-b border-[#8296D8]/15 pb-2">
                  <h2 className="text-xs font-bold font-serif-title text-[#FFD485] flex items-center gap-1.5">
                    <span>⚔️</span> 战斗状态与护甲
                  </h2>
                  <button
                    type="button"
                    onClick={handleAutoRecalculateCombat}
                    className="px-2 py-0.5 text-[10px] font-bold text-[#FFD485] bg-[#E6A85C]/15 hover:bg-[#E6A85C]/25 border border-[#E6A85C]/40 rounded transition-colors flex items-center gap-1"
                    title="按当前职业生命骰、体质修正与基础护甲重算"
                  >
                    <span>🔄</span> 规则重算
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* 当前生命值 */}
                  <div className="bg-[#24141F]/60 p-2.5 rounded-xl border border-[#E6A85C]/40 flex flex-col justify-between space-y-1.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-[#FFD485] font-bold">❤️ 当前生命</span>
                      <span className="font-mono text-[#F1E5CE]/80">{hpPct}%</span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => update('hp', { max: maxHp, current: Math.max(0, curHp - 1) })}
                        className="w-6 h-7 rounded bg-[#3B182B] hover:bg-[#521C38] text-[#FFD485] font-bold text-xs border border-[#E6A85C]/40 flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={maxHp}
                        value={curHp}
                        onChange={e => update('hp', { max: maxHp, current: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-11 h-7 text-center text-sm font-bold font-mono text-[#FFD485] bg-[#0B1020] border border-[#E6A85C]/50 rounded px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => update('hp', { max: maxHp, current: Math.min(maxHp, curHp + 1) })}
                        className="w-6 h-7 rounded bg-[#3B182B] hover:bg-[#521C38] text-[#FFD485] font-bold text-xs border border-[#E6A85C]/40 flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <div className="w-full bg-[#0E1424] h-1 rounded-full overflow-hidden border border-[#8296D8]/20">
                      <div
                        className="h-full bg-gradient-to-r from-[#E27D60] to-[#E6A85C] transition-all duration-300"
                        style={{ width: `${hpPct}%` }}
                      />
                    </div>
                  </div>

                  {/* 最大生命上限 */}
                  <div className="bg-[#151D30] p-2.5 rounded-xl border border-[#8296D8]/20 flex flex-col justify-between space-y-1.5">
                    <div className="text-[10px] text-[#8296D8] font-bold">🩸 上限 Max HP</div>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => update('hp', { max: Math.max(1, maxHp - 1), current: Math.min(curHp, maxHp - 1) })}
                        className="w-6 h-7 rounded bg-[#0E1424] hover:bg-[#1A253D] text-[#8296D8] font-bold text-xs border border-[#8296D8]/30 flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={maxHp}
                        onChange={e => update('hp', { max: Math.max(1, Number(e.target.value) || 1), current: curHp })}
                        className="w-11 h-7 text-center text-sm font-bold font-mono text-[#F1E5CE] bg-[#0B1020] border border-[#8296D8]/40 rounded px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => update('hp', { max: maxHp + 1, current: curHp })}
                        className="w-6 h-7 rounded bg-[#0E1424] hover:bg-[#1A253D] text-[#8296D8] font-bold text-xs border border-[#8296D8]/30 flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-[9px] text-[#8296D8] bg-[#0E1424] py-0.5 px-1 rounded border border-[#8296D8]/20 text-center truncate" title={`d${combatCalc.hitDie}(${combatCalc.hitDie}) ＋ 体质(${combatCalc.conMod >= 0 ? '+' : ''}${combatCalc.conMod})`}>
                      d{combatCalc.hitDie}＋体质({combatCalc.conMod >= 0 ? '+' : ''}${combatCalc.conMod})
                    </div>
                  </div>

                  {/* 护甲等级 */}
                  <div className="bg-[#151D30] p-2.5 rounded-xl border border-[#8296D8]/20 flex flex-col justify-between space-y-1.5">
                    <div className="text-[10px] text-[#8296D8] font-bold">🛡️ 护甲 (AC)</div>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => update('ac', Math.max(0, ac - 1))}
                        className="w-6 h-7 rounded bg-[#0E1424] hover:bg-[#1A253D] text-[#8296D8] font-bold text-xs border border-[#8296D8]/30 flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={ac}
                        onChange={e => update('ac', Math.max(0, Number(e.target.value) || 0))}
                        className="w-11 h-7 text-center text-sm font-bold font-mono text-[#F1E5CE] bg-[#0B1020] border border-[#8296D8]/40 rounded px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => update('ac', ac + 1)}
                        className="w-6 h-7 rounded bg-[#0E1424] hover:bg-[#1A253D] text-[#8296D8] font-bold text-xs border border-[#8296D8]/30 flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-[9px] text-[#8296D8] bg-[#0E1424] py-0.5 px-1 rounded border border-[#8296D8]/20 text-center truncate" title={`${combatCalc.baseArmorName} ＋ 敏捷(${combatCalc.dexMod >= 0 ? '+' : ''}${combatCalc.dexMod})`}>
                      {combatCalc.baseArmorName.split(' ')[0]}
                    </div>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* 核心六维基础属性体系 */}
          {(() => {
            const currentRaceBonus = RACE_BONUSES[character.race] || { stats: {}, desc: '凡人基准' };
            const currentClassConfig = CLASS_CONFIGS[character.class] || CLASS_CONFIGS['游侠'];

            return (
              <section className="galgame-card rounded-2xl p-4 space-y-3 border border-[#8296D8]/20">
                <div className="flex justify-between items-center flex-wrap gap-1 border-b border-[#8296D8]/15 pb-2">
                  <h2 className="text-xs font-bold font-serif-title text-[#FFD485] flex items-center gap-1.5">
                    <span>⚡</span> 核心六维基础属性
                  </h2>
                  <span className="text-[10px] text-[#E6A85C] bg-[#E6A85C]/15 px-2 py-0.5 rounded border border-[#E6A85C]/30 font-mono font-bold">
                    总和: {totalAttr} 点
                  </span>
                </div>

                {/* 六维属性网格 (3x2 完美自适应布局) */}
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(ATTRIBUTE_LABELS) as AttributeKey[]).map(attr => {
                    const val = attributes[attr];
                    const mod = getModifier(val);
                    const sign = mod >= 0 ? '+' : '';
                    const rVal = currentRaceBonus.stats[attr] || 0;
                    const cVal = currentClassConfig.statFocus[attr] || 0;

                    return (
                      <div
                        key={attr}
                        className="bg-[#151D30] p-2 rounded-xl border border-[#8296D8]/20 text-center space-y-1.5 hover:border-[#E6A85C]/40 transition-colors flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-[#FFD485] font-bold">
                            {ATTRIBUTE_LABELS[attr]}
                          </span>
                          <span className="text-[9px] text-[#8296D8] uppercase font-mono">
                            {attr}
                          </span>
                        </div>

                        {/* 数值与微调按钮 */}
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateAttr(attr, val - 1)}
                            className="w-5 h-6 rounded bg-[#0E1424] hover:bg-[#1A253D] text-[#8296D8] font-bold text-xs border border-[#8296D8]/30 flex items-center justify-center transition-colors"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={val}
                            onChange={e => updateAttr(attr, Number(e.target.value) || 1)}
                            className="w-10 h-6 text-center text-sm font-bold font-mono text-[#F1E5CE] bg-[#0B1020] border border-[#8296D8]/30 rounded px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-[#E6A85C]"
                          />
                          <button
                            type="button"
                            onClick={() => updateAttr(attr, val + 1)}
                            className="w-5 h-6 rounded bg-[#0E1424] hover:bg-[#1A253D] text-[#8296D8] font-bold text-xs border border-[#8296D8]/30 flex items-center justify-center transition-colors"
                          >
                            +
                          </button>
                        </div>

                        {/* D&D 修正 */}
                        <div className="text-[10px] font-mono font-bold text-[#52B788] bg-[#0E1424] py-0.5 rounded border border-[#8296D8]/20">
                          修正 {sign}{mod}
                        </div>

                        {/* 构成 */}
                        <div className="text-[8px] text-[#8296D8]/80 bg-[#0E1424]/60 py-0.5 px-0.5 rounded truncate" title={`10 ＋ 种族${rVal >= 0 ? '+' : ''}${rVal} ＋ 职业${cVal >= 0 ? '+' : ''}${cVal}`}>
                          10{rVal !== 0 ? ` 族${rVal > 0 ? '+' : ''}${rVal}` : ''}{cVal !== 0 ? ` 职${cVal > 0 ? '+' : ''}${cVal}` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 快捷操作栏 */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleApplyStandardAttributes}
                    className="px-2 py-1 text-[10px] font-bold text-[#FFD485] bg-[#E6A85C]/20 hover:bg-[#E6A85C]/30 border border-[#E6A85C]/40 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span>🔄</span> 标准加点
                  </button>
                  <button
                    type="button"
                    onClick={handleRoll4d6Attributes}
                    className="px-2 py-1 text-[10px] font-bold text-[#D8B4FE] bg-[#A855F7]/20 hover:bg-[#A855F7]/30 border border-[#A855F7]/40 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span>🎲</span> 4d6掷骰
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToBaseline}
                    className="px-2 py-1 text-[10px] text-[#8296D8] hover:text-[#F1E5CE] bg-[#0E1424] hover:bg-[#151D30] border border-[#8296D8]/20 rounded-lg transition-colors"
                  >
                    🧹 全10基准
                  </button>
                </div>
              </section>
            );
          })()}
        </div>

        {/* ============================================================ */}
        {/* 中栏 (4/12): 角色主立绘 Showcase、战力总览与故事传记           */}
        {/* ============================================================ */}
        <div className="lg:col-span-4 space-y-4">
          {/* 主立绘 Showcase 面板 */}
          <div className="galgame-card p-4 rounded-2xl flex flex-col items-center text-center space-y-3 border border-[#E6A85C]/30 relative overflow-hidden">
            <h2 className="text-xs font-serif-title font-bold text-[#FFD485] tracking-widest uppercase">
              角色立绘预览
            </h2>

            {/* 大立绘渲染容器 */}
            <div className="w-full h-80 flex items-end justify-center rounded-xl bg-[radial-gradient(ellipse_at_50%_40%,#473527,#171414_74%)] border border-[#aa855055] overflow-hidden relative">
              <CharacterPortraitRenderer
                characterId={character.portraitId || 'traveler'}
                imageUrl={portrait}
                layers={appearanceFor(character)}
                portraitName={character.name}
                pose={previewPose}
                portraitPoses={character.avatarUrl ? character.portraitPoses : undefined}
                size="full"
                showGlow={false}
              />
            </div>

            {/* 表情差分切换 */}
            <div className="w-full space-y-1.5" suppressHydrationWarning>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[#8296D8]">预览舞台反应</span>
                <span className="text-[10px] text-[#FFD485]">{character.avatarUrl ? '自定义图片' : `${character.race} · ${character.class}`}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5" suppressHydrationWarning>
                {PORTRAIT_POSES.map(([pose, label]) => (
                  <button
                    key={pose}
                    type="button"
                    aria-pressed={previewPose === pose}
                    suppressHydrationWarning
                    onClick={() => setPreviewPose(pose)}
                    className={`py-1 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all active:scale-95 ${
                      previewPose === pose
                        ? 'bg-[#E6A85C] text-[#0B1020] shadow-md font-bold'
                        : 'bg-[#151D30] text-[#F1E5CE]/80 hover:bg-[#1E2942] border border-[#8296D8]/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI 绘图 Prompt 展开面板 */}
            {(() => {
              const activeConfig = ALL_CHARACTERS.find(c => c.id === (character.portraitId || 'traveler')) || ALL_CHARACTERS[0];
              return (
                <div className="w-full text-left p-2.5 rounded-xl bg-[#0F1626] border border-[#E6A85C]/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#FFD485] flex items-center gap-1">
                      <span>🎨</span> AI 绘图/建模 Prompt
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeConfig.prompt);
                        alert(`已复制 ${activeConfig.name} 的 AI 绘图 Prompt！`);
                      }}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-[#E6A85C]/20 hover:bg-[#E6A85C]/40 text-[#FFD485] border border-[#E6A85C]/40 transition-colors"
                    >
                      复制英文 Prompt
                    </button>
                  </div>
                  
                  <p className="text-[9px] text-[#F1E5CE]/80 line-clamp-2 leading-relaxed font-mono bg-[#080D18] p-1.5 rounded border border-[#8296D8]/15">
                    {activeConfig.prompt}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* 角色核心战力与定位 Dashboard */}
          {(() => {
            const combatCalc = statsFor(character);
            const curHp = character.hp?.current ?? combatCalc.maxHp;
            const maxHp = character.hp?.max ?? combatCalc.maxHp;
            const ac = character.ac ?? combatCalc.ac;
            const hpPct = Math.min(100, Math.max(0, Math.round((curHp / maxHp) * 100)));

            const profCount = (character.skills || []).filter(s => (s.bonus || 2) === 2).length;
            const expCount = (character.skills || []).filter(s => s.bonus === 4).length;

            return (
              <section className="galgame-card rounded-2xl p-4 space-y-2.5 border border-[#8296D8]/20">
                <div className="flex justify-between items-center border-b border-[#8296D8]/15 pb-1.5">
                  <h2 className="text-xs font-bold font-serif-title text-[#FFD485] flex items-center gap-1.5">
                    <span>📊</span> 角色核心战力 Dashboard
                  </h2>
                  <span className="text-[10px] text-[#52B788] font-mono">
                    战力综合指数: {totalAttr + ac * 2 + maxHp}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#151D30] p-2.5 rounded-xl border border-[#8296D8]/20 space-y-1">
                    <div className="text-[10px] text-[#8296D8] flex justify-between">
                      <span>生命状态</span>
                      <span className="text-[#FFD485] font-mono">{curHp}/{maxHp}</span>
                    </div>
                    <div className="w-full bg-[#0E1424] h-2 rounded-full overflow-hidden border border-[#8296D8]/20">
                      <div className="h-full bg-gradient-to-r from-[#E27D60] to-[#E6A85C]" style={{ width: `${hpPct}%` }} />
                    </div>
                  </div>

                  <div className="bg-[#151D30] p-2.5 rounded-xl border border-[#8296D8]/20 space-y-0.5">
                    <div className="text-[10px] text-[#8296D8]">护甲与定位</div>
                    <div className="text-xs font-bold text-[#FFD485] flex items-center gap-1">
                      <span>🛡️ {ac} AC</span>
                      <span className="text-[10px] text-[#8296D8] font-normal">({character.class})</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#8296D8] bg-[#0E1424] p-2 rounded-xl border border-[#8296D8]/15">
                  <span>技能受训: <strong className="text-[#FFD485]">⭐{profCount}项熟练</strong> + <strong className="text-[#D8B4FE]">👑{expCount}项专精</strong></span>
                  <span>属性六维总和: <strong className="text-[#E6A85C] font-mono">{totalAttr}点</strong></span>
                </div>
              </section>
            );
          })()}

          {/* 角色背景故事 */}
          <section className="galgame-card rounded-2xl p-4 space-y-2 border border-[#8296D8]/20">
            <h2 className="text-xs font-bold font-serif-title text-[#FFD485] flex items-center gap-1.5">
              <span>📖</span> 角色背景与跑团传记
            </h2>
            <textarea
              value={character.backstory}
              onChange={e => update('backstory', e.target.value)}
              className="w-full h-24 bg-[#0B1020] border border-[#8296D8]/30 rounded-xl p-2.5 text-xs text-[#F1E5CE] focus:border-[#E6A85C] focus:outline-none leading-relaxed resize-y"
              placeholder="你曾经历过怎样的传奇？为什么踏入这间神秘的流浪者之憩酒馆……"
            />
          </section>
        </div>

        {/* ============================================================ */}
        {/* 右栏 (4/12): 角色切换选择、试衣间外装、技能判定工坊与随身背包 */}
        {/* ============================================================ */}
        <div className="lg:col-span-4 space-y-4">
          {/* 跑团角色形象与预设选择 */}
          <section className="galgame-card rounded-2xl p-4 space-y-2.5 border border-[#8296D8]/20">
            <div className="flex items-center justify-between border-b border-[#8296D8]/15 pb-1.5">
              <h2 className="text-xs font-bold font-serif-title text-[#FFD485] flex items-center gap-1.5">
                <span>🎭</span> 跑团主角卡形象切换
              </h2>
              <span className="text-[10px] text-[#E6A85C]">预设英雄与自定义立绘</span>
            </div>

            <div className="grid grid-cols-2 gap-2" suppressHydrationWarning>
              {PLAYER_CHARACTERS.map(char => {
                const isSelected = !character.avatarUrl && (character.portraitId || 'traveler') === char.id;
                return (
                  <button
                    key={char.id}
                    type="button"
                    suppressHydrationWarning
                    onClick={() => handleSelectCharacter(char.id)}
                    className={`p-2 rounded-xl flex items-center gap-2 text-left cursor-pointer select-none transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-[#1E2942] border-2 border-[#E6A85C] shadow-md font-bold'
                        : 'bg-[#151D30] border border-[#8296D8]/20 hover:border-[#E6A85C]/40 opacity-80'
                    }`}
                  >
                    <CharacterAvatarRenderer
                      characterId={char.id}
                      expression="normal"
                      size="xs"
                      shape="circle"
                      showBorder={false}
                    />
                    <div className="text-xs min-w-0 flex-1">
                      <div className="text-[#FFD485] truncate">{char.name}</div>
                      <div className="text-[10px] text-[#8296D8] truncate">{char.title}</div>
                    </div>
                  </button>
                );
              })}

              {/* 第 5 张卡：自定义专属角色卡位 */}
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => handleSelectCharacter('custom')}
                className={`p-2 rounded-xl flex items-center gap-2 text-left cursor-pointer select-none transition-all active:scale-95 col-span-2 ${
                  Boolean(character.avatarUrl) || character.portraitId === 'custom'
                    ? 'bg-[#1E2942] border-2 border-[#E6A85C] shadow-md font-bold'
                    : 'bg-[#151D30]/80 border border-dashed border-[#8296D8]/40 hover:border-[#E6A85C]/60 opacity-85'
                }`}
              >
                {character.avatarUrl ? (
                  // Custom data/external URLs are rendered directly, like the existing avatar renderer.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={character.avatarUrl}
                    alt="Custom Avatar"
                    className="w-7 h-7 rounded-full object-cover border border-[#E6A85C] shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#E6A85C]/20 border border-[#E6A85C]/50 flex items-center justify-center text-xs shrink-0">
                    🎨
                  </div>
                )}
                <div className="text-xs min-w-0 flex-1">
                  <div className="text-[#FFD485] truncate flex items-center gap-1.5">
                    <span>{character.avatarUrl ? (character.name || '我的自定义英雄') : '自定义英雄立绘'}</span>
                    {character.avatarUrl && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E6A85C]/20 text-[#FFD485] font-normal">
                        已装载
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#8296D8] truncate">
                    {character.avatarUrl ? '正在使用自定义动作图' : '默认按种族与职业搭配，也可上传自己的图'}
                  </div>
                </div>
              </button>
            </div>

            {/* 自定义上传 / 网络图片 URL */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="粘贴网络图片 URL (http://...)"
                value={character.avatarUrl || ''}
                onChange={e => {
                  const url = e.target.value;
                  setCharacter(prev => ({
                    ...prev, avatarUrl: url,
                    ...(url ? { portraitId: 'custom', voiceId: voiceFor(prev.portraitId, prev.voiceId),
                      appearance: prev.appearance && { ...prev.appearance, active: false } } : {}),
                  }));
                }}
                className="flex-1 bg-[#0B1020] border border-[#8296D8]/30 rounded-lg px-2 py-1 text-xs text-[#F1E5CE] focus:border-[#E6A85C] focus:outline-none"
              />
              <label className="px-2.5 py-1 rounded-lg bg-[#E6A85C] hover:bg-[#D4974B] text-[#0B1020] text-xs font-bold cursor-pointer transition-all flex items-center gap-1 shrink-0 active:scale-95">
                <span>📁 上传</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => loadPortraitFile(e.target.files?.[0], 'idle')}
                />
              </label>
            </div>
            {character.avatarUrl && <details className="rounded-lg border border-[#aa855055] p-2 text-xs">
              <summary className="cursor-pointer text-[#e8c99e]">设置交谈与出手立绘</summary>
              <div className="mt-2 space-y-2">
                {(['talk', 'action'] as const).map(pose => <div className="flex items-center gap-2" key={pose}>
                  <label className="shrink-0" htmlFor={`portrait-${pose}`}>{pose === 'talk' ? '交谈' : '出手'}</label>
                  <input id={`portrait-${pose}`} className="min-w-0 flex-1 rounded border border-[#aa855055] bg-[#151D30] px-2 py-1" placeholder="图片地址" value={character.portraitPoses?.[pose]?.startsWith('data:') ? '' : character.portraitPoses?.[pose] ?? ''} onChange={e => changePortraitPose(pose, e.target.value)} />
                  <label className="shrink-0 cursor-pointer rounded border border-[#aa855055] px-2 py-1">{character.portraitPoses?.[pose]?.startsWith('data:') ? '已上传' : '上传'}<input type="file" accept="image/*" className="sr-only" aria-label={`上传${pose === 'talk' ? '交谈' : '出手'}立绘`} onChange={e => loadPortraitFile(e.target.files?.[0], pose)} /></label>
                </div>)}
                <button type="button" className="text-[#e8c99e] underline underline-offset-4" onClick={() => setCharacter(prev => ({ ...prev, avatarUrl: undefined, portraitPoses: undefined }))}>恢复种族与职业立绘</button>
              </div>
            </details>}
            {portraitError && <p role="alert" className="text-xs text-[#f2aa9b]">{portraitError}</p>}
          </section>

          <CharacterCustomization character={character}
            onAppearance={appearance => update('appearance', appearance)}
            onVoice={id => update('voiceId', id)}
          />

          {/* 装备摘要 */}
          <section className="galgame-card rounded-2xl p-4 space-y-2.5 border border-[#E6A85C]/30">
            <div className="flex justify-between items-center border-b border-[#8296D8]/15 pb-1.5">
              <h2 className="text-xs font-serif-title font-bold text-[#FFD485] flex items-center gap-1.5">
                <span>🧢</span> 装备速览
              </h2>
              <span className="text-[10px] text-[#8296D8] bg-[#0E1424] px-2 py-0.5 rounded border border-[#8296D8]/20">
                已装载 4/4 槽位
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#151D30] p-2 rounded-xl border border-[#8296D8]/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#0E1424] border border-[#E6A85C]/40 flex items-center justify-center text-xs shrink-0">
                  🎩
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] text-[#8296D8]">头部/兜帽</div>
                  <div className="text-[11px] font-bold text-[#FFD485] truncate">
                    {character.class === '法师' ? '星象丝绸兜帽' : character.class === '圣骑士' ? '精钢骑士战盔' : '游侠旅人连帽'}
                  </div>
                </div>
              </div>

              <div className="bg-[#151D30] p-2 rounded-xl border border-[#8296D8]/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#0E1424] border border-[#E6A85C]/40 flex items-center justify-center text-xs shrink-0">
                  ⚔️
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] text-[#8296D8]">主手武器</div>
                  <div className="text-[11px] font-bold text-[#FFD485] truncate">
                    {character.inventory[0] || '精炼长剑 (1d8)'}
                  </div>
                </div>
              </div>

              <div className="bg-[#151D30] p-2 rounded-xl border border-[#8296D8]/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#0E1424] border border-[#E6A85C]/40 flex items-center justify-center text-xs shrink-0">
                  🛡️
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] text-[#8296D8]">战躯护甲</div>
                  <div className="text-[11px] font-bold text-[#FFD485] truncate">
                    {statsFor(character).baseArmorName}
                  </div>
                </div>
              </div>

              <div className="bg-[#151D30] p-2 rounded-xl border border-[#8296D8]/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#0E1424] border border-[#E6A85C]/40 flex items-center justify-center text-xs shrink-0">
                  💍
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] text-[#8296D8]">随身奇物</div>
                  <div className="text-[11px] font-bold text-[#FFD485] truncate">
                    {character.inventory[1] || '白银太阳圣徽'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 🎯 技能熟练专精与判定加点 (带可滚动容器) */}
          <section className="galgame-card rounded-2xl p-4 space-y-3 border border-[#8296D8]/20">
            <div className="flex justify-between items-center flex-wrap gap-1 border-b border-[#8296D8]/15 pb-2">
              <h2 className="text-xs font-bold font-serif-title text-[#FFD485] flex items-center gap-1.5">
                <span>🎯</span> 技能熟练专精与判定
              </h2>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-[#E6A85C]/20 border border-[#E6A85C]/40 text-[#FFD485] font-semibold">
                  ⭐熟练: {(character.skills || []).filter(s => (s.bonus || 2) === 2).length}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[#A855F7]/20 border border-[#A855F7]/40 text-[#D8B4FE] font-semibold">
                  👑专精: {(character.skills || []).filter(s => s.bonus === 4).length}
                </span>
              </div>
            </div>

            {/* 分类 Tab 切换 */}
            <div className="flex gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setSkillFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  skillFilter === 'all'
                    ? 'bg-[#E6A85C] text-[#0B1020]'
                    : 'bg-[#151D30] text-[#8296D8] hover:text-[#FFD485]'
                }`}
              >
                全部({DEFAULT_SKILLS.length})
              </button>
              {(['str', 'dex', 'int', 'wis', 'cha'] as AttributeKey[]).map(attr => (
                <button
                  key={attr}
                  type="button"
                  onClick={() => setSkillFilter(attr)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    skillFilter === attr
                      ? 'bg-[#E6A85C] text-[#0B1020]'
                      : 'bg-[#151D30] text-[#8296D8] hover:text-[#FFD485]'
                  }`}
                >
                  {ATTRIBUTE_LABELS[attr]}
                </button>
              ))}
            </div>

            {/* 技能列表可滚动卡片容器 */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {DEFAULT_SKILLS
                .filter(skill => skillFilter === 'all' || skill.attribute === skillFilter)
                .map(skill => {
                  const existing = (character.skills || []).find(s => s.name === skill.name);
                  const isProficient = Boolean(existing);
                  const isExpertise = existing?.bonus === 4;
                  const bonusAdd = isExpertise ? 4 : isProficient ? 2 : 0;
                  const attrMod = getModifier(attributes[skill.attribute]);
                  const total = attrMod + bonusAdd;
                  const sign = total >= 0 ? '+' : '';

                  return (
                    <button
                      key={skill.name}
                      type="button"
                      onClick={() => toggleSkill(skill.name, skill.attribute)}
                      className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between gap-2 border select-none active:scale-[0.98] ${
                        isExpertise
                          ? 'bg-[#221738] border-[#A855F7]'
                          : isProficient
                          ? 'bg-[#1E2942] border-[#E6A85C]'
                          : 'bg-[#151D30] border-[#8296D8]/20 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#F1E5CE]">{skill.name}</span>
                          {isExpertise ? (
                            <span className="text-[8px] px-1 py-0.2 rounded bg-[#A855F7]/30 text-[#D8B4FE] font-bold">
                              👑 专精
                            </span>
                          ) : isProficient ? (
                            <span className="text-[8px] px-1 py-0.2 rounded bg-[#E6A85C]/30 text-[#FFD485] font-bold">
                              ⭐ 熟练
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[9px] text-[#8296D8] truncate">{skill.desc}</div>
                      </div>

                      <div className={`px-2 py-0.5 rounded text-center shrink-0 font-mono font-bold text-xs ${
                        isExpertise ? 'bg-[#A855F7]/30 text-[#D8B4FE]' : isProficient ? 'bg-[#E6A85C]/30 text-[#FFD485]' : 'bg-[#0E1424] text-[#8296D8]'
                      }`}>
                        {sign}{total}
                      </div>
                    </button>
                  );
                })}
            </div>
          </section>

          {/* 随身背包物品 (Inventory) */}
          <section className="galgame-card rounded-2xl p-4 space-y-2 border border-[#8296D8]/20">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold font-serif-title text-[#FFD485] flex items-center gap-1.5">
                <span>🎒</span> 随身背包与魔法物品
              </h2>
              <button onClick={addItem} className="px-2 py-0.5 rounded bg-[#E6A85C] text-[#0B1020] text-[10px] font-bold">
                + 添加
              </button>
            </div>
            {character.inventory.length === 0 ? (
              <p className="text-[10px] text-[#8296D8]/60 text-center py-2 italic">行囊空空如也……</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {character.inventory.map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-[#151D30] px-2 py-1 rounded-lg border border-[#8296D8]/20 text-[11px] text-[#F1E5CE]">
                    <span>· {item}</span>
                    <button onClick={() => removeItem(i)} className="text-red-400 font-bold ml-1">×</button>
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      </fieldset>
    </div>
  );
}
