import { v4 as uuid } from 'uuid';
import type { Character, ChapterReward, Script, ScriptChapter, StoryMemory, TavernState, ChatMessage, ScriptChoice, AttributeKey, OutcomeTier, TieredDCCheck, ExplorationAction } from './types';
import { createDefaultCharacter, getModifier } from './types';
import { getSpeciesTraits } from './speciesTraits';
import { createDiceMessage, createInitialState, createNarratorMessage, createPlayerMessage, createSystemMessage } from './gameState';
import type { AdventureEvent, DirectorResult } from './adventure';
import type { BattleState, Combatant } from './combat/types';
import { createPartyMember, createBattle } from './combat/engine';
import { classKey, classResourceLimits, combatHitDie, isChapterEncounter, isEnemyKind, LEVEL_EXPERIENCE } from './combat/catalog';
import { EXPLORATION_OUTCOME_LABELS, getActionCheck, getExplorationOutcome } from './checks';
import { isEndingChapter } from './worldLore';
import { isChapterReward } from './scripts';

export interface CampaignState extends TavernState {
  campaignVersion: 2;
  useScriptSnapshot?: boolean;
  party: Combatant[];
  battle: BattleState | null;
  visitedChapterIds: string[];
  appliedEventIds: string[];
  turnNumber: number;
  sceneStartedOnTurn: number;
  elapsedMinutes: number;
  migrationNotes: string[];
  directorChoices: ScriptChoice[];
  pendingCheck: ExplorationCheck | null;
}

export interface ExplorationCheck {
  text: string; choice?: ScriptChoice;
  source?: { kind: 'chapter' } | { kind: 'exploration'; actionId: string };
  chapterId?: string;
  check: { attribute: AttributeKey; label: string; skill?: string; dc: number; bonus: number };
  result?: { roll: number; total: number };
}

export interface ExplorationOutcome {
  tier: OutcomeTier;
  roll: number;
  total: number;
  dc: number;
  margin: number;
  summary: string;
  minutes: number;
  damage: number;
  chapterId?: string;
  clues: string[];
  items: string[];
  milestone?: string;
}

