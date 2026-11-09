import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { setMuted, setVolume } from '../lib/audio';
import { getDialogueSegments } from '../lib/dialogue';
import { EILEEN_GREETINGS } from '../lib/eileenLines';
import { createPresetScript } from '../lib/scripts';
import { playDialogueVoice, stopDialogueVoice } from '../lib/voicePlayer';

function mockBrowser(t: TestContext, speech: object = {}) {
  const settings = new Map([['ai-tavern-muted', 'false'], ['ai-tavern-volume', '0.7']]);
  const browser = Object.assign(new EventTarget(), speech, {
    localStorage: {
      getItem: (key: string) => settings.get(key) ?? null,
      setItem: (key: string, value: string) => settings.set(key, value),
    },
  });
  const playing: MockAudio[] = [];
  class MockAudio {
    volume = 1;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(readonly src: string) {}
    play() { playing.push(this); return Promise.resolve(); }
    pause() { playing.splice(playing.indexOf(this), 1); }
    removeAttribute() {}
    load() {}
  }
  const globals = { window: browser, Audio: MockAudio };
  const previous = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  setMuted(false);
  setVolume(0.7);
  t.after(() => {
    stopDialogueVoice();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return playing;
}

test('dialogue keeps one speaker across sentences and recognizes an adjacent speaker line', () => {
  assert.deepEqual(getDialogueSegments('誓约写在门上。\n艾琳：“别出声。跟我来！”\n亚瑟：我守后门。'), [
    { text: '誓约写在门上。' },
    { characterId: 'eileen', text: '“别出声。' },
    { characterId: 'eileen', text: '跟我来！”' },
    { characterId: 'paladin_arthur', text: '我守后门。' },
  ]);
});

test('unknown NPC dialogue gets a stable voice identifier without classifying plain headings as speakers', () => {
  const [first, prose, later] = getDialogueSegments('守卫：“停下。”\n\n警告：禁止通行。\n\n守卫：“报上名来。”');
  assert.equal(first.speakerName, '守卫');
  assert.match(first.characterId ?? '', /^npc-[0-9a-f]{8}$/);
  assert.equal(later.characterId, first.characterId);
  assert.deepEqual(prose, { text: '警告：禁止通行。' });
});

test('skipping a line discards a response that arrives after cancellation', async t => {
  const playing = mockBrowser(t);
  let complete: (response: Response) => void = () => assert.fail('voice request did not start');
  const response = new Promise<Response>(resolve => { complete = resolve; });
  const fetch = t.mock.method(globalThis, 'fetch', () => response);

  const playback = playDialogueVoice('eileen', '欢迎来到酒馆。');
  assert.equal(fetch.mock.callCount(), 1);
  stopDialogueVoice();
  complete(new Response('audio', { headers: { 'content-type': 'audio/mpeg' } }));
  await playback;
  assert.deepEqual(playing, []);
});

test('closing a voice owner cancels its request and leaves newer playback running', async t => {
  mockBrowser(t);
  const requests: AbortSignal[] = [];
  t.mock.method(globalThis, 'fetch', (_url: string, init: RequestInit) => {
    const signal = init.signal!;
    requests.push(signal);
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  });

  const previous = new AbortController();
  const current = new AbortController();
  const first = playDialogueVoice('eileen', '请选一份委托。', { signal: previous.signal });
  const second = playDialogueVoice('eileen', '看看手里的骰子。', { signal: current.signal });
  previous.abort();
  assert.equal(requests[0].aborted, true);
  assert.equal(requests[1].aborted, false);

  current.abort();
  assert.equal(requests[1].aborted, true);
  await Promise.all([first, second]);
});

test('scoped playback completes when its audio ends', async t => {
  const playing = mockBrowser(t);
  t.mock.method(globalThis, 'fetch', async () =>
    new Response('audio', { headers: { 'content-type': 'audio/mpeg' } }));

  const owner = new AbortController();
  let completed = false;
  const playback = playDialogueVoice('eileen', '该出发了。', { signal: owner.signal }).then(() => { completed = true; });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(playing.length, 1);
  assert.equal(completed, false);

  playing[0].onended?.();
  await playback;
  assert.equal(playing.length, 0);
});

test('replaying a synthesized line reuses the clip and muting stops active playback', async t => {
  const playing = mockBrowser(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    new Response('audio', { headers: { 'content-type': 'audio/mpeg' } }));

  await playDialogueVoice('eileen', '好久不见。');
  assert.equal(playing.length, 1);
  stopDialogueVoice();
  await playDialogueVoice('eileen', '好久不见。');
  assert.equal(playing.length, 1);
  assert.equal(fetch.mock.callCount(), 1);
  setVolume(0.42);
  assert.equal(playing[0]?.volume, 0.42);
  setMuted(true);
  assert.equal(playing.length, 0);
});

test('the authored greeting plays its recording in rehearsal', async t => {
  const playing = mockBrowser(t);
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('recorded dialogue was sent to a server'));

  const owner = new AbortController();
  const playback = playDialogueVoice('eileen', EILEEN_GREETINGS.welcome, { recordingOnly: true, signal: owner.signal });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(playing.length, 1);
  assert.equal(playing[0].src, '/audio/eileen/welcome.mp3');

  owner.abort();
  await playback;
  assert.deepEqual(playing, []);
});

test('a failed recording falls back to synthesized audio when allowed', async t => {
  const playing = mockBrowser(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    new Response('audio', { headers: { 'content-type': 'audio/mpeg' } }));

  await playDialogueVoice('eileen', EILEEN_GREETINGS.welcome);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(playing.length, 1);
  playing[0].onerror?.();

  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(playing.length, 1);
  assert.match(playing[0].src, /^blob:/);
});

test('local rehearsal can synthesize sanitized dialogue through the same-origin endpoint', async t => {
  const playing = mockBrowser(t);
  const fetch = t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, '/api/voice');
    assert.deepEqual(JSON.parse(String(init.body)), { characterId: 'custom', voiceId: 'selene', text: '把药喝了。' });
    return new Response('audio', { headers: { 'content-type': 'audio/wav' } });
  });
  await playDialogueVoice('custom', '[表情: 开心] **把药喝了。**', { voiceId: 'selene' });
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(playing.length, 1);
});

test('an unavailable voice leaves the line silent and reports failure only to the playback owner', async t => {
  const playing = mockBrowser(t, {
    speechSynthesis: { speak: () => assert.fail('device speech should not play') },
  });
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  await playDialogueVoice('eileen', '你回来啦！先坐一会儿。', { recordingOnly: true });
  assert.equal(fetch.mock.callCount(), 0);
  let unavailable = 0;
  const owner = new AbortController();
  await playDialogueVoice('eileen', '你回来啦！先坐一会儿。', {
    signal: owner.signal, onUnavailable: () => unavailable++,
  });
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(unavailable, 1);
  assert.deepEqual(playing, []);
});

test('Shadowheart speaks her plea in the authored Baldur’s Gate chapter', () => {
  const script = createPresetScript('baldurs_gate');
  const chapter = Object.values(script.chapters).find(entry => entry.content.includes('求你了！'))!;
  const lines = getDialogueSegments(chapter.content).filter(line => /救救我|求你了/.test(line.text));
  assert.equal(lines.length, 2);
  assert.ok(lines.every(line => line.characterId === 'selene'));
});
