import { ATTRIBUTE_LABELS, TIME_LABELS, type TavernState } from './types';
import { EXPLORATION_OUTCOME_LABELS } from './checks';
import { isBackgroundProfile, isSceneType } from './worldLore';
import { isChapterEncounter } from './combat/catalog';
import { isChapterReward } from './scripts';
import { isAppearance } from './appearance';
import { voiceIdPattern } from './voiceAssets';

const FORMAT = 'ai-tavern-save';
const VERSION = 1;
const attributes = Object.keys(ATTRIBUTE_LABELS);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function strings(...values: unknown[]) {
  return values.every(value => typeof value === 'string');
}

function numbers(...values: unknown[]) {
  return values.every(Number.isFinite);
}

function boundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function list(value: unknown, accepts: (entry: unknown) => boolean) {
  return Array.isArray(value) && value.every(entry => accepts(entry));
}

function optional(value: unknown, accepts: (entry: unknown) => boolean) {
  return value === undefined || accepts(value);
}

function attribute(value: unknown) {
  return typeof value === 'string' && attributes.includes(value);
}

function outcomeText(value: unknown) {
  return record(value) && Object.entries(value).every(([tier, text]) =>
    Object.hasOwn(EXPLORATION_OUTCOME_LABELS, tier) && typeof text === 'string' && text.length <= 500,
  );
}

function choice(value: unknown) {
  return record(value) && strings(value.text, value.nextChapter)
    && optional(value.check, check => record(check) && attribute(check.attribute) && numbers(check.dc)
      && optional(check.skill, strings) && optional(check.successChapter, strings) && optional(check.failureChapter, strings));
}

function script(value: unknown) {
  return record(value) && strings(value.id, value.title, value.description, value.genre)
    && typeof value.startChapter === 'string' && record(value.chapters) && Object.hasOwn(value.chapters, value.startChapter)
    && Object.values(value.chapters).every(chapter => record(chapter) && strings(chapter.id, chapter.title, chapter.content)
      && list(chapter.choices, choice)
      && optional(chapter.sceneType, isSceneType)
      && optional(chapter.ending, ending => typeof ending === 'boolean')
      && optional(chapter.encounter, isChapterEncounter)
      && optional(chapter.reward, isChapterReward)
      && optional(chapter.dcCheck, check => record(check) && attribute(check.attribute) && numbers(check.dc)
        && strings(check.successChapter, check.failureChapter) && optional(check.skill, strings)
        && optional(check.required, required => typeof required === 'boolean') && optional(check.outcomeText, outcomeText))
      && optional(chapter.explorationActions, actions => list(actions, action => record(action)
        && strings(action.id, action.title, action.description) && attribute(action.attribute) && numbers(action.dc)
        && optional(action.skill, strings) && optional(action.outcomeText, outcomeText))))
    && optional(value.worldSetting, strings)
    && optional(value.backgroundProfile, isBackgroundProfile)
    && optional(value.knowledge, entries => list(entries, entry => record(entry) && strings(entry.id, entry.title, entry.content)
      && optional(entry.chapterIds, ids => list(ids, strings)) && optional(entry.requiresSecret, strings)))
    && optional(value.allowedEnemies, enemies => list(enemies, strings));
}

function character(value: unknown) {
  if (!record(value) || !record(value.attributes) || !record(value.hp)) return false;
  const scores = value.attributes;
  return strings(value.id, value.name, value.race, value.class, value.backstory, value.notes)
    && optional(value.speciesTraits, enabled => typeof enabled === 'boolean')
    && boundedInteger(value.level, 1, 20) && numbers(value.ac, value.hp.current, value.hp.max)
    && attributes.every(key => numbers(scores[key])) && list(value.inventory, strings)
    && list(value.skills, skill => record(skill) && strings(skill.name) && attribute(skill.attribute) && numbers(skill.bonus))
    && optional(value.portraitId, strings) && optional(value.avatarUrl, strings)
    && optional(value.appearance, isAppearance)
    && optional(value.voiceId, id => typeof id === 'string' && voiceIdPattern.test(id))
    && optional(value.portraitPoses, poses => record(poses) && optional(poses.talk, strings) && optional(poses.action, strings))
    && optional(value.buffs, buffs => list(buffs, strings));
}