export function createWorldMemory(script?: Script): StoryMemory {
  return {
    milestones: [], companionAffinity: {}, discoveredSecrets: [], activeBuffsDebuffs: [],
    questLog: [], storySummary: script ? `《${script.title}》的冒险刚刚开始。` : '新的冒险尚未开始。',
  };
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const stringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/** Preserve an existing character, filling only fields absent from early saves. */
function migrateMember(value: unknown): Combatant {
  const raw = isObject(value) ? value : {};
  const fallback = createDefaultCharacter(typeof raw.portraitId === 'string' ? raw.portraitId : 'traveler');
  const character = {
    ...fallback, ...raw,
    attributes: { ...fallback.attributes, ...(isObject(raw.attributes) ? raw.attributes : {}) },
    hp: { ...fallback.hp, ...(isObject(raw.hp) ? raw.hp : {}) },
    inventory: Array.isArray(raw.inventory) ? stringArray(raw.inventory) : fallback.inventory,
    skills: Array.isArray(raw.skills) ? raw.skills : fallback.skills,
  } as Character;
  const member = createPartyMember(character);
  if (isObject(raw.resources) && Array.isArray(raw.conditions) && isObject(raw.deathSaves)) {
    return {
      ...member, ...raw, attributes: member.attributes, hp: member.hp,
      resources: { ...member.resources, ...raw.resources },
    } as Combatant;
  }
  return member;
}

export function migrateCampaign(value: unknown, externalCharacter?: Character | null): CampaignState {
  const raw = isObject(value) ? value : {};
  const initial = createInitialState();
  const hasParty = Array.isArray(raw.party) && raw.party.length > 0;
  let party = hasParty ? (raw.party as unknown[]).slice(0, 4).map(migrateMember) : [];
  if (!party.length) {
    const primary = externalCharacter || (isObject(raw.character) ? raw.character : createDefaultCharacter());
    party = [migrateMember(primary)];
    for (const id of ['traveler', 'selene', 'shadow_rogue', 'paladin_arthur']) {
      const preset = createDefaultCharacter(id);
      if (party.length < 4 && !party.some(p => p.portraitId === id || p.id === preset.id)) party.push(createPartyMember(preset));
    }
  }
  const previousParty = party;
  const assignedIds = new Set<string>();
  party = party.map((member, index) => {
    let id = member.id || `party-member-${index}`;
    while (assignedIds.has(id)) id = `${id}:member-${index}`;
    assignedIds.add(id);
    return id === member.id ? member : { ...member, id };
  });
  const battle = isObject(raw.battle) && Array.isArray(raw.battle.combatants) && Array.isArray(raw.battle.initiative)
    ? structuredClone(raw.battle) as unknown as BattleState : null;
  if (battle && previousParty.some((member, index) => member.id !== party[index].id)) {
    const paired = new Set<number>();
    const renamed = new Map<string, string[]>();
    battle.combatants = battle.combatants.map(unit => {
      const index = unit.side === 'party' ? previousParty.findIndex((member, i) => !paired.has(i) && member.id === unit.id && member.portraitId === unit.portraitId) : -1;
      if (index < 0) return unit;
      paired.add(index);
      renamed.set(unit.id, [...(renamed.get(unit.id) || []), party[index].id]);
      return { ...unit, id: party[index].id };
    });
    const occurrences = new Map<string, number>();
    battle.initiative = battle.initiative.map(id => {
      const occurrence = occurrences.get(id) || 0;
      occurrences.set(id, occurrence + 1);
      return renamed.get(id)?.[occurrence] || id;
    });
  }
  const script = isObject(raw.currentScript) && isObject(raw.currentScript.chapters) ? raw.currentScript as unknown as Script : null;
  const chapter = typeof raw.currentChapter === 'string' && script?.chapters[raw.currentChapter]
    ? raw.currentChapter : script?.startChapter ?? null;
  const defaultMemory = createWorldMemory(script ?? undefined);
  const memory = isObject(raw.memory) ? { ...defaultMemory, ...raw.memory } as StoryMemory : defaultMemory;
  for (const key of ['milestones', 'discoveredSecrets', 'activeBuffsDebuffs', 'questLog'] as const) memory[key] = stringArray(memory[key]);
  const notes = stringArray(raw.migrationNotes);
  if (raw.campaignVersion !== 2 && value) notes.push('旧存档已升级：保留故事、角色与血量，补充队伍和回合资源。旧版示例招式按当前等级映射到已支持能力。');
  const turnNumber = typeof raw.turnNumber === 'number' && Number.isInteger(raw.turnNumber) && raw.turnNumber >= 0 ? raw.turnNumber : 0;
  const state: CampaignState = {
    ...initial, ...raw,
    campaignVersion: 2, party, character: party[0], currentScript: script, currentChapter: chapter,
    messages: Array.isArray(raw.messages) ? raw.messages as ChatMessage[] : [],
    gameTime: isObject(raw.gameTime) ? raw.gameTime as unknown as TavernState['gameTime'] : initial.gameTime,
    memory,
    battle,
    visitedChapterIds: [...new Set([...stringArray(raw.visitedChapterIds), ...(chapter ? [chapter] : [])])],
    appliedEventIds: stringArray(raw.appliedEventIds),
    turnNumber,
    sceneStartedOnTurn: typeof raw.sceneStartedOnTurn === 'number' && Number.isInteger(raw.sceneStartedOnTurn)
      && raw.sceneStartedOnTurn >= 0 && raw.sceneStartedOnTurn <= turnNumber ? raw.sceneStartedOnTurn : turnNumber,
    elapsedMinutes: typeof raw.elapsedMinutes === 'number' && Number.isFinite(raw.elapsedMinutes) ? raw.elapsedMinutes : 0,
    migrationNotes: notes,
    directorChoices: Array.isArray(raw.directorChoices) ? raw.directorChoices as ScriptChoice[] : [],
    pendingCheck: isObject(raw.pendingCheck) && typeof raw.pendingCheck.text === 'string' && isObject(raw.pendingCheck.check)
      && ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(String(raw.pendingCheck.check.attribute))
      && typeof raw.pendingCheck.check.bonus === 'number' && Number.isFinite(raw.pendingCheck.check.bonus)
      && typeof raw.pendingCheck.check.dc === 'number' && Number.isFinite(raw.pendingCheck.check.dc)
      ? structuredClone(raw.pendingCheck) as unknown as ExplorationCheck : null,
  };
  if (state.pendingCheck) {
    const pending = state.pendingCheck;
    const source = pending.source ?? inferLegacyCheckSource(state, pending);
    if (source) pending.source = source;
    if (!getExplorationPlan(state, pending) || (pending.result && !isValidRoll(pending, pending.result))) state.pendingCheck = null;
  }
  return state;
}

export function getCampaignParty(state: CampaignState): Combatant[] {
  const { battle, party } = state;
  if (!battle) return party;
  return party.map(member => battle.combatants.find(unit => unit.id === member.id && unit.side === 'party') || member);
}

export function startScript(state: CampaignState, script: Script): CampaignState {
  const chapter = script.chapters[script.startChapter];
  if (!chapter) return state;
  const party = state.battle ? getCampaignParty(state).map(member => structuredClone(member)) : state.party;
  return arriveAtChapter({
    ...state, party, character: party[0], currentScript: script, currentChapter: script.startChapter, useScriptSnapshot: false,
    battle: null, visitedChapterIds: [script.startChapter], appliedEventIds: [],
    memory: createWorldMemory(script), directorChoices: [], pendingCheck: null, turnNumber: 0, sceneStartedOnTurn: 0,
    messages: [createSystemMessage(`启程：《${script.title}》`)],
  }, chapter);
}

function currentChapter(state: CampaignState) {
  return state.currentChapter ? state.currentScript?.chapters[state.currentChapter] : undefined;
}

function chapterRewardId(state: CampaignState) {
  return `chapter-reward:${JSON.stringify([state.currentScript?.id, state.currentChapter])}`;
}

function chapterRewardText(reward: ChapterReward) {
  return [...(reward.gold > 0 ? [`${reward.gold} 金币`] : []), ...reward.items.map(item => item.trim())].join(' · ');
}

export function getChapterRewardNotice(state: CampaignState) {
  if (!currentChapter(state)) return;
  return state.messages.find(message => message.id === chapterRewardId(state) && message.role === 'system')?.content;
}

function arriveAtChapter(state: CampaignState, chapter: ScriptChapter): CampaignState {
  const reward = chapter.reward;
  const rewardId = chapterRewardId(state);
  const [hero, ...companions] = state.party;
  const messages = [...state.messages];
  let next = state;
  if (hero && isChapterReward(reward) && (reward.gold > 0 || reward.items.length) && !state.appliedEventIds.includes(rewardId)) {
    const character = { ...hero, gold: (hero.gold ?? 50) + reward.gold, inventory: [...hero.inventory, ...reward.items.map(item => item.trim())] };
    next = { ...state, character, party: [character, ...companions], appliedEventIds: [...state.appliedEventIds, rewardId] };
    messages.push({ ...createSystemMessage(`章节奖励到账 · ${chapterRewardText(reward)}`), id: rewardId });
  }
  messages.push(createNarratorMessage(chapter.content, { sender: '地下城主', characterId: 'old_tom', speakerTitle: state.currentScript?.title }));
  return { ...next, messages };
}

function chapterEncounterId(state: CampaignState) {
  return `chapter-encounter:${JSON.stringify([state.currentScript?.id, state.currentChapter])}`;
}

export function getRequiredChapterEncounter(state: CampaignState) {
  const encounter = currentChapter(state)?.encounter;
  if (isChapterEncounter(encounter) && !state.appliedEventIds.includes(chapterEncounterId(state))) return encounter;
}

export function isChapterEncounterBattle(state: CampaignState) {
  return state.battle?.chapterEncounterId === chapterEncounterId(state);
}

export function beginChapterEncounter(state: CampaignState): CampaignState {
  const encounter = getRequiredChapterEncounter(state);
  if (!encounter || state.battle || state.pendingCheck || !state.party.some(member => member.hp.current > 0)) return state;
  const battle = createBattle(state.party, { ...encounter, id: uuid() });
  battle.chapterEncounterId = chapterEncounterId(state);
  return { ...state, battle, directorChoices: [] };
}

function epilogueId(state: CampaignState) {
  return `epilogue:${state.currentScript?.id}:${state.currentChapter}`;
}

export function isEndingPending(state: CampaignState) {
  const chapter = currentChapter(state);
  return Boolean(chapter && state.currentScript && isEndingChapter(state.currentScript, chapter) && !getRequiredChapterCheck(state) && !getRequiredChapterEncounter(state)
    && !state.appliedEventIds.includes(epilogueId(state)));
}

export function startEpilogue(state: CampaignState, choice: ScriptChoice) {
  if (state.battle || state.pendingCheck || !isEndingPending(state) || choice.nextChapter !== 'AI_DYNAMIC'
    || !currentChapter(state)?.choices.some(authored => sameChoice(authored, choice))) return state;
  return { ...state, appliedEventIds: [...state.appliedEventIds, epilogueId(state)] };
}

function validChapter(state: CampaignState, id: unknown): id is string {
  return typeof id === 'string' && !!state.currentScript && Object.hasOwn(state.currentScript.chapters, id);
}

function explorationId(state: CampaignState, source: NonNullable<ExplorationCheck['source']>) {
  const actionId = source.kind === 'exploration' ? source.actionId : 'main';
  return `exploration:${JSON.stringify([state.currentScript?.id, state.currentChapter, source.kind, actionId])}`;
}

export function isExplorationCheckResolved(state: CampaignState, source: NonNullable<ExplorationCheck['source']>): boolean {
  return state.appliedEventIds.includes(explorationId(state, source));
}

export function getRequiredChapterCheck(state: CampaignState): TieredDCCheck | null {
  const check = currentChapter(state)?.dcCheck;
  if (!check || !validChapter(state, check.successChapter) || !validChapter(state, check.failureChapter)
    || !(check.required ?? check.successChapter === check.failureChapter)
    || !state.party[0] || !getActionCheck('', state.party[0], check)
    || isExplorationCheckResolved(state, { kind: 'chapter' })) return null;
  return check;
}

export function getRequiredChapterChoices(state: CampaignState): ScriptChoice[] {
  const check = getRequiredChapterCheck(state);
  if (!check) return [];
  const destinations = [check.successChapter, check.failureChapter, check.critSuccessChapter, check.critFailureChapter];
  return (currentChapter(state)?.choices ?? []).filter(choice =>
    validChapter(state, choice.nextChapter) && destinations.includes(choice.nextChapter)
    && getActionCheck(choice.text, state.party[0], choice.check) !== null,
  );
}

function sameCheck(a: Pick<ExplorationCheck['check'], 'attribute' | 'skill' | 'dc'>, b: Pick<ExplorationCheck['check'], 'attribute' | 'skill' | 'dc'>) {
  return a.attribute === b.attribute && a.skill === b.skill && a.dc === b.dc;
}

function sameChoice(a: ScriptChoice, b: ScriptChoice | undefined) {
  if (!b || a.text !== b.text || a.nextChapter !== b.nextChapter) return false;
  if (!a.check || !b.check) return a.check === b.check;
  return sameCheck(a.check, b.check) && a.check.successChapter === b.check.successChapter && a.check.failureChapter === b.check.failureChapter;
}

function inferLegacyCheckSource(state: CampaignState, pending: ExplorationCheck): ExplorationCheck['source'] {
  const chapter = currentChapter(state);
  if (!chapter) return undefined;
  const choiceCheck = pending.choice?.check;
  if (chapter.dcCheck && choiceCheck && sameCheck(chapter.dcCheck, choiceCheck)
    && choiceCheck.successChapter === chapter.dcCheck.successChapter && choiceCheck.failureChapter === chapter.dcCheck.failureChapter) return { kind: 'chapter' };
  if (getRequiredChapterChoices(state).some(choice => sameChoice(choice, pending.choice))) return { kind: 'chapter' };
  const action = chapter.explorationActions?.find(action => action.title === pending.text && choiceCheck && sameCheck(action, choiceCheck)
    && action.targetChapterOnDiscover === choiceCheck.successChapter);
  return action ? { kind: 'exploration', actionId: action.id } : undefined;
}

interface ExplorationPlan {
  id?: string;
  chapterCheck?: TieredDCCheck;
  action?: ExplorationAction;
}

function getExplorationPlan(state: CampaignState, pending: ExplorationCheck): ExplorationPlan | null {
  if (state.battle || getRequiredChapterEncounter(state) || (pending.chapterId !== undefined && pending.chapterId !== state.currentChapter)) return null;
  if (getRequiredChapterCheck(state) && pending.source?.kind !== 'chapter') return null;
  if (!pending.source) return {};
  const id = explorationId(state, pending.source);
  if (state.appliedEventIds.includes(id)) return null;
  const chapter = currentChapter(state);
  const hero = state.party[0];
  if (!chapter || !hero) return null;
  let expected: ReturnType<typeof getActionCheck>;
  let plan: ExplorationPlan;
  if (pending.source.kind === 'chapter' && chapter.dcCheck) {
    const alternative = getRequiredChapterChoices(state).find(choice => sameChoice(choice, pending.choice) && choice.text === pending.text);
    expected = alternative ? getActionCheck(alternative.text, hero, alternative.check) : getActionCheck(pending.text, hero, chapter.dcCheck);
    // Old saves used the entire option to infer its attribute. Keep the result of a die already rolled under that rule.
    if (alternative && pending.result && pending.chapterId === undefined && expected && !sameCheck(expected, pending.check)) {
      expected = getActionCheck(alternative.text, hero, alternative.check, false);
    }
    plan = { id, chapterCheck: chapter.dcCheck };
  } else if (pending.source.kind === 'exploration') {
    const actionId = pending.source.actionId;
    const action = chapter.explorationActions?.find(action => action.id === actionId);
    if (!action || action.title !== pending.text) return null;
    expected = getActionCheck(action.title, hero, action);
    plan = { id, action };
  } else return null;
  return expected && sameCheck(expected, pending.check) && expected.bonus === pending.check.bonus ? plan : null;
}

function isValidRoll(pending: ExplorationCheck, result: { roll: number; total: number }) {
  return Number.isInteger(result.roll) && result.roll >= 1 && result.roll <= 20 && result.total === result.roll + pending.check.bonus;
}

export function beginExplorationCheck(state: CampaignState, pending: ExplorationCheck): CampaignState {
  if (state.pendingCheck || !getExplorationPlan(state, pending)) return state;
  const next = structuredClone(pending);
  delete next.result;
  if (state.currentChapter) next.chapterId = state.currentChapter;
  return { ...state, pendingCheck: next };
}

export function recordExplorationRoll(state: CampaignState, result: { roll: number; total: number }): CampaignState {
  const pending = state.pendingCheck;
  if (!pending || pending.result || !isValidRoll(pending, result) || !getExplorationPlan(state, pending)) return state;
  return { ...state, pendingCheck: { ...pending, result: { ...result } } };
}

export function advanceChapter(state: CampaignState, chapterId: string): CampaignState {
  if (state.battle || state.pendingCheck || getRequiredChapterEncounter(state) || getRequiredChapterCheck(state)
    || !validChapter(state, chapterId) || state.currentChapter === chapterId) return state;
  const script = state.currentScript!;
  return arriveAtChapter({
    ...state, currentChapter: chapterId, directorChoices: [], sceneStartedOnTurn: state.turnNumber,
    visitedChapterIds: [...new Set([...state.visitedChapterIds, chapterId])],
  }, script.chapters[chapterId]);
}

const consequences: Record<OutcomeTier, { minutes: number; text: string }> = {
  crit_success: { minutes: 0, text: '行动顺利完成，队伍抢得先机。' },
  success: { minutes: 5, text: '行动达到目的，队伍整理现场后继续。' },
  failure: { minutes: 10, text: '行动未达预期，队伍调整做法并承担延误。' },
  crit_failure: { minutes: 20, text: '行动遭遇严重阻碍，队伍不得不花更多时间稳住局面。' },
};

function newAuthoredText(values: unknown[], existing: string[], max: number) {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && !!value.trim() && value.length <= max))]
    .filter(value => !existing.includes(value));
}

