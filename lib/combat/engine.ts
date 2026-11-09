import type { AttributeKey, Character } from '../types';
import { ATTRIBUTE_LABELS, getModifier, getProficiencyBonus } from '../types';
import { rollDie as die, rollDice } from '../dice';
import { getSpeciesTraits } from '../speciesTraits';
import type { BattleState, BattleAction, Combatant, CombatSpell, EncounterSpec, Point, PendingReaction, ConditionName } from './types';
import { classKey, classResourceLimits, combatHitDie, ENEMY_CATALOG, freeSpellResource, getAvailableSpells, getHealingPotions, slotsFor, weaponFor } from './catalog';
export { getAvailableSpells } from './catalog';
type RNG = () => number;
type Hit = Extract<NonNullable<PendingReaction['continuation']>, {
    kind: 'hit';
}>;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const dice = (count: number, sides: number, rng: RNG) => rollDice(count, sides, rng).reduce((total, roll) => total + roll, 0);
export const gridDistance = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 5;
export function describeRelativePosition(origin: Point, point: Point): string {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    return [
        dx ? `向${dx > 0 ? '东' : '西'} ${Math.abs(dx) * 5} 尺` : '',
        dy ? `向${dy > 0 ? '南' : '北'} ${Math.abs(dy) * 5} 尺` : '',
    ].filter(Boolean).join('、') || '当前位置';
}
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const has = (a: Combatant, c: ConditionName) => a.conditions.some(x => x.name === c);
const dead = (a: Combatant) => has(a, 'dead');
const capable = (a: Combatant) => a.hp.current > 0 && !['dead', 'unconscious', 'stunned'].some(c => has(a, c as ConditionName));
function log(b: BattleState, text: string, kind: BattleState['log'][number]['kind'] = 'info') {
    b.log.push({
        id: `${b.id}:${b.log.length}`, round: b.round, text, kind
    });
}
function addCondition(a: Combatant, name: ConditionName, sourceId?: string, spellId?: string, remainingTurns?: number) {
    if (!a.conditions.some(c => c.name === name && c.sourceId === sourceId && c.spellId === spellId))
        a.conditions.push({
            name, sourceId, spellId, remainingTurns
        });
}
export function createPartyMember(character: Character): Combatant {
    const c = clone(character), level = Math.max(1, Math.min(5, Math.floor(c.level) || 1)), key = classKey(c.class), slots = slotsFor(c.class, level);
    const speed = c.speciesTraits === true ? getSpeciesTraits(c.race).speed : 30;
    return {
        ...c, level, side: 'party', position: {
            x: 1, y: 1
        }, speed, proficiencyBonus: getProficiencyBonus(level), hp: {
            current: Math.max(0, Math.min(c.hp.current, c.hp.max)), max: Math.max(1, c.hp.max)
        },
        resources: {
            action: 1, bonusAction: 1, reaction: true, movement: speed, spellSlots: {
                ...slots
            }, maxSpellSlots: {
                ...slots
            }, hitDice: level, maxHitDice: level, secondWind: 0, sneakAttackUsed: false, leveledSpellCast: false,
            arcaneRecoveryUsed: false, ...classResourceLimits(key, level),
        },
        conditions: c.hp.current <= 0 ? [{
                name: 'unconscious'
            }, {
                name: 'prone'
            }] : [], deathSaves: {
            successes: 0, failures: 0, stable: false
        }, weapon: weaponFor(c.class, c.speciesTraits ? c.race : undefined), experience: 0, temporaryHp: 0,
        savingThrowProficiencies: ({
            wizard: ['int', 'wis'], ranger: ['str', 'dex'], paladin: ['wis', 'cha'], rogue: ['dex', 'int']
        } as Record<string, AttributeKey[]>)[key] ?? [], attacksRemaining: 0
    };
}
export function createBattle(party: Combatant[], encounter: EncounterSpec, rng: RNG = Math.random): BattleState {
    const combatants = clone(party.slice(0, 4));
    combatants.forEach((c, i) => {
        c.side = 'party';
        c.position = {
            x: 1, y: 1 + i * 2
        };
        c.resources.action = 1;
        c.resources.bonusAction = 1;
        c.resources.reaction = true;
        c.resources.movement = c.speed;
        c.resources.leveledSpellCast = false;
        c.resources.sneakAttackUsed = false;
        c.attacksRemaining = 0;
        delete c.lastHitTargetId;
    });
    const template = ENEMY_CATALOG[encounter.enemyKind] ?? ENEMY_CATALOG.bandit;
    for (let i = 0; i < Math.max(1, Math.min(8, Math.floor(encounter.count) || 1)); i++) {
        const e = createPartyMember({
            id: `${encounter.id}:enemy:${i}`, name: `${template.name} ${i + 1}`, class: 'enemy', race: '敌人', level: 1, attributes: {
                str: template.str, dex: template.dex, con: 10, int: 10, wis: 10, cha: 10
            }, skills: [], hp: {
                current: template.hp, max: template.hp
            }, ac: template.ac, inventory: [], backstory: '', notes: ''
        });
        e.side = 'enemy';
        e.enemyKind = encounter.enemyKind;
        e.speed = template.speed;
        e.resources.movement = e.speed;
        e.position = {
            x: 10 - Math.floor(i / 4), y: 1 + (i % 4) * 2
        };
        e.weapon = clone(template.weapon);
        combatants.push(e);
    }
    const order = combatants.map((c, i) => ({
        id: c.id, total: die(20, rng) + getModifier(c.attributes.dex), i
    })).sort((a, b) => b.total - a.total || a.i - b.i);
    const n = combatants.filter(c => c.side === 'enemy').length;
    const b: BattleState = {
        id: encounter.id, title: encounter.title, phase: 'active', round: 1, turnIndex: 0, combatants, initiative: order.map(o => o.id), width: 12, height: 8,
        terrain: [{
                x: 5, y: 2, type: 'wall'
            }, {
                x: 5, y: 3, type: 'wall'
            }, {
                x: 6, y: 5, type: 'cover'
            }, {
                x: 7, y: 5, type: 'difficult'
            }], log: [], pendingReaction: null, processedActionIds: [], reward: {
            gold: template.xp / 5 * n, experience: template.xp * n, items: []
        }
    };
    order.forEach(o => log(b, `${combatants.find(c => c.id === o.id)!.name} 先攻 ${o.total}（同值按编队顺序）`));
    checkPhase(b);
    if (b.phase === 'active') {
        startTurn(b, rng);
        if (!capable(getCurrentActor(b)!))
            nextTurn(b, rng);
    }
    return b;
}
export function getCurrentActor(b: BattleState): Combatant | undefined {
    return b.combatants.find(c => c.id === b.initiative[b.turnIndex]);
}
export function getDecisionActor(battle: BattleState): Combatant | undefined {
    if (battle.phase !== 'active') return undefined;
    const pending = battle.pendingReaction;
    return pending ? battle.combatants.find(unit => unit.id === pending.actorId) : getCurrentActor(battle);
}
export function canTransferMark(battle: BattleState, actor: Combatant, spell: CombatSpell): boolean {
    const concentration = actor.concentration;
    return spell.effect === 'mark' && concentration?.spellId === spell.id
        && concentration.targetIds.every(id => (battle.combatants.find(unit => unit.id === id)?.hp.current ?? 0) === 0);
}
function inside(b: BattleState, p: Point) {
    return Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < b.width && p.y < b.height;
}
function wall(b: BattleState, p: Point) {
    return b.terrain.some(t => same(t, p) && t.type === 'wall');
}
export function getCombatantAt(battle: BattleState, point: Point, exceptId?: string): Combatant | undefined {
    return battle.combatants.find(unit => unit.id !== exceptId && !dead(unit) && same(unit.position, point));
}
function moveCost(b: BattleState, a: Combatant, p: Point) {
    return 5 * (1 + (b.terrain.some(t => same(t, p) && t.type === 'difficult') ? 1 : 0) + (has(a, 'prone') ? 1 : 0));
}
function paths(b: BattleState, a: Combatant, budget = a.resources.movement): Map<string, {
    point: Point;
    cost: number;
    path: Point[];
}> {
    const key = (p: Point) => `${p.x},${p.y}`, m = new Map<string, {
        point: Point;
        cost: number;
        path: Point[];
    }>();
    m.set(key(a.position), {
        point: a.position, cost: 0, path: []
    });
    const queue = [m.get(key(a.position))!];
    while (queue.length) {
        queue.sort((a, b) => a.cost - b.cost);
        const cur = queue.shift()!;
        for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++) {
                if (!dx && !dy)
                    continue;
                const p = {
                    x: cur.point.x + dx, y: cur.point.y + dy
                };
                if (!inside(b, p) || wall(b, p) || getCombatantAt(b, p, a.id))
                    continue;
                if (dx && dy && (wall(b, {
                    x: p.x, y: cur.point.y
                }) || wall(b, {
                    x: cur.point.x, y: p.y
                })))
                    continue;
                const cost = cur.cost + moveCost(b, a, p);
                if (cost > budget || (m.get(key(p))?.cost ?? Infinity) <= cost)
                    continue;
                const next = {
                    point: p, cost, path: [...cur.path, p]
                };
                m.set(key(p), next);
                queue.push(next);
            }
    }
    return m;
}
export function getReachableRoutes(b: BattleState, id: string): { point: Point; cost: number; path: Point[] }[] {
    const a = b.combatants.find(c => c.id === id);
    if (!a || b.phase !== 'active' || b.pendingReaction || getCurrentActor(b)?.id !== id || !capable(a) || has(a, 'restrained'))
        return [];
    return [...paths(b, a).values()].filter(route => route.path.length > 0);
}
export function getReachableCells(b: BattleState, id: string): Point[] {
    return getReachableRoutes(b, id).map(route => route.point);
}
function ray(b: BattleState, from: Point, to: Point): {
    visible: boolean;
    cover: number;
} {
    const dx = to.x - from.x, dy = to.y - from.y, n = Math.max(Math.abs(dx), Math.abs(dy)) * 8;
    let cover = 0, prev = from;
    for (let i = 1; i <= n; i++) {
        const p = {
            x: Math.round(from.x + dx * i / n), y: Math.round(from.y + dy * i / n)
        };
        if (same(p, prev))
            continue;
        if (wall(b, p))
            return {
                visible: false, cover: 0
            };
        if (p.x !== prev.x && p.y !== prev.y && (wall(b, {
            x: p.x, y: prev.y
        }) || wall(b, {
            x: prev.x, y: p.y
        })))
            return {
                visible: false, cover: 0
            };
        if (b.terrain.some(t => same(t, p) && t.type === 'cover') || (!same(p, to) && b.combatants.some(c => !dead(c) && same(c.position, p))))
            cover = 2;
        prev = p;
    }
    return {
        visible: true, cover
    };
}
export { ray as getLineOfSight };

