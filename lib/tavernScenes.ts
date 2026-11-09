import type { PresetKey } from './scripts';
import type { Script, ScriptChapter } from './types';
import { getSceneProfile, getWorldProfile } from './worldLore';

export const EILEEN_GREETING_KEY = 'ai-tavern-eileen-greeted';

export const COMMISSIONS: { key: PresetKey; title: string; teaser: string }[] = [
  { key: 'baldurs_gate', title: '博德之门', teaser: '你在一艘摇摇欲坠的异界舰船上醒来。先离开养殖舱，再弄清谁把你带到这里。' },
  { key: 'dungeon', title: '地下城探险', teaser: '地底遗迹重新露出入口。带上照明和绳索，沿着前人留下的痕迹调查。' },
  { key: 'mystery', title: '迷雾悬案', teaser: '雨中的小镇寄来一封求助信。走访目击者，在各人的说法中寻找破绽。' },
  { key: 'eldritch', title: '不可名状', teaser: '一座失落庄园传出异样动静。越过门槛前，先想好如何彼此照应。' },
  { key: 'cyberpunk', title: '霓虹边缘', teaser: '一桩委托把队伍引入霓虹都市。街上的传闻和监视器都值得留心。' },
  { key: 'tavern', title: '酒馆奇遇', teaser: '炉火旁贴出一份小小的委托，接下来要走多远，由你们决定。' },
];

export function sceneKey(script: Script | null): PresetKey {
  const key = script ? getWorldProfile(script).key : 'tavern';
  return key === 'dnd' || key === 'custom' ? 'tavern' : key;
}

export function sceneImage(scene: PresetKey) {
  if (scene === 'tavern') return '/scenes/tavern_background.jpg';
  if (scene === 'baldurs_gate') return '/scenes/nautiloid.webp';
  return `/scenes/${scene}.webp`;
}

const locationArt = {
  ship: '/scenes/nautiloid.webp', coast: '/scenes/sword-coast.webp', forest: '/scenes/forest.webp',
  ruins: '/scenes/dungeon.webp', underdark: '/scenes/underdark.webp', manor: '/scenes/eldritch.webp',
  mill: '/scenes/mystery.webp', neon: '/scenes/cyberpunk.webp', security: '/scenes/cyberpunk.webp',
} satisfies Partial<Record<ReturnType<typeof getSceneProfile>['key'], string>>;

export function chapterSceneImage(script: Script | null, chapter?: ScriptChapter | null) {
  const world = sceneKey(script);
  if (!script || !chapter) return sceneImage(world);
  const location = getSceneProfile(script, chapter).key;
  const title = chapter.title;
  if (!chapter.sceneType && world === 'dungeon' && title === '宝藏室') return '/scenes/dungeon-vault.webp';
  if (!chapter.sceneType && world === 'baldurs_gate' && title.includes('耐色主脑冲破港湾')) return '/scenes/crown-battlefield.webp';
  if (location === 'tavern') {
    return world === 'baldurs_gate' && /营地篝火|林地庆典/.test(title) ? locationArt.forest : sceneImage('tavern');
  }
  if (location === 'town') return world === 'mystery' ? sceneImage('mystery') : '/scenes/coastal-city.webp';
  if (location === 'shadow') return sceneImage('eldritch');
  if (location !== 'quiet') return locationArt[location];
  if (world !== 'baldurs_gate') return sceneImage(world);

  // Quiet scenes can share an illustration without gaining that location's random encounters.
  if (/^序章/.test(title) || /塔底肉池/.test(title)) return locationArt.ship;
  if (/^第四章|^终章/.test(title)) return '/scenes/coastal-city.webp';
  if (/古代精金熔炉/.test(title)) return locationArt.underdark;
  if (/月出之塔/.test(title)) return sceneImage('eldritch');
  if (/^第二章/.test(title)) return locationArt.forest;
  if (/石棺启示/.test(title)) return locationArt.ruins;
  return locationArt.coast;
}