export function previewExplorationOutcome(state: CampaignState): ExplorationOutcome | undefined {
  const pending = state.pendingCheck;
  if (!pending?.result || !isValidRoll(pending, pending.result)) return undefined;
  const plan = getExplorationPlan(state, pending);
  if (!plan) return undefined;
  const { roll, total } = pending.result;
  const { dc, bonus, label, skill, attribute } = pending.check;
  const margin = total - dc;
  const tier = getExplorationOutcome(total, dc);
  const passed = margin >= 0;
  const chapter = currentChapter(state);
  const { chapterCheck, action } = plan;
  const preferredChapter = tier === 'crit_success' ? chapterCheck?.critSuccessChapter : tier === 'crit_failure' ? chapterCheck?.critFailureChapter : undefined;
  const authoredBranch = passed ? chapterCheck?.successChapter : chapterCheck?.failureChapter;
  let target = validChapter(state, preferredChapter) ? preferredChapter : authoredBranch;
  if (!chapterCheck) {
    if (action) target = passed ? action.targetChapterOnDiscover : undefined;
    else target = passed ? pending.choice?.check?.successChapter || pending.choice?.nextChapter : pending.choice?.check?.failureChapter;
  }
  const chapterId = validChapter(state, target) && target !== state.currentChapter ? target : undefined;
  const hero = state.party[0];
  const sceneHazard = Boolean((chapterCheck || action) && ['str', 'dex', 'con'].includes(attribute)
    && /坍塌|爆炸|崩溃|火海|滚烫|坠落|陷阱|坠崖/.test(chapter?.content ?? ''));
  const danger = Number.isFinite(chapterCheck?.dangerDamage) ? Math.max(0, Math.min(6, Math.floor(chapterCheck!.dangerDamage!))) : sceneHazard ? 2 : 0;
  const damage = passed ? 0 : Math.max(0, Math.min((hero?.hp.current ?? 1) - 1, tier === 'crit_failure' ? danger : Math.ceil(danger / 2)));
  const chapterClues = chapterCheck && tier === 'crit_success' && Array.isArray(chapter?.clues) ? chapter.clues.slice(0, 1) : [];
  const clues = passed ? newAuthoredText([action?.discoveredClue, tier === 'crit_success' ? action?.discoveredSecret : undefined, ...chapterClues], state.memory?.discoveredSecrets ?? [], 500) : [];
  const items = passed ? newAuthoredText([chapterCheck?.rewardItem, action?.rewardItem, tier === 'crit_success' ? action?.lootItem : undefined], hero?.inventory ?? [], 120) : [];
  const milestone = passed ? newAuthoredText([chapterCheck?.milestoneOnSuccess], state.memory?.milestones ?? [], 160)[0] : undefined;
  const { minutes, text } = consequences[tier];
  const authoredText = newAuthoredText([chapterCheck?.outcomeText?.[tier], action?.outcomeText?.[tier]], [], 500)[0];
  const details = [authoredText ?? text, minutes ? `耗时 ${minutes} 分钟。` : '', damage ? `${hero?.name ?? '领队'}损失 ${damage} HP。` : '',
    clues.length ? `发现线索：${clues.join('、')}。` : '', items.length ? `获得物品：${items.join('、')}。` : '', milestone ? `达成：${milestone}。` : '',
    chapterId ? '按剧本进入下一章。' : '仍在当前场景。'];
  const summary = `${label}${skill ? `·${skill}` : ''}探索检定：D20 ${roll} ${bonus < 0 ? '−' : '+'} ${Math.abs(bonus)} = ${total}（DC ${dc}，差值 ${margin >= 0 ? '+' : ''}${margin}），${EXPLORATION_OUTCOME_LABELS[tier]}。${details.join('')}`;
  return { tier, roll, total, dc, margin, summary, minutes, damage, chapterId, clues, items, milestone };
}

