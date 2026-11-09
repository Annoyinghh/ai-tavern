'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AISettings, ChatMessage, Script, ScriptChoice, ExplorationAction, TavernState, OutcomeTier } from '@/lib/types';
import { DEFAULT_AI_SETTINGS, ATTRIBUTE_LABELS } from '@/lib/types';
import { loadState, saveState, loadCharacter, saveCharacter, loadScripts, createPlayerMessage, createSystemMessage, setTimeOfDay } from '@/lib/gameState';
import { chapterSceneImage, COMMISSIONS, EILEEN_GREETING_KEY, sceneKey } from '@/lib/tavernScenes';
import {
  advanceChapter, applyDirectorResult, beginChapterEncounter, beginExplorationCheck, confirmExplorationCheck,
  createWorldMemory, getCampaignParty, getChapterRewardNotice, getRequiredChapterCheck, getRequiredChapterChoices, getRequiredChapterEncounter,
  isChapterEncounterBattle, isEndingPending, isExplorationCheckResolved, migrateCampaign, previewExplorationOutcome,
  recordExplorationRoll, refreshScript, settleBattle, startEpilogue, startScript, type CampaignState, type ExplorationCheck,
} from '@/lib/campaign';
import { getActionCheck } from '@/lib/checks';
import { setBGMScene } from '@/lib/audio';
import { loadAISettings, loadLocalMode, saveLocalMode } from '@/lib/preferences';
import { getDecisionActor, applyAction, advanceEnemyTurn, restParty, createPartyMember } from '@/lib/combat/engine';
import type { BattleAction, BattleState } from '@/lib/combat/types';
import type { DirectorContext, DirectorResult } from '@/lib/adventure';
import { isEndingChapter, sceneEventId } from '@/lib/worldLore';
import GalgameStage from '@/components/GalgameStage';
import BattleStage, { type BattleImpact } from '@/components/BattleStage';
import AudioControls from '@/components/AudioControls';
import BeginnerGuide from '@/components/BeginnerGuide';
import CommissionDesk, { presetCommission, type Commission } from '@/components/CommissionDesk';
import TavernArrival from '@/components/TavernArrival';
import TavernBar from '@/components/TavernBar';
import EileenAside from '@/components/EileenAside';
import PartyPanel from '@/components/PartyPanel';
import FullScreen3DDice from '@/components/FullScreen3DDice';
import GalgameHistoryDrawer from '@/components/GalgameHistoryDrawer';
import SettingsModal from '@/components/SettingsModal';
import JournalModal from '@/components/JournalModal';
import MemoryRadarModal from '@/components/MemoryRadarModal';

const WELCOME: ChatMessage = { id: 'welcome-v2', role: 'narrator', sender: '老汤姆', characterId: 'old_tom', expression: 'smile', speakerTitle: '酒馆老板兼 DM', timestamp: 0, content: '欢迎来到流浪者之憩。先整备你的队伍，再挑一份冒险委托。你将决定每个人的行动，而我会记住旅途中发生的一切。' };

