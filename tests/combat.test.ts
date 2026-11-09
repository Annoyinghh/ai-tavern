import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCharacter } from '../lib/types';
import { createPartyMember, createBattle, applyAction, getCurrentActor, getReachableCells, getReachableRoutes, getAvailableSpells, getAreaSpellError, getAreaSpellTargets, advanceEnemyTurn, restParty } from '../lib/combat/engine';
import type { BattleState, Combatant, BattleAction } from '../lib/combat/types';
const fixed = () => .49;
function member(portrait = 'paladin_arthur', level = 1): Combatant {
    const c = createDefaultCharacter(portrait);
    c.level = level;
    return createPartyMember(c);
}
function fixture(portrait = 'paladin_arthur', level = 1): BattleState {
    const b = createBattle([member(portrait, level)], {
        id: 'test', title: 'Test', enemyKind: 'bandit', count: 1
    }, fixed);
    const p = b.combatants[0], e = b.combatants[1];
    b.initiative = [p.id, e.id];
    b.turnIndex = 0;
    b.terrain = [];
    p.position = {
        x: 1, y: 1
    };
    e.position = {
        x: 2, y: 1
    };
    e.hp = {
        current: 100, max: 100
    };
    e.ac = 10;
    return b;
}
function act(b: BattleState, type: BattleAction['type'], extra: Partial<BattleAction> = {}, rng = fixed) {
    return applyAction(b, {
        id: `${b.processedActionIds.length}-${type}`, actorId: getCurrentActor(b)!.id, type, ...extra
    }, rng);
}
test('rejects wrong actors and unaffordable actions without mutating the original', () => {
    const b = fixture();
    const saved = JSON.stringify(b);
    const r = act(b, 'attack', {
        actorId: 'missing', targetId: b.combatants[1].id
    });
    assert.ok(r.error);
    assert.equal(r.battle, b);
    assert.equal(JSON.stringify(b), saved);
    b.combatants[0].resources.action = 0;
    assert.equal(act(b, 'dodge').battle, b);
});
test('initiative is stable; level one half-casters have slots and fireball waits until five', () => {
    assert.deepEqual(member().resources.spellSlots, {
        1: 2
    });
    assert.deepEqual(member('traveler').resources.spellSlots, {
        1: 2
    });
    assert.equal(getAvailableSpells(member('selene')).some(s => s.id === 'wizard-fireball'), false);
    assert.equal(getAvailableSpells(member('selene', 5)).some(s => s.id === 'wizard-fireball'), true);
    const a = fixture();
    assert.equal(new Set(a.initiative).size, a.combatants.length);
});
test('movement spends five per diagonal, respects walls, terrain and occupied destinations', () => {
    const b = fixture();
    b.combatants[1].position = {
        x: 10, y: 6
    };
    const r = act(b, 'move', {
        point: {
            x: 2, y: 2
        }
    });
    assert.equal(r.battle.combatants[0].resources.movement, 25);
    b.terrain = [{
            x: 2, y: 2, type: 'wall'
        }];
    assert.equal(act(b, 'move', {
        point: {
            x: 2, y: 2
        }
    }).battle, b);
    assert.equal(getReachableCells(b, b.combatants[0].id).some(p => p.x === 2 && p.y === 2), false);
    b.terrain = [{
            x: 2, y: 2, type: 'difficult'
        }];
    assert.equal(act(b, 'move', {
        point: {
            x: 2, y: 2
        }
    }).battle.combatants[0].resources.movement, 20);
});
test('wood elf traits let a custom hero walk seven squares while legacy heroes walk six', () => {
    const hero = createDefaultCharacter('traveler');
    hero.race = '木精灵';
    for (const speciesTraits of [true, undefined]) {
        const b = createBattle([createPartyMember({ ...hero, speciesTraits })], {
            id: 'wood-elf', title: 'Wood Elf', enemyKind: 'bandit', count: 1
        }, fixed);
        assert.equal(getReachableCells(b, hero.id).some(p => p.x === 8 && p.y === 1), speciesTraits === true);
    }
});
test('species resistance reduces matching damage before temporary HP and concentration checks', () => {
    for (const [race, speciesTraits, damageType, expectedHp] of [
        ['提夫林', true, 'fire', 81],
        ['龙裔', true, 'fire', 81],
        ['矮人', true, 'poison', 81],
        ['提夫林', true, 'poison', 58],
        ['提夫林', undefined, 'fire', 58],
    ] as const) {
        const b = fixture('traveler');
        const [hero, enemy] = b.combatants;
        Object.assign(hero, { race, speciesTraits, hp: { current: 100, max: 100 }, temporaryHp: 3, ac: 1 });
        hero.attributes.con = 10;
        hero.concentration = { spellId: 'ranger-hunters-mark', targetIds: [enemy.id], remainingRounds: 5 };
        enemy.weapon = { ...enemy.weapon, attribute: 'str', dice: 1, sides: 50, damageType };
        enemy.attributes.str = 10;
        b.turnIndex = 1;
        const rolls = [.49, .88, .7];
        const result = act(b, 'attack', { targetId: hero.id }, () => rolls.shift() ?? .49);
        assert.equal(result.error, undefined);
        assert.equal(result.battle.combatants[0].hp.current, expectedHp);
        assert.equal(Boolean(result.battle.combatants[0].concentration), expectedHp === 81);
    }
});
test('attacks consume one action and duplicate IDs never reroll', () => {
    const b = fixture();
    const a: BattleAction = {
        id: 'once', type: 'attack', actorId: b.combatants[0].id, targetId: b.combatants[1].id
    };
    const r = applyAction(b, a, () => .99);
    assert.equal(r.error, undefined);
    assert.equal(r.battle.combatants[0].resources.action, 0);
    assert.equal(r.battle.combatants[1].hp.current, 81); // crit: 2d8 + STR 3
    assert.equal(applyAction(r.battle, a, () => {
        throw Error('rerolled');
    }).battle, r.battle);
    assert.equal(b.combatants[1].hp.current, 100);
});
test('shield interruption survives JSON reload, resolves once and consumes a slot/reaction', () => {
    const b = fixture('selene');
    b.initiative.reverse();
    b.turnIndex = 0;
    const e = getCurrentActor(b)!;
    e.weapon.melee = true;
    e.weapon.range = 5;
    e.attributes.str = 10;
    const r = act(b, 'attack', {
        targetId: b.combatants[0].id
    }, () => .49);
    // attack 10+2 =12 hits AC12, shield turns it into a miss
    assert.equal(r.battle.pendingReaction?.kind, 'shield');
    const restored = JSON.parse(JSON.stringify(r.battle));
    const decision: BattleAction = {
        id: 'reaction', type: 'react', actorId: b.combatants[0].id, reaction: 'accept'
    };
    const resolved = applyAction(restored, decision, () => {
        throw Error('attack rerolled');
    });
    assert.equal(resolved.error, undefined);
    assert.equal(resolved.battle.pendingReaction, null);
    assert.equal(resolved.battle.combatants[0].hp.current, 7);
    assert.equal(resolved.battle.combatants[0].resources.spellSlots[1], 1);
    assert.equal(resolved.battle.combatants[0].resources.reaction, false);
    assert.equal(applyAction(resolved.battle, decision).battle, resolved.battle);
});
test('opportunity interrupts before moving and resumes the saved path once', () => {
    const b = fixture();
    const r = act(b, 'move', {
        point: {
            x: 0, y: 1
        }
    });
    assert.equal(r.battle.pendingReaction?.kind, 'opportunity');
    assert.deepEqual(r.battle.combatants[0].position, {
        x: 1, y: 1
    });
    const p = r.battle.pendingReaction!;
    const done = applyAction(JSON.parse(JSON.stringify(r.battle)), {
        id: 'oa', type: 'react', actorId: p.actorId, reaction: 'decline'
    });
    assert.deepEqual(done.battle.combatants[0].position, {
        x: 0, y: 1
    });
    assert.equal(done.battle.combatants[0].resources.movement, 25);
});
test('spell slots are limited once per turn while cantrips can follow a bonus spell', () => {
    const b = fixture('traveler');
    const p = b.combatants[0];
    const mark = act(b, 'cast', {
        spellId: 'ranger-hunters-mark', targetId: b.combatants[1].id, slotLevel: 1
    });
    assert.equal(mark.error, undefined);
    assert.equal(act(mark.battle, 'cast', {
        spellId: 'ranger-cure-wounds', targetId: p.id, slotLevel: 1
    }).battle, mark.battle);
    const w = fixture('selene');
    const fire = act(w, 'cast', {
        spellId: 'wizard-fire-bolt', targetId: w.combatants[1].id
    }, () => .99);
    assert.equal(fire.battle.combatants[1].hp.current, 80);
    assert.equal(fire.battle.combatants[0].resources.spellSlots[1], 2);
});
test('saves have no automatic natural-one failure or natural-twenty success', () => {
    const b = fixture('selene', 5);
    b.combatants[0].attributes.int = 50;
    const r = act(b, 'cast', {
        spellId: 'wizard-fireball', point: {
            x: 2, y: 1
        }, slotLevel: 3
    }, () => .99);
    assert.equal(r.error, undefined);
    assert.equal(r.battle.combatants[1].hp.current, 52);
});
test('healing wakes allies; dead allies cannot be healed; help stabilizes at zero', () => {
    const b = fixture();
    const ally = member('selene');
    ally.id = 'ally';
    ally.position = {
        x: 1, y: 2
    };
    ally.hp.current = 0;
    ally.conditions = [{
            name: 'unconscious'
        }, {
            name: 'prone'
        }];
    b.combatants.push(ally);
    const r = act(b, 'cast', {
        spellId: 'paladin-lay-on-hands', targetId: 'ally'
    });
    assert.equal(r.battle.combatants[2].hp.current, 5);
    assert.equal(r.battle.combatants[2].conditions.some(c => c.name === 'unconscious'), false);
    const s = act(b, 'help', {
        targetId: 'ally'
    }, () => .99);
    assert.equal(s.battle.combatants[2].deathSaves.stable, true);
});
test('zero HP actors progress without deadlock and all incapacitated party ends battle', () => {
    const b = fixture();
    const ally = member('selene');
    ally.id = 'ally';
    b.combatants.push(ally);
    b.initiative = [b.combatants[0].id, 'ally', b.combatants[1].id];
    ally.hp.current = 0;
    ally.conditions = [{
            name: 'unconscious'
        }];
    const r = act(b, 'end-turn', {}, () => .49);
    assert.equal(getCurrentActor(r.battle)?.side, 'enemy');
    assert.equal(r.battle.combatants[2].deathSaves.successes, 1);
    r.battle.combatants[0].hp.current = 0;
    const done = advanceEnemyTurn(r.battle, () => .49);
    assert.equal(done.phase, 'defeat');
});
test('rest recovers 2024 resources without reviving dead characters', () => {
    const w = member('selene', 5);
    w.hp.current = 1;
    w.resources.spellSlots = {
        1: 0, 2: 0, 3: 0
    };
    const short = restParty([w], 'short', () => .99)[0];
    assert.ok(short.hp.current > 1);
    assert.equal(short.resources.arcaneRecoveryUsed, true);
    const long = restParty([short], 'long')[0];
    assert.equal(long.hp.current, long.hp.max);
    assert.deepEqual(long.resources.spellSlots, {
        1: 4, 2: 3, 3: 2
    });
    assert.equal(long.resources.hitDice, 5);
});
test('concentration failure removes only the linked mark and retains unrelated spell effects', () => {
    const b = fixture('traveler');
    const p = b.combatants[0], e = b.combatants[1];
    p.resources.hunterMarkUses = 2;
    const mark = act(b, 'cast', {
        spellId: 'ranger-hunters-mark', targetId: e.id
    });
    assert.equal(mark.battle.combatants[0].resources.spellSlots[1], 2);
    assert.equal(mark.battle.combatants[0].resources.hunterMarkUses, 1);
    const turn = act(mark.battle, 'end-turn').battle;
    turn.combatants[0].hp = {
        current: 100, max: 100
    };
    turn.combatants[0].ac = 1;
    turn.combatants[1].conditions.push({
        name: 'blessed', sourceId: 'other-caster', spellId: 'paladin-bless'
    });
    const numbers = [.49, .49, 0];
    const hit = act(turn, 'attack', {
        targetId: p.id
    }, () => numbers.shift() ?? 0).battle;
    assert.equal(hit.combatants[0].concentration, undefined);
    assert.equal(hit.combatants[1].conditions.some(c => c.name === 'marked'), false);
    assert.equal(hit.combatants[1].conditions.some(c => c.spellId === 'paladin-bless'), true);
});
test('rogue cunning action spends the bonus, sneak attack scales and uncanny dodge halves once', () => {
    const b = fixture('shadow_rogue', 5);
    const p = b.combatants[0];
    const ally = member();
    ally.id = 'ally';
    ally.position = {
        x: 2, y: 2
    };
    b.combatants.push(ally);
    const dash = act(b, 'dash', {
        useBonusAction: true
    }).battle;
    assert.equal(dash.combatants[0].resources.action, 1);
    assert.equal(dash.combatants[0].resources.bonusAction, 0);
    assert.equal(dash.combatants[0].resources.movement, 60);
    const hit = act(dash, 'attack', {
        targetId: b.combatants[1].id
    }, () => .49).battle;
    assert.equal(hit.combatants[1].hp.current, 85); // 1d6(3)+DEX3+3d6(9) =15
    assert.equal(hit.combatants[0].resources.sneakAttackUsed, true);
    const enemyTurn = act(hit, 'end-turn').battle;
    enemyTurn.combatants[0].hp = {
        current: 100, max: 100
    };
    enemyTurn.combatants[0].ac = 1;
    const pending = act(enemyTurn, 'attack', {
        targetId: p.id
    }, () => .49).battle;
    assert.equal(pending.pendingReaction?.kind, 'uncanny-dodge');
    const damage = pending.pendingReaction!.damage!;
    const result = applyAction(pending, {
        id: 'uncanny', type: 'react', actorId: p.id, reaction: 'accept'
    }, () => 0).battle;
    assert.equal(result.combatants[0].hp.current, 100 - Math.floor(damage / 2));
    assert.equal(result.combatants[0].resources.reaction, false);
});
test('Shield making an attack miss cannot open a divine smite window', () => {
    const b = fixture('paladin_arthur', 2);
    const enemy = member('selene');
    enemy.id = b.combatants[1].id;
    enemy.side = 'enemy';
    enemy.position = {
        x: 2, y: 1
    };
    b.combatants[1] = enemy;
    const pending = act(b, 'attack', {
        targetId: enemy.id
    }, () => .49).battle;
    assert.equal(pending.pendingReaction?.kind, 'shield');
    const resolved = applyAction(pending, {
        id: 'shield', type: 'react', actorId: enemy.id, reaction: 'accept'
    }).battle;
    assert.equal(act(resolved, 'cast', {
        spellId: 'paladin-divine-smite', targetId: enemy.id
    }).battle, resolved);
});
test('healed characters retain an unspent reaction before their next turn', () => {
    const b = fixture();
    const e = b.combatants[1], w = member('selene');
    w.id = 'healed-wizard';
    w.position = {
        x: 1, y: 2
    };
    w.hp = {
        current: 1, max: 7
    };
    b.combatants.push(w);
    b.initiative = [e.id, b.combatants[0].id, w.id];
    b.turnIndex = 0;
    e.weapon.attribute = 'str';
    e.attributes.str = 10;
    w.ac = 1;
    const pending = act(b, 'attack', {
        targetId: w.id
    }, () => .49).battle;
    const down = applyAction(pending, {
        id: 'decline-before-down', type: 'react', actorId: w.id, reaction: 'decline'
    }).battle;
    assert.equal(down.combatants[2].hp.current, 0);
    const paladin = act(down, 'end-turn').battle;
    const healed = act(paladin, 'cast', {
        spellId: 'paladin-lay-on-hands', targetId: w.id
    }).battle;
    assert.equal(healed.combatants[2].resources.reaction, true);
});
test('opportunity attack followed by shield resumes its path through a second JSON reload', () => {
    const b = fixture('selene');
    b.combatants[1].attributes.dex = 10;
    const move = act(b, 'move', {
        point: {
            x: 0, y: 1
        }
    }).battle;
    const hit = applyAction(move, {
        id: 'oa-accept', type: 'react', actorId: b.combatants[1].id, reaction: 'accept'
    }, () => .49).battle;
    assert.equal(hit.pendingReaction?.kind, 'shield');
    const restored = JSON.parse(JSON.stringify(hit));
    const complete = applyAction(restored, {
        id: 'oa-shield', type: 'react', actorId: b.combatants[0].id, reaction: 'accept'
    }, () => {
        throw Error('reroll');
    }).battle;
    assert.equal(complete.pendingReaction, null);
    assert.deepEqual(complete.combatants[0].position, {
        x: 0, y: 1
    });
    assert.equal(complete.combatants[0].resources.movement, 25);
});
test('line of sight rejects attacks through walls and half cover changes a hit to a miss', () => {
    const b = fixture('traveler');
    b.combatants[1].position = {
        x: 4, y: 1
    };
    b.combatants[1].ac = 14;
    b.terrain = [{
            x: 2, y: 1, type: 'wall'
        }];
    assert.equal(act(b, 'attack', {
        targetId: b.combatants[1].id
    }).battle, b);
    b.terrain = [{
            x: 2, y: 1, type: 'cover'
        }];
    const result = act(b, 'attack', {
        targetId: b.combatants[1].id
    }).battle;
    assert.equal(result.combatants[1].hp.current, 100);
});
test('local enemies make deterministic legal turns and leave original snapshots intact', () => {
    const b = fixture();
    b.turnIndex = 1;
    b.combatants[1].position = {
        x: 8, y: 1
    };
    const before = JSON.stringify(b), a = advanceEnemyTurn(b, () => .49), other = advanceEnemyTurn(b, () => .49);
    assert.deepEqual(a, other);
    assert.equal(JSON.stringify(b), before);
    assert.notEqual(a, b);
    assert.equal(getCurrentActor(a)?.side, 'party');
});
test('advantage and disadvantage cancel to one d20 and still permit ally-enabled sneak attack', () => {
    const b = fixture('shadow_rogue');
    const ally = member();
    ally.id = 'ally';
    ally.position = {
        x: 2, y: 2
    };
    b.combatants.push(ally);
    b.combatants[0].conditions = [{
            name: 'hidden'
        }, {
            name: 'poisoned'
        }];
    let rolls = 0;
    const result = act(b, 'attack', {
        targetId: b.combatants[1].id
    }, () => {
        rolls++;
        return .49;
    }).battle;
    assert.equal(result.combatants[1].hp.current, 91);
    assert.equal(rolls, 3); // d20, weapon d6, sneak d6
});
test('declining shield does not consume the reaction and the next turn restores a spent one', () => {
    const b = fixture('selene');
    b.turnIndex = 1;
    b.combatants[1].attributes.dex = 10;
    const pending = act(b, 'attack', {
        targetId: b.combatants[0].id
    }, () => .49).battle;
    const decision = applyAction(pending, {
        id: 'decline', type: 'react', actorId: b.combatants[0].id, reaction: 'decline'
    }).battle;
    assert.equal(decision.combatants[0].resources.reaction, true);
    decision.combatants[0].resources.reaction = false;
    const next = act(decision, 'end-turn').battle;
    assert.equal(getCurrentActor(next)?.side, 'party');
    assert.equal(next.combatants[0].resources.reaction, true);
});
test('paladin level-five extra attack is exactly twice and smite uses its own bonus/resource', () => {
    const b = fixture('paladin_arthur', 5);
    const id = b.combatants[1].id;
    const first = act(b, 'attack', {
        targetId: id
    }, () => .49).battle;
    const smite = act(first, 'cast', {
        spellId: 'paladin-divine-smite', targetId: id
    }, () => .49).battle;
    assert.equal(smite.combatants[0].resources.divineSmiteUses, 0);
    assert.equal(smite.combatants[0].resources.spellSlots[1], 4);
    assert.equal(smite.combatants[0].resources.bonusAction, 0);
    const second = act(smite, 'attack', {
        targetId: id
    }, () => .49).battle;
    assert.equal(second.combatants[0].attacksRemaining, 0);
    assert.equal(act(second, 'attack', {
        targetId: id
    }).battle, second);
});
test('empty slots, fractional/negative levels, illegal bonus actions and unknown items reject atomically', () => {
    const b = fixture('selene');
    const id = b.combatants[1].id;
    for (const slotLevel of [-1, 0, 1.5, 4]) {
        const result = act(b, 'cast', {
            spellId: 'wizard-magic-missile', slotLevel, targetId: id
        });
        assert.equal(result.battle, b);
        assert.ok(result.error);
    }
    b.combatants[0].resources.spellSlots[1] = 0;
    assert.equal(act(b, 'cast', {
        spellId: 'wizard-magic-missile', targetId: id
    }).battle, b);
    assert.equal(act(b, 'dash', {
        useBonusAction: true
    }).battle, b);
    assert.equal(act(b, 'use-item', {
        item: 'invented healing potion'
    }).battle, b);
});
test('thunderwave affects its cube, pushes on failed saves, and never provokes on forced movement', () => {
    const b = fixture('selene');
    b.combatants[0].position = {
        x: 1, y: 3
    };
    b.combatants[1].position = {
        x: 2, y: 3
    };
    b.combatants[1].attributes.con = 1;
    const result = act(b, 'cast', {
        spellId: 'wizard-thunderwave', slotLevel: 1, point: {
            x: 3, y: 3
        }
    }, () => .49).battle;
    assert.equal(result.pendingReaction, null);
    assert.equal(result.combatants[1].hp.current, 92);
    assert.deepEqual(result.combatants[1].position, {
        x: 4, y: 3
    });
    assert.equal(result.combatants[0].hp.current, 7);
});
test('replacing concentration cleans every linked condition without touching another caster', () => {
    const b = fixture();
    const p = b.combatants[0], e = b.combatants[1];
    p.concentration = {
        spellId: 'old-effect', targetIds: [e.id], remainingRounds: 2
    };
    e.conditions = [{
            name: 'restrained', sourceId: p.id, spellId: 'old-effect'
        }, {
            name: 'blessed', sourceId: 'other', spellId: 'paladin-bless'
        }];
    const r = act(b, 'cast', {
        spellId: 'paladin-bless', targetId: p.id
    }).battle;
    assert.equal(r.combatants[1].conditions.some(c => c.name === 'restrained'), false);
    assert.equal(r.combatants[1].conditions.some(c => c.sourceId === 'other'), true);
    assert.equal(r.combatants[0].concentration?.spellId, 'paladin-bless');
});
test('moving a hunter mark preserves its remaining duration and does not spend another free use', () => {
    const b = fixture('traveler');
    const p = b.combatants[0], dead = b.combatants[1];
    const other = member();
    other.id = 'second-enemy';
    other.side = 'enemy';
    other.position = {
        x: 3, y: 1
    };
    b.combatants.push(other);
    p.concentration = {
        spellId: 'ranger-hunters-mark', targetIds: [dead.id], remainingRounds: 123
    };
    dead.hp.current = 0;
    dead.conditions = [{
            name: 'dead'
        }, {
            name: 'marked', sourceId: p.id, spellId: 'ranger-hunters-mark'
        }];
    const r = act(b, 'cast', {
        spellId: 'ranger-hunters-mark', targetId: other.id
    }).battle;
    assert.equal(r.combatants[0].concentration?.remainingRounds, 123);
    assert.equal(r.combatants[0].resources.hunterMarkUses, 2);
    assert.equal(r.combatants[0].resources.spellSlots[1], 2);
});
test('natural twenty death save wakes a party member without resetting the completed turn', () => {
    const b = fixture();
    const down = member('selene');
    down.id = 'down';
    down.hp.current = 0;
    down.conditions = [{
            name: 'unconscious'
        }, {
            name: 'prone'
        }];
    b.combatants.push(down);
    b.initiative = [b.combatants[0].id, 'down', b.combatants[1].id];
    const result = act(b, 'end-turn', {}, () => .99).battle;
    assert.equal(getCurrentActor(result)?.id, 'down');
    assert.equal(result.combatants[2].hp.current, 1);
    assert.equal(result.combatants[2].conditions.some(c => c.name === 'prone'), true);
    assert.equal(result.combatants[2].resources.action, 1);
});
test('all unconscious but living party members end in defeat instead of waiting forever', () => {
    const b = fixture();
    b.combatants[0].hp.current = 0;
    b.combatants[0].conditions = [{
            name: 'unconscious'
        }];
    const r = act(b, 'end-turn').battle;
    assert.equal(r.phase, 'defeat');
    assert.equal(r.pendingReaction, null);
    assert.equal(r.combatants[0].conditions.some(c => c.name === 'dead'), false);
});
test('pending decisions reject wrong actors and invalid choices without mutating stored dice', () => {
    const b = fixture('selene');
    b.turnIndex = 1;
    b.combatants[1].attributes.dex = 10;
    const pending = act(b, 'attack', {
        targetId: b.combatants[0].id
    }).battle;
    const before = JSON.stringify(pending);
    const wrong = applyAction(pending, {
        id: 'bad', type: 'react', actorId: b.combatants[1].id, reaction: 'accept'
    }, () => {
        throw Error('roll');
    });
    assert.equal(wrong.battle, pending);
    assert.ok(wrong.error);
    assert.equal(JSON.stringify(pending), before);
    assert.equal(act(pending, 'end-turn').battle, pending);
});
test('2024 concentration DC is capped at thirty even after enormous damage', () => {
    const b = fixture('traveler');
    const p = b.combatants[0], e = b.combatants[1];
    p.hp = {
        current: 500, max: 500
    };
    p.attributes.con = 40;
    p.ac = 1;
    p.concentration = {
        spellId: 'ranger-hunters-mark', targetIds: [e.id], remainingRounds: 5
    };
    e.conditions = [{
            name: 'marked', sourceId: p.id, spellId: 'ranger-hunters-mark'
        }];
    b.turnIndex = 1;
    e.weapon.sides = 1000;
    e.weapon.dice = 1;
    e.weapon.attribute = 'str';
    e.attributes.str = 10;
    const rolls = [.49, .1, .99];
    const result = act(b, 'attack', {
        targetId: p.id
    }, () => rolls.shift() ?? .99).battle;
    assert.ok(result.combatants[0].concentration);
    assert.equal(result.combatants[0].hp.current, 399);
});
test('a prone actor can stand in place for half speed; restrained actors cannot stand', () => {
    const b = fixture();
    const p = b.combatants[0];
    p.conditions = [{
            name: 'prone'
        }];
    const result = act(b, 'move', {
        point: p.position
    });
    assert.equal(result.error, undefined);
    assert.equal(result.battle.combatants[0].resources.movement, 15);
    assert.equal(result.battle.combatants[0].conditions.some(c => c.name === 'prone'), false);
    p.conditions.push({
        name: 'restrained'
    });
    assert.equal(act(b, 'move', {
        point: p.position
    }).battle, b);
});
test('verbal spellcasting ends hiding and Dodge cannot protect against an unseen attacker', () => {
    const b = fixture('selene');
    b.combatants[0].conditions = [{
            name: 'hidden'
        }];
    const cast = act(b, 'cast', {
        spellId: 'wizard-magic-missile', targetId: b.combatants[1].id
    }).battle;
    assert.equal(cast.combatants[0].conditions.some(c => c.name === 'hidden'), false);
    const p = fixture('shadow_rogue');
    p.combatants[0].conditions = [{
            name: 'hidden'
        }];
    p.combatants[1].conditions = [{
            name: 'dodging'
        }];
    const values = [0, .99, .49, .49];
    const attack = act(p, 'attack', {
        targetId: p.combatants[1].id
    }, () => values.shift() ?? .49).battle;
    assert.ok(attack.combatants[1].hp.current < 100);
});