export function confirmExplorationCheck(state: CampaignState): { state: CampaignState; outcome?: ExplorationOutcome } {
  const pending = state.pendingCheck;
  const outcome = previewExplorationOutcome(state);
  if (!pending || !outcome) return { state };
  const { summary, tier, roll, total, minutes, damage, clues, items, milestone } = outcome;
  const [hero, ...companions] = state.party;
  const party = hero && (damage || items.length) ? [{ ...hero, hp: { ...hero.hp, current: hero.hp.current - damage }, inventory: [...hero.inventory, ...items] }, ...companions] : state.party;
  const dice = createDiceMessage(summary);
  dice.diceResult = { rolls: [roll], total, modifier: pending.check.bonus, type: 'd20', advantage: 'none', explorationOutcome: tier };
  const memory = state.memory || createWorldMemory(state.currentScript ?? undefined);
  let next: CampaignState = {
    ...state, party, character: party[0], pendingCheck: null, directorChoices: [], turnNumber: state.turnNumber + 1,
    elapsedMinutes: state.elapsedMinutes + minutes,
    appliedEventIds: pending.source ? [...state.appliedEventIds, explorationId(state, pending.source)] : state.appliedEventIds,
    messages: [...state.messages, createPlayerMessage(pending.text, hero), dice],
    journal: [...(state.journal ?? []), { id: dice.id, timestamp: dice.timestamp, day: state.gameTime.day, title: pending.text, summary, category: 'check' }],
    memory: { ...memory, discoveredSecrets: [...memory.discoveredSecrets, ...clues], milestones: milestone ? [...memory.milestones, milestone] : memory.milestones,
      storySummary: `${memory.storySummary}\n${summary}`.slice(-2400) },
  };
  if (outcome.chapterId) next = advanceChapter(next, outcome.chapterId);
  return { state: next, outcome };
}

