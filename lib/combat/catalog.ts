import type { ChapterEncounter, Combatant, CombatSpell, EnemyKind, Weapon } from './types';
export function classKey(value: string): string {
    return ({
        '法师': 'wizard', '游侠': 'ranger', '游荡者': 'rogue', '圣骑士': 'paladin'
    } as Record<string, string>)[value] ?? value.toLowerCase();
}

// Indexed by level. Combat progression and party preparation use the same thresholds.
export const LEVEL_EXPERIENCE = [0, 0, 300, 900, 2700, 6500] as const;

export function classResourceLimits(key: string, level: number) {
    return {
        layOnHands: key === 'paladin' ? 5 * level : 0,
        hunterMarkUses: key === 'ranger' ? (level >= 5 ? 3 : 2) : 0,
        divineSmiteUses: key === 'paladin' && level >= 2 ? 1 : 0,
    };
}

export function combatHitDie(key: string): number {
    return key === 'wizard' ? 6 : key === 'rogue' ? 8 : 10;
}

export const COMBAT_SPELLS: CombatSpell[] = [
    {
        id: 'wizard-fire-bolt', name: '火焰箭', description: '远程法术攻击；5级2d10。', classes: ['wizard'], level: 0, cost: 'action', range: 120, target: 'enemy', effect: 'attack', dice: 1, sides: 10, damageType: 'fire'
    },
    {
        id: 'wizard-magic-missile', name: '魔法飞弹', description: '三个必中的飞弹，每枚1d4+1力场；集中同一目标。', classes: ['wizard'], level: 1, cost: 'action', range: 120, target: 'enemy', effect: 'missile', dice: 3, sides: 4, damageType: 'force'
    },
    {
        id: 'wizard-shield', name: '护盾术', description: '命中或飞弹触发反应；AC+5至下回合开始，免疫飞弹。', classes: ['wizard'], level: 1, cost: 'reaction', range: 0, target: 'self', effect: 'shield', dice: 0, sides: 0, duration: 1
    },
    {
        id: 'wizard-thunderwave', name: '雷鸣波', description: '15尺立方；选择水平或竖直10尺处的中心。体质豁免减半，失败推10尺。', classes: ['wizard'], level: 1, cost: 'action', range: 10, target: 'area', effect: 'save', dice: 2, sides: 8, damageType: 'thunder', save: 'con', halfOnSave: true, radius: 5
    },
    {
        id: 'wizard-fireball', name: '火球术', description: '20尺范围含友军；敏捷豁免减半，8d6火焰。', classes: ['wizard'], level: 3, minLevel: 5, cost: 'action', range: 150, target: 'area', effect: 'save', dice: 8, sides: 6, damageType: 'fire', save: 'dex', halfOnSave: true, radius: 20
    },
    {
        id: 'ranger-hunters-mark', name: '猎人印记', description: '专注；攻击命中目标额外1d6力场。默认使用免费次数。', classes: ['ranger'], level: 1, cost: 'bonus', range: 90, target: 'enemy', effect: 'mark', dice: 1, sides: 6, damageType: 'force', concentration: true, duration: 600
    },
    ...(['ranger', 'paladin'] as const).map(c => ({
        id: `${c}-cure-wounds`, name: '疗伤术', description: '接触恢复2d8+施法调整值，每升一环增加2d8。', classes: [c], level: 1, cost: 'action' as const, range: 5, target: 'ally' as const, effect: 'heal' as const, dice: 2, sides: 8
    })),
    {
        id: 'paladin-lay-on-hands', name: '圣疗', description: '附赠动作；治疗缺失生命值，最多消耗剩余圣疗池。', classes: ['paladin'], level: 0, cost: 'bonus', range: 5, target: 'ally', effect: 'lay-on-hands', dice: 0, sides: 0
    },
    {
        id: 'paladin-divine-smite', name: '至圣斩', description: '2级起，近战命中后立即用附赠动作：额外2d8光耀；每天一次免费。', classes: ['paladin'], level: 1, minLevel: 2, cost: 'bonus', range: 5, target: 'enemy', effect: 'smite', dice: 2, sides: 8, damageType: 'radiant'
    },
    {
        id: 'paladin-bless', name: '祝福术', description: '专注；祝福所选队友及最近两名队友。攻击和豁免+1d4。', classes: ['paladin'], level: 1, cost: 'action', range: 30, target: 'ally', effect: 'bless', dice: 0, sides: 0, concentration: true, duration: 10
    },
];
export function slotsFor(characterClass: string, level: number): Record<number, number> {
    const key = classKey(characterClass), list = key === 'wizard' ? [[2], [3], [4, 2], [4, 3], [4, 3, 2]][level - 1] : ['paladin', 'ranger'].includes(key) ? [[2], [2], [3], [3], [4, 2]][level - 1] : [];
    return Object.fromEntries((list ?? []).map((n, i) => [i + 1, n]));
}
export function getAvailableSpells(a: Combatant): CombatSpell[] {
    return COMBAT_SPELLS.filter(s => s.classes.includes(classKey(a.class)) && a.level >= (s.minLevel ?? 1) && (s.level === 0 || (a.resources.maxSpellSlots[s.level] ?? 0) > 0));
}

