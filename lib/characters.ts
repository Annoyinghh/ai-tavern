import type { Character } from './types';
import { DND_CHARACTER_PRESETS, PLAYER_CHARACTERS } from './characterAssets';

/** Player statistics have one source; each character owns its mutable inventory and skills. */
export function createDefaultCharacter(portraitId = 'traveler'): Character {
  const id = PLAYER_CHARACTERS.some(character => character.id === portraitId) ? portraitId : 'traveler';
  return {
    ...structuredClone(DND_CHARACTER_PRESETS[id]),
    id: `char_${id}`, portraitId: id, currentExpression: 'normal',
  };
}