/** Read the workshop's latest data when this campaign was started from a saved script. */
export function refreshScript(state: CampaignState, scripts: Script[]): CampaignState {
  if (state.useScriptSnapshot || state.battle || state.pendingCheck) return state;
  const latest = scripts.find(script => script.id === state.currentScript?.id);
  if (!latest || JSON.stringify(latest) === JSON.stringify(state.currentScript)) return state;
  const currentChapter = state.currentChapter && latest.chapters[state.currentChapter] ? state.currentChapter : latest.startChapter;
  if (!latest.chapters[currentChapter]) return state;
  return {
    ...state, currentScript: latest, currentChapter,
    sceneStartedOnTurn: currentChapter === state.currentChapter ? state.sceneStartedOnTurn : state.turnNumber,
    visitedChapterIds: [...new Set([...state.visitedChapterIds.filter(id => latest.chapters[id]), currentChapter])],
  };
}

export function applyAdventureEvent(state: CampaignState, event: AdventureEvent): CampaignState {
  if (!event || !event.id || state.appliedEventIds.includes(event.id) || state.battle || state.pendingCheck
    || getRequiredChapterEncounter(state) || getRequiredChapterCheck(state) || isEndingPending(state)) return state;
  let next = { ...state, party: event.kind === 'ambience' ? state.party : structuredClone(state.party) };
  const hero = next.party[0];
  if (!hero) return state;
  switch (event.kind) {
    case 'ambience':
      if (!event.description.trim()) return state;
      break;
    case 'encounter':
      if (!isEnemyKind(event.enemyKind) || !Number.isInteger(event.count) || event.count < 1 || event.count > 6) return state;
      if (state.currentScript?.allowedEnemies && !state.currentScript.allowedEnemies.includes(event.enemyKind)) return state;
      next = { ...next, battle: createBattle(next.party, event) };
      break;
    case 'danger':
      if (!Number.isFinite(event.damage) || event.damage < 0 || event.damage > 12) return state;
      hero.hp.current = Math.max(0, hero.hp.current - event.damage);
      break;
    case 'reward':
      if (!Number.isFinite(event.gold) || event.gold < 0 || event.gold > 100 || !Array.isArray(event.items) || event.items.length > 3 || event.items.some(item => typeof item !== 'string')) return state;
      hero.gold = (hero.gold ?? 50) + event.gold;
      hero.inventory = [...hero.inventory, ...event.items];
      break;
    case 'discovery':
      if (typeof event.clue !== 'string' || !event.clue.trim()) return state;
      if (event.secretId && !state.currentScript?.knowledge?.some(k => k.requiresSecret === event.secretId)) return state;
      next.memory = { ...(next.memory || createWorldMemory()), discoveredSecrets: [...new Set([...(next.memory?.discoveredSecrets || []), event.clue, ...(event.secretId ? [event.secretId] : [])])] };
      break;
    case 'environment':
      if (typeof event.description !== 'string') return state;
      next.memory = { ...(next.memory || createWorldMemory()), activeBuffsDebuffs: [...(next.memory?.activeBuffsDebuffs || []), event.description].slice(-8) };
      break;
    default: return state;
  }
  next.character = next.party[0];
  next.appliedEventIds = [...state.appliedEventIds, event.id];
  next.messages = [...state.messages, createSystemMessage(`【${event.title}】${event.kind === 'discovery' ? event.clue : event.kind === 'ambience' || event.kind === 'environment' ? event.description : event.kind === 'reward' ? `金币 +${event.gold}；${event.items.join('、') || '没有额外物品'}` : event.kind === 'danger' ? `${hero.name} 受到 ${event.damage} 点伤害。` : '遭遇敌人，进入先攻与战斗。'}`)];
  return next;
}