test('enemy routes to a visible attack cell around default-map wall corners', () => {
  const b = fixture();
  b.combatants[0].position = { x: 6, y: 2 };
  b.combatants[0].hp = { current: 100, max: 100 };
  b.combatants[1].position = { x: 4, y: 2 };
  b.terrain = [{ x: 5, y: 2, type: 'wall' }, { x: 5, y: 3, type: 'wall' }];
  b.turnIndex = 1;
  let result = advanceEnemyTurn(b, () => .99);
  for (let turn = 0; turn < 3 && result.combatants[0].hp.current === 100; turn++) {
    result = act(result, 'end-turn').battle;
    result = advanceEnemyTurn(result, () => .99);
  }
  assert.ok(result.combatants[0].hp.current < 100, 'a reachable enemy must attack instead of remaining behind the corner');
});

test('enemy follows a detour even when its first step increases distance to the target', () => {
  const b = fixture();
  b.combatants[0].position = { x: 3, y: 1 };
  b.combatants[0].hp = { current: 100, max: 100 };
  b.combatants[1].position = { x: 1, y: 1 };
  b.combatants[1].speed = 5;
  b.combatants[1].resources.movement = 5;
  b.terrain = [0, 1, 2, 3, 4].map(y => ({ x: 2, y, type: 'wall' as const }));
  b.turnIndex = 1;
  let result = advanceEnemyTurn(b, () => .99);
  assert.equal(result.combatants[1].resources.movement, 0, 'the first step must consume only the available five feet');
  for (let turn = 0; turn < 14 && result.combatants[0].hp.current === 100; turn++) {
    result = act(result, 'end-turn').battle;
    result = advanceEnemyTurn(result, () => .99);
  }
  assert.ok(result.combatants[0].hp.current < 100, 'a longer legal detour must eventually reach attack range');
});

