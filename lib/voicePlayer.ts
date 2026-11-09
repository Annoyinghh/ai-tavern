import { AUDIO_SETTINGS_EVENT, getMuted, getVolume } from './audio';
import { EILEEN_COMMISSION_LINES, EILEEN_GREETINGS, EILEEN_LESSONS, TOM_TAVERN_LINES } from './eileenLines';
import cast from './voiceCast.json';
import { MAX_VOICE_TEXT_LENGTH, voiceFor, voiceIdPattern } from './voiceAssets';

const recordings = new Map<string, Map<string, string>>([
  ['eileen', new Map([
    ...Object.entries(EILEEN_GREETINGS).map(([id, line]) => [line, `/audio/eileen/${id}.mp3`] as const),
    ...Object.entries(EILEEN_COMMISSION_LINES).map(([id, line]) => [line, `/audio/eileen/commission-${id}.mp3`] as const),
    ...Object.entries(EILEEN_LESSONS).map(([id, line]) => [line, `/audio/eileen/lesson-${id}.mp3`] as const),
  ])],
  ['old_tom', new Map(Object.entries(TOM_TAVERN_LINES).map(([id, line]) => [line, `/audio/voices/old_tom/${id}.mp3`]))],
]);

for (const { id, sample, danger } of cast) {
  const lines = recordings.get(id) ?? new Map<string, string>();
  lines.set(sample, `/audio/voices/${id}/sample.mp3`);
  lines.set(danger, `/audio/voices/${id}/danger.mp3`);
  recordings.set(id, lines);
}

const audioCache = new Map<string, Blob>();
const maxCacheBytes = 8 * 1024 * 1024;
let cacheBytes = 0;
let activePlayback: AbortController | null = null;

function cacheAudio(key: string, blob: Blob) {
  if (blob.size > maxCacheBytes) return;
  cacheBytes -= audioCache.get(key)?.size ?? 0;
  audioCache.delete(key);
  audioCache.set(key, blob);
  cacheBytes += blob.size;
  for (const [oldKey, oldBlob] of audioCache) {
    if (audioCache.size <= 32 && cacheBytes <= maxCacheBytes) break;
    cacheBytes -= oldBlob.size;
    audioCache.delete(oldKey);
  }
}

export function stopDialogueVoice(): void {
  activePlayback?.abort();
}

type VoicePlayback = {
  voiceId?: string;
  signal?: AbortSignal;
  recordingOnly?: boolean;
  sample?: boolean;
  onUnavailable?: () => void;
};

/** A scoped caller can await the end of its line and cancel it without affecting a newer line. */
export async function playDialogueVoice(characterId: string, line: string, {
  voiceId, signal: ownerSignal, recordingOnly = false, sample = false, onUnavailable,
}: VoicePlayback = {}): Promise<void> {
  if (ownerSignal?.aborted) return;
  stopDialogueVoice();
  const text = line
    .replace(/\[\s*(?:表情|expression|emotion|说话者|speaker|sender)\s*[:：][^\]]*\]/gi, '')
    .replace(/\[([^\]]+)\]\([^\n)]+\)/g, '$1')
    .replace(/(^|\n)\s*(?:[#>]+|[-*])\s+/g, '$1')
    .replace(/[*_`~]/g, '').trim();
  if (typeof window === 'undefined' || !text || getMuted() || getVolume() === 0) return;

  const profile = voiceFor(characterId, voiceId);
  const controller = new AbortController();
  const { signal } = controller;
  activePlayback = controller;
  let finish: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  let audio: HTMLAudioElement | undefined;
  let audioUrl: string | undefined;

  function releaseAudio() {
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio = undefined;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = undefined;
  }

  function dispose() {
    window.removeEventListener(AUDIO_SETTINGS_EVENT, onSettingsChange);
    signal.removeEventListener('abort', dispose);
    ownerSignal?.removeEventListener('abort', abortPlayback);
    releaseAudio();
    if (activePlayback === controller) activePlayback = null;
    finish();
  }

  function unavailable() {
    if (signal.aborted) return;
    dispose();
    onUnavailable?.();
  }

  function abortPlayback() {
    controller.abort();
  }

  function onSettingsChange() {
    const volume = getVolume();
    if (getMuted() || volume === 0) controller.abort();
    else if (audio) audio.volume = volume;
  }

  signal.addEventListener('abort', dispose, { once: true });
  ownerSignal?.addEventListener('abort', abortPlayback, { once: true });
  window.addEventListener(AUDIO_SETTINGS_EVENT, onSettingsChange);

  async function playAudio(src: string, onError: () => void) {
    const clip = new Audio(src);
    audio = clip;
    clip.volume = getVolume();
    clip.onended = dispose;
    await clip.play();
    if (audio === clip) clip.onerror = onError;
  }

  async function playSynthesis() {
    if (signal.aborted) return;
    if (recordingOnly || text.length > MAX_VOICE_TEXT_LENGTH) return unavailable();
    const cacheKey = JSON.stringify([profile, text]);
    let clip = audioCache.get(cacheKey);
    if (!clip) {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, voiceId, text }),
        signal,
      });
      if (!response.ok || !response.headers.get('Content-Type')?.startsWith('audio/')) return unavailable();
      clip = await response.blob();
    }
    if (signal.aborted) return;
    cacheAudio(cacheKey, clip);
    audioUrl = URL.createObjectURL(clip);
    await playAudio(audioUrl, unavailable);
  }

  async function start() {
    const recording = recordings.get(profile)?.get(text)
      ?? (sample && voiceIdPattern.test(profile) ? `/audio/voices/${profile}/sample.mp3` : undefined);
    if (recording) {
      const trySynthesis = () => {
        releaseAudio();
        return playSynthesis().catch(unavailable);
      };
      try {
        await playAudio(recording, () => void trySynthesis());
        return;
      } catch {
        if (signal.aborted) return;
        return trySynthesis();
      }
    }
    return playSynthesis();
  }

  const started = start().catch(unavailable);
  return ownerSignal ? finished : started;
}
