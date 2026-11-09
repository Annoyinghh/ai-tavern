'use client';

import { useEffect, useRef, useState } from 'react';
import { getMuted, getVolume } from '@/lib/audio';
import { playDialogueVoice } from '@/lib/voicePlayer';

export default function VoiceButton({ line, characterId = 'eileen', voiceId, label = '听艾琳说',
  sample, className, onStart }: {
  line: string;
  characterId?: string;
  voiceId?: string;
  label?: string;
  sample?: boolean;
  className?: string;
  onStart?: () => void;
}) {
  const playback = useRef<AbortController | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => () => playback.current?.abort(), [line, characterId, voiceId]);

  const toggle = async () => {
    if (playback.current) { playback.current.abort(); return; }
    if (getMuted() || getVolume() === 0) { setStatus('请先解除静音或调高音量。'); return; }
    const controller = new AbortController();
    playback.current = controller;
    setSpeaking(true);
    setStatus('');
    onStart?.();
    try {
      await playDialogueVoice(characterId, line, {
        voiceId, sample, signal: controller.signal,
        onUnavailable: () => setStatus('配音暂不可用。'),
      });
    }
    finally {
      playback.current = null;
      setSpeaking(false);
    }
  };

  return <><button type="button" className={className} onClick={toggle}>{speaking ? '停止语音' : label}</button>
    {status && <small role="status">{status}</small>}
  </>;
}