test('damage at zero retains death-save successes until stabilization or healing', () => {
  const b = fixture();
  const down = member('selene');
  down.id = 'down';
  down.hp = { current: 0, max: 100 };
  down.position = { x: 2, y: 2 };
  down.conditions = [{ name: 'unconscious' }, { name: 'prone' }];
  down.deathSaves = { successes: 2, failures: 0, stable: false };
  b.combatants.push(down);
  b.turnIndex = 1;
  const result = act(b, 'attack', { targetId: down.id }, () => .49).battle;
  assert.equal(result.combatants[2].deathSaves.successes, 2);
  assert.equal(result.combatants[2].deathSaves.failures, 2);
});

test('Bless adds its d4 to ordinary death-save totals while natural one and twenty keep special effects', () => {
  const b = fixture();
  const down = member('selene');
  down.id = 'down';
  down.hp.current = 0;
  down.conditions = [{ name: 'unconscious' }, { name: 'blessed', sourceId: b.combatants[0].id, spellId: 'paladin-bless' }];
  b.combatants.push(down);
  b.combatants[0].concentration = { spellId: 'paladin-bless', targetIds: ['down'], remainingRounds: 10 };
  b.initiative = [b.combatants[0].id, down.id, b.combatants[1].id];
  const rolls = [.44, .49]; // natural 9 + Bless 2 succeeds
  const result = act(b, 'end-turn', {}, () => rolls.shift() ?? .49).battle;
  assert.equal(result.combatants[2].deathSaves.successes, 1);
  assert.equal(result.combatants[2].deathSaves.failures, 0);
  const one = act(b, 'end-turn', {}, () => 0).battle;
  assert.equal(one.combatants[2].deathSaves.failures, 2);
  const twenty = act(b, 'end-turn', {}, () => .99).battle;
  assert.equal(twenty.combatants[2].hp.current, 1);
});

