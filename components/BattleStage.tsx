'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { heroPortrait } from '@/lib/heroPortraits';
import { appearanceFor } from '@/lib/appearance';
import type { BattleAction, BattleState, Combatant, Point, TerrainCell } from '@/lib/combat/types';
import { classKey, freeSpellResource, getAvailableSpells, getHealingPotions } from '@/lib/combat/catalog';
import {
  canTransferMark,
  describeRelativePosition,
  displayBattleLog,
  getAreaSpellError,
  getAreaSpellTargets,
  getCombatantAt,
  getCurrentActor,
  getDecisionActor,
  getLineOfSight,
  getReachableRoutes,
  gridDistance,
} from '@/lib/combat/engine';
import styles from './BattleStage.module.css';
import ActorPoseLayer from './ActorPose';
import CharacterAvatarRenderer from './CharacterAvatarRenderer';
import LayeredPortrait from './LayeredPortrait';

export type BattleImpact = { battleId: string; id: string; hp: Record<string, number> };

interface Props {
  battle: BattleState;
  onAction: (action: BattleAction) => boolean;
  onSettle: () => void;
  error?: string;
  sceneImage?: string;
  tools?: ReactNode;
  impact?: BattleImpact;
}

type Mode = 'move' | 'attack' | 'cast' | 'help' | 'use-item';
type Panel = Mode | 'tactics' | 'intel' | 'log';
type PointChoice = { point: Point; label: string };
const modes: Mode[] = ['move', 'attack', 'cast', 'help', 'use-item'];
const panelLabels: Record<Panel, string> = {
  move: '移动', attack: '武器攻击', cast: '法术与能力', help: '救助', 'use-item': '治疗药水',
  tactics: '战术动作', intel: '战场情报', log: '完整战报',
};
const conditionNames = {
  prone: '倒地', restrained: '束缚', poisoned: '中毒', stunned: '震慑', unconscious: '昏迷', dead: '死亡',
  dodging: '闪避', disengaged: '脱离近战', hidden: '躲藏', blessed: '祝福', marked: '猎人印记', shielded: '护盾',
};
const terrainNames: Record<TerrainCell['type'], string> = { wall: '墙体', cover: '掩体', difficult: '困难地形', hazard: '危险地形' };
const costNames = { action: '动作', bonus: '附赠动作', reaction: '反应' };
const logNames = { info: '行动', attack: '攻击检定', damage: '伤害', heal: '治疗', save: '豁免', spell: '施法', reaction: '反应' };
const directions = ['当前位置', '北', '东北', '东', '东南', '南', '西南', '西', '西北'];
const pointKey = (point: Point) => `${point.x},${point.y}`;
const isDead = (unit: Combatant) => unit.conditions.some(condition => condition.name === 'dead');

function directionFrom(origin: Point, point: Point) {
  const vertical = point.y < origin.y ? '北' : point.y > origin.y ? '南' : '';
  const horizontal = point.x < origin.x ? '西' : point.x > origin.x ? '东' : '';
  return `${vertical}${horizontal}` || '当前位置';
}

function conditionsOf(unit: Combatant) {
  return [...unit.conditions.map(condition => conditionNames[condition.name]), ...(unit.concentration ? ['专注中'] : [])].join(' · ') || '状态正常';
}

function CombatPortrait({ unit, thumbnail = false, acting = false }: { unit: Combatant; thumbnail?: boolean; acting?: boolean }) {
  const [failed, setFailed] = useState(false);
  const layers = unit.side === 'party' ? appearanceFor(unit) : undefined;
  if (layers) {
    return <span className={thumbnail ? 'shrink-0' : styles.portrait} aria-hidden="true" data-side={unit.side}>
      {thumbnail ? <CharacterAvatarRenderer layers={layers} size="xs" />
        : <LayeredPortrait layers={layers} className={`h-full w-full ${acting ? 'animate-galgame-shock' : ''}`} />}
    </span>;
  }
  const image = unit.side === 'party' ? heroPortrait(unit)
    : unit.enemyKind && `/battle/${unit.enemyKind}.webp`;
  const portrait = image && !failed
    ? <Image src={image} alt="" fill unoptimized onError={() => setFailed(true)} />
    : <span className={styles.portraitFallback}>{unit.name.slice(0, 1)}</span>;

  return <span className={thumbnail ? styles.avatar : styles.portrait} aria-hidden="true" data-side={unit.side}>
    {!thumbnail && image ? <ActorPoseLayer imageUrl={image} portraitPoses={unit.portraitPoses} pose={acting ? 'action' : 'idle'} preload>
      {portrait}
    </ActorPoseLayer> : portrait}
  </span>;
}

