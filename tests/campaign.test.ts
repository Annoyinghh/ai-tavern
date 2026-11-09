import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCharacter } from '../lib/types';
import { createEmptyScript, addChapter, createPresetScript, type PresetKey } from '../lib/scripts';
import { migrateCampaign, startScript, applyAdventureEvent, applyDirectorResult, settleBattle, advanceChapter, createWorldMemory, refreshScript, beginExplorationCheck, recordExplorationRoll, getRequiredChapterCheck, getRequiredChapterChoices, previewExplorationOutcome, confirmExplorationCheck, isEndingPending, startEpilogue, beginChapterEncounter, getRequiredChapterEncounter, getChapterRewardNotice } from '../lib/campaign';
import { isEndingChapter } from '../lib/worldLore';
import { getActionCheck, getExplorationOutcome } from '../lib/checks';
import { exportCampaignSave, importCampaignSave } from '../lib/saveFile';

test('authored endings survive old saves and wait for an explicit epilogue choice', () => {
  const presets: Record<PresetKey, number> = { baldurs_gate: 4, dungeon: 1, mystery: 1, tavern: 1, eldritch: 1, cyberpunk: 1 };
  for (const [key, count] of Object.entries(presets)) {
    const script = createPresetScript(key as PresetKey);
    const endings = Object.values(script.chapters).filter(chapter => isEndingChapter(script, chapter));
    assert.equal(endings.length, count, key);
  }
  const script = createPresetScript('dungeon');
  const ending = Object.values(script.chapters).find(chapter => isEndingChapter(script, chapter))!;
  const state = advanceChapter(startScript(migrateCampaign(null), script), ending.id);
  const epilogue = ending.choices.find(choice => choice.nextChapter === 'AI_DYNAMIC')!;
  const result = { narration: '额外情节', choices: [], sources: [] };
  assert.equal(isEndingPending(state), true);
  assert.equal(applyDirectorResult(state, '随意续写', result), state);
  assert.equal(startEpilogue(state, { ...epilogue, text: '未写入剧本的分支' }), state);
  const continued = startEpilogue(state, epilogue);
  assert.equal(isEndingPending(migrateCampaign(continued)), false);
  assert.equal(applyDirectorResult(continued, epilogue.text, result).messages.at(-1)?.content, result.narration);
  assert.equal(isEndingPending(startScript(continued, script)), false);
});

test('old saves preserve character/messages and migrate to one canonical party', () => {
  const hero = createDefaultCharacter('selene');
  hero.name = '我的角色';
  hero.hp.current = 3;
  const save = { messages: [{ id: 'kept', content: '已发生的故事' }], character: hero, gameTime: { day: 3, timeOfDay: 'night' } };
  const state = migrateCampaign(save);
  assert.equal(state.party[0].name, '我的角色');
  assert.equal(state.party[0].hp.current, 3);
  assert.equal(state.character?.id, state.party[0].id);
  assert.equal(state.messages[0].id, 'kept');
  assert.equal(state.gameTime.day, 3);
  assert.deepEqual(save.character, hero);
});

test('new script replaces world memory and battlefield while preserving party', () => {
  const state = migrateCampaign(null);
  state.memory = { ...createWorldMemory(), milestones: ['旧世界事件'], questLog: ['旧任务'] };
  const script = createEmptyScript('霓虹城调查');
  script.genre = '科幻';
  const next = startScript(state, script);
  assert.equal(next.currentChapter, script.startChapter);
  assert.deepEqual(next.memory?.milestones, []);
  assert.ok(!next.memory?.questLog.includes('旧任务'));
  assert.deepEqual(next.party, state.party);
  assert.equal(next.battle, null);
  assert.deepEqual(next.visitedChapterIds, [script.startChapter]);
});

test('chapter jumps accept only actual chapters and remember visited chapters once', () => {
  let script = createEmptyScript('分支');
  script = addChapter(script, '下一幕');
  const nextId = Object.keys(script.chapters).find(id => id !== script.startChapter)!;
  const state = startScript(migrateCampaign(null), script);
  assert.equal(advanceChapter(state, 'missing'), state);
  const next = advanceChapter(state, nextId);
  assert.equal(next.currentChapter, nextId);
  assert.equal(advanceChapter(next, nextId).visitedChapterIds.filter(id => id === nextId).length, 1);
});

