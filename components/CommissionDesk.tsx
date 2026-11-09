'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPresetScript, type PresetKey } from '@/lib/scripts';
import type { Script } from '@/lib/types';
import { COMMISSIONS, sceneImage, sceneKey } from '@/lib/tavernScenes';
import { EILEEN_COMMISSION_LINES, EILEEN_GREETINGS } from '@/lib/eileenLines';
import VoiceButton from './VoiceButton';
import styles from './TavernArrival.module.css';

export type Commission = { script: Script; preset?: PresetKey };

export function presetCommission(preset: PresetKey): Commission {
  return { script: createPresetScript(preset), preset };
}

interface Props {
  selection: Commission | null;
  scripts: Script[];
  activeCampaign: boolean;
  onSelect: (selection: Commission | null) => void;
  onAccept: (script: Script) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function CommissionDesk({ selection, scripts, activeCampaign, onSelect, onAccept, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [error, setError] = useState('');
  const script = selection?.script;
  const intro = selection?.preset ? COMMISSIONS.find(preset => preset.key === selection.preset)?.teaser : script?.description;
  const scene = sceneKey(script ?? null);
  const cover = selection?.preset === 'tavern' ? '/scenes/tavern-bar.webp'
    : scene !== 'tavern' ? sceneImage(scene) : '/scenes/tavern-board.webp';
  const brief = intro?.trim().slice(0, 420) || '委托的详细情形会在出发后由老汤姆介绍。';
  const line = selection?.preset ? EILEEN_COMMISSION_LINES[selection.preset]
    : script ? `给，这是《${script.title}》的委托。${brief}准备好后，我就把它交给老汤姆。` : EILEEN_GREETINGS.board;

  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  useEffect(() => { heading.current?.focus(); }, [script?.id]);

  const select = (commission: Commission | null) => {
    setError('');
    onSelect(commission);
  };

  const accept = (script: Script) => {
    try { onAccept(script); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '未能保存，请再试一次。'); }
  };

  return <dialog ref={dialog} className={styles.desk} aria-labelledby="commission-title" onClose={onClose}>
    <div className={styles.deskFrame}>
      <div className={styles.deskTop}>
        <span>流浪者之憩 · 委托墙</span>
        <button type="button" className="battle-button" onClick={() => dialog.current?.close()}>关闭委托</button>
      </div>
      <div className={styles.deskGrid}>
        <div className={styles.hostPortrait} aria-hidden="true"><Image src="/characters/eileen-letter.webp" alt="" fill sizes="(max-width: 700px) 30vw, 34vw" /></div>
        <section className={styles.letter}>
          {script && <button type="button" className={styles.back} onClick={() => select(null)}>← 返回委托墙</button>}
          <h2 id="commission-title" ref={heading} tabIndex={-1}>{script?.title || '今晚想去哪里？'}</h2>
          {script ? <>
            <div className={styles.window} role="img" aria-label={`${script.title}的场景插画`}
              style={{ '--commission-image': `url("${cover}")` } as CSSProperties} />
            <p className={styles.brief}>{brief}</p>
            {activeCampaign && <p className={styles.notice}>出发会开启新战役。你可以先保存当前进度。</p>}
            <div className={styles.deskActions}>
              <button type="button" className="battle-button primary" onClick={() => accept(script)}>接受委托，出发</button>
              {activeCampaign && <button type="button" className="battle-button" onClick={onSave}>先保存进度</button>}
            </div>
            {error && <p className={styles.notice} role="alert">{error}</p>}
          </> : <>
            <p className={styles.brief}>先挑一份委托。艾琳会拿来一封信，告诉你那边发生了什么。</p>
            <div className={styles.commissionList}>
              {COMMISSIONS.map(preset => <button type="button" key={preset.key} onClick={() => select(presetCommission(preset.key))}>{preset.title}<span aria-hidden="true">↗</span></button>)}
            </div>
            {scripts.length > 0 && <details className={styles.workshop}>
              <summary>工坊剧本（{scripts.length}）</summary>
              <div className={styles.commissionList}>{scripts.map(custom => <button type="button" key={custom.id} onClick={() => select({ script: custom })}>{custom.title}<span aria-hidden="true">↗</span></button>)}</div>
            </details>}
            <Link href="/scripts" className={styles.back}>前往剧本工坊</Link>
          </>}
          <VoiceButton key={script?.id} className={styles.voice} line={line} />
        </section>
      </div>
    </div>
  </dialog>;
}
