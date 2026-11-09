'use client';
// ============================================================
// AI 酒馆 - 高精度二次元半身立绘与表情差分渲染器 (Galgame 核心建模)
// 包含 4 位原创角色立绘建模、4 种表情差分、呼吸微动光效、外部图像无缝适配
// ============================================================

import { useState } from 'react';
import type { Character, CharacterExpression } from '@/lib/types';
import { getCharacterConfig } from '@/lib/characterAssets';
import type { appearanceFor } from '@/lib/appearance';
import LayeredPortrait from './LayeredPortrait';
import ActorPoseLayer, { type ActorPose } from './ActorPose';

interface CharacterPortraitRendererProps {
  characterId?: string;
  expression?: CharacterExpression;
  isSpeaking?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  showGlow?: boolean;
  imageUrl?: string; // 允许外部 AI 生成的 PNG/WebP 图像直连
  portraitName?: string;
  portraitPoses?: Character['portraitPoses'];
  layers?: ReturnType<typeof appearanceFor>;
  pose?: ActorPose;
  onClick?: () => void;
}

export default function CharacterPortraitRenderer(props: CharacterPortraitRendererProps) {
  return <CharacterPortrait key={JSON.stringify([props.characterId, props.expression, props.imageUrl])} {...props} />;
}

function CharacterPortrait({
  characterId = 'old_tom',
  expression = 'normal',
  isSpeaking = false,
  className = '',
  size = 'full',
  showGlow = true,
  imageUrl,
  portraitName,
  portraitPoses,
  layers,
  pose = 'idle',
  onClick,
}: CharacterPortraitRendererProps) {
  const config = getCharacterConfig(characterId);
  const themeColor = config.themeColor || '#E6A85C';

  const sizeClasses = {
    sm: 'w-32 h-44',
    md: 'w-56 h-72',
    lg: 'w-80 h-[440px]',
    full: 'w-full h-full max-w-[840px]',
  }[size];

  const [imgError, setImgError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  if (layers) {
    const motion = pose === 'action' || expression === 'surprised' ? 'animate-galgame-shock'
      : pose === 'talk' || isSpeaking ? 'animate-speaking-glow' : 'animate-galgame-breathe';
    return <div className={`relative flex items-end justify-center ${sizeClasses} ${className}`} onClick={onClick}>
      <LayeredPortrait layers={layers} name={portraitName || config.name} className={`h-full w-full ${motion}`} />
    </div>;
  }

  // 根据当前表情动态解析立绘路径
  const activeImageUrl = imageUrl || (
    useFallback || expression === 'normal' || config.portraitUrl.startsWith('/heroes/')
      ? config.portraitUrl
      : `/characters/${characterId}_${expression}.png`
  );

  // 渲染 AI 生成的二次元纸人/插画立绘模型 (纯立绘纸人，绝不闪现白色方块)
  if (!imgError && activeImageUrl && (/\.(?:png|jpg|webp)(?:\?|$)/i.test(activeImageUrl) || activeImageUrl.startsWith('data:') || activeImageUrl.startsWith('http'))) {
    const motionClass = isSpeaking
      ? 'animate-speaking-glow'
      : expression === 'surprised'
        ? 'animate-galgame-shock'
        : expression === 'smile'
          ? 'animate-galgame-nod'
          : 'animate-galgame-breathe';

    const expressionGlow = {
      normal: showGlow ? `drop-shadow(0 12px 32px ${themeColor}66)` : 'none',
      smile: `drop-shadow(0 0 28px #FFD485aa) drop-shadow(0 12px 32px ${themeColor}66)`,
      serious: `drop-shadow(0 0 28px #E63946aa) drop-shadow(0 12px 32px ${themeColor}66)`,
      surprised: `drop-shadow(0 0 36px #8296D8cc) drop-shadow(0 12px 32px ${themeColor}88)`,
    }[expression];

    return (
      <div
        onClick={onClick}
        suppressHydrationWarning={true}
        className={`relative flex items-end justify-center select-none ${sizeClasses} ${className}`}
        style={{
          filter: expressionGlow,
        }}
      >

        <div className={`w-full h-full flex items-end justify-center transition-all duration-300 ${motionClass}`}>
          <div className="relative w-full h-full flex items-end justify-center pointer-events-none">
            <ActorPoseLayer imageUrl={imageUrl || config.portraitUrl} portraitPoses={portraitPoses} pose={pose}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeImageUrl}
                alt={portraitName || config.name}
                suppressHydrationWarning={true}
                onError={() => {
                  if (!imageUrl && !useFallback && expression !== 'normal') {
                    setUseFallback(true);
                  } else {
                    setImgError(true);
                  }
                }}
                className="w-full h-full object-contain object-bottom pointer-events-none"
              />
            </ActorPoseLayer>
          </div>
        </div>
      </div>
    );
  }

  // 后备渲染：直接指向高精度二次元 PNG 资产
  const renderCharacterSvg = () => {
    const charPng = `/characters/${config.id}.png?v=28`;
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={charPng}
        alt={portraitName || config.name}
        className="w-full h-full object-contain object-bottom pointer-events-none"
      />
    );
  };

  return (
    <div
      onClick={onClick}
      className={`relative flex items-end justify-center select-none ${sizeClasses} ${className}`}
      style={{
        filter: showGlow ? `drop-shadow(0 12px 30px ${themeColor}40)` : 'none',
      }}
    >
      <div
        className={`w-full h-full flex items-end justify-center transition-all duration-300 ${isSpeaking
          ? 'animate-speaking-glow'
          : expression === 'surprised'
            ? 'animate-galgame-shock'
            : expression === 'smile'
              ? 'animate-galgame-nod'
              : 'animate-galgame-breathe'
          }`}
      >
        <ActorPoseLayer imageUrl={imageUrl || config.portraitUrl} portraitPoses={portraitPoses} pose={pose}>
          {renderCharacterSvg()}
        </ActorPoseLayer>
      </div>
    </div>
  );
}

