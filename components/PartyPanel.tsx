'use client';

import type { Combatant } from '@/lib/combat/types';
import { getAvailableSpells, LEVEL_EXPERIENCE } from '@/lib/combat/catalog';
import { createPartyMember } from '@/lib/combat/engine';
import { createDefaultCharacter, getModifier } from '@/lib/types';
import { PLAYER_CHARACTERS } from '@/lib/characterAssets';
import { heroPortrait } from '@/lib/heroPortraits';
import { appearanceFor } from '@/lib/appearance';
import CharacterAvatarRenderer from './CharacterAvatarRenderer';

interface Props {
  party: Combatant[]; locked: boolean; busy: boolean; elapsedMinutes: number;
  onChange: (party: Combatant[]) => void; onRest: (kind: 'short' | 'long') => void;
}

export default function PartyPanel({ party, locked, busy, elapsedMinutes, onChange, onRest }: Props) {
  return <section className="party-panel" aria-label="队伍编成与休息">
    <div className="party-panel-heading"><div><span className="battle-kicker">冒险小队 · {party.length} / 4</span><h2>共同踏上旅途</h2></div><p>{locked ? '战役中保留队伍身份与资源；返回整备后可重新编队。' : '第一位角色是叙事主角，你将控制队伍中每个人的战斗回合。'}</p></div>
    <div className="party-member-grid">{party.map((member, index) => <article className="party-member" key={member.id}>
      <div className="unit-card-title"><CharacterAvatarRenderer characterId={member.portraitId} imageUrl={heroPortrait(member)} layers={appearanceFor(member)} name={member.name} size="lg" /><div><strong>{member.name}</strong><small>{index === 0 ? '主角 · ' : ''}{member.race} · {member.class} · 等级 {member.level}</small></div></div>
      <p className="unit-hp"><span>HP {member.hp.current}/{member.hp.max}</span><span>AC {member.ac}</span></p>
      <meter min={0} max={member.hp.max} value={member.hp.current} aria-label={`${member.name}生命值`} />
      <div className="member-resources"><span>经验 {member.experience}</span><span>生命骰 {member.resources.hitDice}/{member.resources.maxHitDice}</span></div>
      <p className="member-slots">{Object.entries(member.resources.maxSpellSlots).length ? Object.entries(member.resources.maxSpellSlots).map(([level, max]) => `${level}环 ${member.resources.spellSlots[Number(level)] ?? 0}/${max}`).join(' · ') : '无可用法术位'}</p>
      <details className="member-spells">
        <summary>随身物品与状态</summary>
        <p>金币 {member.gold ?? 50}{member.hunger !== undefined && ` · 饱腹 ${member.hunger}%`}{member.fatigue !== undefined && ` · 疲劳 ${member.fatigue}%`}</p>
        <p>{member.inventory.join('、') || '背包空空'}</p>
        {Boolean(member.buffs?.length) && <p>状态 · {member.buffs?.join('、')}</p>}
      </details>
      <details className="member-spells"><summary>可用法术与能力（{getAvailableSpells(member).length}）</summary>{getAvailableSpells(member).map(spell => <p key={spell.id}><strong>{spell.name}</strong> · {({ action: '动作', bonus: '附赠动作', reaction: '反应' })[spell.cost]}{spell.level > 0 ? ` · ${spell.level}环` : ''}<span>{spell.description}</span></p>)}<small>战斗中在行动栏选择施放。</small></details>
      {!locked && <div className="member-edit"><label>起始等级 <select value={member.level} onChange={e => {
        const level = Number(e.target.value);
        const con = getModifier(member.attributes.con);
        const hitDie = member.class === '法师' ? 6 : member.class === '游荡者' ? 8 : 10;
        const max = Math.max(level, hitDie + con + (level - 1) * (hitDie / 2 + 1 + con));
        const updated = createPartyMember({ ...member, level, hp: { current: max, max } });
        updated.experience = LEVEL_EXPERIENCE[level];
        onChange(party.map(c => c.id === member.id ? updated : c));
      }}>{[1, 2, 3, 4, 5].map(level => <option key={level} value={level}>{level}</option>)}</select></label><button type="button" disabled={party.length <= 1} onClick={() => onChange(party.filter(c => c.id !== member.id))}>移出队伍</button></div>}
    </article>)}</div>
    {!locked && <div className="add-members"><span>招募同伴</span>{PLAYER_CHARACTERS.map(preset => <button type="button" key={preset.id} disabled={party.length >= 4 || party.some(p => p.portraitId === preset.id)} onClick={() => onChange([...party, createPartyMember({ ...createDefaultCharacter(preset.id), id: crypto.randomUUID() })])}>{preset.name}</button>)}</div>}
    <div className="rest-controls"><div><strong>扎营与恢复</strong><p>短休消耗可用生命骰恢复体力；长休恢复相应资源。死亡角色不会因休息复活。</p><small>旅途经过 {Math.floor(elapsedMinutes / 60)} 小时 {elapsedMinutes % 60} 分钟</small></div><button type="button" className="battle-button" disabled={busy} onClick={() => onRest('short')}>短休 · 1小时</button><button type="button" className="battle-button" disabled={busy} onClick={() => onRest('long')}>长休 · 8小时</button></div>
  </section>;
}
