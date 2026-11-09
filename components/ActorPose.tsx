'use client';

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import type { Character } from '@/lib/types';
import styles from './ActorPose.module.css';

export type ActorPose = 'idle' | 'talk' | 'action';

function poseImage(imageUrl: string, pose: ActorPose, portraitPoses: Character['portraitPoses']): { src: string; cell?: 0 | 1 } | undefined {
  if (pose === 'idle') return;
  const custom = portraitPoses?.[pose];
  if (custom) return { src: custom };

  const path = imageUrl.split('?')[0];
  if (path === '/characters/eileen.png') {
    return { src: `/characters/eileen-${pose === 'talk' ? 'wave' : 'book'}.webp` };
  }

  const base = path.match(/^(\/(?:heroes|battle)\/[\w-]+)\.webp$/)?.[1];
  const atlas = path === '/characters/old_tom.png' ? '/heroes/old-tom' : base;
  if (atlas) return { src: `${atlas}-actions.webp`, cell: pose === 'talk' ? 0 : 1 };
}

export default function ActorPoseLayer({ imageUrl, pose, portraitPoses, preload = false, children }: {
  imageUrl: string;
  pose: ActorPose;
  portraitPoses?: Character['portraitPoses'];
  preload?: boolean;
  children: ReactNode;
}) {
  const asset = poseImage(imageUrl, pose === 'idle' && preload ? 'action' : pose, portraitPoses);
  const src = asset?.src;
  const cell = asset?.cell;
  const columns = cell === undefined ? 1 : 2;
  const [loaded, setLoaded] = useState<{ src: string; ratio: number }>();
  const measure = useCallback((image: HTMLImageElement | null) => {
    if (image?.naturalWidth && image.naturalHeight && src) {
      const width = image.naturalWidth / columns;
      setLoaded({ src, ratio: width / image.naturalHeight });
    }
  }, [src, columns]);

  const ready = Boolean(src && loaded?.src === src && pose !== 'idle');

  return <span className={styles.frame} data-pose={ready ? pose : 'idle'}>
    <span className={styles.base}>{children}</span>
    {src && <span
      className={styles.cell}
      data-cell={cell}
      data-visible={ready}
      style={{ '--pose-ratio': loaded?.ratio } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={src} ref={measure} src={src} alt="" onLoad={event => measure(event.currentTarget)}
        onError={() => setLoaded(previous => previous?.src === src ? undefined : previous)} />
    </span>}
  </span>;
}
