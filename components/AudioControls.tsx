'use client';

import { useEffect, useState } from 'react';
import EileenAside from './EileenAside';
import {
  AUDIO_SETTINGS_EVENT,
  BGM_TRACKS,
  DEFAULT_AUDIO_VOLUME,
  getBGMEnabled,
  getBGMTrackPreference,
  getCurrentBGMTrack,
  getMuted,
  getVolume,
  playCoinSound,
  setBGMEnabled,
  setBGMTrackPreference,
  setMuted,
  setVolume,
  startTavernAmbience,
  type BGMTrackId,
  type BGMTrackPreference,
} from '@/lib/audio';

export default function AudioControls() {
  const [showSettings, setShowSettings] = useState(false);
  const [audio, setAudio] = useState({
    enabled: true,
    muted: false,
    volume: DEFAULT_AUDIO_VOLUME,
    preference: 'auto' as BGMTrackPreference,
    track: 'tavern' as BGMTrackId,
  });

  useEffect(() => {
    const sync = () => setAudio({
      enabled: getBGMEnabled(),
      muted: getMuted(),
      volume: getVolume(),
      preference: getBGMTrackPreference(),
      track: getCurrentBGMTrack(),
    });
    const initial = setTimeout(sync, 0);
    window.addEventListener(AUDIO_SETTINGS_EVENT, sync);
    window.addEventListener('click', startTavernAmbience, { once: true });
    window.addEventListener('keydown', startTavernAmbience, { once: true });
    return () => {
      clearTimeout(initial);
      window.removeEventListener(AUDIO_SETTINGS_EVENT, sync);
      window.removeEventListener('click', startTavernAmbience);
      window.removeEventListener('keydown', startTavernAmbience);
    };
  }, []);

  const trackName = BGM_TRACKS[audio.track].name;
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-[#E6A85C]/35 bg-[#101728] px-1.5 py-1 text-xs">
      <button
        type="button"
        onClick={() => setBGMEnabled(!getBGMEnabled())}
        aria-label="背景配乐"
        aria-pressed={audio.enabled}
        title={audio.enabled ? `关闭配乐 · ${trackName}` : '开启配乐'}
        className={`flex items-center gap-1 rounded-full px-1.5 py-1 transition-colors ${audio.enabled ? 'bg-[#E6A85C]/15 text-[#FFD485]' : 'text-[#8296D8] hover:text-[#FFD485]'}`}
      >
        <span aria-hidden="true">{audio.enabled ? '🎵' : '🎻'}</span>
        <span className="hidden lg:inline">{audio.enabled ? trackName : '配乐已关闭'}</span>
      </button>

      <button
        type="button"
        onClick={() => {
          const next = !getMuted();
          setMuted(next);
          if (!next) playCoinSound();
        }}
        aria-label="静音"
        aria-pressed={audio.muted}
        title={audio.muted ? '解除静音' : '静音'}
        className="rounded px-1 py-1 text-[#8296D8] transition-colors hover:text-[#FFD485]"
      >
        <span aria-hidden="true">{audio.muted ? '🔇' : '🔊'}</span>
      </button>

      <details
        className="relative"
        onToggle={event => setShowSettings(event.currentTarget.open)}
        onKeyDown={event => {
          if (event.key !== 'Escape' || !event.currentTarget.open) return;
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }}
      >
        <summary aria-label="音频设置" title="音频设置" className="list-none cursor-pointer rounded px-1 py-1 text-[#FFD485] [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true">▾</span>
        </summary>
        <div className="absolute right-0 z-50 mt-2 grid w-64 gap-3 rounded-lg border border-[#E6A85C]/45 bg-[#101728] p-3 text-[#F1E5CE] shadow-lg">
          <label className="grid gap-1.5">
            <span>配乐曲目</span>
            <select
              value={audio.preference}
              onChange={event => setBGMTrackPreference(event.target.value as BGMTrackPreference)}
              className="w-full rounded border border-[#8296D8]/40 bg-[#151D30] px-2 py-1.5"
            >
              <option value="auto">跟随剧情</option>
              {Object.entries(BGM_TRACKS).map(([id, track]) => <option key={id} value={id}>{track.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="flex items-center justify-between">主音量 <span className="tabular-nums text-[#FFD485]">{Math.round(audio.volume * 100)}%</span></span>
            <input
              aria-label="主音量"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audio.volume}
              onChange={event => setVolume(Number(event.target.value))}
              className="w-full accent-[#E6A85C]"
            />
          </label>
          {showSettings && <EileenAside context="audio" />}
        </div>
      </details>
    </div>
  );
}