export function applyDirectorResult(state: CampaignState, action: string, result: DirectorResult): CampaignState {
  if (state.battle || state.pendingCheck || getRequiredChapterEncounter(state) || isEndingPending(state)) return state;
  const memory = state.memory || createWorldMemory(state.currentScript ?? undefined);
  const narration = createNarratorMessage(result.narration, {
    sender: '地下城主', characterId: 'old_tom', speakerTitle: state.currentScript?.title,
  });
  const next = {
    ...state, directorChoices: getRequiredChapterCheck(state) ? [] : result.choices,
    memory: { ...memory, storySummary: `${memory.storySummary}\n${action.slice(0, 120)}：${result.narration.slice(0, 220)}`.slice(-2400) },
    messages: [...state.messages, narration],
  };
  return result.event ? applyAdventureEvent(next, result.event) : next;
}

export function settleBattle(state: CampaignState): CampaignState {
  const battle = state.battle;
  if (!battle || battle.phase === 'active') return state;
  const key = `settled:${battle.id}`;
  if (state.appliedEventIds.includes(key)) return { ...state, battle: null };
  const party = getCampaignParty(state).map(member => structuredClone(member));
  if (battle.phase === 'victory') {
    const share = Math.floor(battle.reward.experience / party.length);
    for (let i = 0; i < party.length; i++) party[i] = awardExperience(party[i], share);
    party[0].gold = (party[0].gold ?? 50) + battle.reward.gold;
    party[0].inventory.push(...battle.reward.items);
  }
  const summary = battle.phase === 'victory' ? `战斗胜利，获得 ${battle.reward.gold} 金币、${battle.reward.experience} 队伍经验。`
    : battle.phase === 'escaped' ? '队伍撤离战场，保留资源损耗。' : '队伍败北，可读取存档或重新编队开启战役。';
  const chapterFight = isChapterEncounterBattle(state);
  const cleared = chapterFight && battle.phase === 'victory';
  const aftermath = !chapterFight ? undefined : cleared
    ? currentChapter(state)?.encounter?.aftermath?.trim() || '你们清出了前方的通路。整理好武器和背包，再决定下一步。'
    : battle.phase === 'escaped' ? '你们退到了掩护后。伤势和消耗仍在，整备好就能再次迎战。' : summary;
  const memory = state.memory || createWorldMemory();
  const storySummary = `${memory.storySummary}\n【${battle.title}】${summary}${cleared && aftermath ? `\n${aftermath}` : ''}`.slice(-1800);
  return {
    ...state, party, character: party[0], battle: null,
    appliedEventIds: [...state.appliedEventIds, key, ...(cleared ? [chapterEncounterId(state)] : [])],
    memory: { ...memory, storySummary, milestones: [...memory.milestones, `${battle.phase}:${battle.id}`] },
    messages: [...state.messages, createSystemMessage(summary), ...(aftermath ? [createNarratorMessage(aftermath, {
      sender: '地下城主', characterId: 'old_tom', speakerTitle: state.currentScript?.title,
    })] : [])],
  };
}