function point(value: unknown): value is { x: number; y: number } {
  return record(value) && boundedInteger(value.x, 0, 39) && boundedInteger(value.y, 0, 39);
}

function combatant(value: unknown) {
  if (!record(value) || !character(value) || !record(value.resources) || !record(value.weapon) || !record(value.deathSaves)) return false;
  const { resources, weapon, deathSaves } = value;
  return (value.side === 'party' || value.side === 'enemy') && point(value.position)
    && numbers(value.speed, value.proficiencyBonus, value.experience, value.temporaryHp)
    && list(value.conditions, condition => record(condition) && strings(condition.name))
    && list(value.savingThrowProficiencies, attribute)
    && optional(value.concentration, entry => record(entry) && strings(entry.spellId)
      && numbers(entry.remainingRounds) && list(entry.targetIds, strings))
    && numbers(deathSaves.successes, deathSaves.failures) && typeof deathSaves.stable === 'boolean'
    && strings(weapon.name, weapon.damageType) && attribute(weapon.attribute)
    && boundedInteger(weapon.dice, 0, 20) && boundedInteger(weapon.sides, 1, 100) && numbers(weapon.range) && typeof weapon.melee === 'boolean'
    && numbers(resources.action, resources.bonusAction, resources.movement, resources.layOnHands)
    && boundedInteger(resources.hitDice, 0, 20) && boundedInteger(resources.maxHitDice, 0, 20)
    && typeof resources.reaction === 'boolean'
    && [resources.spellSlots, resources.maxSpellSlots].every(slots => record(slots) && Object.values(slots).every(Number.isFinite));
}

function action(value: unknown) {
  return record(value) && strings(value.id, value.type, value.actorId) && optional(value.point, point);
}

function reaction(value: unknown, ids: Set<unknown>) {
  if (!record(value) || !strings(value.id) || !ids.has(value.actorId) || !ids.has(value.sourceId)
    || !['opportunity', 'shield', 'uncanny-dodge'].some(kind => kind === value.kind) || !action(value.resumeAction)) return false;
  return optional(value.alternativeKinds, kinds => list(kinds, kind => kind === 'shield' || kind === 'uncanny-dodge'))
    && optional(value.continuation, entry => record(entry) && (
      entry.kind === 'hit' && numbers(entry.naturalRoll, entry.attackTotal, entry.damage) && strings(entry.damageType)
      || entry.kind === 'move' && numbers(entry.cost) && list(entry.path, point) && list(entry.reactedIds, strings)
    )) && optional(value.afterMove, entry => record(entry) && action(entry.action)
      && list(entry.path, point) && list(entry.reactedIds, strings));
}

function battle(value: unknown, party: unknown[]) {
  if (!record(value)) return false;
  const { combatants, initiative, width, height } = value;
  if (!boundedInteger(width, 1, 40) || !boundedInteger(height, 1, 40)) return false;
  const inBounds = (cell: unknown) => point(cell) && cell.x < width && cell.y < height;
  if (!Array.isArray(combatants) || combatants.length > 12 || !Array.isArray(initiative)
    || !combatants.every(unit => combatant(unit) && inBounds(unit.position))) return false;
  const ids = new Set(combatants.map(unit => unit.id));
  return strings(value.id, value.title) && ['active', 'victory', 'defeat', 'escaped'].some(phase => phase === value.phase)
    && optional(value.chapterEncounterId, strings)
    && boundedInteger(value.turnIndex, 0, initiative.length - 1)
    && numbers(value.round) && ids.size === combatants.length && ids.size === initiative.length
    && new Set(initiative).size === ids.size && initiative.every(id => ids.has(id))
    && party.every(member => record(member) && combatants.some(unit => unit.id === member.id && unit.side === 'party'))
    && list(value.terrain, cell => record(cell) && inBounds(cell) && strings(cell.type))
    && list(value.log, entry => record(entry) && strings(entry.id, entry.text, entry.kind) && numbers(entry.round))
    && list(value.processedActionIds, strings)
    && record(value.reward) && numbers(value.reward.gold, value.reward.experience) && list(value.reward.items, strings)
    && (value.pendingReaction === null || reaction(value.pendingReaction, ids));
}