export default function TavernCampaign({ lobby = false }: { lobby?: boolean }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignState>(() => migrateCampaign(null));
  const campaignRef = useRef(campaign);
  const [hydrated, setHydrated] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [impact, setImpact] = useState<BattleImpact>();
  const [offline, setOffline] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [autoVoice, setAutoVoice] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/voice', { signal: controller.signal }).then(async response => {
      if (response.ok) {
        const result = await response.json();
        if (!controller.signal.aborted) setAutoVoice(result.autoplay === true);
      }
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [panel, setPanel] = useState<'party' | 'scripts' | 'history' | 'settings' | 'journal' | 'memory' | 'guide' | 'bar' | null>(null);
  const [savedScripts, setSavedScripts] = useState<Script[]>([]);
  const [commission, setCommission] = useState<Commission | null>(null);
  const [greeting, setGreeting] = useState(false);
  const resumeCommission = useRef(false);
  const pendingCheck = campaign.pendingCheck;
  const retryRef = useRef<{ state: CampaignState; action: string; resolution?: string; settledEncounterId?: string; checkOutcome?: OutcomeTier; scouting?: boolean } | null>(null);

  const update = useCallback((value: CampaignState | ((previous: CampaignState) => CampaignState), requireStorage = false) => {
    const changed = typeof value === 'function' ? value(campaignRef.current) : value;
    const party = getCampaignParty(changed);
    const next = { ...changed, party, character: party[0] };
    if (!saveState(next) && requireStorage) throw new Error('浏览器存储空间不足或不可用，当前战役未更改。');
    campaignRef.current = next;
    setCampaign(next);
    if (party[0]) saveCharacter(party[0]);
  }, []);

  const commitBattle = useCallback((before: BattleState, after: BattleState) => {
    const current = campaignRef.current;
    if (current.battle !== before || after === before) return;
    const hp: Record<string, number> = {};
    for (const unit of after.combatants) {
      const previous = before.combatants.find(candidate => candidate.id === unit.id);
      if (previous && previous.hp.current !== unit.hp.current) hp[unit.id] = unit.hp.current - previous.hp.current;
    }
    if (Object.keys(hp).length) setImpact({ battleId: after.id, id: after.log.at(-1)?.id ?? crypto.randomUUID(), hp });
    update({ ...current, battle: after });
  }, [update]);

  useEffect(() => {
    if (!impact) return;
    const timer = setTimeout(() => setImpact(undefined), 1450);
    return () => clearTimeout(timer);
  }, [impact]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = loadState();
      const raw = localStorage.getItem('ai-tavern-state');
      if (raw && (saved as Partial<CampaignState> | null)?.campaignVersion !== 2 && !localStorage.getItem('ai-tavern-state-before-v2')) localStorage.setItem('ai-tavern-state-before-v2', raw);
      const initial = migrateCampaign(saved, saved?.currentScript ? undefined : loadCharacter());
      const url = new URL(window.location.href);
      const opensTavernPanel = url.searchParams.has('preset') || url.searchParams.has('tavern');
      if (!lobby && (opensTavernPanel || (!initial.currentScript && !initial.battle))) {
        router.replace(`/${url.search}`);
        return;
      }
      update(initial);
      setSettings(loadAISettings());
      setLocalMode(loadLocalMode());
      setGreeting(localStorage.getItem(EILEEN_GREETING_KEY) !== 'true');
      const preset = COMMISSIONS.find(option => option.key === url.searchParams.get('preset'));
      const tavern = url.searchParams.get('tavern');
      if (opensTavernPanel) {
        url.searchParams.delete('preset');
        url.searchParams.delete('tavern');
        window.history.replaceState(null, '', url);
      }
      if ((preset || tavern === 'desk') && !initial.battle && !initial.pendingCheck) {
        setSavedScripts(loadScripts());
        setCommission(preset ? presetCommission(preset.key) : null);
        setPanel('scripts');
      } else if (tavern === 'guide' || tavern === 'party') {
        setPanel(tavern);
      }
      setHydrated(true);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.current?.abort();
      controller.current = null;
    };
  }, [lobby, router, update]);

  const cancelRequest = () => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setError('');
    retryRef.current = null;
    setRetryAvailable(false);
  };

  const restoreCampaign = (saved: TavernState) => {
    const restored = migrateCampaign(saved);
    update(restored, true);
    setImpact(undefined);
    resumeCommission.current = false;
    setCommission(null);
    cancelRequest();
    setLoadRevision(revision => revision + 1);
    setOffline(false);
    if (lobby && (restored.currentScript || restored.battle)) router.push('/game');
    else if (!lobby && !restored.currentScript && !restored.battle) router.replace('/');
  };

  const acknowledgeGreeting = () => {
    if (!greeting) return;
    setGreeting(false);
    localStorage.setItem(EILEEN_GREETING_KEY, 'true');
  };

  const openGuide = () => {
    acknowledgeGreeting();
    setPanel('guide');
  };

  const openScriptPicker = () => {
    if (campaignRef.current.battle || campaignRef.current.pendingCheck || controller.current) return;
    acknowledgeGreeting();
    setCommission(null);
    setSavedScripts(loadScripts());
    setPanel('scripts');
  };

  const narrate = async (snapshot: CampaignState, action: string, resolution?: string, settledEncounterId?: string, checkOutcome?: OutcomeTier, scouting?: boolean) => {
    const latest = campaignRef.current;
    if (controller.current || latest.battle || latest.currentScript?.id !== snapshot.currentScript?.id || latest.turnNumber !== snapshot.turnNumber) return;
    const state = refreshScript(latest, loadScripts());
    if (state !== latest) update(state);
    if (!state.currentScript || !state.currentChapter || getRequiredChapterEncounter(state) || isEndingPending(state)) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    retryRef.current = { state, action, resolution, settledEncounterId, checkOutcome, scouting };
    const { id: scriptId } = state.currentScript;
    const chapterId = state.currentChapter;
    const context: DirectorContext = {
      script: state.currentScript, chapterId: state.currentChapter, visitedChapterIds: state.visitedChapterIds,
      memory: state.memory || createWorldMemory(state.currentScript),
      partySummary: state.party.map(p => `${p.name}，${p.level}级${p.race}${p.class}，HP ${p.hp.current}/${p.hp.max}，AC ${p.ac}，金币${p.gold ?? 50}，法术位${JSON.stringify(p.resources.spellSlots)}，背包${p.inventory.join('、')}`).join('\n'),
      action, resolvedAction: resolution, turnNumber: state.turnNumber, settledEncounterId, checkOutcome,
      sceneTurns: state.turnNumber - state.sceneStartedOnTurn, scouting,
      sceneEventKinds: (['ambience', 'encounter'] as const).filter(kind => state.appliedEventIds.includes(sceneEventId(scriptId, chapterId, kind))),
    };
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
        body: JSON.stringify({ directorContext: context, offline: localMode, customSettings: settings }),
      });
      const data = await response.json();
      if (!response.ok || !data.director) throw new Error(data.error || '主持服务未返回有效剧情，可重试。');
      if (controller.current !== abort || campaignRef.current.currentScript?.id !== state.currentScript.id || campaignRef.current.turnNumber !== state.turnNumber) return;
      const result = data.director as DirectorResult;
      update(current => applyDirectorResult(current, action, result));
      setOffline(Boolean(result.offline));
      retryRef.current = null;
      setRetryAvailable(false);
    } catch (cause) {
      if (controller.current === abort && !abort.signal.aborted) {
        setError(cause instanceof Error ? cause.message : '主持连接失败，已保留行动和投骰结果。');
        setRetryAvailable(true);
      }
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  };

  const adventure = (text: string, choice?: ScriptChoice, source?: ExplorationCheck['source'], scouting?: boolean) => {
    let current = refreshScript(campaignRef.current, loadScripts());
    if (controller.current || current.battle || current.pendingCheck || !text.trim()) return;
    if (!current.currentScript || !current.currentChapter) { openScriptPicker(); return; }
    if (choice?.nextChapter === 'open_presets' && !getRequiredChapterCheck(current)) { openScriptPicker(); return; }
    if (current.party.every(p => p.hp.current <= 0)) { setError('队伍已无法继续行动。请读取存档，或返回整备开启新的战役。'); return; }
    if (getRequiredChapterEncounter(current)) {
      if (current !== campaignRef.current) update(current);
      setError('先处理眼前的战斗，再继续探索。');
      return;
    }
    const script = current.currentScript;
    const chapter = script.chapters[current.currentChapter];
    if (isEndingChapter(script, chapter)) {
      const authored = chapter.choices.find(branch => branch.text === text && branch.nextChapter === choice?.nextChapter);
      if (authored?.nextChapter === script.startChapter) {
        cancelRequest();
        update({ ...startScript(current, script), useScriptSnapshot: current.useScriptSnapshot });
        setOffline(false);
        return;
      }
      if (isEndingPending(current)) {
        if (!authored) return;
        if (authored.nextChapter === 'AI_DYNAMIC') current = startEpilogue(current, authored);
      }
    }
    const check = getActionCheck(text, current.party[0], choice?.check);
    if (check) {
      const next = beginExplorationCheck(current, { text, choice, check, source });
      if (next === current) setError('这项检定在当前场景不可用，请选择其他行动。');
      else { setError(''); update(next); }
      return;
    }
    if (getRequiredChapterCheck(current)) { setError('请先完成当前章节的关键检定。'); return; }
    let next: CampaignState = { ...current, turnNumber: current.turnNumber + 1, directorChoices: [], messages: [...current.messages, createPlayerMessage(text, current.party[0])] };
    const target = choice?.nextChapter;
    if (target && script.chapters[target]) next = advanceChapter(next, target);
    update(next);
    if (next.currentChapter !== current.currentChapter) {
      cancelRequest();
      return;
    }
    void narrate(next, text, undefined, undefined, undefined, scouting);
  };

  const confirmCheck = (roll: { roll: number; total: number }) => {
    const current = campaignRef.current;
    const pending = current.pendingCheck;
    if (controller.current || !pending) return;
    if (pending.result?.roll !== roll.roll || pending.result.total !== roll.total) {
      setError('检定结果尚未保存，请等待骰子确认。');
      return;
    }
    const { state, outcome } = confirmExplorationCheck(current);
    if (!outcome) return;
    update(state);
    if (state.currentChapter !== current.currentChapter) {
      cancelRequest();
      return;
    }
    void narrate(state, pending.text, outcome.summary, undefined, outcome.tier);
  };

  const begin = (script: Script) => {
    const current = campaignRef.current;
    if (current.battle || current.pendingCheck || controller.current) throw new Error('请先完成当前回合，再接受新的委托。');
    const next = startScript(current, script);
    const opening = next.messages.at(-1);
    if (next === current || !opening) throw new Error('这份委托缺少开场章节，请在剧本工坊检查。');
    update({ ...next, messages: [...next.messages.slice(0, -1), {
      ...opening, sender: '老汤姆', speakerTitle: '酒馆老板兼地下城主',
      content: `老汤姆：“艾琳已经把委托交给我了。都坐稳，故事从这里开始。”\n\n${opening.content}`,
    }] }, true);
    acknowledgeGreeting();
    cancelRequest();
    setCommission(null);
    setOffline(false); setPanel(null);
    if (lobby) router.push('/game');
  };

  const takeBattleAction = (action: BattleAction) => {
    const current = campaignRef.current;
    if (!current.battle) return false;
    const result = applyAction(current.battle, action);
    setError(result.error || '');
    if (result.battle === current.battle) return false;
    commitBattle(current.battle, result.battle);
    return !result.error;
  };

  const startChapterBattle = () => {
    const current = campaignRef.current;
    if (controller.current) return;
    const next = beginChapterEncounter(current);
    if (next === current) return;
    cancelRequest();
    update(next);
  };

  useEffect(() => {
    const battle = campaign.battle;
    if (lobby || !hydrated || !battle || getDecisionActor(battle)?.side !== 'enemy') return;
    const timer = setTimeout(() => {
      const current = campaignRef.current;
      if (current.battle === battle) commitBattle(battle, advanceEnemyTurn(battle));
    }, 550);
    return () => clearTimeout(timer);
  }, [campaign.battle, hydrated, lobby, commitBattle]);

  const finishBattle = () => {
    const current = campaignRef.current;
    if (!current.battle || current.battle.phase === 'active') return;
    const outcome = current.battle.phase;
    const title = current.battle.title;
    const next = { ...settleBattle(current), turnNumber: current.turnNumber + 1 };
    update(next);
    if (outcome !== 'defeat' && !isChapterEncounterBattle(current)) void narrate(next, `【已由规则结算】${title}：${outcome === 'victory' ? '队伍胜利' : '队伍撤离'}。请承接本次后果继续当前剧本，提供下一步探索选项。`, '血量、资源、奖励均已结算，不要再次发放金币、物品或造成同一笔伤害。', current.battle.id);
  };

  const rest = (kind: 'short' | 'long') => {
    const current = campaignRef.current;
    if (current.battle || controller.current) return;
    const party = restParty(current.party, kind);
    update({ ...current, party, character: party[0], elapsedMinutes: current.elapsedMinutes + (kind === 'long' ? 480 : 60), messages: [...current.messages, createSystemMessage(`队伍完成${kind === 'long' ? '8小时长休' : '1小时短休'}，恢复详情见角色资源。`)] });
  };

  const returnToPreparation = () => {
    if (!confirm('返回整备会结束当前战役进度。角色当前血量与资源保留，建议先在冒险日志中保存。继续吗？')) return;
    cancelRequest();
    update(current => ({ ...current, currentScript: null, currentChapter: null, battle: null, directorChoices: [], memory: createWorldMemory(), visitedChapterIds: [] }));
    router.replace('/?tavern=party');
  };

  const activeChapter = campaign.currentScript && campaign.currentChapter ? campaign.currentScript.chapters[campaign.currentChapter] : null;
  const requiredEncounter = getRequiredChapterEncounter(campaign);
  const canFight = campaign.party.some(member => member.hp.current > 0);
  const ending = isEndingPending(campaign);
  const requiredCheck = getRequiredChapterCheck(campaign);
  const activeCheck = isExplorationCheckResolved(campaign, { kind: 'chapter' }) ? undefined : activeChapter?.dcCheck;
  const explorationActions = activeChapter?.explorationActions?.filter(action => !isExplorationCheckResolved(campaign, { kind: 'exploration', actionId: action.id }));
  const authoredChoices = activeChapter?.choices ?? [];
  const choices = requiredCheck ? getRequiredChapterChoices(campaign) : ending ? authoredChoices : [
    ...authoredChoices,
    ...campaign.directorChoices.filter(choice => !authoredChoices.some(authored =>
      authored.text === choice.text || (authored.nextChapter !== activeChapter?.id && authored.nextChapter === choice.nextChapter),
    )),
  ];
  const latestNarration = [...campaign.messages].reverse().find(m => m.role === 'narrator');
  // Early saves could advance a chapter before the remote narrator returned its opening text.
  const staleOpening = activeChapter && latestNarration && Object.values(campaign.currentScript?.chapters ?? {}).some(chapter =>
    chapter.id !== activeChapter.id && chapter.content === latestNarration.content);
  const narration = activeChapter && ((ending && !activeChapter.encounter) || !latestNarration || staleOpening)
    ? { ...WELCOME, id: `chapter:${activeChapter.id}`, expression: undefined, speakerTitle: campaign.currentScript?.title, content: activeChapter.content }
    : latestNarration || WELCOME;
  const currentMessage = narration.characterId === 'dm' || narration.characterId === 'old_tom'
    ? { ...narration, characterId: 'old_tom', sender: '老汤姆', speakerTitle: '酒馆老板兼地下城主' }
    : narration;
  const checkPreview = useMemo(() => previewExplorationOutcome(campaign), [campaign]);
  const backdrop = chapterSceneImage(campaign.currentScript, activeChapter);
  const musicScene = lobby || panel === 'scripts' ? 'tavern' : sceneKey(campaign.currentScript);
  const inActiveBattle = !lobby && campaign.battle?.phase === 'active';
  useEffect(() => {
    if (hydrated) setBGMScene(musicScene, inActiveBattle);
  }, [hydrated, musicScene, inActiveBattle]);
  useEffect(() => () => setBGMScene('tavern', false), []);
  const executeExploration = (action: ExplorationAction) => adventure(
    action.title,
    { text: action.title, nextChapter: 'AI_DYNAMIC', check: { attribute: action.attribute, skill: action.skill, dc: action.dc, successChapter: action.targetChapterOnDiscover } },
    { kind: 'exploration', actionId: action.id },
  );

  if (!hydrated) return <div className="campaign-loading" role="status">正在整理你的战役档案…</div>;

  const battleView = !lobby && Boolean(campaign.battle);
  const storyView = !lobby && !battleView && Boolean(campaign.currentScript);
  const stageTools = <div className="stage-utilities">
    {storyView && <>
      {(offline || localMode) && <small className="stage-rehearsal">本地演练</small>}
      {ending ? <button type="button" className="battle-button" onClick={openScriptPicker}>查看其他委托</button>
        : !requiredEncounter && <button type="button" className="battle-button" disabled={busy || Boolean(requiredCheck || pendingCheck)}
          onClick={() => adventure('队伍主动侦察周边，做好遭遇敌人的准备。', undefined, undefined, true)}>主动侦察</button>}
    </>}
    <button type="button" className="battle-button" onClick={() => setPanel('journal')}>存档</button>
    <details className="stage-menu" onKeyDown={event => {
      if (event.key !== 'Escape' || event.defaultPrevented || !event.currentTarget.open) return;
      event.preventDefault();
      event.currentTarget.open = false;
      event.currentTarget.querySelector('summary')?.focus();
    }}>
      <summary className="battle-button" aria-label={battleView ? '战斗菜单' : '剧情菜单'}>菜单</summary>
      <div>
        {battleView ? <Link href="/">返回酒馆</Link> : <>
          <label className="local-mode-toggle"><input type="checkbox" checked={localMode} disabled={busy} onChange={event => {
            setLocalMode(event.target.checked);
            saveLocalMode(event.target.checked);
          }} />本地演练</label>
          <button type="button" onClick={() => setPanel('party')}>队伍与法术</button>
          <button type="button" disabled={Boolean(pendingCheck) || busy} onClick={openScriptPicker}>剧本委托</button>
          <button type="button" onClick={() => setPanel('history')}>回想与检定记录</button>
          <button type="button" onClick={() => setPanel('memory')}>战役记忆</button>
          <button type="button" disabled={busy || Boolean(pendingCheck)} onClick={returnToPreparation}>返回整备</button>
        </>}
        <button type="button" onClick={openGuide}>新手指引</button>
        <button type="button" onClick={() => setPanel('settings')}>设置</button>
        {battleView && <AudioControls />}
      </div>
    </details>
  </div>;

  return <div className="campaign-game" data-battle={battleView}>
    {!battleView && !storyView && <nav className="campaign-toolbar" aria-label={lobby ? '酒馆操作' : '战役操作'}><span className="campaign-label">{lobby ? '酒馆吧台' : '出发前整备'}{(offline || localMode) && <small>本地演练 · 未调用AI</small>}</span><div>
      <label className="local-mode-toggle"><input type="checkbox" checked={localMode} disabled={busy} onChange={e => { setLocalMode(e.target.checked); saveLocalMode(e.target.checked); }} />本地演练</label>
      {!lobby && <><button type="button" aria-haspopup="dialog" className="guide-trigger" onClick={openGuide}>新手指引</button><button type="button" onClick={() => setPanel('party')}>队伍</button><button type="button" disabled={Boolean(campaign.battle || pendingCheck) || busy} onClick={openScriptPicker}>剧本</button></>}
      {campaign.currentScript && <><button type="button" onClick={() => setPanel('history')}>回想</button><button type="button" onClick={() => setPanel('memory')}>记忆</button></>}
      <button type="button" onClick={() => setPanel('journal')}>存档</button><button type="button" onClick={() => setPanel('settings')}>设置</button>
    </div></nav>}
    {!battleView && campaign.migrationNotes.length > 0 && <details className="migration-note"><summary>旧存档已安全升级，查看说明</summary>{campaign.migrationNotes.map((note, i) => <p key={i}>{note}</p>)}</details>}
    {!battleView && error && <div className="campaign-error" role="alert"><span>{error}</span>{retryAvailable && !busy && <button type="button" onClick={() => { const retry = retryRef.current; if (retry) void narrate(retry.state, retry.action, retry.resolution, retry.settledEncounterId, retry.checkOutcome, retry.scouting); }}>重试主持，不重新投骰</button>}<button type="button" onClick={() => setError('')}>收起</button></div>}

    {lobby ? <TavernArrival greeting={greeting} voicePaused={Boolean(panel)} activeCampaign={Boolean(campaign.currentScript || campaign.battle)}
      commissionLocked={Boolean(campaign.battle || pendingCheck)} gameTime={campaign.gameTime}
      onTimeChange={time => update(current => ({ ...current, ...setTimeOfDay(current, time) }))}
      onCommission={openScriptPicker} onGuide={openGuide} onParty={() => setPanel('party')} onBar={() => setPanel('bar')} />
      : campaign.battle ? <BattleStage key={`${loadRevision}:${campaign.battle.id}:${campaign.battle.round}:${campaign.battle.turnIndex}`}
        battle={campaign.battle} sceneImage={backdrop} onAction={takeBattleAction} onSettle={finishBattle} error={error} tools={stageTools} impact={impact} />
      : !campaign.currentScript ? null
      : <GalgameStage key={`${loadRevision}:${currentMessage.id}`}
        playerCharacter={campaign.party[0]} party={campaign.party} currentMessage={currentMessage} choices={choices}
        isLoading={busy || Boolean(pendingCheck)} checking={Boolean(pendingCheck)} tools={stageTools}
        voicePaused={Boolean(panel)} autoVoice={autoVoice}
        encounter={requiredEncounter && { title: requiredEncounter.title, canFight, onStart: startChapterBattle }}
        rewardNotice={getChapterRewardNotice(campaign)}
        dcCheck={ending ? undefined : activeCheck} requiredCheck={!ending && Boolean(requiredCheck)}
        explorationActions={ending ? undefined : explorationActions} ending={ending}
        onSelectChoice={choice => adventure(choice.text, choice, requiredCheck ? { kind: 'chapter' } : undefined)} onSendMessage={text => adventure(text)}
        onExecuteDCCheck={() => {
          const check = activeChapter?.dcCheck;
          if (check) adventure(`尝试${ATTRIBUTE_LABELS[check.attribute]}${check.skill || ''}检定 DC ${check.dc}`,
            { text: '', nextChapter: check.successChapter, check }, { kind: 'chapter' });
        }}
        onExecuteExploration={executeExploration} backgroundImage={backdrop}
        sceneTitle={campaign.currentScript.title} chapterTitle={activeChapter?.title}
      />}

    {!lobby && pendingCheck && <FullScreen3DDice
      key={loadRevision}
      resolvedRoll={pendingCheck.result}
      actionTitle={pendingCheck.text}
      targetAttr={pendingCheck.check.attribute}
      targetSkill={pendingCheck.check.skill}
      targetDC={pendingCheck.check.dc}
      bonus={pendingCheck.check.bonus}
      bonusBreakdown={`${pendingCheck.check.label}${pendingCheck.check.skill ? ` · ${pendingCheck.check.skill}` : ''}，加值 ${pendingCheck.check.bonus}`}
      outcomeSummary={checkPreview?.summary}
      onRollStart={roll => update(current => recordExplorationRoll(current, roll))}
      onRollFinish={confirmCheck}
      onOpenJournal={() => setPanel('journal')}
    />}

    {panel === 'party' && <div className="campaign-modal-backdrop" onClick={() => setPanel(null)}><div className="campaign-modal" role="dialog" aria-modal="true" aria-labelledby="campaign-dialog-title" onClick={e => e.stopPropagation()}><header><h2 id="campaign-dialog-title">冒险队伍</h2><button type="button" aria-label="关闭" onClick={() => setPanel(null)}>关闭</button></header>
      {!campaign.currentScript && <EileenAside context="party" onOpenGuide={openGuide} />}
      <PartyPanel party={campaign.party} locked={Boolean(campaign.currentScript)} busy={busy || Boolean(campaign.battle)} elapsedMinutes={campaign.elapsedMinutes} onChange={party => update(current => ({ ...current, party, character: party[0] }))} onRest={rest} />
      {campaign.party.every(p => p.hp.current <= 0) && <button type="button" className="battle-button" onClick={() => { cancelRequest(); const fresh = campaign.party.map(p => createPartyMember({ ...p, hp: { ...p.hp, current: p.hp.max } })); update({ ...migrateCampaign(null), party: fresh, character: fresh[0] }); setPanel(null); }}>重新编队，开启新战役</button>}
    </div></div>}
    {panel === 'scripts' && <CommissionDesk selection={commission} scripts={savedScripts} activeCampaign={Boolean(campaign.currentScript)}
      onSelect={setCommission} onAccept={begin} onSave={() => { resumeCommission.current = true; setPanel('journal'); }} onClose={() => { setCommission(null); setPanel(null); }} />}
    <GalgameHistoryDrawer isOpen={panel === 'history'} onClose={() => setPanel(null)} messages={campaign.messages} />
    <SettingsModal isOpen={panel === 'settings'} onClose={() => setPanel(null)} onSave={setSettings} />
    {panel === 'journal' && <JournalModal state={campaign} onClose={() => { setPanel(resumeCommission.current ? 'scripts' : null); resumeCommission.current = false; }} onLoadState={restoreCampaign} />}
    {panel === 'guide' && <BeginnerGuide onClose={() => setPanel(null)} />}
    {panel === 'bar' && <TavernBar localMode={localMode} settings={settings} onClose={() => setPanel(null)} />}
    <MemoryRadarModal isOpen={panel === 'memory'} onClose={() => setPanel(null)} memory={campaign.memory} />
  </div>;
}