test('enemy opportunity reactions resolve automatically without ending the moving player turn', () => {
  const b = fixture();
  b.combatants[0].hp = { current: 100, max: 100 };
  b.combatants[0].ac = 1;
  const move = act(b, 'move', { point: { x: 0, y: 1 } }).battle;
  assert.equal(move.pendingReaction?.actorId, b.combatants[1].id);
  const result = advanceEnemyTurn(move, () => .49);
  assert.equal(result.pendingReaction, null);
  assert.deepEqual(result.combatants[0].position, { x: 0, y: 1 });
  assert.equal(result.combatants[0].resources.movement, 25);
  assert.equal(result.combatants[1].resources.reaction, false);
  assert.equal(result.combatants[0].hp.current, 96);
  assert.equal(getCurrentActor(result)?.id, b.combatants[0].id);
  assert.equal(result.round, 1);
  assert.equal(result.combatants[0].resources.action, 1);
  assert.deepEqual(advanceEnemyTurn(move, () => .49), result);
  assert.equal(advanceEnemyTurn(result, () => { throw Error('replayed enemy reaction'); }), result);
});

test('automatic enemy opportunity attacks preserve a nested player Shield decision', () => {
  const b = fixture('selene');
  b.combatants[1].attributes.dex = 10;
  const move = act(b, 'move', { point: { x: 0, y: 1 } }).battle;
  const pendingShield = advanceEnemyTurn(move, () => .49);
  assert.equal(pendingShield.pendingReaction?.kind, 'shield');
  assert.equal(pendingShield.pendingReaction?.actorId, b.combatants[0].id);
  assert.equal(advanceEnemyTurn(pendingShield, () => { throw Error('player reaction resolved automatically'); }), pendingShield);
  const result = applyAction(JSON.parse(JSON.stringify(pendingShield)), { id: 'player-shield', type: 'react', actorId: b.combatants[0].id, reaction: 'accept' }, () => { throw Error('rerolled opportunity attack'); }).battle;
  assert.equal(result.pendingReaction, null);
  assert.deepEqual(result.combatants[0].position, { x: 0, y: 1 });
  assert.equal(getCurrentActor(result)?.id, b.combatants[0].id);
  assert.equal(result.combatants[0].hp.current, 7);
});