function FeaturedCombatant({ unit, label, current, acting, impact }: {
  unit: Combatant; label: string; current: boolean; acting: boolean; impact?: BattleImpact;
}) {
  const change = impact?.hp[unit.id] ?? 0;
  return <div className={styles.featured} data-side={unit.side} data-fallen={unit.hp.current === 0}>
    <CombatPortrait key={unit.id} unit={unit} acting={acting && unit.hp.current > 0} />
    {change !== 0 && <span key={impact?.id} className={styles.hpChange} data-heal={change > 0} aria-hidden="true">
      {change > 0 ? '+' : '−'}{Math.abs(change)} <small>HP</small>
    </span>}
    <div className={styles.nameplate}>
      <small>{label}{current && ' · 行动中'}</small>
      <strong>{unit.name}</strong>
      <div className={styles.vitals}><span>HP {unit.hp.current}/{unit.hp.max}</span><span>AC {unit.ac}</span></div>
      <meter min={0} max={unit.hp.max} value={unit.hp.current} aria-label={`${unit.name}生命值`} />
    </div>
  </div>;
}

function PositionPicker({ label, origin, options, selected, onChange, disabled }: {
  label: string;
  origin: Point;
  options: PointChoice[];
  selected?: Point;
  onChange: (point: Point | null) => void;
  disabled: boolean;
}) {
  return <label className={styles.field}>
    <span>{label}</span>
    <select value={selected ? pointKey(selected) : ''} disabled={disabled || !options.length}
      onChange={event => onChange(options.find(option => pointKey(option.point) === event.target.value)?.point ?? null)}>
      <option value="">{options.length ? '按方位选择位置' : '没有可用位置'}</option>
      {directions.map(direction => {
        const group = options.filter(option => directionFrom(origin, option.point) === direction);
        return group.length > 0 && <optgroup key={direction} label={direction}>
          {group.map(option => <option key={pointKey(option.point)} value={pointKey(option.point)}>{option.label}</option>)}
        </optgroup>;
      })}
    </select>
  </label>;
}