export function freeSpellResource(spell: CombatSpell): 'hunterMarkUses' | 'divineSmiteUses' | undefined {
    if (spell.effect === 'mark') return 'hunterMarkUses';
    if (spell.effect === 'smite') return 'divineSmiteUses';
}

export function getHealingPotions(inventory: string[]) {
    return inventory.flatMap((item, index) => {
        if (!/治疗药水|healing potion/i.test(item)) return [];
        const quantity = item.match(/\s*[x×]\s*(\d+)$/i);
        return [{
            index, item,
            count: quantity ? Number(quantity[1]) : 1,
            name: quantity ? item.slice(0, quantity.index) : item,
        }];
    });
}
export function weaponFor(value: string, race?: string): Weapon {
    if (classKey(value) === 'paladin' && race === '矮人') {
        return { name: '战锤', attribute: 'str', dice: 1, sides: 8, damageType: 'bludgeoning', range: 5, melee: true };
    }
    switch (classKey(value)) {
        case 'wizard': return {
            name: '法杖', attribute: 'str', dice: 1, sides: 6, damageType: 'bludgeoning', range: 5, melee: true
        };
        case 'ranger': return {
            name: '长弓', attribute: 'dex', dice: 1, sides: 8, damageType: 'piercing', range: 150, longRange: 600, melee: false
        };
        case 'rogue': return {
            name: '短剑', attribute: 'dex', dice: 1, sides: 6, damageType: 'piercing', range: 5, melee: true, finesse: true
        };
        default: return {
            name: '长剑', attribute: 'str', dice: 1, sides: 8, damageType: 'slashing', range: 5, melee: true
        };
    }
}
// Curated opponents, not full official monster statblocks.
export const ENEMY_CATALOG: Record<EnemyKind, {
    name: string;
    hp: number;
    ac: number;
    speed: number;
    str: number;
    dex: number;
    weapon: Weapon;
    xp: number;
}> = {
    bandit: {
        name: '匪徒', hp: 11, ac: 12, speed: 30, str: 11, dex: 12, weapon: {
            name: '弯刀', attribute: 'dex', dice: 1, sides: 6, damageType: 'slashing', range: 5, melee: true
        }, xp: 25
    },
    wolf: {
        name: '狼', hp: 11, ac: 13, speed: 40, str: 12, dex: 15, weapon: {
            name: '撕咬', attribute: 'str', dice: 2, sides: 4, damageType: 'piercing', range: 5, melee: true
        }, xp: 50
    },
    skeleton: {
        name: '骷髅', hp: 13, ac: 13, speed: 30, str: 10, dex: 14, weapon: {
            name: '短弓', attribute: 'dex', dice: 1, sides: 6, damageType: 'piercing', range: 80, longRange: 320, melee: false
        }, xp: 50
    },
    cultist: {
        name: '邪教徒', hp: 9, ac: 12, speed: 30, str: 11, dex: 12, weapon: {
            name: '匕首', attribute: 'dex', dice: 1, sides: 4, damageType: 'piercing', range: 5, melee: true, finesse: true
        }, xp: 25
    },
    aberration: {
        name: '畸变体', hp: 18, ac: 12, speed: 30, str: 14, dex: 10, weapon: {
            name: '触须', attribute: 'str', dice: 1, sides: 8, damageType: 'bludgeoning', range: 5, melee: true
        }, xp: 50
    },
    drone: {
        name: '警戒机', hp: 12, ac: 13, speed: 30, str: 10, dex: 14, weapon: {
            name: '脉冲', attribute: 'dex', dice: 1, sides: 6, damageType: 'lightning', range: 60, melee: false
        }, xp: 50
    },
};

export function isEnemyKind(value: unknown): value is EnemyKind {
    return typeof value === 'string' && Object.hasOwn(ENEMY_CATALOG, value);
}

export function isChapterEncounter(value: unknown): value is ChapterEncounter {
    if (!value || typeof value !== 'object') return false;
    const { title, enemyKind, count, aftermath } = value as Partial<ChapterEncounter>;
    return typeof title === 'string' && !!title.trim() && title.length <= 120
        && isEnemyKind(enemyKind) && typeof count === 'number' && Number.isInteger(count) && count >= 1 && count <= 6
        && (aftermath === undefined || (typeof aftermath === 'string' && aftermath.length <= 4000));
}
