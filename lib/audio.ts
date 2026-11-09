type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

export const AUDIO_SETTINGS_EVENT = 'ai-tavern-audio-settings';
export const DEFAULT_AUDIO_VOLUME = 0.7;
const BGM_FADE_SECONDS = 0.4;

let output: { context: AudioContext; master: GainNode } | null = null;
let ambience: { gain: GainNode; noise: AudioBufferSourceNode; timer: ReturnType<typeof setInterval> } | null = null;
let noiseBuffer: AudioBuffer | null = null;
let preferencesRestored = false;
let mutedPreference = false;
let volumePreference = DEFAULT_AUDIO_VOLUME;
let bgmEnabled = true;
let trackPreference: BGMTrackPreference = 'auto';
let bgmScene = 'tavern';
let battleActive = false;

interface BGMTrackConfig {
  name: string;
  notes: number[];
  speedMs: number;
  noiseFreq: number;
}

export const BGM_TRACKS = {
  tavern: {
    name: '酒馆炉火',
    notes: [293.66, 349.23, 440.00, 523.25, 587.33, 698.46, 440.00, 349.23],
    speedMs: 420,
    noiseFreq: 350,
  },
  dungeon: {
    name: '地牢回响',
    notes: [146.83, 174.61, 220.00, 261.63, 293.66, 220.00, 174.61, 146.83],
    speedMs: 650,
    noiseFreq: 180,
  },
  battle: {
    name: '战斗配乐',
    notes: [293.66, 440.00, 587.33, 440.00, 659.25, 587.33, 440.00, 293.66],
    speedMs: 280,
    noiseFreq: 600,
  },
  eldritch: {
    name: '异界低语',
    notes: [293.66, 311.13, 415.30, 493.88, 622.25, 415.30, 311.13, 293.66],
    speedMs: 580,
    noiseFreq: 220,
  },
  baldurs_gate: {
    name: '剑湾远行',
    notes: [196, 293.66, 392, 440, 493.88, 392, 329.63, 293.66],
    speedMs: 460,
    noiseFreq: 300,
  },
  mystery: {
    name: '迷雾小镇',
    notes: [220, 261.63, 329.63, 246.94, 293.66, 261.63, 196, 246.94],
    speedMs: 740,
    noiseFreq: 430,
  },
  cyberpunk: {
    name: '霓虹脉冲',
    notes: [110, 220, 164.81, 220, 130.81, 261.63, 164.81, 196],
    speedMs: 320,
    noiseFreq: 540,
  },
} satisfies Record<string, BGMTrackConfig>;

export type BGMTrackId = keyof typeof BGM_TRACKS;
export type BGMTrackPreference = 'auto' | BGMTrackId;

function resolveBGMTrack(scene: string, inBattle: boolean, preference: BGMTrackPreference): BGMTrackId {
  if (inBattle) return 'battle';
  if (preference !== 'auto') return preference;
  return Object.hasOwn(BGM_TRACKS, scene) ? scene as BGMTrackId : 'tavern';
}

function getStoredSetting(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function restorePreferences(): void {
  if (preferencesRestored || typeof window === 'undefined') return;
  preferencesRestored = true;
  mutedPreference = getStoredSetting('ai-tavern-muted') === 'true';
  bgmEnabled = getStoredSetting('ai-tavern-bgm-enabled') !== 'false';
  const volume = getStoredSetting('ai-tavern-volume');
  if (volume?.trim() && Number.isFinite(Number(volume))) {
    volumePreference = Math.max(0, Math.min(1, Number(volume)));
  }
  const track = getStoredSetting('ai-tavern-bgm-track');
  if (track === 'auto' || (track && Object.hasOwn(BGM_TRACKS, track))) {
    trackPreference = track as BGMTrackPreference;
  }
}

function storeSetting(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, value); } catch { /* Use in-memory settings. */ }
}

function notifyAudioSettings(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUDIO_SETTINGS_EVENT));
}

function syncMasterVolume(): void {
  if (!output) return;
  const { context, master } = output;
  master.gain.setValueAtTime(getMuted() ? 0 : getVolume(), context.currentTime);
}

function getAudioOutput(): typeof output {
  if (typeof window === 'undefined') return null;
  if (!output) {
    const AudioCtx = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!AudioCtx) return null;
    const context = new AudioCtx();
    const master = context.createGain();
    master.connect(context.destination);
    output = { context, master };
    syncMasterVolume();
  }
  if (output.context.state === 'suspended') void output.context.resume().catch(() => {});
  return output;
}

export function setMuted(muted: boolean): void {
  restorePreferences();
  mutedPreference = muted;
  storeSetting('ai-tavern-muted', String(muted));
  syncMasterVolume();
  notifyAudioSettings();
}

export function getMuted(): boolean {
  restorePreferences();
  return mutedPreference;
}

export function setVolume(vol: number): void {
  if (!Number.isFinite(vol)) return;
  restorePreferences();
  volumePreference = Math.max(0, Math.min(1, vol));
  storeSetting('ai-tavern-volume', String(volumePreference));
  syncMasterVolume();
  notifyAudioSettings();
}

export function getVolume(): number {
  restorePreferences();
  return volumePreference;
}

