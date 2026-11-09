import type { DirectorContext } from './adventure';
import { getSceneProfile, getWorldProfile } from './worldLore';

export interface RetrievalSource {
  id: string;
  scriptId: string;
  kind: 'world' | 'chapter' | 'scene' | 'lore' | 'memory';
  title: string;
  text: string;
  chapterId?: string;
}
export interface RetrievedContext { text: string; sources: RetrievalSource[] }

// Chinese bigrams retain useful matching without a tokenizer or embedding service.
function terms(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z0-9_]+|[\u3400-\u9fff]+/g) ?? [];
  return [...new Set(tokens.flatMap(token => /^[\u3400-\u9fff]+$/.test(token)
    ? Array.from({ length: Math.max(0, token.length - 1) }, (_, i) => token.slice(i, i + 2))
    : [token]))].slice(0, 120);
}

/** Only current/visited chapters and explicitly unlocked lore enter the model context. */
export function retrieveContext(context: DirectorContext): RetrievedContext {
  const { script, chapterId, memory } = context;
  const visited = new Set([chapterId, ...context.visitedChapterIds]);
  const query = terms(`${context.action} ${context.resolvedAction ?? ''} ${memory.questLog.join(' ')} ${script.chapters[chapterId].title}`);
  const candidates: { source: RetrievalSource; priority: number; score: number }[] = [];
  function add(kind: RetrievalSource['kind'], id: string, title: string, text: string, priority: number, chapter?: string) {
    const lowerTitle = title.toLowerCase();
    const lowerText = text.toLowerCase();
    candidates.push({ source: { id: `${script.id}:${kind}:${id}`, scriptId: script.id, kind, title: title.slice(0, 120), text: text.slice(0, kind === 'chapter' && id === chapterId ? 3000 : 1800), ...(chapter ? { chapterId: chapter } : {}) }, priority,
      score: query.reduce((score, token) => score + (lowerTitle.includes(token) ? 3 : 0) + (lowerText.includes(token) ? 1 : 0), 0) });
  }
  if (script.worldSetting?.trim()) add('world', 'setting', '作者指定的世界约束', script.worldSetting, 6);
  const world = getWorldProfile(script);
  add('world', 'profile', world.title, world.lore, 5);
  const current = script.chapters[chapterId];
  const scene = getSceneProfile(script, current);
  add('scene', chapterId, scene.label, scene.lore, 5, chapterId);
  add('chapter', chapterId, current.title, current.content, 6, chapterId);
  const opening = `《${script.title}》的冒险刚刚开始。`;
  const summary = memory.storySummary.startsWith(opening)
    ? '冒险刚刚开始。' + memory.storySummary.slice(opening.length).replace(/^[^\n]*/, '')
    : memory.storySummary;
  add('memory', 'confirmed', '战役记录与已结算状态', JSON.stringify({ environmentAndConditions: memory.activeBuffsDebuffs, relationships: memory.companionAffinity, summary, milestones: memory.milestones, discoveredSecrets: memory.discoveredSecrets, quests: memory.questLog }), 4);
  for (const id of visited) {
    if (id === chapterId || !Object.hasOwn(script.chapters, id)) continue;
    const chapter = script.chapters[id];
    // clues, exploration secrets, and check outcomes are intentionally not copied.
    add('chapter', id, chapter.title, chapter.content, 1, id);
  }
  for (const entry of script.knowledge ?? []) {
    if (!entry.title.trim() || !entry.content.trim()) continue;
    if (entry.requiresSecret && !memory.discoveredSecrets.includes(entry.requiresSecret)) continue;
    if (entry.chapterIds?.length && !entry.chapterIds.some(id => visited.has(id))) continue;
    add('lore', entry.id, entry.title, entry.content, 1);
  }
  candidates.sort((a, b) => b.priority - a.priority || b.score - a.score || a.source.id.localeCompare(b.source.id));
  const sources: RetrievalSource[] = [];
  let text = '';
  for (const { source } of candidates) {
    if (sources.length >= 9) break;
    const header = `[${source.id}] ${source.title}\n`;
    const remaining = 12000 - text.length - header.length - 2;
    if (remaining < 80) break;
    const bounded = { ...source, text: source.text.slice(0, remaining) };
    sources.push(bounded);
    text += `${header}${bounded.text}\n\n`;
  }
  return { text, sources };
}
