import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUDIO_SETTINGS_EVENT, getBGMEnabled, getBGMTrackPreference, getCurrentBGMTrack, getMuted, getVolume,
  setBGMEnabled, setBGMScene, setBGMTrackPreference, setMuted, setVolume,
} from '../lib/audio';

test('auto score follows the script while battle takes priority over a manual selection', () => {
  try {
    setBGMScene('mystery', false);
    assert.equal(getCurrentBGMTrack(), 'mystery');
    setBGMScene('dungeon', false);
    assert.equal(getCurrentBGMTrack(), 'dungeon');
    setBGMScene('custom', false);
    assert.equal(getCurrentBGMTrack(), 'tavern');
    setBGMScene('mystery', true);
    assert.equal(getCurrentBGMTrack(), 'battle');
    setBGMTrackPreference('eldritch');
    assert.equal(getCurrentBGMTrack(), 'battle');
    setBGMScene('mystery', false);
    assert.equal(getCurrentBGMTrack(), 'eldritch');
    setBGMTrackPreference('auto');
    assert.equal(getCurrentBGMTrack(), 'mystery');
  } finally {
    setBGMTrackPreference('auto');
    setBGMScene('tavern', false);
  }
});

test('audio settings restore saved preferences and announce immediate playback changes', () => {
  const storage = new Map([
    ['ai-tavern-muted', 'true'], ['ai-tavern-volume', '0.35'],
    ['ai-tavern-bgm-enabled', 'false'], ['ai-tavern-bgm-track', 'dungeon'],
  ]);
  let writable = true;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const window = Object.assign(new EventTarget(), { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (!writable) throw new Error('Storage quota exceeded');
      storage.set(key, value);
    },
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  try {
    let updates = 0;
    window.addEventListener(AUDIO_SETTINGS_EVENT, () => { updates++; });
    assert.equal(getMuted(), true);
    assert.equal(getVolume(), 0.35);
    assert.equal(getBGMEnabled(), false);
    assert.equal(getBGMTrackPreference(), 'dungeon');
    setMuted(false);
    setVolume(0.8);
    assert.equal(storage.get('ai-tavern-muted'), 'false');
    assert.equal(storage.get('ai-tavern-volume'), '0.8');
    assert.equal(updates, 2);
    writable = false;
    setMuted(true);
    setVolume(0.2);
    assert.equal(getMuted(), true);
    assert.equal(getVolume(), 0.2);
  } finally {
    writable = true;
    setMuted(false);
    setVolume(0.7);
    setBGMTrackPreference('auto');
    setBGMEnabled(true);
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