test('an authored encounter gates its own chapter and resumes from an imported battle', () => {
  const script = addChapter(createEmptyScript('遗迹守卫'), '石门之后');
  const destination = Object.keys(script.chapters).find(id => id !== script.startChapter)!;
  const chapter = script.chapters[script.startChapter];
  chapter.encounter = { title: '守门骷髅', enemyKind: 'skeleton', count: 1, aftermath: '石门后的通道重新露了出来。' };
  chapter.choices = [{ text: '走过石门', nextChapter: destination }];
  const state = startScript(migrateCampaign(null), script);
  assert.equal(getRequiredChapterEncounter(state)?.title, '守门骷髅');
  assert.equal(advanceChapter(state, destination), state);
  assert.equal(applyDirectorResult(state, '悄悄离开', { narration: '已经过去了。', sources: [], choices: [] }), state);
  const check = getActionCheck('', state.party[0], { attribute: 'dex', dc: 10 })!;
  assert.equal(beginExplorationCheck(state, { text: '绕过去', check }), state);

  const started = beginChapterEncounter(state);
  assert.equal(started.battle?.title, '守门骷髅');
  assert.equal(beginChapterEncounter(started), started);
  const restored = migrateCampaign(importCampaignSave(exportCampaignSave(started)));
  assert.equal(restored.battle?.id, started.battle?.id);
  restored.battle!.phase = 'escaped';
  restored.battle!.combatants.find(unit => unit.id === restored.party[0].id)!.hp.current = 2;
  const retreated = settleBattle(restored);
  assert.equal(retreated.party[0].hp.current, 2);
  assert.equal(advanceChapter(retreated, destination), retreated);

  const retry = beginChapterEncounter(retreated);
  assert.notEqual(retry.battle?.id, started.battle?.id);
  retry.battle!.phase = 'victory';
  const won = settleBattle(retry);
  assert.equal(won.messages.at(-1)?.content, chapter.encounter.aftermath);
  assert.equal(won.party[0].gold, (state.party[0].gold ?? 50) + retry.battle!.reward.gold);
  assert.equal(getRequiredChapterEncounter(migrateCampaign(importCampaignSave(exportCampaignSave(won)))), undefined);
  assert.equal(settleBattle({ ...won, battle: retry.battle }).party[0].gold, won.party[0].gold);
  assert.equal(beginChapterEncounter(won), won);
  assert.equal(advanceChapter(won, destination).currentChapter, destination);
});

test('the dungeon commission pays the promised reward once on arrival, including after a save round trip', () => {
  const script = createPresetScript('dungeon');
  const chapter = (title: string) => Object.values(script.chapters).find(entry => entry.title === title)!;
  const start = startScript(migrateCampaign(null), script);
  const entrance = advanceChapter(start, chapter('墓穴入口').id);
  const corridor = advanceChapter(entrance, chapter('陷阱走廊').id);
  const fight = beginChapterEncounter(corridor);
  fight.battle!.phase = 'victory';
  const won = settleBattle(fight);
  const vault = chapter('宝藏室').id;
  const arrived = advanceChapter(won, vault);
  assert.equal(arrived.party[0].gold, (won.party[0].gold ?? 50) + 500);
  assert.ok(arrived.party[0].inventory.includes('霜月之刃'));
  const restored = migrateCampaign(importCampaignSave(exportCampaignSave(arrived)));
  assert.match(getChapterRewardNotice(restored) ?? '', /500 金币 · 霜月之刃/);
  const revisited = advanceChapter(advanceChapter(restored, chapter('陷阱走廊').id), vault);
  assert.equal(revisited.party[0].gold, arrived.party[0].gold);
  assert.equal(revisited.party[0].inventory.filter(item => item === '霜月之刃').length, 1);
});

test('validated event rewards are applied once and invalid effects leave state unchanged', () => {
  const state = startScript(migrateCampaign(null), createEmptyScript('奖励'));
  const event = { id: 'reward-1', kind: 'reward' as const, title: '找到钱袋', gold: 8, items: ['银钥匙'] };
  const next = applyAdventureEvent(state, event);
  assert.equal(next.party[0].gold, (state.party[0].gold ?? 50) + 8);
  assert.ok(next.party[0].inventory.includes('银钥匙'));
  assert.equal(applyAdventureEvent(next, event), next);
  assert.equal(applyAdventureEvent(state, { ...event, gold: -100 }), state);
});

