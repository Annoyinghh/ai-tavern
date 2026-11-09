import Image from 'next/image';
import Link from 'next/link';
import { EILEEN_GREETINGS } from '@/lib/eileenLines';
import { TIME_LABELS, type GameTime, type TimeOfDay } from '@/lib/types';
import VoiceButton from './VoiceButton';
import styles from './TavernArrival.module.css';

export default function TavernArrival({ greeting, voicePaused = false, activeCampaign, commissionLocked, gameTime, onTimeChange, onCommission, onGuide, onParty, onBar }: {
  greeting: boolean;
  voicePaused?: boolean;
  activeCampaign: boolean;
  commissionLocked: boolean;
  gameTime: GameTime;
  onTimeChange: (time: TimeOfDay) => void;
  onCommission: () => void;
  onGuide: () => void;
  onParty: () => void;
  onBar: () => void;
}) {
  const line = greeting ? EILEEN_GREETINGS.welcome : EILEEN_GREETINGS.return;
  return <section className={styles.arrival} aria-labelledby="tavern-arrival-title">
    <div className={styles.arrivalContent}>
      <span className={styles.eyebrow}>酒馆吧台 · 第 {gameTime.day} 天</span>
      <h1 id="tavern-arrival-title">流浪者之憩</h1>
      <div className={styles.hostNames}>艾琳 · 酒馆接待 <span aria-hidden="true">/</span> 老汤姆 · 掌柜与主持</div>
      <p>{line}</p>
      <div className={styles.deskActions}>
        {activeCampaign && <Link className="battle-button primary" href="/game">继续战役</Link>}
        <button type="button" className={`battle-button${activeCampaign ? '' : ' primary'}`} disabled={commissionLocked} onClick={onCommission}>去看委托</button>
        <button type="button" className="battle-button" onClick={onGuide}>{greeting ? '跟艾琳练一遍' : '新手指引'}</button>
      </div>
      <div className={styles.arrivalLinks}><button type="button" onClick={onBar}>和老汤姆聊聊</button><button type="button" onClick={onParty}>{activeCampaign ? '查看队伍' : '整备队伍'}</button><Link href="/character#hero-build">编辑英雄</Link><Link href="/scripts">剧本工坊</Link>
        {!voicePaused && <VoiceButton line={line} />}
      </div>
      <label className={styles.time}>酒馆时辰 <select value={gameTime.timeOfDay} disabled={activeCampaign} onChange={event => onTimeChange(event.target.value as TimeOfDay)}>{Object.entries(TIME_LABELS).map(([time, label]) => <option key={time} value={time}>{label}</option>)}</select></label>
    </div>
    <div className={styles.hosts}>
      <button type="button" className={styles.tomPortrait} onClick={onBar} aria-label="到吧台找老汤姆">
        <Image src="/characters/old_tom.png" alt="" fill sizes="(max-width: 700px) 26vw, 21vw" />
      </button>
      <button type="button" className={styles.arrivalPortrait} onClick={onGuide} aria-label="找艾琳打开新手指引">
        <Image src="/characters/eileen-wave.webp" alt="" fill sizes="(max-width: 700px) 48vw, 34vw" />
      </button>
    </div>
  </section>;
}
