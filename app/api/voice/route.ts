import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { castVoices, MAX_VOICE_TEXT_LENGTH, voiceFor, voiceIdPattern, type VoiceProfile } from '../../../lib/voiceAssets';

const MAX_REQUEST_BYTES = 8192;
const voiceData = join(process.cwd(), 'voice-data');

export async function GET() {
  const [entries, benchmark] = await Promise.all([
    readdir(voiceData, { withFileTypes: true }).catch(() => []),
    readFile(join(voiceData, 'benchmark.json'), 'utf8').then(value => JSON.parse(value)).catch(() => null),
  ]);
  const extra = await Promise.all(entries.filter(entry => entry.isDirectory() && voiceIdPattern.test(entry.name)
    && !castVoices.some(voice => voice.id === entry.name)).map(async entry => {
    try {
      const { name, description, sample } = JSON.parse(await readFile(join(voiceData, entry.name, 'profile.json'), 'utf8'));
      if (typeof name === 'string' && typeof description === 'string' && typeof sample === 'string'
          && name.trim() && sample.trim() && sample.length <= MAX_VOICE_TEXT_LENGTH) {
        return { id: entry.name, name, description, sample } satisfies VoiceProfile;
      }
    } catch { /* A partially generated voice becomes visible on the next complete run. */ }
    return null;
  }));
  return Response.json({
    voices: [...castVoices, ...extra.filter(voice => voice !== null)],
    autoplay: benchmark?.autoplay === true,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

async function readVoiceRequest(request: Request): Promise<{ voiceId: string; text: string }> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const decoder = new TextDecoder();
  let bytes = 0;
  let json = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new Error('Body too large');
      }
      json += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  const payload = JSON.parse(json + decoder.decode());
  const characterId = payload?.characterId;
  const voiceId = payload?.voiceId;
  const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
  if (typeof characterId !== 'string' || !voiceIdPattern.test(characterId) || !text ||
      (voiceId !== undefined && (typeof voiceId !== 'string' || !voiceIdPattern.test(voiceId))) ||
      text.length > MAX_VOICE_TEXT_LENGTH || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
    throw new Error('Invalid dialogue');
  }
  return { voiceId: voiceFor(characterId, voiceId), text };
}

export async function POST(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return new Response(null, { status: 403 });
  }
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    return new Response(null, { status: 415 });
  }
  let dialogue;
  try {
    dialogue = await readVoiceRequest(request);
  } catch {
    return new Response(null, { status: 400 });
  }

  try {
    const response = await fetch('http://127.0.0.1:8765/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dialogue),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
    });
    if (!response.ok) return new Response(null, { status: 503 });
    if (!response.body || response.headers.get('content-type') !== 'audio/wav') return new Response(null, { status: 502 });
    return new Response(response.body, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