test('settlement applies combat losses and reward once, never heals party for free', () => {
  const state = startScript(migrateCampaign(null), createEmptyScript('战后'));
  const injured = structuredClone(state.party[0]);
  injured.hp.current = 1;
  state.battle = {
    id: 'enc-1', title: '伏击', phase: 'victory', round: 3, turnIndex: 0,
    combatants: [injured], initiative: [injured.id], width: 12, height: 8, terrain: [], log: [],
    pendingReaction: null, processedActionIds: [], reward: { gold: 12, experience: 100, items: ['碎晶石'] },
  };
  const next = settleBattle(state);
  assert.equal(next.party[0].hp.current, 1);
  assert.equal(next.party[0].experience, 100 / state.party.length);
  assert.equal(next.battle, null);
  assert.equal(settleBattle(next), next);
  assert.equal(next.appliedEventIds.filter(id => id === 'settled:enc-1').length, 1);
});

test('world memories begin without hard-coded companions or other campaign quests', () => {
  const memory = createWorldMemory();
  assert.deepEqual(memory.companionAffinity, {});
  assert.deepEqual(memory.questLog, []);
});

test('combat experience levels a member without restoring already spent slots or healing old wounds', () => {
  const state = startScript(migrateCampaign(null), createEmptyScript('升级'));
  state.party = [state.party[0]];
  state.party[0].experience = 290;
  state.party[0].hp.current = 1;
  state.party[0].resources.spellSlots[1] = 0;
  state.battle = {
    id: 'level-up', title: '胜利', phase: 'victory', round: 2, turnIndex: 0,
    combatants: structuredClone(state.party), initiative: [state.party[0].id], width: 12, height: 8, terrain: [], log: [], pendingReaction: null, processedActionIds: [],
    reward: { gold: 0, experience: 20, items: [] },
  };
  const next = settleBattle(state);
  assert.equal(next.party[0].level, 2);
  assert.equal(next.party[0].experience, 310);
  assert.equal(next.party[0].hp.max - next.party[0].hp.current, state.party[0].hp.max - 1);
  assert.equal(next.party[0].resources.spellSlots[1], 0);
});

test('an opted-in dwarf gains one extra HP at level-up after reloading', () => {
  const hero = createDefaultCharacter('selene');
  for (const [speciesTraits, max] of [[true, 16], [undefined, 15]] as const) {
    const initial = migrateCampaign(null, { ...hero, race: '矮人', speciesTraits, hp: { current: 4, max: 10 } });
    initial.party = [initial.party[0]];
    const state = migrateCampaign(importCampaignSave(exportCampaignSave(initial)));
    state.party[0].experience = 290;
    state.battle = {
      id: 'dwarf-level-up', title: '胜利', phase: 'victory', round: 2, turnIndex: 0,
      combatants: structuredClone(state.party), initiative: [hero.id], width: 12, height: 8, terrain: [], log: [], pendingReaction: null, processedActionIds: [],
      reward: { gold: 0, experience: 20, items: [] },
    };
    assert.deepEqual(settleBattle(state).party[0].hp, { current: max - 6, max });
  }
});

test('import rejects non-boolean species traits', () => {
  const state = migrateCampaign(null);
  Object.assign(state.party[0], { speciesTraits: 'true' });
  assert.throws(() => importCampaignSave(exportCampaignSave(state)), /存档内容不完整或已损坏/);
});

test('environment changes remain in world memory and replay does not duplicate them', () => {
  const state = startScript(migrateCampaign(null), createEmptyScript('雨夜'));
  const event = { id: 'rain-1', kind: 'environment' as const, title: '暴雨', description: '暴雨冲垮了旧桥，需要寻找绕行路线。' };
  const next = applyAdventureEvent(state, event);
  assert.ok(next.memory?.activeBuffsDebuffs.includes(event.description));
  assert.equal(applyAdventureEvent(next, event), next);
});

test('discovery IDs unlock authored knowledge while unknown IDs are rejected', () => {
  const script = createEmptyScript('密室');
  script.knowledge = [{ id: 'hidden', title: '密室来历', content: '密室历史', requiresSecret: 'secret-door' }];
  const state = startScript(migrateCampaign(null), script);
  const event = { id: 'door-found', kind: 'discovery' as const, title: '发现暗门', clue: '墙后传来空洞回音', secretId: 'secret-door' };
  const next = applyAdventureEvent(state, event);
  assert.ok(next.memory?.discoveredSecrets.includes('secret-door'));
  assert.ok(next.memory?.discoveredSecrets.includes(event.clue));
  assert.equal(applyAdventureEvent(state, { ...event, secretId: 'unrelated' }), state);
});

