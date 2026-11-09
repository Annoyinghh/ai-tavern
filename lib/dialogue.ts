import { MAX_VOICE_TEXT_LENGTH } from './voiceAssets';

const speakerAliases = new Map([
  ['老汤姆', 'old_tom'], ['掌柜', 'old_tom'], ['地下城主', 'old_tom'], ['dm', 'old_tom'], ['old_tom', 'old_tom'],
  ['艾琳', 'eileen'], ['看板娘', 'eileen'], ['eileen', 'eileen'],
  ['塞勒涅', 'selene'], ['影心', 'selene'], ['shadowheart', 'selene'], ['selene', 'selene'],
  ['瓦尔特', 'shadow_rogue'], ['莱埃泽尔', 'shadow_rogue'], ['walter', 'shadow_rogue'], ['shadow_rogue', 'shadow_rogue'],
  ['亚瑟', 'paladin_arthur'], ['亚瑟·瓦伦丁', 'paladin_arthur'], ['arthur', 'paladin_arthur'], ['paladin_arthur', 'paladin_arthur'],
  ['无名旅者', 'traveler'], ['traveler', 'traveler'],
]);

const speakerPrefix = /^(?:\[\s*(?:说话者|speaker|sender)\s*[:：]\s*([^\]]+)\]|([^:：\n]{1,24})[:：])\s*/i;
const sentenceBoundary = /(?<=[。！？!?…])(?=[^。！？!?…”’」』）】])|(?<=[。！？!?…][”’」』）】])(?=[^”’」』）】])/u;

interface DialogueSegment {
  text: string;
  characterId?: string;
  speakerName?: string;
}

function npcId(name: string) {
  let hash = 2166136261;
  for (const char of name.normalize('NFKC').toLowerCase()) {
    hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
  }
  return 'npc-' + (hash >>> 0).toString(16).padStart(8, '0');
}

export function getDialogueSegments(content: string): DialogueSegment[] {
  const segments: DialogueSegment[] = [];
  const paragraphs = content
    .replace(/<StateUpdate\b[^>]*>[\s\S]*?(?:<\/StateUpdate\s*>|$)/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\{[\s\r\n]*"(?:is_combat|combat_initiative|inventory_add|hp_change|damage_reminder|random_event)[\s\S]*$/gi, '')
    .replace(/\\n/g, '\n')
    .replace(/(?<=\S)[ \t]*(?=\[\s*(?:说话者|speaker|sender)\s*[:：])/gi, '\n')
    .trim().split(/\n\s*\n/);

  function addParagraph(text: string, speaker: Omit<DialogueSegment, 'text'>) {
    if (!text) return;
    const parts = speaker.characterId || text.length > 90
      ? text.split(sentenceBoundary).map(part => part.trim()).filter(Boolean)
      : [text];
    for (const part of parts) {
      // Keep exceptionally long unpunctuated text inside the synthesis limit.
      const chunks = part.length <= MAX_VOICE_TEXT_LENGTH ? [part] : part.match(/[\s\S]{1,250}/gu) ?? [];
      for (const chunk of chunks) segments.push({ text: chunk, ...speaker });
    }
  }

  for (const paragraph of paragraphs) {
    let speaker: Omit<DialogueSegment, 'text'> = {};
    let lines: string[] = [];
    for (const rawLine of paragraph.split('\n')) {
      const line = rawLine.trimStart();
      const prefix = line.match(speakerPrefix);
      const name = prefix ? (prefix[1] ?? prefix[2]).trim() : '';
      const nextSpeaker = speakerAliases.get(name.toLowerCase());
      const dialogue = prefix ? line.slice(prefix[0].length) : '';
      const genericNpc = /^[\p{L}\p{M}\p{N}·・.'’\- ]{1,18}$/u.test(name) && /^[“「『"]/.test(dialogue);
      if (nextSpeaker || genericNpc) {
        addParagraph(lines.join('\n').trim(), speaker);
        speaker = nextSpeaker ? { characterId: nextSpeaker } : { characterId: npcId(name), speakerName: name };
        lines = [dialogue];
      } else {
        lines.push(rawLine);
      }
    }
    addParagraph(lines.join('\n').trim(), speaker);
  }
  return segments;
}
