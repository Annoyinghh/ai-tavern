'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { EXPLORATION_OUTCOME_LABELS, getExplorationOutcome } from '@/lib/checks';
import { rollDie } from '@/lib/dice';
import { playDialogueVoice } from '@/lib/voicePlayer';
import { EILEEN_LESSONS } from '@/lib/eileenLines';
import styles from './BeginnerGuide.module.css';

const lessons = [
  {
    id: 'commission',
    label: '开局',
    title: '先领一份委托',
    pose: 'letter',
    voice: EILEEN_LESSONS.letter,
  },
  {
    id: 'dialogue',
    label: '探索',
    title: '听完故事，再做选择',
    pose: 'quill',
    voice: EILEEN_LESSONS.dialogue,
  },
  {
    id: 'check',
    label: '检定',
    title: '让骰子决定结果',
    pose: 'dice',
    voice: EILEEN_LESSONS.dice,
  },
  {
    id: 'battle',
    label: '战斗',
    title: '靠近目标，再出手',
    pose: 'wave',
    voice: EILEEN_LESSONS.combat,
  },
  {
    id: 'save',
    label: '存档',
    title: '把这一程记进册子',
    pose: 'book',
    voice: EILEEN_LESSONS.save,
  },
] as const;

type LessonId = typeof lessons[number]['id'];

const checkDifficulty = 13;
const checkBonus = 2;
const checkConsequences = {
  crit_success: '你找到暗门，还发现了刻在门框上的公会徽记。',
  success: '你察觉风从书架后吹来，找到了暗门。',
  failure: '你没找到机关，只好绕去另一条路。',
  crit_failure: '你碰倒了一排空瓶，惊动了门后的守卫。',
};

function Portrait({ pose }: { pose: string }) {
  const [useFallback, setUseFallback] = useState(false);

  return (
    <Image
      alt=""
      src={useFallback ? '/characters/eileen.png' : `/characters/eileen-${pose}.webp`}
      fill
      loading="eager"
      unoptimized
      className={styles.portrait}
      onError={() => setUseFallback(true)}
    />
  );
}