test('workshop edits refresh the active script without replacing combat or messages', () => {
  const state = startScript(migrateCampaign(null), createEmptyScript('可编辑世界'));
  const edited = { ...state.currentScript!, worldSetting: '世界中只有机械生命，没有魔法。' };
  const next = refreshScript(state, [edited]);
  assert.equal(next.currentScript?.worldSetting, edited.worldSetting);
  assert.equal(next.messages, state.messages);
  assert.equal(next.battle, state.battle);
});

test('starting another script carries active battle losses and spent slots forward', () => {
  const state = migrateCampaign(null);
  const party = structuredClone(state.party);
  party[0].hp.current = 2;
  party[0].resources.spellSlots[1] = 0;
  state.battle = { id: 'ongoing', title: '尚未结束', phase: 'active', round: 2, turnIndex: 0, combatants: party, initiative: party.map(p => p.id), width: 12, height: 8, terrain: [], log: [], pendingReaction: null, processedActionIds: [], reward: { gold: 99, experience: 100, items: [] } };
  const next = startScript(state, createEmptyScript('另一场冒险'));
  assert.equal(next.party[0].hp.current, 2);
  assert.equal(next.party[0].resources.spellSlots[1], 0);
  assert.equal(next.party[0].gold, party[0].gold);
  assert.equal(next.battle, null);
});

test('standalone custom hero fills an early hall save with no character', () => {
  const hero = createDefaultCharacter('selene');
  hero.name = '先创建的自定义主角';
  const migrated = migrateCampaign({ character: null, messages: [] }, hero);
  assert.equal(migrated.party[0].name, hero.name);
});

test('a custom build replaces the matching preset when assembling a fresh party', () => {
  const preset = createDefaultCharacter('traveler');
  const custom = { ...preset, portraitId: 'custom', name: '烬角', race: '提夫林', class: '法师', speciesTraits: true };
  const { party } = migrateCampaign({ character: preset }, custom);
  assert.equal(party.length, 4);
  assert.equal(party[0].name, '烬角');
  assert.equal(party[0].weapon.name, '法杖');
  assert.ok(party.slice(1).every(member => member.portraitId !== 'traveler'));
});

test('an exploration die is committed before confirmation and survives refresh without reroll', () => {
  const state = beginExplorationCheck(migrateCampaign(null), { text: '撬开暗门', check: { attribute: 'dex', label: '敏捷', skill: '巧手', dc: 13, bonus: 3 } });
  const rolled = recordExplorationRoll(state, { roll: 7, total: 10 });
  const reloaded = migrateCampaign(JSON.parse(JSON.stringify(rolled)));
  assert.deepEqual(reloaded.pendingCheck?.result, { roll: 7, total: 10 });
  assert.equal(recordExplorationRoll(reloaded, { roll: 20, total: 23 }), reloaded);
  assert.equal(beginExplorationCheck(reloaded, { text: '再次撬门', check: { attribute: 'str', label: '力量', dc: 10, bonus: 0 } }), reloaded);
});

test('renamed portraits and old duplicate party IDs migrate to distinct combat identities', () => {
  const editedHero = createDefaultCharacter('selene');
  editedHero.id = 'char_traveler';
  const initial = migrateCampaign({ character: null, messages: [] }, editedHero);
  assert.equal(new Set(initial.party.map(member => member.id)).size, initial.party.length);
  const duplicate = migrateCampaign(null);
  duplicate.party[1].id = duplicate.party[0].id;
  const reloaded = migrateCampaign(JSON.parse(JSON.stringify(duplicate)));
  assert.equal(new Set(reloaded.party.map(member => member.id)).size, reloaded.party.length);
});

function gatedCampaign() {
  const script = addChapter(createEmptyScript('逃出密室'), '走廊');
  const nextId = Object.keys(script.chapters).find(id => id !== script.startChapter)!;
  script.chapters[nextId].content = '你踏入昏暗走廊，前方有两个岔口。';
  const check = { attribute: 'str' as const, dc: 12, successChapter: nextId, failureChapter: nextId, dangerDamage: 4, rewardItem: '门房铜钥匙', outcomeText: {
    crit_success: '你及时抬起闸门，石锁也完整落到手边。',
    success: '你扳开闸门，钻过石框。',
    failure: '闸门卡住了，你换到另一侧推开石框。',
    crit_failure: '闸门压伤你的手，你借裂隙拖身而出。',
  } };
  const alternate = { text: '【敏捷 DC 12】用巧手撬锁', nextChapter: nextId };
  Object.assign(script.chapters[script.startChapter], {
    dcCheck: check, clues: ['门边刻着守卫轮值记号'], choices: [alternate, { text: '直接离开', nextChapter: nextId }],
  });
  return { state: startScript(migrateCampaign(null), script), script, nextId, check, alternate };
}

