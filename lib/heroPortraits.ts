import { getCharacterConfig } from './characterAssets';
import { classKey } from './combat/catalog';
import type { Character } from './types';

const origins: Record<string, string> = {
  人类: 'human', human: 'human',
  精灵: 'traveler', elf: 'traveler', 木精灵: 'traveler', 'wood elf': 'traveler',
  高等精灵: 'selene', 'high elf': 'selene', 半精灵: 'shadow_rogue', 'half-elf': 'shadow_rogue',
  矮人: 'dwarf', dwarf: 'dwarf', 半身人: 'halfling', halfling: 'halfling',
  半兽人: 'half-orc', 'half-orc': 'half-orc', 兽人: 'half-orc', orc: 'half-orc',
  龙裔: 'dragonborn', dragonborn: 'dragonborn', 提夫林: 'tiefling', tiefling: 'tiefling',
};

const combinations: Record<string, string> = {
  'human:paladin': 'paladin_arthur', 'human:rogue': 'human-rogue',
  'traveler:wizard': 'wood-elf-wizard', 'halfling:rogue': 'halfling-rogue',
  'dwarf:paladin': 'dwarf-paladin', 'dragonborn:paladin': 'dragonborn-paladin', 'tiefling:wizard': 'tiefling-wizard',
};

export function heroPortrait(character: Pick<Character, 'avatarUrl' | 'portraitId' | 'race' | 'class'>): string {
  if (character.avatarUrl) return character.avatarUrl;
  const origin = origins[character.race.toLowerCase()];
  const art = origin && (combinations[`${origin}:${classKey(character.class)}`] ?? origin);
  return art ? `/heroes/${art}.webp` : getCharacterConfig(character.portraitId).portraitUrl;
}
