import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appearanceFor, defaultAppearance, outfitWidth } from '../lib/appearance';
import { createDefaultCharacter } from '../lib/characters';
import { voiceFor } from '../lib/voiceAssets';

test('the same coat fits two different bodies and preserves their independent voice', () => {
  const dwarf = { ...createDefaultCharacter(), race: '矮人', voiceId: 'selene' };
  const elf = { ...createDefaultCharacter(), race: '木精灵', voiceId: 'traveler' };
  dwarf.appearance = { ...defaultAppearance(dwarf.race, 'female'), outfit: 'coat' };
  elf.appearance = { ...defaultAppearance(elf.race, 'male'), outfit: 'coat' };
  const first = appearanceFor(dwarf)!;
  const second = appearanceFor(elf)!;
  assert.equal(first.outfit, second.outfit);
  assert.notEqual(outfitWidth[first.fit], outfitWidth[second.fit]);
  assert.equal(voiceFor(dwarf.portraitId, dwarf.voiceId), 'selene');
  assert.equal(voiceFor(elf.portraitId, elf.voiceId), 'traveler');
});

test('saved full portraits and legacy characters keep using their existing images', () => {
  const character = createDefaultCharacter();
  assert.equal(appearanceFor(character), undefined);
  const uploaded = { ...character, avatarUrl: 'data:image/png;base64,eA==',
    appearance: defaultAppearance('矮人') };
  assert.equal(appearanceFor(uploaded), undefined);
  assert.equal(appearanceFor({ ...uploaded, appearance: { ...uploaded.appearance, active: true } })?.fit, 'short');
});
