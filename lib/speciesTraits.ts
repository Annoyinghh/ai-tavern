type SpeciesTraits = {
  speed: number;
  hpPerLevel: number;
  resistance?: 'fire' | 'poison';
  description?: string;
};

export function getSpeciesTraits(race: string): SpeciesTraits {
  switch (race) {
    case '木精灵':
      return { speed: 35, hpPerLevel: 0, description: '步行速度 35 尺' };
    case '矮人':
      return { speed: 30, hpPerLevel: 1, resistance: 'poison', description: '每级生命上限 +1，毒素伤害减半' };
    case '提夫林':
      return { speed: 30, hpPerLevel: 0, resistance: 'fire', description: '炼狱血脉：火焰伤害减半' };
    case '龙裔':
      return { speed: 30, hpPerLevel: 0, resistance: 'fire', description: '红龙血脉：火焰伤害减半' };
    default:
      return { speed: 30, hpPerLevel: 0 };
  }
}
