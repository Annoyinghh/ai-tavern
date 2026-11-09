import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCharacter } from '../lib/types';
import { getActionCheck } from '../lib/checks';

test('skill proficiency and expertise scale at fifth level in both preview and execution', () => {
  const ranger = createDefaultCharacter();
  ranger.level = 5;
  assert.equal(getActionCheck('【敏捷 DC 13】隐匿', ranger)?.bonus, 6);
  const rogue = createDefaultCharacter('shadow_rogue');
  rogue.level = 5;
  assert.equal(getActionCheck('【敏捷 DC 13】巧手', rogue)?.bonus, 9);
});

test('explicit check metadata controls the ability and custom skill bonuses are retained', () => {
  const hero = createDefaultCharacter();
  hero.skills.push({ name: '航海', attribute: 'wis', proficient: true, bonus: 5 });
  const check = getActionCheck('驾驶船只', hero, { attribute: 'wis', skill: '航海', dc: 15 });
  assert.equal(check?.bonus, 7);
  assert.equal(check?.dc, 15);
});