function pendingCheck(value: unknown) {
  if (!record(value) || !record(value.check)) return false;
  const { check } = value;
  return strings(value.text, check.label) && attribute(check.attribute) && numbers(check.dc, check.bonus) && optional(check.skill, strings)
    && optional(value.choice, choice)
    && optional(value.chapterId, strings)
    && optional(value.source, source => record(source) && (source.kind === 'chapter' || source.kind === 'exploration' && strings(source.actionId)))
    && optional(value.result, result => record(result) && typeof result.roll === 'number' && typeof check.bonus === 'number'
      && Number.isInteger(result.roll) && result.roll >= 1 && result.roll <= 20 && result.total === result.roll + check.bonus);
}

function validState(value: unknown): value is TavernState {
  if (!record(value) || !record(value.gameTime)) return false;
  if (typeof value.gameTime.day !== 'number' || !Number.isInteger(value.gameTime.day) || value.gameTime.day < 1
    || typeof value.gameTime.timeOfDay !== 'string' || !Object.hasOwn(TIME_LABELS, value.gameTime.timeOfDay)
    || typeof value.isOpen !== 'boolean' || !(value.currentScript === null || script(value.currentScript))
    || !(value.currentChapter === null || typeof value.currentChapter === 'string' && record(value.currentScript)
      && record(value.currentScript.chapters) && Object.hasOwn(value.currentScript.chapters, value.currentChapter))
    || !(value.character === null || character(value.character))
    || !list(value.messages, message => record(message) && strings(message.id, message.sender, message.content)
      && ['system', 'narrator', 'player', 'dice'].some(role => role === message.role) && numbers(message.timestamp)
      && optional(message.characterId, strings) && optional(message.speakerTitle, strings) && optional(message.expression, strings)
      && optional(message.diceResult, result => record(result) && numbers(result.total, result.modifier) && list(result.rolls, numbers)
        && optional(result.explorationOutcome, tier => typeof tier === 'string' && Object.hasOwn(EXPLORATION_OUTCOME_LABELS, tier))))
    || !optional(value.memory, memory => record(memory) && strings(memory.storySummary)
      && record(memory.companionAffinity) && Object.values(memory.companionAffinity).every(Number.isFinite))) return false;
  if (value.campaignVersion === undefined || value.campaignVersion === 1) {
    return !['party', 'battle', 'pendingCheck', 'directorChoices'].some(key => Object.hasOwn(value, key));
  }
  return value.campaignVersion === 2 && Array.isArray(value.party) && value.party.length >= 1 && value.party.length <= 4
    && value.party.every(member => combatant(member) && member.side === 'party')
    && new Set(value.party.map(member => member.id)).size === value.party.length
    && (value.battle === null || battle(value.battle, value.party))
    && list(value.directorChoices, choice) && (value.pendingCheck === null || pendingCheck(value.pendingCheck));
}

export function exportCampaignSave(state: TavernState): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, state });
}

export function importCampaignSave(text: string): TavernState & { useScriptSnapshot: true } {
  let file: unknown;
  try {
    file = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('无法读取 JSON，请选择有效的存档文件。');
  }
  if (!record(file) || file.format !== FORMAT) throw new Error('这不是 AI 酒馆的 JSON 存档。');
  if (file.version !== VERSION) throw new Error('此存档版本暂不支持。');
  if (!validState(file.state)) throw new Error('存档内容不完整或已损坏。');
  return { ...file.state, useScriptSnapshot: true };
}
