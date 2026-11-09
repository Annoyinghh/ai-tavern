'use client';
// ============================================================
// AI 酒馆 - 二次元专属头部聚焦头像渲染器
// 采用精准的头部视口定位与专用头像矢量建模，支持表情同步与外部图像
// ============================================================

import { useState } from 'react';
import { CharacterExpression } from '@/lib/types';
import { getCharacterConfig } from '@/lib/characterAssets';
import { portraitColors, type appearanceFor } from '@/lib/appearance';
import LayeredPortrait from './LayeredPortrait';
import {
  EileenPortraitSvg,
  SelenePortraitSvg,
  TravelerPortraitSvg,
  ShadowRoguePortraitSvg,
  PaladinArthurPortraitSvg,
} from './CharacterPortraitRenderer';

interface CharacterAvatarRendererProps {
  characterId?: string;
  expression?: CharacterExpression;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'rounded' | 'square';
  className?: string;
  showBorder?: boolean;
  imageUrl?: string;
  layers?: ReturnType<typeof appearanceFor>;
  name?: string;
}

export default function CharacterAvatarRenderer(props: CharacterAvatarRendererProps) {
  const config = getCharacterConfig(props.characterId || 'traveler');
  return <CharacterAvatar key={JSON.stringify([props.characterId, props.imageUrl || config.avatarUrl])} {...props} />;
}

function CharacterAvatar({
  characterId = 'traveler',
  expression = 'normal',
  size = 'md',
  shape = 'circle',
  className = '',
  showBorder = true,
  imageUrl,
  layers,
  name,
}: CharacterAvatarRendererProps) {
  const config = getCharacterConfig(characterId);
  const themeColor = layers ? portraitColors[layers.frameColor] : config.themeColor || '#E6A85C';

  const sizePx = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-32 h-32',
  }[size];

  const shapeClass = {
    circle: 'rounded-full',
    rounded: 'rounded-2xl',
    square: layers ? 'rounded-none' : 'rounded-lg',
  }[layers?.frameShape ?? shape];

  const [imgError, setImgError] = useState(false);
  const activeImageUrl = imageUrl || config.avatarUrl;

  // 渲染二次元 AI 立绘图像头像 (用 includes 兼容带 ?v=xx 查询参数的图片 URL)
  const isImageFile = activeImageUrl && (
    activeImageUrl.includes('.png') ||
    activeImageUrl.includes('.jpg') ||
    activeImageUrl.includes('.jpeg') ||
    activeImageUrl.includes('.webp') ||
    activeImageUrl.startsWith('data:') ||
    activeImageUrl.startsWith('http')
  );

  if (layers || (!imgError && isImageFile)) {
    return (
      <div
        suppressHydrationWarning={true}
        className={`relative overflow-hidden shrink-0 flex items-center justify-center bg-[#0D1322] select-none ${sizePx} ${shapeClass} ${className}`}
        style={{
          border: showBorder ? `2px solid ${themeColor}` : 'none',
          boxShadow: showBorder ? `0 0 16px ${themeColor}44` : 'none',
        }}
      >
        {layers ? <LayeredPortrait layers={layers} thumbnail name={name || config.name} className="h-full w-full" /> : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activeImageUrl}
          alt={config.name}
          suppressHydrationWarning={true}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-top pointer-events-none"
        />)}
      </div>
    );
  }

  // 渲染聚焦于头部的专属 SVG 头像 (老汤姆绝不渲染矢量卡通小人，一律渲染主立绘头部)
  const renderAvatarHeadSvg = () => {
    switch (characterId) {
      case 'old_tom':
        return (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/characters/old_tom.png?v=22`}
            alt="老汤姆"
            className="w-full h-full object-cover object-top pointer-events-none"
          />
        );
      case 'eileen':
        return <EileenPortraitSvg expression={expression} themeColor={themeColor} />;
      case 'selene':
        return <SelenePortraitSvg expression={expression} themeColor={themeColor} />;
      case 'shadow_rogue':
        return <ShadowRoguePortraitSvg expression={expression} themeColor={themeColor} />;
      case 'paladin_arthur':
        return <PaladinArthurPortraitSvg expression={expression} themeColor={themeColor} />;
      case 'traveler':
      default:
        return <TravelerPortraitSvg expression={expression} themeColor={themeColor} />;
    }
  };

  return (
    <div
      className={`relative overflow-hidden shrink-0 flex items-center justify-center bg-gradient-to-b from-[#162035] to-[#0A0E1A] select-none ${sizePx} ${shapeClass} ${className}`}
      style={{
        border: showBorder ? `2px solid ${themeColor}` : 'none',
        boxShadow: showBorder ? `0 0 14px ${themeColor}55` : 'none',
      }}
    >
      {/* 头部视口精准定位：完美居中融合面部与发型 */}
      <div className="w-[155%] h-[155%] absolute -top-[5%] flex items-center justify-center pointer-events-none">
        {renderAvatarHeadSvg()}
      </div>

      {/* 边缘微光柔化 */}
      <div
        className="absolute inset-0 pointer-events-none rounded-inherit"
        style={{
          boxShadow: `inset 0 0 8px ${themeColor}33`,
        }}
      />
    </div>
  );
}