export default function BattleStage({ battle, onAction, onSettle, error, sceneImage, tools, impact }: Props) {
  const actor = getCurrentActor(battle);
  const pending = battle.pendingReaction;
  const reactingActor = pending ? getDecisionActor(battle) : undefined;
  const source = battle.combatants.find(unit => unit.id === pending?.sourceId);
  const hasFinished = battle.phase !== 'active';
  const isPlayerTurn = actor?.side === 'party' && !hasFinished && !pending;
  const [panel, setPanel] = useState<Panel | null>(null);
  const [spellId, setSpellId] = useState('');
  const [slotLevel, setSlotLevel] = useState(0);
  const [potionItem, setPotionItem] = useState('');
  const [targetId, setTargetId] = useState('');
  const [point, setPoint] = useState<Point | null>(null);
  const panelTrigger = useRef<HTMLButtonElement | null>(null);
  const panelBody = useRef<HTMLElement | null>(null);
  const [poseCue, setPoseCue] = useState<BattleAction>();
  const cueId = poseCue && battle.processedActionIds.includes(poseCue.id) ? poseCue.id : undefined;

  useEffect(() => {
    if (panel) panelBody.current?.focus({ preventScroll: true });
  }, [panel]);

  useEffect(() => {
    if (!cueId) return;
    const timer = setTimeout(() => setPoseCue(previous => previous?.id === cueId ? undefined : previous), 900);
    return () => clearTimeout(timer);
  }, [cueId]);

  const party = battle.combatants.filter(unit => unit.side === 'party');
  const enemies = battle.combatants.filter(unit => unit.side === 'enemy');
  const activeEnemies = enemies.filter(unit => !isDead(unit) && unit.hp.current > 0);
  const nearestThreat = actor && activeEnemies.sort((a, b) => gridDistance(actor.position, a.position) - gridDistance(actor.position, b.position))[0];
  const nearestTerrain = actor && panel === 'intel' ? Object.entries(terrainNames).flatMap(([kind, name]) => {
    const terrain = battle.terrain.filter(cell => cell.type === kind)
      .sort((a, b) => gridDistance(actor.position, a) - gridDistance(actor.position, b))[0];
    if (!terrain) return [];
    const distance = gridDistance(actor.position, terrain);
    return [distance ? `${directionFrom(actor.position, terrain)}侧 ${distance} 尺有${name}` : `当前位置有${name}`];
  }) : [];

  const spells = actor ? getAvailableSpells(actor).filter(spell => spell.cost !== 'reaction') : [];
  const selectedSpell = spells.find(spell => spell.id === spellId);
  const areaSpell = panel === 'cast' && selectedSpell?.target === 'area' ? selectedSpell : undefined;
  const transfersMark = Boolean(actor?.concentration?.targetIds.length && selectedSpell && canTransferMark(battle, actor, selectedSpell));
  const freeResource = selectedSpell && freeSpellResource(selectedSpell);
  const freeUses = freeResource ? actor?.resources[freeResource] ?? 0 : 0;
  const castingOptions = selectedSpell && actor && selectedSpell.level > 0 ? [
    ...(freeResource ? [{ value: 0, label: transfersMark ? '免费转移印记' : `免费施放 · 剩余 ${freeUses} 次`, disabled: !transfersMark && freeUses === 0 }] : []),
    ...Object.entries(actor.resources.maxSpellSlots).filter(([level]) => Number(level) >= selectedSpell.level).map(([level, max]) => ({
      value: Number(level), label: `${level} 环法术位 ${actor.resources.spellSlots[Number(level)] || 0}/${max}`,
      disabled: !(actor.resources.spellSlots[Number(level)] > 0) || actor.resources.leveledSpellCast || transfersMark,
    })),
  ] : [];
  const selectedCastingOption = castingOptions.find(option => option.value === slotLevel && !option.disabled)
    ?? castingOptions.find(option => !option.disabled);
  const spellPayment = selectedCastingOption && selectedCastingOption.value > 0 ? { slotLevel: selectedCastingOption.value } : {};
  const canCast = selectedSpell && actor && (selectedSpell.cost === 'bonus' ? actor.resources.bonusAction > 0 : actor.resources.action > 0)
    && (selectedSpell.level === 0 ? selectedSpell.effect !== 'lay-on-hands' || actor.resources.layOnHands > 0 : !!selectedCastingOption);
  const spellCost = selectedSpell ? [
    costNames[selectedSpell.cost],
    selectedSpell.level > 0 ? selectedCastingOption?.label ?? '没有可用施放资源'
      : selectedSpell.effect === 'lay-on-hands' ? `圣疗池剩余 ${actor?.resources.layOnHands ?? 0} HP` : '无需法术位',
  ].join(' · ') : '';
  const potions = actor ? getHealingPotions(actor.inventory).filter(potion => potion.count > 0) : [];
  const selectedPotion = potions.find(potion => potion.item === potionItem) ?? potions[0];
  const potionCount = potions.reduce((total, potion) => total + potion.count, 0);
  const canDrink = !!selectedPotion && !!actor && actor.resources.bonusAction > 0 && actor.hp.current < actor.hp.max;

  const routes = actor && panel === 'move' ? getReachableRoutes(battle, actor.id).sort((a, b) => a.cost - b.cost) : [];
  const selectedRoute = point && routes.find(route => pointKey(route.point) === pointKey(point));
  const moveOptions = actor ? routes.map(route => ({
    point: route.point,
    label: `${describeRelativePosition(actor.position, route.point)} · 消耗 ${route.cost} 尺${route.point.x === 0 ? ' · 退路' : ''}`,
  })) : [];
  const routeTerrain = selectedRoute ? [...new Set(battle.terrain.filter(cell => cell.type !== 'wall' && selectedRoute.path.some(step => pointKey(step) === pointKey(cell))).map(cell => terrainNames[cell.type]))] : [];
  const exitRoute = actor && routes.filter(route => route.point.x < actor.position.x).sort((a, b) => a.point.x - b.point.x || a.cost - b.cost)[0];
  const threatDistance = actor && nearestThreat ? gridDistance(actor.position, nearestThreat.position) : 0;
  const threatRoutes = nearestThreat ? routes.map(route => ({ route, distance: gridDistance(route.point, nearestThreat.position) })) : [];
  const approach = threatRoutes.filter(candidate => candidate.distance < threatDistance).sort((a, b) => a.distance - b.distance || a.route.cost - b.route.cost)[0]?.route;
  const withdraw = threatRoutes.filter(candidate => candidate.distance > threatDistance).sort((a, b) => b.distance - a.distance || a.route.cost - b.route.cost)[0]?.route;

  const areaOptions: PointChoice[] = [];
  if (actor && areaSpell) {
    for (let y = 0; y < battle.height; y++) {
      for (let x = 0; x < battle.width; x++) {
        const center = { x, y };
        if (getAreaSpellError(battle, actor, areaSpell, center)) continue;
        const unit = getCombatantAt(battle, center);
        const location = describeRelativePosition(actor.position, center);
        areaOptions.push({ point: center, label: unit ? `${unit.name}所在处 · ${location}` : location });
      }
    }
    areaOptions.sort((a, b) => gridDistance(actor.position, a.point) - gridDistance(actor.position, b.point));
  }
  const selectedArea = point && areaOptions.find(option => pointKey(option.point) === pointKey(point));
  const areaTargets = areaSpell && selectedArea ? getAreaSpellTargets(battle, areaSpell, selectedArea.point) : [];
  const affectedParty = areaTargets.filter(unit => unit.side === 'party');
  const affectedEnemies = areaTargets.filter(unit => unit.side === 'enemy');

  const targetGroup = panel === 'attack' || (panel === 'cast' && selectedSpell?.target === 'enemy') ? enemies
    : panel === 'help' || (panel === 'cast' && selectedSpell?.target === 'ally') ? party : null;
  const targetRange = panel === 'attack' ? actor?.weapon.longRange ?? actor?.weapon.range ?? 0 : panel === 'help' ? 5 : selectedSpell?.range ?? 0;
  const targets = actor && targetGroup ? targetGroup.filter(unit => !isDead(unit)).map(unit => {
    const distance = gridDistance(actor.position, unit.position);
    const sight = getLineOfSight(battle, actor.position, unit.position);
    let unavailable = '';
    if (distance > targetRange) unavailable = '超出距离';
    else if (!sight.visible) unavailable = '视线受阻';
    else if (panel === 'help' && (unit.hp.current > 0 || unit.deathSaves.stable)) unavailable = '无需急救';
    else if (panel === 'cast' && selectedSpell?.effect === 'smite' && (actor.lastHitTargetId !== unit.id || !actor.weapon.melee)) unavailable = '须紧接近战命中';
    else if (panel === 'cast' && (selectedSpell?.effect === 'heal' || selectedSpell?.effect === 'lay-on-hands') && unit.hp.current >= unit.hp.max) unavailable = '生命已满';
    const rangeNote = panel === 'attack' && distance > actor.weapon.range && !unavailable ? ' · 远距离（劣势）' : '';
    const details = [distance ? `${distance} 尺` : '自身', `${unit.hp.current}/${unit.hp.max} HP`, conditionsOf(unit)];
    if (sight.cover) details.push('半掩护');
    return { unit, unavailable, label: `${unit.name} · ${details.join(' · ')}${rangeNote}${unavailable ? ` · ${unavailable}` : ''}` };
  }) : [];
  const selectedTarget = targets.find(target => target.unit.id === targetId && !target.unavailable)?.unit;
  const selfSpell = selectedSpell?.target === 'self';
  const canAttack = !!actor && (actor.resources.action > 0 || (actor.attacksRemaining ?? 0) > 0);
  const canConfirm = isPlayerTurn && (
    panel === 'move' ? !!selectedRoute
      : panel === 'attack' ? canAttack && !!selectedTarget
      : panel === 'help' ? (actor?.resources.action ?? 0) > 0 && !!selectedTarget
      : panel === 'cast' ? canCast && !!(areaSpell ? selectedArea : selfSpell || selectedTarget)
      : panel === 'use-item' && canDrink
  );

  const clearSelection = () => { setTargetId(''); setPoint(null); };
  const closePanel = () => {
    setPanel(null);
    clearSelection();
    panelTrigger.current?.focus();
  };
  const togglePanel = (next: Panel, trigger: HTMLButtonElement) => {
    panelTrigger.current = trigger;
    setPanel(panel === next ? null : next);
    clearSelection();
  };
  const send = (type: BattleAction['type'], extra: Partial<BattleAction> = {}) => {
    if (!actor || !isPlayerTurn) return;
    const action = { id: crypto.randomUUID(), type, actorId: actor.id, ...extra };
    if (!onAction(action)) return;
    if (type === 'attack' || type === 'cast') setPoseCue(action);
    closePanel();
  };
  const confirm = () => {
    if (!actor || !canConfirm) return;
    if (panel === 'move' && selectedRoute) send('move', { point: selectedRoute.point });
    if ((panel === 'attack' || panel === 'help') && selectedTarget) send(panel, { targetId: selectedTarget.id });
    if (panel === 'cast' && selectedSpell) send('cast', {
      spellId: selectedSpell.id, ...spellPayment,
      ...(selectedArea ? { point: selectedArea.point } : { targetId: selfSpell ? actor.id : selectedTarget?.id }),
    });
    if (panel === 'use-item' && selectedPotion) send('use-item', { targetId: actor.id, item: selectedPotion.item });
  };
  const react = (reaction: 'accept' | 'decline', reactionSpellId?: string) => {
    if (!pending || reactingActor?.side !== 'party') return;
    onAction({ id: crypto.randomUUID(), type: 'react', actorId: pending.actorId, reaction, spellId: reactionSpellId });
  };
  const outcome = battle.phase === 'victory' ? '战斗胜利' : battle.phase === 'defeat' ? '队伍败北' : '已撤离';
  const status = hasFinished ? outcome : pending ? reactingActor?.side === 'enemy' ? '敌方反应中' : '等待你的反应'
    : isPlayerTurn ? `${actor?.name}的回合` : '敌方行动中';
  const decisionActor = reactingActor ?? actor;
  const enemyActingId = !hasFinished && decisionActor?.side === 'enemy' ? decisionActor.id : undefined;
  const shownCue = cueId ? poseCue : undefined;
  const cueTarget = shownCue?.targetId && enemies.find(unit => unit.id === shownCue.targetId);
  const currentImpact = impact?.battleId === battle.id ? impact : undefined;
  const partyLead = (reactingActor?.side === 'party' ? reactingActor : source?.side === 'party' ? source : undefined)
    ?? party.find(unit => currentImpact?.hp[unit.id])
    ?? (actor?.side === 'party' ? actor : undefined) ?? party.find(unit => unit.hp.current > 0) ?? party[0];
  const enemyLead = (selectedTarget?.side === 'enemy' ? selectedTarget : undefined)
    ?? (reactingActor?.side === 'enemy' ? reactingActor : source?.side === 'enemy' ? source : undefined)
    ?? (cueTarget || undefined) ?? enemies.find(unit => currentImpact?.hp[unit.id])
    ?? (actor?.side === 'enemy' ? actor : undefined) ?? nearestThreat ?? enemies[0];
  const lastResult = battle.log.findLast(entry => !entry.text.endsWith('（同值按编队顺序）'));

  return (
    <section className={styles.shell} aria-label="回合制遭遇" onKeyDown={event => {
      if (panel && event.key === 'Escape' && !event.defaultPrevented) closePanel();
    }}>
      {sceneImage && <Image key={sceneImage} className={styles.scenery} src={sceneImage} alt="" fill unoptimized fetchPriority="high" onError={event => { event.currentTarget.hidden = true; }} />}
      <div className={styles.top}>
        <header className={styles.heading}>
          <div><span className={styles.eyebrow}>战斗遭遇</span><h1>{battle.title}</h1></div>
          <div className={styles.turnStatus}>
            <span className={styles.round}>第 <b>{String(battle.round).padStart(2, '0')}</b> 轮</span>
            <span className={styles.status} role="status">{status}</span>
            {tools}
          </div>
        </header>

        <div className={styles.initiative}>
          <div className={styles.railLabel} aria-hidden="true">先攻</div>
          <ol className={styles.rail} aria-label="先攻顺序" tabIndex={0}>
            {battle.initiative.map((id, index) => {
              const unit = battle.combatants.find(candidate => candidate.id === id);
              if (!unit) return null;
              const current = index === battle.turnIndex && !hasFinished;
              return <li key={id} aria-current={current ? 'step' : undefined} data-side={unit.side} data-fallen={unit.hp.current <= 0}>
                <span className={styles.railNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <CombatPortrait unit={unit} thumbnail />
                <div><strong>{unit.name}</strong><small>{unit.hp.current <= 0 ? (unit.side === 'enemy' ? '已击败' : conditionsOf(unit)) : `${unit.hp.current}/${unit.hp.max} HP`}</small></div>
              </li>;
            })}
          </ol>
        </div>
      </div>

      <section className={styles.faceoff} aria-label="遭遇现场">
        {partyLead && <FeaturedCombatant unit={partyLead} label="我方" current={!hasFinished && partyLead.id === actor?.id}
          acting={partyLead.id === shownCue?.actorId} impact={currentImpact} />}
        <div className={styles.matchup}>
          <svg viewBox="0 0 32 32" fill="none" focusable="false" aria-hidden="true">
            <path d="M7 6l6 2 12 14-3 3L8 13 7 6Zm18 0-6 2-3 4m-4 5-5 5 3 3 5-5m-8 0 5 5m8-5 5 5M5 27l3-3m16 0 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {partyLead && enemyLead && <span><span className="sr-only">对峙距离 </span>{gridDistance(partyLead.position, enemyLead.position)} 尺</span>}
        </div>
        {enemyLead && <FeaturedCombatant unit={enemyLead} label="敌方" current={!hasFinished && enemyLead.id === actor?.id}
          acting={enemyLead.id === enemyActingId} impact={currentImpact} />}
      </section>

      <div className={styles.dock} role="region" aria-label="战斗操作">
        <div className={styles.resultStrip} role="status" data-kind={lastResult?.kind}>
          <span className={styles.resultType}><span aria-hidden="true">◆</span> {lastResult ? logNames[lastResult.kind] : '战斗记录'}</span>
          <p>{lastResult ? displayBattleLog(lastResult.text) : '先攻已确定，暂无行动记录。'}</p>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}

        {pending && reactingActor?.side === 'party' && <section className={`reaction-prompt ${styles.reaction}`} aria-live="assertive" aria-label="选择反应">
          <div>
            <span className={styles.eyebrow}>反应时机</span><h2>{reactingActor.name}可以反应</h2>
            <p>{pending.kind === 'opportunity' ? `${source?.name ?? '敌人'}正在离开近战范围。是否进行借机攻击？` : `${source?.name ?? '敌人'}的攻击即将命中。是否消耗反应进行防御？`}</p>
            <small>反应在角色下回合开始时恢复。护盾术同时消耗法术位。</small>
          </div>
          <div className="reaction-buttons">
            <button type="button" className="battle-button primary" onClick={() => react('accept')}>
              {pending.kind === 'opportunity' ? '借机攻击' : pending.kind === 'shield' ? '施放护盾术' : '直觉闪避'}
            </button>
            {pending.alternativeKinds?.includes('shield') && pending.kind !== 'shield' && <button type="button" className="battle-button" onClick={() => react('accept', 'wizard-shield')}>施放护盾术</button>}
            <button type="button" className="battle-button" onClick={() => react('decline')}>保留反应</button>
          </div>
        </section>}

        {hasFinished ? <footer className={`battle-result ${styles.outcome}`}>
          <div>
            <h2>{battle.phase === 'victory' ? '战场归于寂静' : battle.phase === 'escaped' ? '暂时脱离险境' : '这段旅途遭遇重创'}</h2>
            <p>{battle.phase === 'victory' ? `队伍奖励 · ${battle.reward.gold} 金币 · ${battle.reward.experience} 经验 · ${battle.reward.items.join('、') || '没有额外物品'}` : '生命、消耗和故事后果将保留。'}</p>
          </div>
          <button type="button" className="battle-button primary" onClick={onSettle}>结算并继续故事</button>
        </footer> : isPlayerTurn && actor ? <section className={styles.command} aria-label="当前角色行动">
          <dl className={styles.resources} aria-label="回合资源">
            <div><dt>动作</dt><dd>{actor.resources.action}</dd></div>
            <div><dt>附赠动作</dt><dd>{actor.resources.bonusAction}</dd></div>
            <div><dt>剩余移动</dt><dd>{actor.resources.movement} <small>尺</small></dd></div>
            <div><dt>反应</dt><dd>{actor.resources.reaction ? '可用' : '已用'}</dd></div>
            {Object.entries(actor.resources.maxSpellSlots).map(([level, max]) => <div key={level}><dt>{level} 环法术位</dt><dd>{actor.resources.spellSlots[Number(level)] ?? 0}/{max}</dd></div>)}
            {actor.concentration && <div><dt>专注</dt><dd>{spells.find(spell => spell.id === actor.concentration?.spellId)?.name ?? '持续法术'}</dd></div>}
          </dl>
          <div className={styles.commands} role="group" aria-label="行动类型">
            {modes.map(value => <button type="button" key={value} aria-expanded={panel === value}
              disabled={value === 'use-item' && (!potionCount || actor.resources.bonusAction <= 0)}
              className={`battle-button ${panel === value ? 'chosen' : ''}`}
              onClick={event => togglePanel(value, event.currentTarget)}>{panelLabels[value]}</button>)}
            <button type="button" className="battle-button" aria-expanded={panel === 'tactics'} onClick={event => togglePanel('tactics', event.currentTarget)}>战术动作</button>
            <button type="button" className={`battle-button ${styles.endTurn}`} onClick={() => send('end-turn')}>结束回合 <span aria-hidden="true">→</span></button>
          </div>
        </section> : reactingActor?.side !== 'party' && <p className={styles.waiting}>{reactingActor?.name ?? actor?.name ?? '敌方'}正在行动</p>}

        <div className={styles.references} role="group" aria-label="战斗详情">
          <button type="button" aria-expanded={panel === 'intel'} onClick={event => togglePanel('intel', event.currentTarget)}>战场情报</button>
          <button type="button" aria-expanded={panel === 'log'} onClick={event => togglePanel('log', event.currentTarget)}>完整战报</button>
        </div>

        {panel && <section ref={panelBody} tabIndex={-1} className={styles.popover} aria-labelledby="battle-panel-title">
          <header className={styles.popoverHeader}>
            <h2 id="battle-panel-title">{panelLabels[panel]}</h2>
            <button type="button" className="battle-button" aria-label="收起面板" onClick={closePanel}>收起 <span aria-hidden="true">↓</span></button>
          </header>
          {isPlayerTurn && actor && panel !== 'intel' && panel !== 'log' && <>
            {panel === 'cast' && <div className={styles.reserves} role="group" aria-label="职业资源">
              {spells.some(spell => spell.effect === 'mark') && <span>印记免费 {actor.resources.hunterMarkUses ?? 0} 次</span>}
              {spells.some(spell => spell.effect === 'smite') && <span>至圣斩免费 {actor.resources.divineSmiteUses ?? 0} 次</span>}
              {spells.some(spell => spell.effect === 'lay-on-hands') && <span>圣疗池 {actor.resources.layOnHands} HP</span>}
            </div>}
            {panel !== 'tactics' && <div className={styles.actionDetails}>
              {panel === 'move' && <>
                <p>选择相对方位与落点。困难地形、绕路与爬行会增加消耗。</p>
                <div className={styles.quickActions} role="group" aria-label="移动意图">
                  {approach && nearestThreat && <button type="button" className="battle-button" disabled={!isPlayerTurn} onClick={() => setPoint(approach.point)}>靠近 {nearestThreat.name}</button>}
                  {withdraw && nearestThreat && <button type="button" className="battle-button" disabled={!isPlayerTurn} onClick={() => setPoint(withdraw.point)}>拉开距离</button>}
                  {exitRoute && <button type="button" className="battle-button" disabled={!isPlayerTurn} onClick={() => setPoint(exitRoute.point)}>{exitRoute.point.x === 0 ? '移动到退路' : '靠近退路'}</button>}
                </div>
                <PositionPicker label="移动目的地" origin={actor.position} options={moveOptions} selected={selectedRoute ? selectedRoute.point : undefined} onChange={setPoint} disabled={!isPlayerTurn} />
                {selectedRoute && <p aria-live="polite">
                  {describeRelativePosition(actor.position, selectedRoute.point)}，消耗 {selectedRoute.cost} 尺移动，剩余 {actor.resources.movement - selectedRoute.cost} 尺。
                  {routeTerrain.length > 0 && ` 沿途经过${routeTerrain.join('、')}。`}
                  {nearestThreat && ` 到 ${nearestThreat.name} 的距离将变为 ${gridDistance(selectedRoute.point, nearestThreat.position)} 尺。`}
                </p>}
                {routes.length === 0 && <p>当前没有可达落点。{actor.conditions.some(condition => condition.name === 'restrained') ? '束缚会阻止移动。' : '动作可用时，可以疾走增加移动距离。'}</p>}
              </>}

              {panel === 'attack' && <p>{actor.weapon.name} · 射程 {actor.weapon.range} 尺{actor.weapon.longRange ? `，远距离上限 ${actor.weapon.longRange} 尺` : ''}。{(actor.attacksRemaining ?? 0) > 0 ? '可追加一次攻击。' : '攻击消耗动作。'}</p>}
              {panel === 'help' && <p>救助 5 尺内尚未稳定的倒地队友，消耗一个动作。</p>}
              {panel === 'cast' && <>
                {spells.length === 0 ? <p>当前没有主动施放的能力。游荡者满足条件时会随武器攻击结算偷袭。</p> : <label className={styles.field}>
                  <span>能力</span>
                  <select value={selectedSpell?.id ?? ''} disabled={!isPlayerTurn} onChange={event => {
                    setSpellId(event.target.value); setSlotLevel(0); clearSelection();
                  }}>
                    <option value="">选择法术或职业能力</option>
                    {spells.map(spell => <option key={spell.id} value={spell.id}>{spell.name} · {costNames[spell.cost]}{spell.level ? ` · ${spell.level} 环` : ''}</option>)}
                  </select>
                </label>}
                {selectedSpell && selectedSpell.level > 0 && <label className={styles.field}>
                  <span>施放资源</span>
                  <select value={selectedCastingOption?.value ?? ''} disabled={!isPlayerTurn} onChange={event => setSlotLevel(Number(event.target.value))}>
                    {!selectedCastingOption && <option value="" disabled>没有可用施放资源</option>}
                    {castingOptions.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
                  </select>
                </label>}
                {selectedSpell && <p>{selectedSpell.description} · {spellCost} · {selectedSpell.range} 尺{selectedSpell.concentration ? ' · 需要专注' : ''}</p>}
                {areaSpell && <>
                  <PositionPicker label="法术落点" origin={actor.position} options={areaOptions} selected={selectedArea ? selectedArea.point : undefined} onChange={setPoint} disabled={!isPlayerTurn} />
                  {selectedArea && <p aria-live="polite" className={affectedParty.length > 0 ? styles.friendlyFire : undefined}>
                    {affectedEnemies.length ? `预计波及敌方 ${affectedEnemies.map(unit => unit.name).join('、')}。` : '影响范围内没有敌人。'}
                    {affectedParty.length > 0 ? ` 己方也在范围内 · ${affectedParty.map(unit => unit.name).join('、')}。` : ' 己方不在范围内。'}
                  </p>}
                </>}
              </>}

              {targetGroup && <label className={styles.field}>
                <span>{panel === 'help' ? '救助目标' : '行动目标'}</span>
                <select value={selectedTarget?.id ?? ''} disabled={!isPlayerTurn || !targets.length} onChange={event => setTargetId(event.target.value)}>
                  <option value="">{targets.some(target => !target.unavailable) ? '按名称选择目标' : '没有可用目标'}</option>
                  {targets.map(target => <option key={target.unit.id} value={target.unit.id} disabled={!!target.unavailable}>{target.label}</option>)}
                </select>
              </label>}

              {panel === 'use-item' && <>
                {potions.length > 1 && <label className={styles.field}><span>药水</span>
                  <select value={selectedPotion?.item ?? ''} disabled={!isPlayerTurn} onChange={event => setPotionItem(event.target.value)}>
                    {potions.map((potion, index) => <option key={`${potion.item}-${index}`} value={potion.item}>{potion.item}</option>)}
                  </select>
                </label>}
                <p>{selectedPotion ? `${selectedPotion.item} · 共 ${potionCount} 瓶 · 自身恢复 2d4+2 HP · 消耗 1 瓶及附赠动作。${actor.hp.current >= actor.hp.max ? ' 当前生命已满。' : ''}` : '没有可用治疗药水。'}</p>
              </>}
            </div>}

            {panel === 'tactics' && <div className={styles.tactics} role="group" aria-label="战术动作">
              {actor.conditions.some(condition => condition.name === 'prone') && <button type="button" disabled={!isPlayerTurn || actor.resources.movement < Math.floor(actor.speed / 2) || actor.conditions.some(condition => condition.name === 'restrained')} onClick={() => send('move', { point: actor.position })}>起身 · 半数速度</button>}
              {([['dash', '疾走'], ['disengage', '脱离近战'], ['dodge', '闪避'], ['hide', '躲藏']] as const).map(([type, label]) => <button type="button" key={type} disabled={!isPlayerTurn || actor.resources.action <= 0} onClick={() => send(type)}>{label}</button>)}
              {classKey(actor.class) === 'rogue' && actor.level >= 2 && <><span>灵巧动作</span>
                {([['dash', '疾走'], ['disengage', '脱离近战'], ['hide', '躲藏']] as const).map(([type, label]) => <button type="button" key={`bonus-${type}`} disabled={!isPlayerTurn || actor.resources.bonusAction <= 0} onClick={() => send(type, { useBonusAction: true })}>{label}（附赠）</button>)}
              </>}
              {actor.position.x === 0 && <button type="button" disabled={!isPlayerTurn} onClick={() => send('escape')}>确认带队撤离</button>}
            </div>}

            {panel !== 'tactics' && <div className={styles.confirmation}>
              <button type="button" className="battle-button primary" disabled={!canConfirm} onClick={confirm}>
                {panel === 'move' ? '确认移动' : panel === 'attack' ? '确认攻击' : panel === 'cast' ? '确认施放' : panel === 'help' ? '确认救助' : '确认饮用 · 附赠动作'}
              </button>
            </div>}
          </>}

          {panel === 'log' && <ol className={styles.journal} aria-label="战斗结算记录">
            {battle.log.map(entry => <li key={entry.id} data-kind={entry.kind}><small>第 {entry.round} 轮</small>{displayBattleLog(entry.text)}</li>)}
          </ol>}

          {panel === 'intel' && <div className={styles.intel}>
            {actor && <p className={styles.perspective}>距离以 {actor.name} 为参照。{actor.position.x === 0 ? '已到达西侧退路。' : `西侧退路相距 ${actor.position.x * 5} 尺。`}</p>}
            {nearestTerrain.length > 0 && <ul className={styles.terrain} aria-label="附近地形">
              {nearestTerrain.map(description => <li key={description}>{description}</li>)}
            </ul>}
            <div className={styles.roster}>
              <h3>敌方状态</h3>
              <ul aria-label="敌方状态">
                {enemies.map(unit => {
                  const distance = actor ? gridDistance(actor.position, unit.position) : undefined;
                  const sight = actor ? getLineOfSight(battle, actor.position, unit.position) : undefined;
                  return <li key={unit.id} data-side="enemy">
                    <CombatPortrait unit={unit} thumbnail />
                    <div><strong>{unit.name}</strong><small>{unit.hp.current <= 0 ? '已击败' : conditionsOf(unit)}</small>
                      {unit.hp.current > 0 && actor && <small>{distance ? `${directionFrom(actor.position, unit.position)}侧 · ${distance} 尺` : '当前行动者'}
                        {sight && actor.id !== unit.id && ` · ${!sight.visible ? '视线受阻' : sight.cover ? '半掩护' : '视线通畅'}`}
                      </small>}
                    </div>
                    <span className={styles.rosterVitals}>HP {unit.hp.current}/{unit.hp.max}</span>
                  </li>;
                })}
              </ul>
              <h3>队伍状态</h3>
              <ul aria-label="队伍状态">
                {party.map(unit => <li key={unit.id} data-side="party">
                  <CombatPortrait unit={unit} thumbnail />
                  <div><strong>{unit.name}</strong><small>{unit.class} · 等级 {unit.level} · {conditionsOf(unit)}</small>
                    {unit.hp.current === 0 && !isDead(unit) && <small>死亡豁免 · 成功 {unit.deathSaves.successes} / 失败 {unit.deathSaves.failures}{unit.deathSaves.stable ? ' · 已稳定' : ''}</small>}
                  </div>
                  <span className={styles.rosterVitals}>HP {unit.hp.current}/{unit.hp.max}<small>AC {unit.ac}</small></span>
                </li>)}
              </ul>
            </div>
          </div>}
        </section>}
      </div>
    </section>
  );
}
