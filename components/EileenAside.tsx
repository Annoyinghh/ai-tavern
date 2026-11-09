'use client';

import Image from 'next/image';
import { useId, useState } from 'react';
import VoiceButton from './VoiceButton';
import styles from './EileenAside.module.css';

const hints = {
  hero: {
    title: '角色档案',
    pose: 'quill',
    line: '先选个喜欢的职业，生命值和护甲会自动更新。想自己搭配，再往下调整属性和技能。',
  },
  workshop: {
    title: '剧本工坊',
    pose: 'book',
    line: '先写好开场，再给玩家留几个选择。用分支架构图看看每条路通向哪里。',
  },
  settings: {
    title: '模型与主持设置',
    pose: 'quill',
    line: '自定义接口可以留空。想换个说书口味，就在下方挑一种主持风格。',
  },
  audio: {
    title: '配乐与音量',
    pose: 'quill',
    line: '选「跟随剧情」，配乐就会在酒馆、故事和战斗之间切换。主音量也会调节角色的声音。',
  },
  party: {
    title: '队伍整备',
    pose: 'dice',
    line: '出发前看看队伍有没有能抗伤害、能远攻的伙伴。准备好了，就选一份委托吧。',
  },
};

interface EileenAsideProps {
  context: keyof typeof hints;
  onOpenGuide?: () => void;
}

export default function EileenAside({ context, onOpenGuide }: EileenAsideProps) {
  const hint = hints[context];
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);
  const [failedPose, setFailedPose] = useState<string>();
  const useFallback = failedPose === hint.pose;

  return (
    <aside className={styles.card} data-expanded={expanded || undefined} aria-label={`艾琳的便笺 · ${hint.title}`}>
      <div className={styles.portrait}>
        <Image
          src={useFallback ? '/characters/eileen.png' : `/characters/eileen-${hint.pose}.webp`}
          alt=""
          width={96}
          height={96}
          className={useFallback ? styles.fallback : undefined}
          onError={() => setFailedPose(hint.pose)}
        />
      </div>
      <button
        type="button"
        className={styles.disclosure}
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded(!expanded)}
      >
        艾琳的便笺 <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
      </button>
      <div id={contentId} className={styles.content}>
        <div className={styles.caption}>
          <strong>艾琳的便笺</strong><span>{hint.title}</span>
        </div>
        <p>{hint.line}</p>
        <div className={styles.actions}>
          <VoiceButton key={String(expanded)} line={hint.line} />
          {onOpenGuide && (
            <button type="button" onClick={onOpenGuide}>
              打开新手指引
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