function awardExperience(member: Combatant, amount: number): Combatant {
  const experience = member.experience + amount;
  let level = member.level;
  while (level < 5 && experience >= LEVEL_EXPERIENCE[level + 1]) level++;
  if (level === member.level) return { ...member, experience };
  const key = classKey(member.class);
  const hitDie = combatHitDie(key);
  const gained = level - member.level;
  const speciesHp = member.speciesTraits === true ? getSpeciesTraits(member.race).hpPerLevel : 0;
  const hpGain = (Math.max(1, hitDie / 2 + 1 + getModifier(member.attributes.con)) + speciesHp) * gained;
  const leveled = createPartyMember({ ...member, level, hp: { max: member.hp.max + hpGain, current: member.hp.current > 0 ? member.hp.current + hpGain : 0 } });
  const oldLimits = classResourceLimits(key, member.level);
  const newLimits = classResourceLimits(key, level);
  const maxSlots = leveled.resources.maxSpellSlots;
  const spellSlots = Object.fromEntries(Object.entries(maxSlots).map(([slot, max]) => {
    const rank = Number(slot);
    const spent = (member.resources.maxSpellSlots[rank] || 0) - (member.resources.spellSlots[rank] || 0);
    return [rank, Math.max(0, max - spent)];
  }));
  return {
    ...member, level, experience, hp: leveled.hp, proficiencyBonus: leveled.proficiencyBonus,
    resources: {
      ...member.resources, maxSpellSlots: maxSlots, spellSlots,
      hitDice: Math.min(level, member.resources.hitDice + gained), maxHitDice: level,
      layOnHands: member.resources.layOnHands + Math.max(0, newLimits.layOnHands - oldLimits.layOnHands),
      hunterMarkUses: (member.resources.hunterMarkUses || 0) + (newLimits.hunterMarkUses - oldLimits.hunterMarkUses),
      divineSmiteUses: (member.resources.divineSmiteUses || 0) + (newLimits.divineSmiteUses - oldLimits.divineSmiteUses),
    },
  };
}