test('exploration outcomes are determined by the total-to-DC margin, without natural-roll overrides', () => {
  for (const [total, expected] of [[5, 'crit_failure'], [6, 'failure'], [9, 'failure'], [10, 'success'], [14, 'success'], [15, 'crit_success']] as const) {
    assert.equal(getExplorationOutcome(total, 10), expected);
  }
  assert.equal(getExplorationOutcome(20, 26), 'crit_failure');
  assert.equal(getExplorationOutcome(1 + 12, 10), 'success');
});

test('an authored bracket check takes its attribute, skill, and DC from the label before prose', () => {
  const hero = createDefaultCharacter('shadow_rogue');
  const check = getActionCheck('[巧手 DC 13]用撬棍暴力砸开控制台，旁边还有力量 DC 20 的路线。', hero);
  assert.equal(check?.attribute, 'dex');
  assert.equal(check?.skill, '巧手');
  assert.equal(check?.dc, 13);
  assert.equal(check?.bonus, 7);
});

test('optional authored discoveries reveal only their current clues and cannot award the same loot twice', () => {
  const script = createEmptyScript('调查桌案');
  const action = { id: 'ledger', title: '翻查登记册', description: '检查案头留下的登记册。', attribute: 'int' as const, dc: 10,
    discoveredClue: '登记册列出今晚的来访人', discoveredSecret: 'ledger-key', lootItem: '旧铜牌' };
  script.chapters[script.startChapter].explorationActions = [action];
  script.chapters[script.startChapter].clues = ['作者藏在当前场景的其他信息'];
  const state = startScript(migrateCampaign(null), script);
  const check = getActionCheck(action.title, state.party[0], action)!;
  const pending = { text: action.title, source: { kind: 'exploration' as const, actionId: action.id }, check };
  const result = confirmExplorationCheck(recordExplorationRoll(beginExplorationCheck(state, pending), { roll: 19, total: 19 + check.bonus }));
  assert.deepEqual(result.outcome?.clues, [action.discoveredClue, action.discoveredSecret]);
  assert.deepEqual(result.outcome?.items, [action.lootItem]);
  assert.equal(beginExplorationCheck(result.state, pending), result.state);
  assert.equal(beginExplorationCheck(state, { ...pending, source: { kind: 'exploration', actionId: 'future-action' } }), state);
  const generic = confirmExplorationCheck(recordExplorationRoll(beginExplorationCheck(state, { text: '留意动静', check }), { roll: 19, total: 19 + check.bonus }));
  assert.deepEqual(generic.outcome?.clues, []);
  assert.deepEqual(generic.outcome?.items, []);
});

test('required chapters block arbitrary jumps, free checks, and director effects until an authored check is confirmed', () => {
  const { state, check, nextId, alternate } = gatedCampaign();
  assert.equal(getRequiredChapterCheck(state), check);
  assert.deepEqual(getRequiredChapterChoices(state), [alternate]);
  const reward = { id: 'pre-check', kind: 'reward' as const, title: '钱袋', gold: 8, items: [] };
  assert.equal(advanceChapter(state, nextId), state);
  assert.equal(applyAdventureEvent(state, reward), state);
  const proposed = applyDirectorResult(state, '跳过门锁', { narration: '门仍锁着。', choices: [{ text: '走进去', nextChapter: nextId }], event: reward, sources: [] });
  assert.deepEqual(proposed.directorChoices, []);
  assert.equal(proposed.party[0].gold, state.party[0].gold);
  const computed = getActionCheck('掰开闸门', state.party[0], check)!;
  assert.equal(beginExplorationCheck(state, { text: '跳过门锁', check: computed }), state);
  assert.equal(beginExplorationCheck(state, { text: '跳过门锁', source: { kind: 'chapter' }, check: { ...computed, dc: 5 } }), state);
  const pending = beginExplorationCheck(state, { text: alternate.text, choice: alternate, source: { kind: 'chapter' }, check: getActionCheck(alternate.text, state.party[0])! });
  assert.equal(pending.pendingCheck?.check.attribute, 'dex');
  assert.equal(confirmExplorationCheck(pending).state, pending);
});

