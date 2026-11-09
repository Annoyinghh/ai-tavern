'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AISettings } from '@/lib/types';
import { TOM_TAVERN_LINES } from '@/lib/eileenLines';
import CharacterPortraitRenderer from './CharacterPortraitRenderer';
import VoiceButton from './VoiceButton';
import styles from './TavernArrival.module.css';

const { welcome, rehearsal: localReply } = TOM_TAVERN_LINES;

export default function TavernBar({ localMode, settings, onClose }: {
  localMode: boolean;
  settings: AISettings;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<{ role: 'user' | 'assistant'; content: string }[]>([{ role: 'assistant', content: welcome }]);
  const [busy, setBusy] = useState(false);
  const reply = lines.findLast(line => line.role === 'assistant')?.content ?? welcome;

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    return () => request.current?.abort();
  }, []);

  async function talk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || request.current) return;
    const exchange = [...lines, { role: 'user' as const, content }];
    setLines(exchange);
    setInput('');
    if (localMode) {
      setLines([...exchange, { role: 'assistant', content: localReply }]);
      return;
    }
    const pending = new AbortController();
    request.current = pending;
    setBusy(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: pending.signal,
        body: JSON.stringify({ messages: exchange.slice(-8), customSettings: settings,
          systemPrompt: '你是流浪者之憩的酒馆老板老汤姆。用简短、口语化的中文和旅人聊天。此时仍在酒馆，不推动任何战役。' }),
      });
      const data = await response.json();
      if (!pending.signal.aborted) setLines([...exchange, { role: 'assistant', content: response.ok && data.content ? data.content : localReply }]);
    } catch {
      if (!pending.signal.aborted) setLines([...exchange, { role: 'assistant', content: localReply }]);
    } finally {
      request.current = null;
      if (!pending.signal.aborted) setBusy(false);
    }
  }

  return <dialog ref={dialog} className={styles.desk} aria-labelledby="tavern-bar-title" onClose={onClose}>
    <div className={`${styles.deskFrame} ${styles.barFrame}`}>
      <header className={styles.deskTop}><span>流浪者之憩 · 吧台</span><button type="button" className="battle-button" onClick={() => dialog.current?.close()}>关闭交谈</button></header>
      <div className={styles.deskGrid}>
        <div className={styles.barHost}><CharacterPortraitRenderer characterId="old_tom" size="full" pose="talk" showGlow={false} /></div>
        <section className={styles.letter}>
          <h2 id="tavern-bar-title">老汤姆</h2>
          <p className={styles.brief} role="status">{busy ? '老汤姆擦了擦手里的酒杯，正在想怎么回答。' : reply}</p>
          <form className={styles.barInput} onSubmit={talk}>
            <input aria-label="和老汤姆说话" placeholder="想跟掌柜聊点什么？" maxLength={300} value={input} onChange={event => setInput(event.target.value)} />
            <button type="submit" className="battle-button primary" disabled={busy || !input.trim()}>交谈</button>
          </form>
          {!busy && <VoiceButton key={reply} characterId="old_tom" line={reply} className={styles.voice} label="听老汤姆说" />}
        </section>
      </div>
    </div>
  </dialog>;
}
