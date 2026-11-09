export const outfitWidth = { slender: 78, short: 91, broad: 109 } as const;
type Fit = keyof typeof outfitWidth;
type Body = { fit: Fit; skin: string; hair: string; feature?: 'elf' | 'orc' | 'dragon' | 'horns' | 'fins' | 'mark' | 'scar' };

export const bodies = {
  人类: { fit: 'slender', skin: '#dfad8c', hair: '#49322d' },
  精灵: { fit: 'slender', skin: '#e4bcaa', hair: '#b4ad9b', feature: 'elf' },
  木精灵: { fit: 'slender', skin: '#bb8565', hair: '#4c392a', feature: 'elf' },
  高等精灵: { fit: 'slender', skin: '#ead1b9', hair: '#c5a66e', feature: 'elf' },
  矮人: { fit: 'short', skin: '#c49073', hair: '#744234' },
  半身人: { fit: 'short', skin: '#e8ad83', hair: '#70513d' },
  半兽人: { fit: 'broad', skin: '#9ba375', hair: '#323c30', feature: 'orc' },
  龙裔: { fit: 'broad', skin: '#ac6950', hair: '#5f3531', feature: 'dragon' },
  半精灵: { fit: 'slender', skin: '#d6a383', hair: '#493a4d', feature: 'elf' },
  提夫林: { fit: 'slender', skin: '#be7f8a', hair: '#46323f', feature: 'horns' },
  近现代市民: { fit: 'slender', skin: '#dfad8c', hair: '#49322d' },
  异界契约者: { fit: 'slender', skin: '#d4afa0', hair: '#422d45', feature: 'mark' },
  秘教幸存者: { fit: 'slender', skin: '#c5907b', hair: '#473d38', feature: 'scar' },
  混血裔: { fit: 'slender', skin: '#a3aaa0', hair: '#354b4d', feature: 'fins' },
} as const satisfies Record<string, Body>;

export const outfits = { cloak: '旅人披风', robe: '法师长袍', armor: '骑士罩甲', coat: '近现代长外套' } as const;
export const portraitColors = { amber: '#b98850', blue: '#586c91', green: '#527769', wine: '#9a5261' } as const;
export const colorLabels: Record<keyof typeof portraitColors, string> = {
  amber: '烛火金', blue: '月影蓝', green: '林地绿', wine: '酒红',
};
export const frameShapes = { circle: '圆形', rounded: '圆角', square: '方形' } as const;
export const bodyStyles = { male: '男版', female: '女版' } as const;

export interface Appearance {
  active?: boolean;
  body: keyof typeof bodies;
  bodyStyle: keyof typeof bodyStyles;
  outfit: keyof typeof outfits;
  outfitColor: keyof typeof portraitColors;
  frameShape: keyof typeof frameShapes;
  frameColor: keyof typeof portraitColors;
}

export function defaultAppearance(race: string, bodyStyle: Appearance['bodyStyle'] = 'male'): Appearance {
  const body = Object.hasOwn(bodies, race) ? race as Appearance['body'] : '人类';
  return { body, bodyStyle, outfit: 'cloak', outfitColor: 'green', frameShape: 'circle', frameColor: 'amber' };
}

export function isAppearance(value: unknown): value is Appearance {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (fields.active === undefined || typeof fields.active === 'boolean') && Object.entries({
    body: bodies, bodyStyle: bodyStyles, outfit: outfits, outfitColor: portraitColors,
    frameShape: frameShapes, frameColor: portraitColors,
  }).every(([key, options]) => typeof fields[key] === 'string' && Object.hasOwn(options, fields[key]));
}

export function appearanceFor(character: { avatarUrl?: string; appearance?: Appearance }) {
  if (!isAppearance(character.appearance) || character.appearance.active === false
      || (character.avatarUrl && character.appearance.active !== true)) return;
  return { ...character.appearance, ...bodies[character.appearance.body] };
}
