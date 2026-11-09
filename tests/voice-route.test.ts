import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../app/api/voice/route';

function request(body: unknown, headers: HeadersInit = {}) {
  return new Request('http://localhost/api/voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('voice route sends validated dialogue and the resolved voice to the loopback service', async t => {
  const calls: unknown[] = [];
  const upstream = t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'http://127.0.0.1:8765/synthesize');
    calls.push(JSON.parse(String(init.body)));
    return new Response('RIFF', { headers: { 'Content-Type': 'audio/wav' } });
  });
  assert.equal((await POST(request({ characterId: 'eileen', text: ' ' }))).status, 400);
  assert.equal((await POST(request({ characterId: 'eileen', text: '字'.repeat(501) }))).status, 400);
  assert.equal((await POST(request({ characterId: 'eileen', voiceId: '../voice', text: '你好。' }))).status, 400);
  assert.equal((await POST(request({ characterId: 'eileen', text: '你好。' }, { 'Sec-Fetch-Site': 'cross-site' }))).status, 403);
  assert.equal(upstream.mock.callCount(), 0);

  const eileen = await POST(request({ characterId: 'eileen', text: '小于号 < 以及 &。' }));
  const tom = await POST(request({ characterId: 'custom', voiceId: 'old_tom', text: '欢迎光临。' }));
  assert.equal(eileen.status, 200);
  assert.equal(eileen.headers.get('content-type'), 'audio/wav');
  assert.equal(await eileen.text(), 'RIFF');
  assert.equal(tom.status, 200);
  assert.deepEqual(calls, [
    { voiceId: 'eileen', text: '小于号 < 以及 &。' },
    { voiceId: 'old_tom', text: '欢迎光临。' },
  ]);
});

test('the public voice catalog is available with the inference service offline', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  assert.equal((await POST(request({ characterId: 'eileen', text: '你好。' }))).status, 503);
  const catalog = await (await GET()).json();
  assert.equal(catalog.autoplay, false);
  assert.equal(catalog.voices.length >= 6, true);
});