export function getAreaSpellError(battle: BattleState, actor: Combatant, spell: CombatSpell, point?: Point): string | undefined {
    if (!point || !inside(battle, point) || gridDistance(actor.position, point) > spell.range || !ray(battle, actor.position, point).visible)
        return '范围中心不合法';
    if (spell.id === 'wizard-thunderwave' && (gridDistance(actor.position, point) !== 10 || (point.x !== actor.position.x && point.y !== actor.position.y)))
        return '雷鸣波中心须在水平或竖直方向10尺';
}

export function getAreaSpellTargets(battle: BattleState, spell: CombatSpell, center: Point): Combatant[] {
    const radius = spell.radius;
    if (radius === undefined) return [];
    return battle.combatants.filter(unit => !dead(unit) && gridDistance(unit.position, center) <= radius && ray(battle, center, unit.position).visible);
}
function endConcentration(b: BattleState, a: Combatant) {
    const spell = a.concentration?.spellId;
    delete a.concentration;
    if (spell)
        b.combatants.forEach(c => {
            c.conditions = c.conditions.filter(x => !(x.sourceId === a.id && x.spellId === spell));
        });
}
function checkPhase(b: BattleState) {
    if (!b.combatants.some(c => c.side === 'enemy' && c.hp.current > 0))
        b.phase = 'victory';
    else if (!b.combatants.some(c => c.side === 'party' && capable(c)))
        b.phase = 'defeat';
    if (b.phase !== 'active') {
        b.pendingReaction = null;
        b.combatants.forEach(c => endConcentration(b, c));
    }
}
function d20(rng: RNG, advantage: boolean, disadvantage: boolean) {
    const a = die(20, rng);
    if (advantage === disadvantage)
        return a;
    const b = die(20, rng);
    return advantage ? Math.max(a, b) : Math.min(a, b);
}
const blessed = (a: Combatant) => has(a, 'blessed');
const damageNames: Record<string, string> = {
    acid: '强酸', bludgeoning: '钝击', cold: '寒冷', fire: '火焰', force: '力场', lightning: '闪电',
    necrotic: '黯蚀', piercing: '穿刺', poison: '毒素', psychic: '心灵', radiant: '光耀', slashing: '挥砍', thunder: '雷鸣'
};

