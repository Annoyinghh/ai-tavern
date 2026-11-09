'use client';

import { useState, useEffect, useMemo, useRef, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import {
  Character, ChatMessage, ScriptChoice, CharacterExpression, TieredDCCheck, ExplorationAction, ATTRIBUTE_LABELS,
} from '@/lib/types';
import CharacterPortraitRenderer from './CharacterPortraitRenderer';
import { getCharacterConfig } from '@/lib/characterAssets';
import { heroPortrait } from '@/lib/heroPortraits';
import { appearanceFor } from '@/lib/appearance';
import { getDialogueSegments } from '@/lib/dialogue';
import { playDialogueVoice, stopDialogueVoice } from '@/lib/voicePlayer';
import { voiceFor } from '@/lib/voiceAssets';
import VoiceButton from './VoiceButton';
import { getActionCheck } from '@/lib/checks';
import ReactMarkdown from 'react-markdown';
import styles from './GalgameStage.module.css';

interface GalgameStageProps {
  playerCharacter: Character | null;
  party?: Character[];
  currentMessage: ChatMessage | null;
  choices: ScriptChoice[];
  dcCheck?: TieredDCCheck;
  requiredCheck?: boolean;
  explorationActions?: ExplorationAction[];
  isLoading: boolean;
  voicePaused?: boolean;
  autoVoice?: boolean;
  onSelectChoice: (choice: ScriptChoice) => void;
  onExecuteDCCheck?: () => void;
  onExecuteExploration?: (action: ExplorationAction) => void;
  onSendMessage: (text: string) => void;
  tools?: ReactNode;
  checking?: boolean;
  ending?: boolean;
  encounter?: { title: string; canFight: boolean; onStart: () => void };
  rewardNotice?: string;
  backgroundImage?: string | null;
  sceneTitle?: string;
  chapterTitle?: string;
}

export default function GalgameStage({
  playerCharacter,
  party,
  currentMessage,
  choices,
  dcCheck,
  requiredCheck = false,
  explorationActions,
  isLoading,
  voicePaused = false,
  autoVoice = false,
  onSelectChoice,
  onExecuteDCCheck,
  onExecuteExploration,
  onSendMessage,
  tools,
  checking = false,
  ending = false,
  encounter,
  rewardNotice,
  backgroundImage = '/scenes/tavern_background.jpg',
  sceneTitle = '「流浪者之憩」酒馆大厅',
  chapterTitle,
}: GalgameStageProps) {
  const [inputText, setInputText] = useState('');
  const [typedSegment, setTypedSegment] = useState({ key: '', text: '' });

  const handledVoiceSegment = useRef<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [segmentIndex, setSegmentIndex] = useState(0);

  const rawContent = (currentMessage?.content ?? '')
    .replace(/^【离线模式 · 本地场景续写，未调用AI】\s*[^\n]*\n+/, '');
  const segments = useMemo(() => getDialogueSegments(rawContent), [rawContent]);
  const segment = segments[segmentIndex] ?? segments[0];
  const currentSegmentText = segment?.text
    .replace(/\[\s*(?:表情|expression|emotion)\s*[:：][^\]]*\]/gi, '').trim()
    || '（当前场景沉浸中，等待你的探索与决断…）';
  const isFinalSegment = segmentIndex >= segments.length - 1;

  const playerSpeaking = currentMessage?.role === 'player';
  const speakingMember = playerSpeaking ? playerCharacter : party?.find(member => segment?.speakerName
    ? member.name.normalize('NFKC').toLowerCase() === segment.speakerName.normalize('NFKC').toLowerCase()
    : Boolean(segment?.characterId && member.portraitId === segment.characterId));
  const voiceId = speakingMember ? voiceFor(speakingMember.portraitId, speakingMember.voiceId) : undefined;
  const currentSpeakerId = playerSpeaking
    ? playerCharacter?.portraitId || 'traveler'
    : segment?.characterId || currentMessage?.characterId || 'old_tom';
  const speakerConfig = getCharacterConfig(currentSpeakerId);
  const currentSpeakerName = speakingMember?.name || segment?.speakerName
    || (segment?.characterId ? speakerConfig.name : currentMessage?.sender || speakerConfig.name);
  const currentSpeakerTitle = speakingMember
    ? [speakingMember.race, speakingMember.class].filter(Boolean).join(' · ')
    : segment?.speakerName ? '' : (segment?.characterId ? speakerConfig.title : currentMessage?.speakerTitle || speakerConfig.title);

  // 解析当前句段中的表情差分
  const parsedExpressionFromContent = useMemo((): CharacterExpression | null => {
    if (!segment?.text) return null;
    const text = segment.text;

    if (/\[(表情|expression|emotion)\s*:\s*(微笑|得意|欢快|开心|smile|happy)\]/i.test(text)) return 'smile';
    if (/\[(表情|expression|emotion)\s*:\s*(严肃|警惕|拔剑|凝重|serious)\]/i.test(text)) return 'serious';
    if (/\[(表情|expression|emotion)\s*:\s*(震惊|惊愕|震颤|骇然|surprised|shocked)\]/i.test(text)) return 'surprised';
    if (/\[(表情|expression|emotion)\s*:\s*(平静|温和|normal|calm)\]/i.test(text)) return 'normal';

    if (/(哈哈|笑着|得意|爽朗|欢迎|美酒|干杯|😃|😄|✨|🎉)/.test(text)) return 'smile';
    if (/(危险|警惕|冷声|严肃|拔剑|凝重|警告|⚔️|🛡️|⚠️)/.test(text)) return 'serious';
    if (/(怎么可能|什么|倒吸一口凉气|大惊|骇然|惊呆|震惊|😱|😲|⁉️)/.test(text)) return 'surprised';

    return null;
  }, [segment]);

  const speakerExpression: CharacterExpression = currentMessage?.expression || parsedExpressionFromContent || 'normal';
  const segmentKey = `${currentMessage?.id}_${segmentIndex}`;
  const displayedText = typedSegment.key === segmentKey ? typedSegment.text : '';
  const voiceAllowed = Boolean(segment && currentMessage && !currentMessage.diceResult && !isLoading && !voicePaused);

  useEffect(() => {
    let currentIdx = 0;
    const timer = setInterval(() => {
      currentIdx += 2;
      if (currentIdx >= currentSegmentText.length) {
        setTypedSegment({ key: segmentKey, text: currentSegmentText });
        clearInterval(timer);
      } else {
        setTypedSegment({ key: segmentKey, text: currentSegmentText.slice(0, currentIdx) });
      }
    }, 18);
    typingTimer.current = timer;
    return () => clearInterval(timer);
  }, [segmentKey, currentSegmentText]);

  useEffect(() => {
    if (!voiceAllowed || handledVoiceSegment.current === segmentKey) return stopDialogueVoice;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleVoice = () => {
      clearTimeout(startTimer);
      startTimer = setTimeout(() => {
        if (handledVoiceSegment.current === segmentKey) return;
        handledVoiceSegment.current = segmentKey;
        void playDialogueVoice(currentSpeakerId, currentSegmentText, { voiceId, recordingOnly: !autoVoice });
      }, 0);
    };
    if (navigator.userActivation?.hasBeenActive === false) {
      window.addEventListener('click', scheduleVoice, { once: true });
      window.addEventListener('keydown', scheduleVoice, { once: true });
    } else {
      scheduleVoice();
    }
    return () => {
      clearTimeout(startTimer);
      window.removeEventListener('click', scheduleVoice);
      window.removeEventListener('keydown', scheduleVoice);
      stopDialogueVoice();
    };
  }, [voiceAllowed, segmentKey, currentSpeakerId, currentSegmentText, autoVoice, voiceId]);

  const stopCurrentLine = () => {
    handledVoiceSegment.current = segmentKey;
    stopDialogueVoice();
  };

  const handleNextSegment = () => {
    stopCurrentLine();
    if (displayedText.length < currentSegmentText.length) {
      if (typingTimer.current) clearInterval(typingTimer.current);
      setTypedSegment({ key: segmentKey, text: currentSegmentText });
      return;
    }
    if (segmentIndex < segments.length - 1) {
      setSegmentIndex(segmentIndex + 1);
    }
  };

  const handleSend = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading || requiredCheck || encounter) return;
    stopCurrentLine();
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const chapterCheck = dcCheck && playerCharacter ? getActionCheck('', playerCharacter, dcCheck) : null;
  const showChoices = !isLoading && isFinalSegment;
  const showPortrait = Boolean(speakingMember || (!segment?.speakerName && (playerSpeaking || segment?.characterId)));
  const advanceLabel = displayedText.length < currentSegmentText.length ? '显示整句' : '下一句';

  return (
    <section className={styles.stage} aria-label="剧情舞台">
      {backgroundImage && <Image className={styles.scenery} src={backgroundImage} alt="" fill unoptimized fetchPriority="high"
        onError={event => { event.currentTarget.hidden = true; }} />}
      <header className={styles.header}>
        <div className={styles.chapter}>
          <p>{sceneTitle}{ending && ' · 主线结局'}</p>
          <h1>{chapterTitle ?? '冒险开始'}</h1>
        </div>
        {tools}
      </header>

      <div className={styles.view}>
        {showPortrait && <div className={styles.portrait} key={currentSpeakerId}>
          <CharacterPortraitRenderer
            characterId={speakerConfig.id}
            imageUrl={speakingMember ? heroPortrait(speakingMember) : undefined}
            portraitPoses={speakingMember?.portraitPoses}
            layers={speakingMember ? appearanceFor(speakingMember) : undefined}
            portraitName={currentSpeakerName}
            expression={speakerExpression}
            isSpeaking={voiceAllowed}
            pose={voiceAllowed ? 'talk' : 'idle'}
            showGlow={false}
          />
        </div>}
        {isLoading && <p className={styles.waiting} role="status">{checking ? '等待检定结果' : '老汤姆正在续写这一幕…'}</p>}
      </div>

      <div className={styles.bottom}>
        <article className={styles.dialogue} aria-label="当前对白">
          <header className={styles.speaker}>
            <strong>{currentSpeakerName}</strong>
            {currentSpeakerTitle && <small>{currentSpeakerTitle}</small>}
            {voiceAllowed && <VoiceButton key={segmentKey} characterId={currentSpeakerId} voiceId={voiceId}
              line={currentSegmentText} label="播放本句" onStart={() => { handledVoiceSegment.current = segmentKey; }} />}
          </header>
          <div className={styles.line} onClick={handleNextSegment}>
            <ReactMarkdown>{currentMessage?.diceResult ? currentMessage.content : displayedText}</ReactMarkdown>
          </div>
          <footer className={styles.progress}>
            <span>{segments.length > 1 ? String(segmentIndex + 1).padStart(2, '0') + ' / ' + String(segments.length).padStart(2, '0') : '当前对白'}</span>
            {(!isFinalSegment || displayedText.length < currentSegmentText.length) && <button type="button" className="battle-button" onClick={handleNextSegment}>{advanceLabel}</button>}
            {!isFinalSegment && <button type="button" onClick={() => {
              stopDialogueVoice();
              handledVoiceSegment.current = (currentMessage?.id ?? '') + '_' + (segments.length - 1);
              setSegmentIndex(segments.length - 1);
            }}>快进至选项</button>}
          </footer>
        </article>

        {rewardNotice && <p className={styles.note} role="status">{rewardNotice}</p>}

        {showChoices && encounter && <div className={styles.decisions}>
          <div className={styles.check}>
            <p><strong>主线战斗</strong> · {encounter.title}</p>
            <button type="button" className="battle-button primary" disabled={!encounter.canFight} onClick={() => {
              stopCurrentLine();
              encounter.onStart();
            }}>进入战斗</button>
          </div>
        </div>}

        {showChoices && !encounter && <div className={styles.decisions}>
          {dcCheck && onExecuteDCCheck && <div className={styles.check}>
            <p><strong>{requiredCheck ? '主线必经检定' : 'D20 检定'}</strong> · {ATTRIBUTE_LABELS[dcCheck.attribute]}{dcCheck.skill ? ' · ' + dcCheck.skill : ''} DC {chapterCheck?.dc ?? dcCheck.dc}
              {chapterCheck && ' · 加值 ' + (chapterCheck.bonus >= 0 ? '+' : '') + chapterCheck.bonus}</p>
            <button type="button" className="battle-button primary" onClick={() => {
              stopCurrentLine();
              onExecuteDCCheck();
            }}>{requiredCheck ? '掷骰并继续' : '投掷检定'}</button>
          </div>}

          {choices.length > 0 && <div className={styles.choices} role="group" aria-label="剧情选择">
            {choices.map((choice, index) => {
              const check = playerCharacter ? getActionCheck(choice.text, playerCharacter, choice.check) : null;
              return <button type="button" key={index} onClick={() => { stopCurrentLine(); onSelectChoice(choice); }}>
                <span className={styles.choiceIndex} aria-hidden="true">{index + 1}</span>
                <span>{choice.text}{check && <small>{check.label} DC {check.dc} · 加值 {check.bonus >= 0 ? '+' : ''}{check.bonus}</small>}</span>
              </button>;
            })}
          </div>}

          {explorationActions && explorationActions.length > 0 && !requiredCheck && <details className={styles.exploration}>
            <summary>调查现场 · {explorationActions.length} 项</summary>
            <div className={styles.choices}>
              {explorationActions.map(action => <button type="button" key={action.id}
                onClick={() => { stopCurrentLine(); onExecuteExploration?.(action); }}>
                <span>{action.title}<small>{ATTRIBUTE_LABELS[action.attribute]} DC {action.dc}</small></span>
              </button>)}
            </div>
          </details>}
        </div>}

        {encounter ? <p className={styles.note}>{encounter.canFight ? '击败守敌后可以继续探索。' : '队伍已无法战斗。可以读取存档，或在队伍面板重新编队。'}</p>
          : ending ? <p className={styles.note}>主线已落幕。你可以保存当前进度，或从结局选项继续。</p>
          : requiredCheck ? <p className={styles.note}>先完成本幕关键检定。四档结果各有后果，失败也会按剧本继续。</p> : <form className={styles.freeAction} onSubmit={handleSend}>
          <input type="text" aria-label="自由行动" placeholder="描述队伍的行动…" value={inputText}
            onChange={event => setInputText(event.target.value)} disabled={isLoading} />
          <button type="submit" className="battle-button primary" disabled={isLoading || !inputText.trim()}>行动</button>
        </form>}
      </div>
    </section>
  );
}