test('movement destinations preview the same difficult-terrain cost spent on confirmation', () => {
  const b = fixture();
  const actor = b.combatants[0];
  const point = { x: 2, y: 2 };
  b.terrain = [{ ...point, type: 'difficult' }];
  const route = getReachableRoutes(b, actor.id).find(route => route.point.x === point.x && route.point.y === point.y);
  assert.equal(route?.cost, 10);
  const result = act(b, 'move', { point });
  assert.equal(result.error, undefined);
  assert.equal(result.battle.combatants[0].resources.movement, 20);
  assert.match(result.battle.log.at(-1)?.text ?? '', /向东 5 尺、向南 5 尺/);
});

test('area preview enforces cardinal Thunderwave and excludes creatures behind a wall', () => {
  const b = fixture('selene');
  const actor = b.combatants[0];
  actor.position = { x: 1, y: 3 };
  b.combatants[1].position = { x: 4, y: 2 };
  b.terrain = [{ x: 4, y: 3, type: 'wall' }];
  const spell = getAvailableSpells(actor).find(spell => spell.id === 'wizard-thunderwave')!;
  assert.ok(getAreaSpellError(b, actor, spell, { x: 3, y: 2 }));
  const center = { x: 3, y: 3 };
  assert.equal(getAreaSpellError(b, actor, spell, center), undefined);
  assert.deepEqual(getAreaSpellTargets(b, spell, center), []);
  const result = act(b, 'cast', { point: center, spellId: spell.id });
  assert.equal(result.error, undefined);
  assert.equal(result.battle.combatants[1].hp.current, 100);
});