export function displayBattleLog(text: string) {
    return text.replace(/(\d+) ([a-z]+)伤害/g, (match, amount: string, type: string) =>
        damageNames[type] ? `${amount} 点${damageNames[type]}伤害` : match)
        .replace(/ (str|dex|con|int|wis|cha)豁免/g, (_, attribute: AttributeKey) => ` ${ATTRIBUTE_LABELS[attribute]}豁免`);
}

function save(b: BattleState, a: Combatant, attribute: AttributeKey, dc: number, rng: RNG): boolean {
    if (['str', 'dex'].includes(attribute) && ['unconscious', 'stunned'].some(c => has(a, c as ConditionName))) {
        log(b, `${a.name} ${ATTRIBUTE_LABELS[attribute]}豁免自动失败`, 'save');
        return false;
    }
    const disadvantage = attribute === 'dex' && has(a, 'restrained'), advantage = attribute === 'dex' && has(a, 'dodging') && capable(a) && !has(a, 'restrained');
    const roll = d20(rng, advantage, disadvantage), total = roll + getModifier(a.attributes[attribute]) + (a.savingThrowProficiencies.includes(attribute) ? a.proficiencyBonus : 0) + (blessed(a) ? die(4, rng) : 0);
    log(b, `${a.name} ${ATTRIBUTE_LABELS[attribute]}豁免 ${total} / DC${dc}：${total >= dc ? '成功' : '失败'}`, 'save');
    return total >= dc;
}
function damage(b: BattleState, a: Combatant, amount: number, critical: boolean, rng: RNG, type: string) {
    if (a.speciesTraits === true && getSpeciesTraits(a.race).resistance === type)
        amount = Math.floor(amount / 2);
    const raw = amount, absorbed = Math.min(a.temporaryHp, amount);
    a.temporaryHp -= absorbed;
    amount -= absorbed;
    if (a.hp.current === 0 && amount > 0) {
        a.deathSaves.stable = false;
        a.deathSaves.failures += critical ? 2 : 1;
        if (amount >= a.hp.max || a.deathSaves.failures >= 3)
            addCondition(a, 'dead');
    }
    const before = a.hp.current;
    a.hp.current = Math.max(0, before - amount);
    log(b, `${a.name} 受到 ${raw} 点${damageNames[type] ?? type}伤害（HP ${a.hp.current}/${a.hp.max}）`, 'damage');
    if (a.hp.current === 0) {
        if (a.side === 'enemy' || amount - before >= a.hp.max)
            addCondition(a, 'dead');
        addCondition(a, 'unconscious');
        addCondition(a, 'prone');
        endConcentration(b, a);
    }
    else if (a.concentration && raw > 0 && !save(b, a, 'con', Math.min(30, Math.max(10, Math.floor(raw / 2))), rng))
        endConcentration(b, a);
}
function heal(b: BattleState, a: Combatant, amount: number) {
    if (dead(a))
        return;
    a.hp.current = Math.min(a.hp.max, a.hp.current + Math.max(0, amount));
    if (a.hp.current > 0) {
        a.conditions = a.conditions.filter(c => c.name !== 'unconscious');
        a.deathSaves = {
            successes: 0, failures: 0, stable: false
        };
    }
    log(b, `${a.name} 恢复 ${amount} HP（${a.hp.current}/${a.hp.max}）`, 'heal');
}
function castingAttribute(a: Combatant): AttributeKey {
    return classKey(a.class) === 'wizard' ? 'int' : classKey(a.class) === 'paladin' ? 'cha' : 'wis';
}
function shieldActive(a: Combatant) {
    return a.conditions.some(c => c.spellId === 'wizard-shield');
}
function canShield(a: Combatant) {
    return classKey(a.class) === 'wizard' && capable(a) && a.resources.reaction && Object.values(a.resources.spellSlots).some(n => n > 0) && !a.resources.leveledSpellCast;
}
function hitReaction(b: BattleState, a: Combatant, target: Combatant, action: BattleAction, hit: Hit, rng: RNG) {
    if (hit.spellId === 'wizard-magic-missile' && shieldActive(target)) {
        log(b, `${target.name} 护盾阻挡魔法飞弹`, 'reaction');
        return;
    }
    const shield = canShield(target) && !shieldActive(target), uncanny = classKey(target.class) === 'rogue' && target.level >= 5 && capable(target) && target.resources.reaction && hit.naturalRoll !== 0 && ray(b, target.position, a.position).visible;
    if (shield || uncanny) {
        b.pendingReaction = {
            id: `${action.id}:hit`, actorId: target.id, sourceId: a.id, kind: shield ? 'shield' : 'uncanny-dodge', alternativeKinds: [...(shield ? ['shield' as const] : []), ...(uncanny ? ['uncanny-dodge' as const] : [])], resumeAction: action, attackRoll: hit.attackTotal, damage: hit.damage, targetId: target.id, continuation: hit
        };
        log(b, `${target.name} 可使用${shield ? '护盾术' : '直觉闪避'}或放弃`, 'reaction');
        return;
    }
    damage(b, target, hit.damage, hit.critical, rng, hit.damageType);
}
function attack(b: BattleState, a: Combatant, t: Combatant, action: BattleAction, rng: RNG, spell?: CombatSpell) {
    const ranged = spell ? true : !a.weapon.melee, visibility = ray(b, a.position, t.position), distance = gridDistance(a.position, t.position);
    const ally = b.combatants.some(c => c.id !== a.id && c.side === a.side && capable(c) && gridDistance(c.position, t.position) <= 5);
    const advantage = has(a, 'hidden') || has(t, 'restrained') || has(t, 'unconscious') || has(t, 'stunned') || (has(t, 'prone') && distance <= 5) || (a.enemyKind === 'wolf' && ally);
    const disadvantage = has(a, 'poisoned') || has(a, 'restrained') || has(a, 'prone') || has(t, 'hidden') || (has(t, 'dodging') && capable(t) && !has(t, 'restrained') && !has(a, 'hidden')) || (has(t, 'prone') && distance > 5) || (ranged && b.combatants.some(c => c.side !== a.side && capable(c) && gridDistance(c.position, a.position) <= 5)) || (!spell && !a.weapon.melee && distance > a.weapon.range);
    const natural = d20(rng, advantage, disadvantage), attribute = spell ? castingAttribute(a) : a.weapon.attribute;
    const total = natural + getModifier(a.attributes[attribute]) + a.proficiencyBonus + (blessed(a) ? die(4, rng) : 0), ac = t.ac + visibility.cover + (shieldActive(t) ? 5 : 0);
    a.conditions = a.conditions.filter(c => c.name !== 'hidden');
    const hit = natural === 20 || (natural !== 1 && total >= ac);
    log(b, `${a.name} ${spell?.name ?? a.weapon.name} 攻击 ${t.name}：d20=${natural}，总值${total} / AC${ac}，${hit ? '命中' : '未命中'}${advantage && !disadvantage ? '（优势）' : disadvantage && !advantage ? '（劣势）' : ''}`, 'attack');
    if (!hit)
        return;
    const critical = natural === 20 || (has(t, 'unconscious') && distance <= 5);
    let n = spell ? (a.level >= 5 ? 2 : 1) : a.weapon.dice;
    let amount = dice(n * (critical ? 2 : 1), spell?.sides ?? a.weapon.sides, rng) + (spell ? 0 : getModifier(a.attributes[a.weapon.attribute]));
    if (!spell && classKey(a.class) === 'rogue' && !a.resources.sneakAttackUsed && (a.weapon.finesse || !a.weapon.melee) && ((advantage && !disadvantage) || (ally && !(disadvantage && !advantage)))) {
        n = Math.ceil(a.level / 2);
        amount += dice(n * (critical ? 2 : 1), 6, rng);
        a.resources.sneakAttackUsed = true;
        log(b, `${a.name} 偷袭 +${n}d6`, 'damage');
    }
    if (t.conditions.some(c => c.name === 'marked' && c.sourceId === a.id))
        amount += dice(critical ? 2 : 1, 6, rng);
    if (!spell && a.weapon.melee) {
        a.lastHitTargetId = t.id;
        a.lastHitCritical = critical;
    }
    hitReaction(b, a, t, action, {
        kind: 'hit', naturalRoll: natural, attackTotal: total, critical, damage: Math.max(0, amount), damageType: spell?.damageType ?? a.weapon.damageType, spellId: spell?.id
    }, rng);
}
function startTurn(b: BattleState, rng: RNG) {
    const a = getCurrentActor(b);
    if (!a)
        return;
    b.combatants.forEach(c => {
        c.resources.sneakAttackUsed = false;
        c.resources.leveledSpellCast = false;
    });
    a.conditions = a.conditions.filter(c => !['dodging', 'disengaged'].includes(c.name) && c.spellId !== 'wizard-shield');
    a.resources.action = 1;
    a.resources.bonusAction = 1;
    a.resources.reaction = true;
    a.resources.movement = has(a, 'restrained') ? 0 : a.speed;
    a.attacksRemaining = 0;
    delete a.lastHitTargetId;
    delete a.lastHitCritical;
    if (a.concentration) {
        a.concentration.remainingRounds--;
        if (a.concentration.remainingRounds <= 0)
            endConcentration(b, a);
    }
    if (!capable(a))
        endConcentration(b, a);
    if (a.hp.current === 0 && a.side === 'party' && !dead(a) && !a.deathSaves.stable) {
        const roll = die(20, rng);
        const total = roll + (blessed(a) ? die(4, rng) : 0);
        log(b, `${a.name} 死亡豁免 d20=${roll}，总值${total}`, 'save');
        if (roll === 20)
            heal(b, a, 1);
        else {
            if (roll === 1)
                a.deathSaves.failures += 2;
            else if (total >= 10)
                a.deathSaves.successes++;
            else
                a.deathSaves.failures++;
            if (a.deathSaves.failures >= 3)
                addCondition(a, 'dead');
            if (a.deathSaves.successes >= 3)
                a.deathSaves = {
                    successes: 0, failures: 0, stable: true
                };
        }
    }
}
function nextTurn(b: BattleState, rng: RNG) {
    for (let i = 0; i < b.initiative.length; i++) {
        b.turnIndex = (b.turnIndex + 1) % b.initiative.length;
        if (b.turnIndex === 0)
            b.round++;
        startTurn(b, rng);
        checkPhase(b);
        if (b.phase !== 'active' || capable(getCurrentActor(b)!))
            return;
    }
    checkPhase(b);
}
function finish(b: BattleState, rng: RNG) {
    checkPhase(b);
    if (b.phase === 'active' && !b.pendingReaction && !capable(getCurrentActor(b)!))
        nextTurn(b, rng);
}
function movePath(b: BattleState, a: Combatant, action: BattleAction, path: Point[], reactedIds: string[], rng: RNG) {
    const origin = a.position;
    const availableMovement = a.resources.movement;
    const reportMovement = () => {
        if (same(origin, a.position)) return;
        const spent = availableMovement - a.resources.movement;
        log(b, `${a.name} ${describeRelativePosition(origin, a.position)}，消耗 ${spent} 尺移动。`);
    };
    for (let i = 0; i < path.length; i++) {
        const p = path[i];
        if (!has(a, 'disengaged')) {
            const r = b.combatants.find(c => c.side !== a.side && capable(c) && c.resources.reaction && c.weapon.melee && !reactedIds.includes(c.id) && gridDistance(c.position, a.position) <= c.weapon.range && gridDistance(c.position, p) > c.weapon.range && ray(b, c.position, a.position).visible);
            if (r) {
                reportMovement();
                b.pendingReaction = {
                    id: `${action.id}:oa:${r.id}`, kind: 'opportunity', actorId: r.id, sourceId: a.id, targetId: a.id, resumeAction: action, continuation: {
                        kind: 'move', path: path.slice(i), cost: 0, reactedIds
                    }
                };
                log(b, `${r.name} 可借机攻击 ${a.name}`, 'reaction');
                return;
            }
        }
        a.resources.movement -= moveCost(b, a, p);
        a.position = {
            ...p
        };
        if (b.terrain.some(t => same(t, p) && t.type === 'hazard'))
            damage(b, a, die(4, rng), false, rng, 'hazard');
        if (!capable(a)) break;
    }
    reportMovement();
}
function reaction(b: BattleState, action: BattleAction, rng: RNG): string | undefined {
    const p = b.pendingReaction;
    if (!p || action.actorId !== p.actorId || !['accept', 'decline'].includes(action.reaction ?? ''))
        return '没有可处理的反应';
    const a = b.combatants.find(c => c.id === p.actorId)!, source = b.combatants.find(c => c.id === p.sourceId)!;
    if (action.reaction === 'accept' && (!capable(a) || !a.resources.reaction))
        return '反应资源不可用';
    b.pendingReaction = null;
    if (p.continuation?.kind === 'move') {
        const saved = p.continuation;
        if (action.reaction === 'accept') {
            a.resources.reaction = false;
            attack(b, a, source, {
                ...p.resumeAction, id: `p:${p.id}`, type: 'attack', actorId: a.id, targetId: source.id
            }, rng);
            const nested = b.pendingReaction as PendingReaction | null;
            if (nested) {
                nested.afterMove = {
                    action: p.resumeAction, path: saved.path, reactedIds: [...saved.reactedIds, a.id]
                };
                return;
            }
        }
        if (capable(source))
            movePath(b, source, p.resumeAction, saved.path, [...saved.reactedIds, a.id], rng);
    }
    else if (p.continuation?.kind === 'hit') {
        const h = p.continuation;
        if (action.reaction === 'accept') {
            const kind = action.spellId === 'wizard-shield' ? 'shield' : p.kind;
            if (kind === 'shield') {
                const slot = action.slotLevel ?? Object.keys(a.resources.spellSlots).map(Number).sort((x, y) => x - y).find(l => (a.resources.spellSlots[l] ?? 0) > 0);
                if (!slot || !Number.isInteger(slot) || slot < 1 || !(a.resources.spellSlots[slot] > 0) || a.resources.leveledSpellCast)
                    return '无法消耗护盾术法术位';
                a.resources.spellSlots[slot]--;
                a.resources.leveledSpellCast = true;
                addCondition(a, 'shielded', a.id, 'wizard-shield');
                if (h.spellId === 'wizard-magic-missile' || (!h.critical && h.attackTotal < a.ac + ray(b, source.position, a.position).cover + 5)) {
                    h.damage = 0;
                    delete source.lastHitTargetId;
                    delete source.lastHitCritical;
                }
            }
            else
                h.damage = Math.floor(h.damage / 2);
            a.resources.reaction = false;
            log(b, `${a.name} 使用${kind === 'shield' ? '护盾术' : '直觉闪避'}`, 'reaction');
        }
        if (h.damage > 0)
            damage(b, a, h.damage, h.critical, rng, h.damageType);
        if (p.afterMove) {
            const mover = b.combatants.find(c => c.id === p.afterMove!.action.actorId)!;
            if (capable(mover))
                movePath(b, mover, p.afterMove.action, p.afterMove.path, p.afterMove.reactedIds, rng);
        }
    }
}
function validateTarget(b: BattleState, a: Combatant, t: Combatant | undefined, range: number, side: 'enemy' | 'ally'): string | undefined {
    if (!t || dead(t) || (side === 'enemy' && t.side === a.side) || (side === 'ally' && t.side !== a.side))
        return '目标不合法';
    if (gridDistance(a.position, t.position) > range)
        return '目标超出距离';
    if (!ray(b, a.position, t.position).visible)
        return '视线被阻挡';
}
export function applyAction(original: BattleState, action: BattleAction, rng: RNG = Math.random): {
    battle: BattleState;
    error?: string;
} {
    const reject = (error: string) => ({
        battle: original, error
    });
    if (!action.id || typeof action.id !== 'string')
        return reject('动作必须具备稳定编号');
    if (original.processedActionIds.includes(action.id))
        return {
            battle: original
        };
    if (original.phase !== 'active')
        return reject('战斗已经结束');
    const b = clone(original), a = b.combatants.find(c => c.id === action.actorId);
    if (!a)
        return reject('角色不存在');
    if (b.pendingReaction) {
        if (action.type !== 'react')
            return reject('请先处理反应');
        const error = reaction(b, action, rng);
        if (error)
            return reject(error);
    }
    else {
        if (getCurrentActor(b)?.id !== a.id)
            return reject('尚未轮到此角色');
        if (!capable(a) && action.type !== 'end-turn')
            return reject('失能角色不能行动');
        const t = b.combatants.find(c => c.id === action.targetId);
        if (action.type !== 'cast' && action.type !== 'react' && action.type !== 'attack') {
            delete a.lastHitTargetId;
            delete a.lastHitCritical;
        }
        switch (action.type) {
            case 'move': {
                if (!action.point || has(a, 'restrained'))
                    return reject('无法移动');
                if (same(action.point, a.position) && has(a, 'prone')) {
                    const cost = Math.floor(a.speed / 2);
                    if (a.speed === 0 || a.resources.movement < cost)
                        return reject('移动不足以起身');
                    a.resources.movement -= cost;
                    a.conditions = a.conditions.filter(c => c.name !== 'prone');
                    log(b, `${a.name} 起身，消耗${cost}尺移动`);
                    break;
                }
                const p = paths(b, a).get(`${action.point.x},${action.point.y}`);
                if (!p || p.path.length === 0)
                    return reject('目的地不可到达');
                movePath(b, a, action, p.path, [], rng);
                break;
            }
            case 'attack': {
                const error = validateTarget(b, a, t, a.weapon.longRange ?? a.weapon.range, 'enemy');
                if (error)
                    return reject(error);
                if (a.resources.action <= 0 && !((a.attacksRemaining ?? 0) > 0))
                    return reject('动作已消耗');
                if (!a.attacksRemaining) {
                    a.resources.action--;
                    a.attacksRemaining = ['paladin', 'ranger'].includes(classKey(a.class)) && a.level >= 5 ? 2 : 1;
                }
                a.attacksRemaining--;
                delete a.lastHitTargetId;
                delete a.lastHitCritical;
                attack(b, a, t!, action, rng);
                break;
            }
            case 'cast': {
                const s = getAvailableSpells(a).find(s => s.id === action.spellId);
                if (!s || s.cost === 'reaction')
                    return reject('未掌握此法术，或只能响应触发施放');
                if (s.cost === 'action' && a.resources.action <= 0 || s.cost === 'bonus' && a.resources.bonusAction <= 0)
                    return reject('动作资源不足');
                if (s.target !== 'area') {
                    const error = validateTarget(b, a, t, s.range, s.target === 'enemy' ? 'enemy' : 'ally');
                    if (error)
                        return reject(error);
                }
                else {
                    const error = getAreaSpellError(b, a, s, action.point);
                    if (error) return reject(error);
                }
                if (s.effect === 'smite' && (a.lastHitTargetId !== t?.id || !a.weapon.melee))
                    return reject('至圣斩只能紧接近战命中');
                if (s.effect === 'lay-on-hands' && (!(a.resources.layOnHands > 0) || t!.hp.current >= t!.hp.max))
                    return reject('圣疗池耗尽或目标无需治疗');
                const transfer = canTransferMark(b, a, s);
                const remainingMarkRounds = transfer ? a.concentration!.remainingRounds : s.duration ?? 600;
                const freeResource = action.slotLevel ? undefined : freeSpellResource(s);
                const freeUses = freeResource ? a.resources[freeResource] ?? 0 : 0;
                const slot = s.level === 0 || freeUses > 0 || transfer ? 0 : action.slotLevel ?? s.level;
                if (slot && (!Number.isInteger(slot) || slot < s.level || !(a.resources.spellSlots[slot] > 0) || a.resources.leveledSpellCast))
                    return reject('法术位不足、环级非法或本回合已消耗法术位');
                if (action.slotLevel !== undefined && (!Number.isInteger(action.slotLevel) || action.slotLevel < s.level || !(a.resources.spellSlots[action.slotLevel] > 0)))
                    return reject('非法法术位');
                if (slot) {
                    a.resources.spellSlots[slot]--;
                    a.resources.leveledSpellCast = true;
                }
                else if (freeResource && freeUses > 0 && !transfer) {
                    a.resources[freeResource] = freeUses - 1;
                }
                if (s.cost === 'action')
                    a.resources.action--;
                else
                    a.resources.bonusAction--;
                if (s.concentration && !transfer)
                    endConcentration(b, a);
                if (s.effect !== 'smite') {
                    delete a.lastHitTargetId;
                    delete a.lastHitCritical;
                }
                if (s.effect !== 'lay-on-hands')
                    a.conditions = a.conditions.filter(c => c.name !== 'hidden');
                log(b, `${a.name} 使用 ${s.name}${slot ? `（${slot}环）` : ''}`, 'spell');
                const effective = slot || s.level;
                if (s.effect === 'attack')
                    attack(b, a, t!, action, rng, s);
                else if (s.effect === 'missile')
                    hitReaction(b, a, t!, action, {
                        kind: 'hit', naturalRoll: 0, attackTotal: 0, critical: false, damage: (die(4, rng) + 1) * (effective + 2), damageType: 'force', spellId: s.id
                    }, rng);
                else if (s.effect === 'heal')
                    heal(b, t!, dice(effective * 2, 8, rng) + getModifier(a.attributes[castingAttribute(a)]));
                else if (s.effect === 'lay-on-hands') {
                    const amount = Math.min(a.resources.layOnHands, t!.hp.max - t!.hp.current);
                    a.resources.layOnHands -= amount;
                    heal(b, t!, amount);
                }
                else if (s.effect === 'smite') {
                    damage(b, t!, dice((effective + 1 + (t!.enemyKind === 'skeleton' ? 1 : 0)) * (a.lastHitCritical ? 2 : 1), 8, rng), false, rng, 'radiant');
                    delete a.lastHitTargetId;
                    delete a.lastHitCritical;
                }
                else if (s.effect === 'mark') {
                    endConcentration(b, a);
                    a.concentration = {
                        spellId: s.id, targetIds: [t!.id], remainingRounds: remainingMarkRounds
                    };
                    addCondition(t!, 'marked', a.id, s.id);
                }
                else if (s.effect === 'bless') {
                    const targets = [t!, ...b.combatants.filter(c => c.id !== t!.id && c.side === a.side && capable(c) && gridDistance(a.position, c.position) <= s.range && ray(b, a.position, c.position).visible).sort((x, y) => gridDistance(a.position, x.position) - gridDistance(a.position, y.position))].slice(0, 3 + effective - 1);
                    a.concentration = {
                        spellId: s.id, targetIds: targets.map(c => c.id), remainingRounds: 10
                    };
                    targets.forEach(c => addCondition(c, 'blessed', a.id, s.id));
                }
                else if (s.effect === 'save') {
                    const targets = getAreaSpellTargets(b, s, action.point!);
                    const amount = dice(s.dice + effective - s.level, s.sides, rng), dc = 8 + a.proficiencyBonus + getModifier(a.attributes[castingAttribute(a)]);
                    for (const target of targets) {
                        const cover = s.save === 'dex' ? ray(b, a.position, target.position).cover : 0, success = save(b, target, s.save!, dc - cover, rng);
                        damage(b, target, success ? Math.floor(amount / 2) : amount, false, rng, s.damageType!);
                        if (!success && s.id === 'wizard-thunderwave')
                            for (let i = 0; i < 2; i++) {
                                const p = {
                                    x: target.position.x + Math.sign(target.position.x - a.position.x), y: target.position.y + Math.sign(target.position.y - a.position.y)
                                };
                                if (inside(b, p) && !wall(b, p) && !getCombatantAt(b, p, target.id))
                                    target.position = p;
                                else
                                    break;
                            }
                    }
                }
                break;
            }
            case 'dash':
            case 'disengage':
            case 'dodge':
            case 'hide': {
                const bonus = !!action.useBonusAction;
                if (bonus && !(classKey(a.class) === 'rogue' && a.level >= 2 && ['dash', 'disengage', 'hide'].includes(action.type)))
                    return reject('没有对应附赠动作能力');
                if ((bonus ? a.resources.bonusAction : a.resources.action) <= 0)
                    return reject('动作已消耗');
                if (action.type === 'hide') {
                    if (b.combatants.some(c => c.side !== a.side && capable(c) && ray(b, c.position, a.position).visible))
                        return reject('必须脱离敌人视线才能躲藏');
                    const skill = a.skills.find(s => s.attribute === 'dex' && ['隐匿', 'Stealth'].includes(s.name)), check = die(20, rng) + getModifier(a.attributes.dex) + (skill?.proficient ? a.proficiencyBonus : 0);
                    log(b, `${a.name} 躲藏检定 ${check} / DC15`);
                    if (check >= 15)
                        addCondition(a, 'hidden');
                }
                else if (action.type === 'dash')
                    a.resources.movement += has(a, 'restrained') ? 0 : a.speed;
                else
                    addCondition(a, action.type === 'dodge' ? 'dodging' : 'disengaged');
                if (bonus)
                    a.resources.bonusAction--;
                else
                    a.resources.action--;
                break;
            }
            case 'help': {
                const error = validateTarget(b, a, t, 5, 'ally');
                if (error)
                    return reject(error);
                if (a.resources.action <= 0 || t!.hp.current !== 0 || t!.deathSaves.stable)
                    return reject('只能救助尚未稳定的倒地队友');
                a.resources.action--;
                const n = die(20, rng) + getModifier(a.attributes.wis);
                log(b, `${a.name} 急救检定 ${n} / DC10`, 'save');
                if (n >= 10)
                    t!.deathSaves = {
                        successes: 0, failures: 0, stable: true
                    };
                break;
            }
            case 'use-item': {
                if (a.resources.bonusAction <= 0)
                    return reject('治疗药水需要附赠动作');
                if (action.targetId && action.targetId !== a.id)
                    return reject('本作药水仅支持自己饮用');
                const potion = getHealingPotions(a.inventory).find(({ item }) => !action.item || item === action.item);
                if (!potion)
                    return reject('没有治疗药水');
                if (potion.count <= 0)
                    return reject('药水已耗尽');
                if (potion.count === 1)
                    a.inventory.splice(potion.index, 1);
                else
                    a.inventory[potion.index] = `${potion.name} x${potion.count - 1}`;
                a.resources.bonusAction--;
                heal(b, a, dice(2, 4, rng) + 2);
                break;
            }
            case 'end-turn':
                nextTurn(b, rng);
                break;
            case 'escape':
                if (a.position.x !== 0)
                    return reject('须先到达左侧撤离边缘');
                b.phase = 'escaped';
                b.combatants.forEach(c => endConcentration(b, c));
                break;
            default: return reject('未知动作');
        }
    }
    b.processedActionIds.push(action.id);
    finish(b, rng);
    return {
        battle: b
    };
}
export function advanceEnemyTurn(original: BattleState, rng: RNG = Math.random): BattleState {
    const actor = getDecisionActor(original);
    if (actor?.side !== 'enemy') return original;
    if (original.pendingReaction) {
        const pending = original.pendingReaction;
        const canReact = capable(actor) && actor.resources.reaction && (pending.kind !== 'shield' || canShield(actor));
        return applyAction(original, {
            id: `${pending.id}:enemy-reaction`, type: 'react', actorId: actor.id,
            reaction: canReact ? 'accept' : 'decline',
        }, rng).battle;
    }
    let b = original, a = actor;
    if (!capable(a))
        return applyAction(b, {
            id: `${b.id}:${b.round}:${a.id}:end`, type: 'end-turn', actorId: a.id
        }, rng).battle;
    const targets = b.combatants.filter(c => c.side === 'party' && capable(c)).sort((x, y) => gridDistance(a!.position, x.position) - gridDistance(a!.position, y.position) || x.hp.current - y.hp.current || x.id.localeCompare(y.id));
    if (!targets.length) {
        const done = clone(b);
        checkPhase(done);
        return done;
    }
    // Route to a square from which an attack is legal, rather than greedily
    // reducing distance to the occupied target square. The finite-map search
    // can plan a longer detour; only this turn's affordable prefix is executed.
    const routes = [...paths(b, a, Infinity).values()];
    const plans = targets.flatMap(target => {
        const route = routes.filter(route =>
            gridDistance(route.point, target.position) <= (a!.weapon.longRange ?? a!.weapon.range) &&
            ray(b, route.point, target.position).visible
        ).sort((x, y) => x.cost - y.cost || x.point.y - y.point.y || x.point.x - y.point.x)[0];
        return route ? [{ target, route }] : [];
    }).sort((x, y) => x.route.cost - y.route.cost || x.target.hp.current - y.target.hp.current || x.target.id.localeCompare(y.target.id));
    const plan = plans[0];
    const targetId = plan?.target.id ?? targets[0].id, id = `${b.id}:${b.round}:${a.id}`;
    const target = () => b.combatants.find(c => c.id === targetId)!;
    const canAttack = () => gridDistance(a!.position, target().position) <= (a!.weapon.longRange ?? a!.weapon.range) && ray(b, a!.position, target().position).visible;
    if (!canAttack() && a.resources.movement > 0 && !has(a, 'restrained') && plan) {
        let cost = 0;
        let destination: Point | undefined;
        for (const point of plan.route.path) {
            cost += moveCost(b, a, point);
            if (cost > a.resources.movement) break;
            destination = point;
        }
        if (destination) {
            b = applyAction(b, {
                id: `${id}:move`, type: 'move', actorId: a.id, point: destination
            }, rng).battle;
            if (b.pendingReaction || b.phase !== 'active')
                return b;
            a = getCurrentActor(b)!;
        }
    }
    if (canAttack() && a.resources.action > 0) {
        b = applyAction(b, {
            id: `${id}:attack`, type: 'attack', actorId: a.id, targetId
        }, rng).battle;
        if (b.pendingReaction || b.phase !== 'active')
            return b;
    }
    a = getCurrentActor(b)!;
    return applyAction(b, {
        id: `${id}:end`, type: 'end-turn', actorId: a.id
    }, rng).battle;
}
export function restParty(party: Combatant[], kind: 'short' | 'long', rng: RNG = Math.random): Combatant[] {
    const next = clone(party);
    for (const a of next) {
        if (dead(a) || a.hp.current <= 0)
            continue;
        const key = classKey(a.class);
        delete a.concentration;
        a.conditions = a.conditions.filter(c => !['dodging', 'disengaged', 'hidden', 'marked', 'blessed'].includes(c.name));
        if (kind === 'long') {
            a.hp.current = a.hp.max;
            a.temporaryHp = 0;
            a.resources.spellSlots = {
                ...a.resources.maxSpellSlots
            };
            a.resources.hitDice = a.resources.maxHitDice;
            a.resources.arcaneRecoveryUsed = false;
            Object.assign(a.resources, classResourceLimits(key, a.level));
            a.hunger = 100;
            a.fatigue = 0;
        }
        else {
            const sides = combatHitDie(key);
            while (a.resources.hitDice > 0 && a.hp.current < a.hp.max) {
                a.resources.hitDice--;
                a.hp.current = Math.min(a.hp.max, a.hp.current + Math.max(1, die(sides, rng) + getModifier(a.attributes.con)));
            }
            if (key === 'wizard' && !a.resources.arcaneRecoveryUsed) {
                let budget = Math.ceil(a.level / 2), used = false;
                for (let level = 3; level >= 1; level--)
                    while (budget >= level && (a.resources.spellSlots[level] ?? 0) < (a.resources.maxSpellSlots[level] ?? 0)) {
                        a.resources.spellSlots[level]++;
                        budget -= level;
                        used = true;
                    }
                if (used)
                    a.resources.arcaneRecoveryUsed = true;
            }
        }
        a.resources.action = 1;
        a.resources.bonusAction = 1;
        a.resources.reaction = true;
        a.resources.movement = a.speed;
        a.resources.sneakAttackUsed = false;
        a.resources.leveledSpellCast = false;
        a.attacksRemaining = 0;
        delete a.lastHitTargetId;
    }
    return next;
}