test('confirmed four-tier checks apply distinct consequences and fail forward with authored narration', () => {
  for (const [roll, tier, minutes, damage] of [[17, 'crit_success', 0, 0], [12, 'success', 5, 0], [11, 'failure', 10, 2], [7, 'crit_failure', 20, 4]] as const) {
    const { state, nextId, check, script } = gatedCampaign();
    const computed = getActionCheck('掰开闸门', state.party[0], check)!;
    const pending = beginExplorationCheck(state, { text: '掰开闸门', source: { kind: 'chapter' }, check: computed });
    const rolled = recordExplorationRoll(pending, { roll, total: roll + computed.bonus });
    const saved = migrateCampaign(importCampaignSave(exportCampaignSave(rolled)));
    assert.equal(advanceChapter(saved, nextId), saved);
    assert.equal(previewExplorationOutcome(saved)?.tier, tier);
    assert.equal(saved.party[0].hp.current, state.party[0].hp.current);
    const result = confirmExplorationCheck(saved);
    assert.equal(result.outcome?.tier, tier);
    assert.ok(result.outcome?.summary.includes(check.outcomeText[tier]));
    assert.equal(result.outcome?.minutes, minutes);
    assert.equal(result.outcome?.damage, damage);
    assert.equal(result.state.party[0].hp.current, state.party[0].hp.current - damage);
    assert.equal(result.state.elapsedMinutes, state.elapsedMinutes + minutes);
    assert.equal(result.state.currentChapter, nextId);
    assert.equal(result.state.messages.at(-1)?.content, script.chapters[nextId].content);
    assert.equal(result.state.messages.find(message => message.role === 'dice')?.diceResult?.explorationOutcome, tier);
    assert.equal(result.state.journal?.at(-1)?.summary, result.outcome?.summary);
    assert.equal(result.state.pendingCheck, null);
    assert.equal(result.state.party[0].inventory.includes('门房铜钥匙'), tier === 'crit_success' || tier === 'success');
    assert.equal(result.state.memory?.discoveredSecrets.includes('门边刻着守卫轮值记号'), tier === 'crit_success');
    assert.equal(confirmExplorationCheck(result.state).state, result.state);
    const revisited = advanceChapter(result.state, script.startChapter);
    assert.equal(getRequiredChapterCheck(revisited), null);
    assert.equal(beginExplorationCheck(revisited, { text: '再次掰开闸门', source: { kind: 'chapter' }, check: computed }), revisited);
  }
});

test('an old misclassified bracket roll retains the attribute and die result already saved', () => {
  const { state, script, nextId } = gatedCampaign();
  const choice = { text: '[巧手 DC 13]用撬棍砸开盖板', nextChapter: nextId };
  script.chapters[script.startChapter].choices = [choice];
  const oldRoll = { roll: 14, total: 14 };
  const migrated = migrateCampaign({ ...state, pendingCheck: { text: choice.text, choice, check: {
    attribute: 'str', label: '力量', dc: 13, bonus: 0,
  }, result: oldRoll } });
  assert.deepEqual(migrated.pendingCheck?.result, oldRoll);
  assert.equal(migrated.pendingCheck?.check.attribute, 'str');
  assert.equal(confirmExplorationCheck(migrated).state.currentChapter, nextId);
});

test('explicit mandatory failure uses its authored target and old saved rolls resume the same check', () => {
  const { state, script, nextId, check } = gatedCampaign();
  const revised = addChapter(script, '绕路');
  const failureId = Object.keys(revised.chapters).find(id => id !== script.startChapter && id !== nextId)!;
  const required = { ...check, required: true, failureChapter: failureId };
  revised.chapters[script.startChapter].dcCheck = required;
  const migrated = migrateCampaign({ ...state, currentScript: revised, pendingCheck: {
    text: '尝试力量检定', choice: { text: '', nextChapter: nextId, check: required }, check: getActionCheck('', state.party[0], required)!, result: { roll: 10, total: 10 },
  } });
  assert.equal(migrated.pendingCheck?.source?.kind, 'chapter');
  assert.equal(confirmExplorationCheck(migrated).state.currentChapter, failureId);
  revised.chapters[script.startChapter].dcCheck = { ...required, failureChapter: 'unknown' };
  assert.equal(getRequiredChapterCheck({ ...state, currentScript: revised }), null);
});
