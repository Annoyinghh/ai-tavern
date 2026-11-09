import cast from './voiceCast.json';

export const MAX_VOICE_TEXT_LENGTH = 500;
export const voiceIdPattern = /^[a-z0-9_-]{1,64}$/;

export interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  sample: string;
}

export const castVoices: VoiceProfile[] = cast.map(({ id, name, description, sample }) => ({ id, name, description, sample }));

export function voiceFor(characterId = 'traveler', selectedVoice?: string): string {
  if (selectedVoice && voiceIdPattern.test(selectedVoice)) return selectedVoice;
  if (castVoices.some(voice => voice.id === characterId)) return characterId;
  const npc = characterId.match(/^npc-([a-f0-9]{8})$/);
  if (npc) return castVoices[parseInt(npc[1], 16) % castVoices.length].id;
  return characterId === 'custom' ? 'traveler' : 'old_tom';
}
