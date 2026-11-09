import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceChapter, beginExplorationCheck, migrateCampaign, recordExplorationRoll, refreshScript, startScript } from '../lib/campaign';
import { createBattle } from '../lib/combat/engine';
import { defaultAppearance } from '../lib/appearance';
import { createInitialState } from '../lib/gameState';
import { exportCampaignSave, importCampaignSave } from '../lib/saveFile';
import { addChapter, createEmptyScript, createPresetScript, deleteChapter } from '../lib/scripts';

test('portable JSON restores a custom script, spent resources and a pending battle reaction', () => {
  const state = startScript(migrateCampaign(null), createEmptyScript('雾中遗迹'));
  state.party[0].avatarUrl = 'https://example.com/idle.webp';
  state.party[0].portraitPoses = { talk: 'https://example.com/talk.webp', action: 'https://example.com/action.webp' };
  state.party[0].appearance = { ...defaultAppearance('矮人', 'female'), outfit: 'cloak', frameColor: 'wine' };
  state.party[0].voiceId = 'selene';
  const battle = createBattle(state.party, { id: 'encounter', title: '狼群', enemyKind: 'wolf', count: 1 }, () => 0.5);
  const [hero] = battle.combatants;
  const enemy = battle.combatants.find(unit => unit.side === 'enemy')!;
  hero.resources.action = 0;
  hero.hp.current -= 2;
  battle.pendingReaction = {
    id: 'opportunity', kind: 'opportunity', actorId: hero.id, sourceId: enemy.id,
    resumeAction: { id: 'enemy-move', type: 'move', actorId: enemy.id, point: { x: 8, y: 1 } },
    continuation: { kind: 'move', path: [{ x: 9, y: 1 }, { x: 8, y: 1 }], cost: 10, reactedIds: [] },
  };
  state.battle = battle;

  const restored = migrateCampaign(importCampaignSave(exportCampaignSave(state)));
  assert.deepEqual(restored.party[0].portraitPoses, state.party[0].portraitPoses);
  assert.deepEqual(restored.party[0].appearance, state.party[0].appearance);
  assert.equal(restored.party[0].voiceId, state.party[0].voiceId);
  assert.deepEqual(restored.currentScript, state.currentScript);
  assert.deepEqual(restored.messages, JSON.parse(JSON.stringify(state.messages)));
  assert.deepEqual(restored.battle, JSON.parse(JSON.stringify(battle)));
});

test('portable JSON keeps a committed exploration roll and migrates legacy campaign data', () => {
  const legacy = { ...createInitialState(), gameTime: { day: 4, timeOfDay: 'night' as const } };
  const migrated = migrateCampaign(importCampaignSave(exportCampaignSave(legacy)));
  assert.deepEqual(migrated.gameTime, legacy.gameTime);
  assert.equal(migrated.party.length, 4);
  assert.equal(migrated.migrationNotes.length, 1);

  const checking = beginExplorationCheck(migrated, { text: '破解密码', check: { attribute: 'int', label: '智力', dc: 14, bonus: 3 } });
  const rolled = recordExplorationRoll(checking, { roll: 12, total: 15 });
  assert.deepEqual(migrateCampaign(importCampaignSave(exportCampaignSave(rolled))).pendingCheck, rolled.pendingCheck);
});

test('all built-in scripts round-trip through portable saves', () => {
  for (const preset of ['baldurs_gate', 'dungeon', 'mystery', 'eldritch', 'cyberpunk', 'tavern'] as const) {
    const state = startScript(migrateCampaign(null), createPresetScript(preset));
    const snapshot = importCampaignSave(exportCampaignSave(state));
    assert.deepEqual(snapshot.currentScript, JSON.parse(JSON.stringify(state.currentScript)));
  }
});

test('a portable save keeps its embedded chapter even when the local workshop removed it', () => {
  const script = addChapter(createEmptyScript('旧钟楼'), '塔顶');
  const towerId = Object.values(script.chapters).find(chapter => chapter.title === '塔顶')!.id;
  const state = advanceChapter(startScript(migrateCampaign(null), script), towerId);
  const restored = migrateCampaign(importCampaignSave(exportCampaignSave(state)));
  const edited = deleteChapter(script, towerId);
  assert.equal(refreshScript(restored, [edited]), restored);
  assert.equal(restored.currentChapter, towerId);
  const restarted = startScript(restored, edited);
  assert.equal(refreshScript(restarted, [{ ...edited, title: '新钟楼' }]).currentScript?.title, '新钟楼');
});

test('invalid, unrelated and malformed nested save data is rejected', () => {
  const state = startScript(migrateCampaign(null), createEmptyScript('损坏存档测试'));
  state.battle = createBattle(state.party, { id: 'encounter', title: '狼群', enemyKind: 'wolf', count: 1 });
  const text = exportCampaignSave(state);
  for (const damage of [
    (save: ReturnType<typeof JSON.parse>) => { save.version = 999; },
    (save: ReturnType<typeof JSON.parse>) => { save.state.messages = [null]; },
    (save: ReturnType<typeof JSON.parse>) => { save.state.battle.combatants[0].resources.spellSlots = null; },
    (save: ReturnType<typeof JSON.parse>) => { save.state.battle.width = 1000000; },
    (save: ReturnType<typeof JSON.parse>) => { save.state.battle.combatants[0].position.x = save.state.battle.width; },
    (save: ReturnType<typeof JSON.parse>) => { save.state.battle.pendingReaction = { actorId: 'unknown' }; },
    (save: ReturnType<typeof JSON.parse>) => { delete save.state.campaignVersion; },
  ]) {
    const save = JSON.parse(text);
    damage(save);
    assert.throws(() => importCampaignSave(JSON.stringify(save)), /存档/);
  }
  assert.throws(() => importCampaignSave('not JSON'), /JSON/);
  assert.throws(() => importCampaignSave('{}'), /存档/);
});
