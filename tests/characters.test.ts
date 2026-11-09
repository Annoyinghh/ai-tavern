import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCharacter } from '../lib/types';

test('the four player factories retain their established identities and basic statistics', () => {
  for (const [id, name, hp, ac] of [['traveler', '无名旅者', 12, 15], ['selene', '塞勒涅·苍月', 7, 12], ['shadow_rogue', '瓦尔特·影武', 9, 14], ['paladin_arthur', '亚瑟·瓦伦丁', 12, 18]] as const) {
    const character = createDefaultCharacter(id);
    assert.equal(character.id, `char_${id}`);
    assert.equal(character.name, name);
    assert.equal(character.hp.current, hp);
    assert.equal(character.ac, ac);
  }
  assert.equal(createDefaultCharacter('unknown').portraitId, 'traveler');
});

test('each character receives independent nested attributes, skills, HP and inventory', () => {
  const first = createDefaultCharacter();
  const second = createDefaultCharacter();
  first.skills[0].bonus = 999;
  first.attributes.dex = 1;
  first.hp.current = 0;
  first.inventory.length = 0;
  assert.notEqual(second.skills[0].bonus, 999);
  assert.equal(second.attributes.dex, 17);
  assert.equal(second.hp.current, 12);
  assert.ok(second.inventory.length > 0);
});