function Practice({ lesson }: { lesson: LessonId }) {
  const practiceRef = useRef<HTMLDivElement>(null);
  const [beat, setBeat] = useState(0);
  const [roll, setRoll] = useState<number | null>(null);
  const next = () => setBeat(value => value + 1);

  useEffect(() => {
    if (beat === 0 && roll === null) return;
    if (document.activeElement !== document.body || !practiceRef.current) return;
    const control = practiceRef.current.querySelector('button') ?? practiceRef.current;
    control.focus();
  }, [beat, roll]);

  if (lesson === 'commission') {
    return (
      <div ref={practiceRef} tabIndex={-1} className={styles.practiceBody}>
        <div className={styles.paper}>
          <span className={styles.paperKicker}>流浪者之憩 · 委托 01</span>
          <strong>迷雾悬案</strong>
          <span>雨夜小镇 · 调查与交涉</span>
          {beat > 0 && <span className={styles.seal} aria-hidden="true">受理</span>}
        </div>
        {beat > 0 ? (
          <p role="status" className={styles.result}>委托已受理。你与队友一同出发。</p>
        ) : (
          <button type="button" className={styles.action} onClick={next}>盖章接受委托</button>
        )}
      </div>
    );
  }

  if (lesson === 'dialogue') {
    return (
      <div ref={practiceRef} tabIndex={-1} className={styles.practiceBody}>
        <p aria-live="polite" className={styles.story}>
          <small>雨夜小镇 · 药铺门外</small>
          {beat === 0 && '雨越下越密，你在药铺门前停下脚步。'}
          {beat === 1 && '窗里还亮着灯，紧闭的门后传来拖动木箱的声音。'}
          {beat === 2 && '你在门口站定。你打算怎么做？'}
          {beat === 3 && '你贴近门缝，听见有人低声提到「旧码头」。'}
          {beat === 4 && '药师把门推开一条缝，请你进屋避雨。'}
        </p>
        {beat <= 2 && <div className={styles.actionRow}>
          <button type="button" className={styles.action} onClick={next}>{beat < 2 ? '点击继续对白' : '先听听动静'}</button>
          <button type="button" className={styles.quiet} onClick={() => setBeat(beat < 2 ? 2 : 4)}>{beat < 2 ? '快进至选项' : '敲门表明来意'}</button>
        </div>}
        {beat > 2 && <p className={styles.result}>故事已沿着你的选择推进。</p>}
      </div>
    );
  }

  if (lesson === 'check') {
    const total = roll === null ? null : roll + checkBonus;
    const outcome = total === null ? null : getExplorationOutcome(total, checkDifficulty);

    return (
      <div ref={practiceRef} tabIndex={-1} className={styles.practiceBody}>
        <div className={styles.check} aria-live="polite">
          <span key={roll ?? 'ready'} className={styles.die} data-rolled={roll !== null}>{roll ?? 'D20'}</span>
          <span>+ {checkBonus}{total !== null && ` = ${total}`}</span>
          <span className={styles.difficulty}>DC {checkDifficulty}</span>
        </div>
        {outcome && <p role="status" className={styles.result}>
          <strong>{EXPLORATION_OUTCOME_LABELS[outcome]}</strong> · {checkConsequences[outcome]}
        </p>}
        {roll === null && <button type="button" className={styles.action} onClick={() => setRoll(rollDie(20))}>掷 D20</button>}
        {roll !== null && beat === 0 && <button type="button" className={styles.action} onClick={next}>确认判定并推进剧情</button>}
        {beat > 0 && <p role="status" className={styles.completion}>✓ 已确认本次判定</p>}
      </div>
    );
  }

  if (lesson === 'battle') {
    const distance = beat === 0 ? 15 : 5;
    const heroHp = beat === 5 ? 9 : 12;
    const enemyHp = beat >= 4 ? 4 : 9;

    return (
      <div ref={practiceRef} tabIndex={-1} className={styles.practiceBody}>
        <div className={styles.initiative} aria-label="先攻顺序">
          <span>先攻</span>
          <strong aria-current={beat < 5 ? 'true' : undefined}>① 你 · 16</strong>
          <strong aria-current={beat === 5 ? 'true' : undefined}>② 匪徒 · 11</strong>
        </div>
        <div className={styles.battleMap} data-moved={beat > 0} aria-hidden="true">
          <span className={styles.heroToken}>你</span>
          <span className={styles.enemyToken} data-hit={beat === 4}>匪</span>
        </div>
        <p role="status" className={styles.battleStatus}>距离 {distance} 尺 · 你 {heroHp}/12 HP · 匪徒 {enemyHp}/9 HP</p>
        <div className={styles.actionRow}>
          {beat === 0 && <button type="button" className={styles.action} onClick={next}>移动 10 尺，靠近匪徒</button>}
          {beat === 1 && <button type="button" className={styles.action} onClick={next}>武器攻击</button>}
          {beat === 2 && <button type="button" className={styles.action} onClick={next}>选择目标 · 匪徒</button>}
          {beat === 3 && <button type="button" className={styles.action} onClick={next}>确认攻击 · 匪徒</button>}
          {beat === 4 && <button type="button" className={styles.action} onClick={next}>结束回合</button>}
        </div>
        {beat >= 4 && <p role="status" className={styles.result}>
          {beat === 4 ? '攻击命中。匪徒损失 5 HP。' : '匪徒自动反击，你损失 3 HP。'}
        </p>}
      </div>
    );
  }

  return (
    <div ref={practiceRef} tabIndex={-1} className={styles.practiceBody}>
      <div className={`${styles.paper} ${styles.ledger}`}>
        <span className={styles.paperKicker}>冒险日志 · 示例</span>
        <strong>{beat === 0 ? '练习进度' : '迷雾悬案 · 药铺门外'}</strong>
        <span>{beat === 0 ? '进度自动保存' : '自动存档 · 已记录'}</span>
      </div>
      {beat === 0 && <button type="button" className={styles.action} onClick={next}>打开示例存档</button>}
      {beat === 1 && <button type="button" className={styles.action} onClick={next}>演练导出当前进度</button>}
      {beat === 2 && <p role="status" className={styles.result}>✓ 已模拟生成 JSON 备份。正式冒险中，这一步会下载存档文件。</p>}
    </div>
  );
}