// ------------------------------------------------------------
// 交互音效 (SFX)
// ------------------------------------------------------------

/** 掷骰子音效 (碰撞木桌声) */
export function playDiceRollSound(): void {
  if (getMuted()) return;
  const audio = getAudioOutput();
  if (!audio) return;
  const { context: audioCtx, master } = audio;

  const now = audioCtx.currentTime;
  const bounces = 4 + Math.floor(Math.random() * 3);

  for (let i = 0; i < bounces; i++) {
    const timeOffset = now + i * (0.05 + Math.random() * 0.04);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    const freq = 120 + Math.random() * 180;
    osc.frequency.setValueAtTime(freq, timeOffset);
    osc.frequency.exponentialRampToValueAtTime(40, timeOffset + 0.04);

    const vol = (1 - i / bounces) * 0.4;
    gain.gain.setValueAtTime(vol, timeOffset);
    gain.gain.exponentialRampToValueAtTime(0.001, timeOffset + 0.05);

    osc.connect(gain);
    gain.connect(master);

    osc.start(timeOffset);
    osc.stop(timeOffset + 0.05);
  }
}

/** 金币 / 快捷按钮音效 */
export function playCoinSound(): void {
  if (getMuted()) return;
  const audio = getAudioOutput();
  if (!audio) return;
  const { context: audioCtx, master } = audio;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1800, now);
  osc.frequency.exponentialRampToValueAtTime(2400, now + 0.08);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain);
  gain.connect(master);

  osc.start(now);
  osc.stop(now + 0.12);
}

// ------------------------------------------------------------
// 多曲风吟游诗人 BGM 与 篝火/环境白噪音
// ------------------------------------------------------------

function pluckLuteNote(target: GainNode, freq: number, startDelay = 0) {
  const audioCtx = target.context;
  const now = audioCtx.currentTime + startDelay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, now);

  // 仿古鲁特琴衰减
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

  osc.connect(gain);
  gain.connect(target);

  osc.start(now);
  osc.stop(now + 0.9);
}

export function getBGMTrackPreference(): BGMTrackPreference {
  restorePreferences();
  return trackPreference;
}

export function setBGMTrackPreference(preference: BGMTrackPreference): void {
  const previous = getCurrentBGMTrack();
  trackPreference = preference;
  storeSetting('ai-tavern-bgm-track', preference);
  if (previous !== getCurrentBGMTrack()) switchAmbience();
  notifyAudioSettings();
}

export function setBGMScene(scene: string, inBattle: boolean): void {
  if (bgmScene === scene && battleActive === inBattle) return;
  const previous = getCurrentBGMTrack();
  const battleThemeChanged = battleActive !== inBattle || (inBattle && bgmScene !== scene);
  bgmScene = scene;
  battleActive = inBattle;
  if (previous !== getCurrentBGMTrack() || battleThemeChanged) switchAmbience();
  notifyAudioSettings();
}

export function getCurrentBGMTrack(): BGMTrackId {
  return resolveBGMTrack(bgmScene, battleActive, getBGMTrackPreference());
}

export function getBGMEnabled(): boolean {
  restorePreferences();
  return bgmEnabled;
}

export function setBGMEnabled(enabled: boolean): void {
  restorePreferences();
  bgmEnabled = enabled;
  storeSetting('ai-tavern-bgm-enabled', String(enabled));
  if (enabled) startTavernAmbience();
  else stopTavernAmbience();
  notifyAudioSettings();
}

function switchAmbience(): void {
  if (!ambience) return;
  stopTavernAmbience();
  startTavernAmbience();
}

export function startTavernAmbience(): void {
  if (!getBGMEnabled()) return;
  const audio = getAudioOutput();
  if (!audio || ambience) return;
  const { context, master } = audio;
  const config = BGM_TRACKS[getCurrentBGMTrack()];
  const scene = BGM_TRACKS[resolveBGMTrack(bgmScene, false, 'auto')];
  const tempo = battleActive ? Math.round((config.speedMs * 4 + scene.speedMs) / 5) : config.speedMs;
  const noiseFreq = battleActive ? (config.noiseFreq + scene.noiseFreq) / 2 : config.noiseFreq;
  const now = context.currentTime;

  if (!noiseBuffer) {
    noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }

  const noise = context.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(noiseFreq, now);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.setTargetAtTime(0.12, now, BGM_FADE_SECONDS / 5);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  noise.start(now);
  noise.onended = () => gain.disconnect();

  let step = 0;
  const playNotes = () => {
    if (mutedPreference || volumePreference === 0 || context.state !== 'running') return;
    const note = config.notes[step % config.notes.length];
    pluckLuteNote(gain, note);
    if (step % 4 === 0) pluckLuteNote(gain, note * 0.75, 0.05);
    step++;
  };
  playNotes();
  ambience = { gain, noise, timer: setInterval(playNotes, tempo) };
}

function stopTavernAmbience(): void {
  if (!ambience) return;
  const { gain, noise, timer } = ambience;
  ambience = null;
  clearInterval(timer);
  const now = gain.context.currentTime;
  gain.gain.setTargetAtTime(0, now, BGM_FADE_SECONDS / 5);
  noise.stop(now + BGM_FADE_SECONDS);
}
