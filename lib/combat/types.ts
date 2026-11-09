import type { AttributeKey, Character, Attributes } from '../types';
export interface Point {
    x: number;
    y: number;
}
export type EnemyKind = 'bandit' | 'wolf' | 'skeleton' | 'cultist' | 'aberration' | 'drone';
export type ConditionName = 'prone' | 'restrained' | 'poisoned' | 'stunned' | 'unconscious' | 'dead' | 'dodging' | 'disengaged' | 'hidden' | 'blessed' | 'marked' | 'shielded';
export interface Condition {
    name: ConditionName;
    sourceId?: string;
    spellId?: string;
    remainingTurns?: number;
}
export interface TurnResources {
    action: number;
    bonusAction: number;
    reaction: boolean;
    movement: number;
    spellSlots: Record<number, number>;
    maxSpellSlots: Record<number, number>;
    hitDice: number;
    maxHitDice: number;
    layOnHands: number;
    secondWind: number;
    sneakAttackUsed: boolean;
    leveledSpellCast: boolean;
    arcaneRecoveryUsed: boolean;
    hunterMarkUses?: number;
    divineSmiteUses?: number;
}
export interface Weapon {
    name: string;
    attribute: AttributeKey;
    dice: number;
    sides: number;
    damageType: string;
    range: number;
    longRange?: number;
    melee: boolean;
    finesse?: boolean;
}
export interface Combatant extends Character {
    side: 'party' | 'enemy';
    position: Point;
    speed: number;
    proficiencyBonus: number;
    resources: TurnResources;
    conditions: Condition[];
    deathSaves: {
        successes: number;
        failures: number;
        stable: boolean;
    };
    concentration?: {
        spellId: string;
        targetIds: string[];
        remainingRounds: number;
    };
    weapon: Weapon;
    experience: number;
    temporaryHp: number;
    enemyKind?: EnemyKind;
    savingThrowProficiencies: AttributeKey[];
    lastHitTargetId?: string;
    attacksRemaining?: number;
    lastHitCritical?: boolean;
}
export interface EncounterSpec {
    id: string;
    title: string;
    enemyKind: EnemyKind;
    count: number;
    difficulty?: 'easy' | 'normal' | 'hard';
}
export type ChapterEncounter = Pick<EncounterSpec, 'title' | 'enemyKind' | 'count'> & { aftermath?: string };
export interface TerrainCell extends Point {
    type: 'wall' | 'difficult' | 'cover' | 'hazard';
}
export interface BattleLog {
    id: string;
    round: number;
    text: string;
    kind: 'info' | 'attack' | 'damage' | 'heal' | 'save' | 'spell' | 'reaction';
}
export interface PendingReaction {
    id: string;
    actorId: string;
    sourceId: string;
    kind: 'opportunity' | 'shield' | 'uncanny-dodge';
    resumeAction: BattleAction;
    attackRoll?: number;
    damage?: number;
    targetId?: string;
    continuation?: {
        kind: 'hit';
        critical: boolean;
        naturalRoll: number;
        attackTotal: number;
        damage: number;
        damageType: string;
        spellId?: string;
    } | {
        kind: 'move';
        path: Point[];
        cost: number;
        reactedIds: string[];
    };
    alternativeKinds?: ('shield' | 'uncanny-dodge')[];
    afterMove?: {
        action: BattleAction;
        path: Point[];
        reactedIds: string[];
    };
}
export interface BattleState {
    id: string;
    chapterEncounterId?: string;
    title: string;
    phase: 'active' | 'victory' | 'defeat' | 'escaped';
    round: number;
    turnIndex: number;
    combatants: Combatant[];
    initiative: string[];
    width: number;
    height: number;
    terrain: TerrainCell[];
    log: BattleLog[];
    pendingReaction: PendingReaction | null;
    processedActionIds: string[];
    reward: {
        gold: number;
        experience: number;
        items: string[];
    };
}
export type BattleActionType = 'move' | 'attack' | 'cast' | 'dash' | 'disengage' | 'dodge' | 'help' | 'hide' | 'use-item' | 'end-turn' | 'react' | 'escape';
export interface BattleAction {
    id: string;
    type: BattleActionType;
    actorId: string;
    targetId?: string;
    point?: Point;
    spellId?: string;
    slotLevel?: number;
    reaction?: 'accept' | 'decline';
    item?: string;
    useBonusAction?: boolean;
}
export interface CombatSpell {
    id: string;
    name: string;
    description: string;
    classes: string[];
    level: number;
    minLevel?: number;
    cost: 'action' | 'bonus' | 'reaction';
    range: number;
    target: 'enemy' | 'ally' | 'self' | 'area';
    effect: 'attack' | 'save' | 'heal' | 'missile' | 'mark' | 'bless' | 'shield' | 'smite' | 'lay-on-hands';
    dice: number;
    sides: number;
    damageType?: string;
    save?: keyof Attributes;
    halfOnSave?: boolean;
    concentration?: boolean;
    radius?: number;
    duration?: number;
}