// =========================================================================
export function EileenPortraitSvg({
  expression = 'normal',
  themeColor = '#E27D60',
  isSpeaking = false,
}: {
  expression?: CharacterExpression;
  themeColor?: string;
  isSpeaking?: boolean;
}) {
  return (
    <svg viewBox="0 0 440 560" className="w-full h-full overflow-visible" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="eileenSkinGrad" x1="220" y1="100" x2="220" y2="300" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF5F0" />
          <stop offset="0.7" stopColor="#FEE4DA" />
          <stop offset="1" stopColor="#F5CAB8" />
        </linearGradient>
        <linearGradient id="eileenHairGrad" x1="140" y1="50" x2="300" y2="440" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C45A30" />
          <stop offset="0.3" stopColor="#E27444" />
          <stop offset="0.7" stopColor="#AD461E" />
          <stop offset="1" stopColor="#702A0E" />
        </linearGradient>
        <linearGradient id="eileenDressGrad" x1="120" y1="300" x2="320" y2="560" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4A1828" />
          <stop offset="1" stopColor="#220912" />
        </linearGradient>
        <linearGradient id="eileenApronGrad" x1="160" y1="320" x2="280" y2="560" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFDF8" />
          <stop offset="1" stopColor="#EBE0CC" />
        </linearGradient>
        <filter id="eileenBlush" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* 暖粉珊瑚光晕 */}
      <ellipse cx="220" cy="230" rx="165" ry="175" fill={themeColor} opacity="0.16" />

      {/* 双马尾超长发辫 */}
      <path d="M125 180 Q50 280 80 460 Q115 420 145 280 Z" fill="url(#eileenHairGrad)" />
      <path d="M315 180 Q390 280 360 460 Q325 420 295 280 Z" fill="url(#eileenHairGrad)" />
      {/* 红色发带大蝴蝶结 */}
      <path d="M85 240 Q105 225 125 245 Q105 265 85 240 Z" fill="#E63946" stroke="#9A1B24" strokeWidth="2" />
      <circle cx="105" cy="242" r="5" fill="#FFE399" />
      <path d="M355 240 Q335 225 315 245 Q335 265 355 240 Z" fill="#E63946" stroke="#9A1B24" strokeWidth="2" />
      <circle cx="335" cy="242" r="5" fill="#FFE399" />

      {/* 蕾丝女仆式酒馆长裙 */}
      <path d="M95 560 L140 330 Q220 300 300 330 L345 560 Z" fill="url(#eileenDressGrad)" stroke="#5B1C30" strokeWidth="2" />
      {/* 荷叶边白色围裙 */}
      <path d="M145 560 L160 340 Q220 360 280 340 L295 560 Z" fill="url(#eileenApronGrad)" stroke="#D4C5A9" strokeWidth="1.5" />
      {/* 翡翠公会徽章胸针 */}
      <ellipse cx="220" cy="335" rx="11" ry="11" fill="#52B788" stroke="#FFE399" strokeWidth="2.5" />
      <path d="M220 327 L223 333 L229 335 L223 338 L220 344 L217 338 L211 335 L217 333 Z" fill="#FFFFFF" />

      {/* 纤巧颈部 */}
      <path d="M200 240 L200 315 Q220 330 240 315 L240 240 Z" fill="url(#eileenSkinGrad)" />
      {/* 锁骨 */}
      <path d="M190 310 Q205 318 220 312 Q235 318 250 310" stroke="#E5A690" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* 脸部轮廓 (圆润甜美瓜子脸) */}
      <path d="M162 170 Q160 252 220 268 Q280 252 278 170 Q275 110 220 110 Q165 110 162 170 Z" fill="url(#eileenSkinGrad)" stroke="#E5A690" strokeWidth="1.5" />

      {/* 元气粉嫩腮红 */}
      <ellipse cx="178" cy="208" rx="14" ry="8" fill="#FF8C94" opacity="0.6" filter="url(#eileenBlush)" />
      <ellipse cx="262" cy="208" rx="14" ry="8" fill="#FF8C94" opacity="0.6" filter="url(#eileenBlush)" />

      {/* 眼睛 (清澈明亮大琥珀金眸 · 双重晶莹高光) */}
      <g>
        {/* 左眼 */}
        <ellipse cx="192" cy="182" rx="15" ry="17" fill="#421C0A" />
        <ellipse cx="192" cy="185" rx="12" ry="13" fill="#D97724" />
        <ellipse cx="192" cy="188" rx="8" ry="8" fill="#F4A261" />
        <circle cx="196" cy="177" r="5.5" fill="#FFFFFF" />
        <circle cx="187" cy="189" r="2.5" fill="#FFF275" />
        {/* 上睫毛 */}
        <path d="M174 175 Q192 165 210 174" stroke="#2B1206" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M176 172 L172 168" stroke="#2B1206" strokeWidth="2.5" strokeLinecap="round" />

        {/* 右眼 */}
        <ellipse cx="248" cy="182" rx="15" ry="17" fill="#421C0A" />
        <ellipse cx="248" cy="185" rx="12" ry="13" fill="#D97724" />
        <ellipse cx="248" cy="188" rx="8" ry="8" fill="#F4A261" />
        <circle cx="252" cy="177" r="5.5" fill="#FFFFFF" />
        <circle cx="243" cy="189" r="2.5" fill="#FFF275" />
        {/* 上睫毛 */}
        <path d="M230 174 Q248 165 266 175" stroke="#2B1206" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M264 172 L268 168" stroke="#2B1206" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* 眉毛 (纤细弯月眉) */}
      {expression === 'serious' ? (
        <>
          <path d="M176 164 L204 170" stroke="#873516" strokeWidth="3" strokeLinecap="round" />
          <path d="M264 164 L236 170" stroke="#873516" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : expression === 'surprised' ? (
        <>
          <path d="M176 150 Q190 142 204 152" stroke="#873516" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M264 150 Q250 142 236 152" stroke="#873516" strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M176 158 Q190 150 204 160" stroke="#873516" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M264 158 Q250 150 236 160" stroke="#873516" strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* 小巧鼻尖 */}
      <ellipse cx="220" cy="206" rx="2" ry="2" fill="#D97B60" />

      {/* 嘴部表情差分 */}
      {expression === 'smile' || isSpeaking ? (
        <g>
          <path d="M205 226 Q220 248 235 226 Q220 230 205 226 Z" fill="#E63946" stroke="#9A1B24" strokeWidth="1.5" />
          <path d="M210 228 Q220 234 230 228" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      ) : expression === 'serious' ? (
        <path d="M210 230 L230 230" stroke="#B84232" strokeWidth="2.5" strokeLinecap="round" />
      ) : expression === 'surprised' ? (
        <ellipse cx="220" cy="232" rx="6" ry="8" fill="#B84232" stroke="#751A0E" strokeWidth="1.5" />
      ) : (
        <path d="M208 228 Q220 236 232 228" stroke="#B84232" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      )}

      {/* 齐刘海与萌系呆毛 (Ahoge) */}
      <path d="M220 95 Q235 50 250 65 Q235 80 224 95 Z" fill="#E27444" />
      <path d="M152 145 Q180 180 200 145 Q220 185 240 145 Q265 175 288 145 Q270 100 220 95 Q170 100 152 145 Z" fill="url(#eileenHairGrad)" />
      {/* 发丝高光光环 (天使光环) */}
      <path d="M168 125 Q220 108 272 125" stroke="#FFE3A8" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

// =========================================================================
// 3. 塞勒涅 (Selene) - 银蓝长发尖耳、冷艳月神占卜师法师 (型月/空灵史诗质感)
// =========================================================================
export function SelenePortraitSvg({
  expression = 'normal',
  themeColor = '#8296D8',
  isSpeaking = false,
}: {
  expression?: CharacterExpression;
  themeColor?: string;
  isSpeaking?: boolean;
}) {
  return (
    <svg viewBox="0 0 440 560" className="w-full h-full overflow-visible" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="seleneSkinGrad" x1="220" y1="100" x2="220" y2="300" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="0.7" stopColor="#E9EEF5" />
          <stop offset="1" stopColor="#D4DEEC" />
        </linearGradient>
        <linearGradient id="seleneHairGrad" x1="140" y1="40" x2="300" y2="480" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E0E7FF" />
          <stop offset="0.4" stopColor="#A5B4FC" />
          <stop offset="0.8" stopColor="#6366F1" />
          <stop offset="1" stopColor="#312E81" />
        </linearGradient>
        <linearGradient id="seleneRobeGrad" x1="100" y1="280" x2="340" y2="560" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E1B4B" />
          <stop offset="0.6" stopColor="#0F172A" />
          <stop offset="1" stopColor="#030712" />
        </linearGradient>
        <linearGradient id="seleneStarGold" x1="160" y1="320" x2="280" y2="460" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
        <filter id="seleneGlowStar" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 星辰月华冷蓝光晕 */}
      <ellipse cx="220" cy="230" rx="170" ry="180" fill={themeColor} opacity="0.18" />

      {/* 飘逸流淌的极光长发 */}
      <path d="M120 180 Q30 290 50 490 Q120 440 145 280 Z" fill="url(#seleneHairGrad)" />
      <path d="M320 180 Q410 290 390 490 Q320 440 295 280 Z" fill="url(#seleneHairGrad)" />

      {/* 午夜星空法袍与星象符文披风 */}
      <path d="M80 560 L125 310 Q220 270 315 310 L360 560 Z" fill="url(#seleneRobeGrad)" stroke="#4338CA" strokeWidth="2" />
      {/* 金色星座连线绣纹 */}
      <g stroke="url(#seleneStarGold)" strokeWidth="1.5" opacity="0.8">
        <circle cx="160" cy="420" r="3" fill="#FDE68A" />
        <circle cx="190" cy="390" r="2.5" fill="#FDE68A" />
        <circle cx="240" cy="405" r="3.5" fill="#FDE68A" />
        <circle cx="275" cy="435" r="2.5" fill="#FDE68A" />
        <line x1="160" y1="420" x2="190" y2="390" />
        <line x1="190" y1="390" x2="240" y2="405" />
        <line x1="240" y1="405" x2="275" y2="435" />
      </g>
      {/* 银色新月胸坠 */}
      <path d="M220 320 Q210 335 220 350 Q230 335 220 320 Z" fill="#E0E7FF" stroke="#818CF8" strokeWidth="2" />

      {/* 优雅修长颈部 */}
      <path d="M202 235 L202 315 Q220 328 238 315 L238 235 Z" fill="url(#seleneSkinGrad)" />

      {/* 精灵标志尖耳与蓝晶耳坠 */}
      <path d="M165 175 Q110 145 130 195 Q155 195 168 185 Z" fill="url(#seleneSkinGrad)" stroke="#B6C5DB" strokeWidth="1.2" />
      <polygon points="128,198 132,208 124,208" fill="#60A5FA" />
      <path d="M275 175 Q330 145 310 195 Q285 195 272 185 Z" fill="url(#seleneSkinGrad)" stroke="#B6C5DB" strokeWidth="1.2" />
      <polygon points="312,198 316,208 308,208" fill="#60A5FA" />

      {/* 清冷瓜子脸轮廓 */}
      <path d="M165 165 Q165 248 220 265 Q275 248 275 165 Q272 105 220 105 Q168 105 165 165 Z" fill="url(#seleneSkinGrad)" stroke="#B6C5DB" strokeWidth="1.2" />

      {/* 眼睛 (深邃冷艳蓝宝石 · 星芒瞳孔) */}
      <g>
        {/* 左眼 */}
        <ellipse cx="192" cy="180" rx="14" ry="14" fill="#0F172A" />
        <ellipse cx="192" cy="182" rx="11" ry="11" fill="#3B82F6" />
        <circle cx="192" cy="182" r="5" fill="#93C5FD" />
        {/* 星芒反射 */}
        <path d="M192 176 L193 182 L199 182 L194 185 L196 191 L192 187 L188 191 L190 185 L185 182 L191 182 Z" fill="#FFFFFF" />
        <circle cx="196" cy="176" r="3" fill="#FFFFFF" />
        {/* 上挑细长眼线 */}
        <path d="M174 175 Q192 167 210 173 L214 170" stroke="#1E1B4B" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* 右眼 */}
        <ellipse cx="248" cy="180" rx="14" ry="14" fill="#0F172A" />
        <ellipse cx="248" cy="182" rx="11" ry="11" fill="#3B82F6" />
        <circle cx="248" cy="182" r="5" fill="#93C5FD" />
        {/* 星芒反射 */}
        <path d="M248 176 L249 182 L255 182 L250 185 L252 191 L248 187 L244 191 L246 185 L241 182 L247 182 Z" fill="#FFFFFF" />
        <circle cx="252" cy="176" r="3" fill="#FFFFFF" />
        {/* 上挑细长眼线 */}
        <path d="M230 173 Q248 167 266 175 L270 170" stroke="#1E1B4B" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>

      {/* 眉毛 (银蓝修长柳叶眉) */}
      {expression === 'serious' ? (
        <>
          <path d="M175 163 L205 168" stroke="#4338CA" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M265 163 L235 168" stroke="#4338CA" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : expression === 'surprised' ? (
        <>
          <path d="M175 152 Q190 144 205 154" stroke="#4338CA" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M265 152 Q250 144 235 154" stroke="#4338CA" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M175 158 Q190 152 205 160" stroke="#4338CA" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M265 158 Q250 152 235 160" stroke="#4338CA" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* 高挺秀丽鼻梁 */}
      <path d="M220 172 L217 205 L224 206" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* 嘴唇差分 */}
      {expression === 'smile' || isSpeaking ? (
        <path d="M210 226 Q220 236 230 226" stroke="#4F46E5" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      ) : expression === 'serious' ? (
        <path d="M211 228 L229 228" stroke="#3730A3" strokeWidth="2.2" strokeLinecap="round" />
      ) : expression === 'surprised' ? (
        <ellipse cx="220" cy="229" rx="4.5" ry="6.5" fill="#3730A3" />
      ) : (
        <path d="M212 227 Q220 230 228 227" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" fill="none" />
      )}

      {/* 新月银色发饰与前发中分流苏 */}
      <path d="M260 100 Q275 85 265 70 Q285 85 270 105 Z" fill="#E0E7FF" stroke="#818CF8" strokeWidth="1.5" />
      <path d="M155 130 Q190 170 210 135 Q225 170 265 130 Q250 90 220 88 Q180 90 155 130 Z" fill="url(#seleneHairGrad)" />
      {/* 银白星光发丝反光 */}
      <path d="M175 110 Q220 95 265 110" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

// =========================================================================
// 4. 无名旅者 (Traveler) - 翡翠绿瞳英俊年轻冒险者主角 (JRPG 现代冒险主角质感)
// =========================================================================
export function TravelerPortraitSvg({
  expression = 'normal',
  themeColor = '#52B788',
  isSpeaking = false,
}: {
  expression?: CharacterExpression;
  themeColor?: string;
  isSpeaking?: boolean;
}) {
  return (
    <svg viewBox="0 0 440 560" className="w-full h-full overflow-visible" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="travelerSkinGrad" x1="220" y1="100" x2="220" y2="300" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF2EB" />
          <stop offset="0.7" stopColor="#F7DFD3" />
          <stop offset="1" stopColor="#E8BEAA" />
        </linearGradient>
        <linearGradient id="travelerHairGrad" x1="150" y1="50" x2="290" y2="250" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2A3833" />
          <stop offset="0.5" stopColor="#1A2420" />
          <stop offset="1" stopColor="#0B120E" />
        </linearGradient>
        <linearGradient id="travelerArmorGrad" x1="120" y1="290" x2="320" y2="560" gradientUnits="userSpaceOnUse">
          <stop stopColor="#354F42" />
          <stop offset="0.6" stopColor="#21332A" />
          <stop offset="1" stopColor="#131E19" />
        </linearGradient>
        <linearGradient id="travelerCapeGrad" x1="60" y1="280" x2="380" y2="560" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E293B" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
      </defs>

      {/* 翡翠绿冒险者光环 */}
      <ellipse cx="220" cy="240" rx="165" ry="175" fill={themeColor} opacity="0.14" />

      {/* 深蓝旅人防风斗篷 */}
      <path d="M75 560 L115 315 Q220 270 325 315 L365 560 Z" fill="url(#travelerCapeGrad)" stroke="#334155" strokeWidth="2" />
      {/* 银质飞翼斗篷搭扣 */}
      <circle cx="160" cy="335" r="7" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
      <circle cx="280" cy="335" r="7" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
      <path d="M160 335 Q220 355 280 335" stroke="#E2E8F0" strokeWidth="3" fill="none" />

      {/* 墨绿精制游侠皮甲与斜跨背带 */}
      <path d="M130 560 L150 330 Q220 350 290 330 L310 560 Z" fill="url(#travelerArmorGrad)" stroke="#4E7360" strokeWidth="2" />
      <path d="M140 330 L290 480" stroke="#8D6E63" strokeWidth="12" strokeLinecap="square" />
      <rect x="205" y="395" width="22" height="22" fill="#D4AF37" stroke="#8C6D1F" strokeWidth="2" />

      {/* 坚毅颈部 */}
      <path d="M196 245 L196 320 Q220 332 244 320 L244 245 Z" fill="url(#travelerSkinGrad)" />

      {/* 青年冒险者英挺脸型 */}
      <path d="M162 170 Q160 255 220 272 Q280 255 278 170 Q275 110 220 110 Q165 110 162 170 Z" fill="url(#travelerSkinGrad)" stroke="#DFAC97" strokeWidth="1.5" />

      {/* 眼睛 (炯炯有神的翡翠绿宝石眸 · 坚毅自信) */}
      <g>
        {/* 左眼 */}
        <ellipse cx="192" cy="180" rx="14" ry="13" fill="#13231B" />
        <ellipse cx="192" cy="182" rx="11" ry="10" fill="#2D6A4F" />
        <circle cx="192" cy="183" r="6" fill="#52B788" />
        <circle cx="196" cy="177" r="4.5" fill="#FFFFFF" />
        <circle cx="188" cy="185" r="2" fill="#D8F3DC" />
        {/* 英气上眼线 */}
        <path d="M174 175 Q192 168 208 174" stroke="#1A2E24" strokeWidth="3.2" strokeLinecap="round" fill="none" />

        {/* 右眼 */}
        <ellipse cx="248" cy="180" rx="14" ry="13" fill="#13231B" />
        <ellipse cx="248" cy="182" rx="11" ry="10" fill="#2D6A4F" />
        <circle cx="248" cy="183" r="6" fill="#52B788" />
        <circle cx="252" cy="177" r="4.5" fill="#FFFFFF" />
        <circle cx="244" cy="185" r="2" fill="#D8F3DC" />
        {/* 英气上眼线 */}
        <path d="M232 174 Q248 168 266 175" stroke="#1A2E24" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      </g>

      {/* 眉毛 (利落英气剑眉) */}
      {expression === 'serious' ? (
        <>
          <path d="M174 163 L206 172" stroke="#1F2925" strokeWidth="4" strokeLinecap="round" />
          <path d="M266 163 L234 172" stroke="#1F2925" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : expression === 'surprised' ? (
        <>
          <path d="M174 150 Q190 142 206 154" stroke="#1F2925" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M266 150 Q250 142 234 154" stroke="#1F2925" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M174 158 Q190 152 206 162" stroke="#1F2925" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M266 158 Q250 152 234 162" stroke="#1F2925" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* 笔直鼻梁 */}
      <path d="M220 170 L216 208 L225 210" stroke="#C28B75" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* 嘴角差分 */}
      {expression === 'smile' || isSpeaking ? (
        <path d="M205 230 Q220 244 235 230" stroke="#683424" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      ) : expression === 'serious' ? (
        <path d="M208 234 L232 234" stroke="#683424" strokeWidth="2.8" strokeLinecap="round" />
      ) : expression === 'surprised' ? (
        <ellipse cx="220" cy="235" rx="6" ry="8" fill="#683424" />
      ) : (
        <path d="M208 232 Q220 236 232 232" stroke="#683424" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      )}

      {/* 帅气碎短发与前额挑染光泽 */}
      <path d="M152 145 Q135 90 215 75 Q295 80 286 145 Q265 105 220 100 Q175 105 152 145 Z" fill="url(#travelerHairGrad)" />
      <path d="M165 115 Q195 150 210 125 Q230 155 255 125 Q270 150 280 130 Q255 98 220 95 Q185 98 165 115 Z" fill="#2E443C" />
      {/* 翡翠微光发丝高光 */}
      <path d="M185 102 Q220 86 255 102" stroke="#74C69D" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

// =========================================================================
// 5. 瓦尔特 (Shadow Rogue) - 银发紫瞳邪魅游荡者 (Fate/Fate Grand Order 刺客质感)
// =========================================================================
export function ShadowRoguePortraitSvg({
  themeColor = '#E67E22',
}: {
  expression?: CharacterExpression;
  themeColor?: string;
  isSpeaking?: boolean;
}) {
  return (
    <svg viewBox="0 0 440 560" className="w-full h-full overflow-visible" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rogueSkin" x1="220" y1="100" x2="220" y2="300" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF4ED" />
          <stop offset="1" stopColor="#E5C2B3" />
        </linearGradient>
        <linearGradient id="rogueHair" x1="140" y1="40" x2="300" y2="240" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="0.6" stopColor="#CBD5E1" />
          <stop offset="1" stopColor="#64748B" />
        </linearGradient>
        <linearGradient id="rogueCoat" x1="100" y1="280" x2="340" y2="560" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2A1B2E" />
          <stop offset="1" stopColor="#120A15" />
        </linearGradient>
      </defs>
      <ellipse cx="220" cy="230" rx="160" ry="170" fill={themeColor} opacity="0.16" />
      <path d="M80 560 L120 310 Q220 275 320 310 L360 560 Z" fill="url(#rogueCoat)" stroke="#5B2166" strokeWidth="2" />
      <path d="M140 330 L220 400 L300 330 L220 300 Z" fill="#1C1022" />
      <path d="M195 240 L195 315 Q220 328 245 315 L245 240 Z" fill="url(#rogueSkin)" />
      <path d="M162 165 Q160 252 220 270 Q280 252 278 165 Q275 105 220 105 Q165 105 162 165 Z" fill="url(#rogueSkin)" stroke="#D89E8C" strokeWidth="1.5" />
      {/* 眼睛 (发光紫瞳) */}
      <ellipse cx="192" cy="180" rx="14" ry="12" fill="#1E102E" />
      <ellipse cx="192" cy="182" rx="11" ry="9" fill="#9333EA" />
      <circle cx="192" cy="182" r="5" fill="#C084FC" />
      <circle cx="196" cy="177" r="4" fill="#FFFFFF" />
      <path d="M174 175 Q192 168 208 174" stroke="#1E102E" strokeWidth="3" strokeLinecap="round" fill="none" />

      <ellipse cx="248" cy="180" rx="14" ry="12" fill="#1E102E" />
      <ellipse cx="248" cy="182" rx="11" ry="9" fill="#9333EA" />
      <circle cx="248" cy="182" r="5" fill="#C084FC" />
      <circle cx="252" cy="177" r="4" fill="#FFFFFF" />
      <path d="M232 174 Q248 168 266 175" stroke="#1E102E" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* 玩味坏笑 */}
      <path d="M208 230 Q225 242 238 226" stroke="#8E24AA" strokeWidth="2.8" strokeLinecap="round" fill="none" />

      {/* 凌厉银短发 */}
      <path d="M152 145 Q135 85 220 70 Q305 85 288 145 Q265 100 220 95 Q175 100 152 145 Z" fill="url(#rogueHair)" />
      <path d="M165 110 Q220 90 275 110" stroke="#FFFFFF" strokeWidth="3" opacity="0.8" />
    </svg>
  );
}

// =========================================================================
// 6. 亚瑟 (Paladin Arthur) - 金发蓝瞳正义骑士 (Saber 浩然正气质感)
// =========================================================================
export function PaladinArthurPortraitSvg({
  themeColor = '#F1C40F',
}: {
  expression?: CharacterExpression;
  themeColor?: string;
  isSpeaking?: boolean;
}) {
  return (
    <svg viewBox="0 0 440 560" className="w-full h-full overflow-visible" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="paladinSkin" x1="220" y1="100" x2="220" y2="300" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF7F2" />
          <stop offset="1" stopColor="#F2D2C2" />
        </linearGradient>
        <linearGradient id="paladinHair" x1="140" y1="40" x2="300" y2="240" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEF08A" />
          <stop offset="0.6" stopColor="#EAB308" />
          <stop offset="1" stopColor="#CA8A04" />
        </linearGradient>
        <linearGradient id="paladinArmor" x1="100" y1="280" x2="340" y2="560" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E2E8F0" />
          <stop offset="0.5" stopColor="#94A3B8" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
      </defs>
      <ellipse cx="220" cy="230" rx="165" ry="175" fill={themeColor} opacity="0.18" />
      {/* 板甲与太阳徽记 */}
      <path d="M80 560 L120 310 Q220 270 320 310 L360 560 Z" fill="url(#paladinArmor)" stroke="#CBD5E1" strokeWidth="2" />
      <circle cx="220" cy="370" r="16" fill="#F59E0B" stroke="#FEF08A" strokeWidth="3" />
      <path d="M196 240 L196 315 Q220 328 244 315 L244 240 Z" fill="url(#paladinSkin)" />
      <path d="M162 165 Q160 252 220 270 Q280 252 278 165 Q275 105 220 105 Q165 105 162 165 Z" fill="url(#paladinSkin)" stroke="#E0A792" strokeWidth="1.5" />
      {/* 蓝宝石神圣眼眸 */}
      <g>
        <ellipse cx="192" cy="180" rx="14" ry="13" fill="#0284C7" />
        <circle cx="192" cy="180" r="6" fill="#38BDF8" />
        <circle cx="196" cy="176" r="4.5" fill="#FFFFFF" />
        <path d="M174 174 Q192 166 208 173" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" />

        <ellipse cx="248" cy="180" rx="14" ry="13" fill="#0284C7" />
        <circle cx="248" cy="180" r="6" fill="#38BDF8" />
        <circle cx="252" cy="176" r="4.5" fill="#FFFFFF" />
        <path d="M232 173 Q248 166 266 174" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
      {/* 严肃庄重嘴形 */}
      <path d="M208 232 L232 232" stroke="#9A3412" strokeWidth="2.5" strokeLinecap="round" />
      {/* 金色秀发 */}
      <path d="M152 145 Q135 85 220 65 Q305 85 288 145 Q265 100 220 95 Q175 100 152 145 Z" fill="url(#paladinHair)" />
      <path d="M170 110 Q220 90 270 110" stroke="#FFFFFF" strokeWidth="3" opacity="0.9" />
    </svg>
  );
}