export default function BeginnerGuide({ onClose }: {
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const playbackRef = useRef<AbortController | null>(null);
  const titleId = useId();
  const [step, setStep] = useState(0);
  const [replay, setReplay] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [unavailableLesson, setUnavailableLesson] = useState('');
  const current = lessons[step];
  const lessonKey = `${current.id}:${replay}`;
  const isLast = step === lessons.length - 1;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    playbackRef.current = controller;
    const timer = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      setSpeaking(true);
      void playDialogueVoice('eileen', current.voice, {
        signal: controller.signal, recordingOnly: true, onUnavailable: () => setUnavailableLesson(lessonKey),
      }).finally(() => {
        if (!controller.signal.aborted) setSpeaking(false);
      });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [current.voice, lessonKey]);

  const stopVoice = () => {
    playbackRef.current?.abort();
    setSpeaking(false);
  };
  const goTo = (index: number) => {
    if (index === step) return;
    stopVoice();
    setStep(index);
  };
  const replayLesson = () => {
    stopVoice();
    setReplay(value => value + 1);
  };
  const close = () => {
    stopVoice();
    dialogRef.current?.close();
  };

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} onCancel={stopVoice} onClose={onClose}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>流浪者之憩 / 新手指引</span>
          <h2 id={titleId}>艾琳的冒险课</h2>
        </div>
        <button type="button" className={styles.close} onClick={close} aria-label="关闭指引"><span aria-hidden="true">×</span></button>
      </header>

      <nav className={styles.chapters} aria-label="指引章节">
        {lessons.map(({ label, id }, index) => (
          <button key={id} type="button" aria-current={index === step ? 'step' : undefined} onClick={() => goTo(index)}>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{label}
          </button>
        ))}
      </nav>

      <div className={styles.lesson}>
        <div className={styles.scene}>
          <div key={lessonKey} className={styles.portraitFrame}><Portrait pose={current.pose} /></div>
          <div className={styles.characterLabel}><span>酒馆侍女</span><strong>艾琳</strong></div>
        </div>
        <div className={styles.lessonBody}>
          <div aria-live="polite" aria-atomic="true">
            <div key={lessonKey} className={styles.copy}>
              <span className={styles.kicker}>第 {step + 1} 课 / 共 {lessons.length} 课</span>
              <h3>{current.title}</h3>
              <p>{current.voice}</p>
            </div>
          </div>
          <div className={styles.practice}>
            <div className={styles.practiceHeader}>
              <span>动手试试</span>
              <small>酒馆练习桌</small>
            </div>
            <Practice key={lessonKey} lesson={current.id} />
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.voiceControls}>
          <button type="button" className={styles.quiet} onClick={replayLesson}>↻ 重播本课</button>
          <button type="button" className={styles.quiet} aria-disabled={!speaking} onClick={() => { if (speaking) stopVoice(); }}>
            停止讲解
          </button>
          {unavailableLesson === lessonKey && <small role="status">配音暂不可用。</small>}
        </div>
        <div>
          <button type="button" className={styles.quiet} disabled={step === 0} onClick={() => goTo(step - 1)}>上一步</button>
          <button type="button" className={styles.action} onClick={isLast ? close : () => goTo(step + 1)}>
            {isLast ? '完成练习' : '下一步'} <span aria-hidden="true">→</span>
          </button>
        </div>
      </footer>
    </dialog>
  );
}
