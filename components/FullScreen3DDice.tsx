'use client';
// ============================================================
// AI 酒馆 - 纯 Canvas 3D 实体数学二十面骰 (D20 Icosahedron)
// 基于时间驱动与 Ref 状态机的物理抛入、重力俯冲、多级地面弹跳与正面定格动画
// 彻底解决首帧闪烁与闭包旋转失效问题
// ============================================================

import { useState, useEffect, useRef, useEffectEvent } from 'react';
import { type AttributeKey, type DiceResult, ATTRIBUTE_LABELS } from '@/lib/types';
import { performDiceRoll, formatDiceResult } from '@/lib/dice';
import { playDiceRollSound, playCoinSound } from '@/lib/audio';
import { EXPLORATION_OUTCOME_LABELS, getExplorationOutcome } from '@/lib/checks';

type Roll = { roll: number; total: number };
type RollResult = Roll & { text: string };

interface FullScreen3DDiceProps {
  actionTitle?: string;
  targetAttr?: AttributeKey | null;
  targetSkill?: string;
  targetDC?: number;
  bonus?: number;
  bonusBreakdown?: string;
  resolvedRoll?: Roll;
  outcomeSummary?: string;
  onOpenJournal?: () => void;
  onRollStart: (result: Roll) => void;
  onRollFinish: (result: Roll) => void;
}

// 黄金比例几何常数
const PHI = (1 + Math.sqrt(5)) / 2;

// 12 个正二十面体基础球面顶点 (归一化半径 = 1)
const RAW_VERTICES = [
  [-1,  PHI, 0], [ 1,  PHI, 0], [-1, -PHI, 0], [ 1, -PHI, 0],
  [0, -1,  PHI], [0,  1,  PHI], [0, -1, -PHI], [0,  1, -PHI],
  [ PHI, 0, -1], [ PHI, 0,  1], [-PHI, 0, -1], [-PHI, 0,  1]
].map(([x, y, z]) => {
  const len = Math.sqrt(x * x + y * y + z * z);
  return [x / len, y / len, z / len];
});

// 20 个逆时针三角面 (法线朝外) 及对应 DND 5e 骰面数字
const FACES: Array<{ verts: [number, number, number]; num: number }> = [
  { verts: [0, 11, 5], num: 20 },
  { verts: [0, 5, 1],  num: 2 },
  { verts: [0, 1, 7],  num: 14 },
  { verts: [0, 7, 10], num: 8 },
  { verts: [0, 10, 11], num: 10 },

  { verts: [1, 5, 9],  num: 12 },
  { verts: [5, 11, 4], num: 18 },
  { verts: [11, 10, 2], num: 6 },
  { verts: [10, 7, 6], num: 4 },
  { verts: [7, 1, 8],  num: 16 },

  { verts: [3, 9, 4],  num: 7 },
  { verts: [3, 4, 2],  num: 19 },
  { verts: [3, 2, 6],  num: 3 },
  { verts: [3, 6, 8],  num: 17 },
  { verts: [3, 8, 9],  num: 13 },

  { verts: [4, 9, 5],  num: 15 },
  { verts: [2, 4, 11], num: 1 },
  { verts: [6, 2, 10], num: 9 },
  { verts: [8, 6, 7],  num: 11 },
  { verts: [9, 8, 1],  num: 5 },
];

// 计算将指定点数三角面精准旋转至正前方 (0, 0, 1) 的欧拉角
function getTargetFaceRotation(faceNum: number): { x: number; y: number; z: number } {
  const targetFace = FACES.find(f => f.num === faceNum) || FACES[0];
  const v0 = RAW_VERTICES[targetFace.verts[0]];
  const v1 = RAW_VERTICES[targetFace.verts[1]];
  const v2 = RAW_VERTICES[targetFace.verts[2]];

  const ax = v1[0] - v0[0], ay = v1[1] - v0[1], az = v1[2] - v0[2];
  const bx = v2[0] - v0[0], by = v2[1] - v0[1], bz = v2[2] - v0[2];
  let nx = ay * bz - az * by;
  let ny = az * bx - ax * bz;
  let nz = ax * by - ay * bx;
  const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
  nx /= nLen;
  ny /= nLen;
  nz /= nLen;

  const rotX = Math.atan2(ny, nz);
  const z1 = Math.sqrt(ny * ny + nz * nz);
  const rotY = -Math.atan2(nx, z1);

  return { x: rotX, y: rotY, z: 0 };
}

export default function FullScreen3DDice({
  actionTitle,
  targetAttr,
  targetSkill,
  targetDC,
  bonus = 0,
  bonusBreakdown,
  resolvedRoll,
  outcomeSummary,
  onOpenJournal,
  onRollStart,
  onRollFinish,
}: FullScreen3DDiceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 结算状态 (仅用于最终 UI 呈现)
  const [settledResult, setSettledResult] = useState<RollResult | null>(null);

  // 动画状态机 (完全基于 Ref，杜绝 React 闭包过期)
  const animStateRef = useRef<{
    phase: 'FLYING' | 'SETTLED';
    startTime: number;
    duration: number;
    targetRoll: number;
    targetRotation: { x: number; y: number; z: number };
    currentPos: { x: number; y: number; z: number };
    currentRot: { x: number; y: number; z: number };
    spinVelocity: { x: number; y: number; z: number };
    hasBounced1: boolean;
    hasBounced2: boolean;
    resultData: RollResult | null;
  }>({
    phase: 'FLYING',
    startTime: 0,
    duration: 1600,
    targetRoll: 20,
    targetRotation: { x: 0, y: 0, z: 0 },
    currentPos: { x: -2000, y: -2000, z: -1000 }, // 初始在屏幕极远处，首帧绝对不闪烁
    currentRot: { x: 0, y: 0, z: 0 },
    spinVelocity: { x: 0.5, y: 0.6, z: 0.4 },
    hasBounced1: false,
    hasBounced2: false,
    resultData: null,
  });

  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }>>([]);
  const animFrameIdRef = useRef<number | null>(null);

  // Saved rolls use deterministic visual noise; replay never consumes new randomness.
  const visualStepRef = useRef(0);
  const visualRandom = useEffectEvent(() => {
    if (!resolvedRoll) return Math.random();
    const value = Math.sin(resolvedRoll.roll + ++visualStepRef.current) * 10000;
    return value - Math.floor(value);
  });

  // 初始化投掷动画
  const initAnimation = useEffectEvent(() => {
    const result: DiceResult = resolvedRoll ? {
      rolls: [resolvedRoll.roll], total: resolvedRoll.total,
      modifier: resolvedRoll.total - resolvedRoll.roll, type: 'd20', advantage: 'none',
    } : performDiceRoll('d20', 1, bonus);
    visualStepRef.current = 0;
    const mainRoll = result.rolls[0];
    const targetRot = getTargetFaceRotation(mainRoll);
    const roll = { roll: mainRoll, total: result.total };

    // 2. 初始化物理状态
    animStateRef.current = {
      phase: 'FLYING',
      startTime: performance.now(),
      duration: 1600,
      targetRoll: mainRoll,
      targetRotation: targetRot,
      currentPos: { x: -1200, y: -900, z: -700 }, // 从屏幕外开始
      currentRot: {
        x: visualRandom() * Math.PI * 2,
        y: visualRandom() * Math.PI * 2,
        z: visualRandom() * Math.PI * 2,
      },
      spinVelocity: {
        x: (visualRandom() - 0.5) * 0.8 + 0.55,
        y: (visualRandom() - 0.5) * 0.8 + 0.65,
        z: (visualRandom() - 0.5) * 0.6 + 0.45,
      },
      hasBounced1: false,
      hasBounced2: false,
      resultData: { ...roll, text: formatDiceResult(result) },
    };

    particlesRef.current = [];
    playDiceRollSound();

    onRollStart(roll);
  });

  // 全屏尺寸监听
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    const initializationFrame = requestAnimationFrame(() => initAnimation());
    return () => {
      cancelAnimationFrame(initializationFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 60FPS 物理渲染主循环
  useEffect(() => {
    let isRunning = true;

    const loop = (now: number) => {
      if (!isRunning) return;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          const centerX = width / 2;
          const centerY = height / 2;
          const baseRadius = Math.min(width, height) * 0.16;
          const fov = Math.max(800, width * 0.85);

          ctx.clearRect(0, 0, width, height);

          const state = animStateRef.current;
          const elapsed = now - state.startTime;
          const progress = Math.min(1, Math.max(0, elapsed / state.duration));

          // ----------------------------------------------------
          // 1. 物理位置与重力轨迹计算 (Trajectory & Physics)
          // ----------------------------------------------------
          if (state.phase === 'FLYING' && state.resultData) {
            // X 轴：从屏幕左上外侧 (-width * 0.65) 大弧度翻滚滑向中心
            state.currentPos.x = (-width * 0.6) * Math.pow(1 - progress, 2.0);

            // Y 轴：重力加速度下坠 + 两次真实地面弹性反弹
            if (progress < 0.4) {
              // 阶段 1：天际重力下坠
              const p = progress / 0.4;
              state.currentPos.y = (-height * 0.6) * (1 - p * p);
            } else if (progress < 0.72) {
              // 阶段 2：初次触地弹跳
              if (!state.hasBounced1) {
                state.hasBounced1 = true;
                // 产生触地火花微粒
                for (let i = 0; i < 28; i++) {
                  particlesRef.current.push({
                    x: centerX + state.currentPos.x,
                    y: centerY + baseRadius * 1.15,
                    vx: (visualRandom() - 0.5) * 14 + 3,
                    vy: -visualRandom() * 10 - 3,
                    life: 1.0,
                    size: visualRandom() * 3 + 1.5,
                    color: visualRandom() > 0.35 ? '#FFD485' : '#E67E22',
                  });
                }
              }
              const p = (progress - 0.4) / 0.32;
              state.currentPos.y = (-height * 0.2) * 4 * p * (1 - p);
            } else if (progress < 0.9) {
              // 阶段 3：二次地面微弹
              if (!state.hasBounced2) {
                state.hasBounced2 = true;
                for (let i = 0; i < 14; i++) {
                  particlesRef.current.push({
                    x: centerX + state.currentPos.x,
                    y: centerY + baseRadius * 1.15,
                    vx: (visualRandom() - 0.5) * 8 + 2,
                    vy: -visualRandom() * 6 - 2,
                    life: 0.8,
                    size: visualRandom() * 2 + 1,
                    color: '#FFD485',
                  });
                }
              }
              const p = (progress - 0.72) / 0.18;
              state.currentPos.y = (-height * 0.05) * 4 * p * (1 - p);
            } else {
              // 阶段 4：贴地减速滑行并在边沿微颤
              const p = (progress - 0.9) / 0.1;
              state.currentPos.y = Math.sin(p * Math.PI * 2) * 4 * (1 - p);
            }

            // Z 轴：从背景深处扑向镜头焦点
            state.currentPos.z = -550 * Math.pow(1 - progress, 1.8);

            // 尾迹粒子 (飞行时持续释放流星尾尘)
            if (progress < 0.75 && visualRandom() > 0.25) {
              particlesRef.current.push({
                x: centerX + state.currentPos.x + (visualRandom() - 0.5) * 40,
                y: centerY - state.currentPos.y + (visualRandom() - 0.5) * 40,
                vx: (visualRandom() - 0.5) * 5 - 3,
                vy: (visualRandom() - 0.5) * 5,
                life: 0.75,
                size: visualRandom() * 3 + 1,
                color: visualRandom() > 0.5 ? '#FFD485' : '#8296D8',
              });
            }

            // ----------------------------------------------------
            // 2. 真实滚动动力学：前进位移与立体向前翻滚 (Somersault Rolling)
            // ----------------------------------------------------
            if (progress < 0.75) {
              // 高速向前翻滚：角速度与前进速度耦合 (向前滚 X + 斜向翻转 Y + 倾斜 Z)
              state.currentRot.x += state.spinVelocity.x;
              state.currentRot.y += state.spinVelocity.y;
              state.currentRot.z += state.spinVelocity.z;
              state.spinVelocity.x *= 0.975;
              state.spinVelocity.y *= 0.975;
              state.spinVelocity.z *= 0.975;
            } else {
              // 阶段 2：着地减速并自然滚进目标面（带真实边沿晃动摇摆 Wobble）
              const settleProgress = (progress - 0.75) / 0.25;
              const easeSettle = 1 - Math.pow(1 - settleProgress, 2.5);
              const wobble = Math.sin(settleProgress * Math.PI * 4) * (1 - easeSettle) * 0.12;

              state.currentRot.x = state.currentRot.x * (1 - easeSettle * 0.3) + (state.targetRotation.x + wobble) * (easeSettle * 0.3);
              state.currentRot.y = state.currentRot.y * (1 - easeSettle * 0.3) + (state.targetRotation.y + wobble * 0.7) * (easeSettle * 0.3);
              state.currentRot.z = state.currentRot.z * (1 - easeSettle * 0.3);
            }

            // 落地结算
            if (progress >= 1) {
              state.phase = 'SETTLED';
              state.currentPos = { x: 0, y: 0, z: 0 };
              state.currentRot = { ...state.targetRotation };
              setSettledResult(state.resultData);

              if (targetDC && state.resultData.total >= targetDC) {
                playCoinSound();
              }
            }
          } else {
            // SETTLED 静止呼吸微浮动
            state.currentPos.x = 0;
            state.currentPos.y = Math.sin(now * 0.002) * 6;
            state.currentPos.z = 0;

            state.currentRot.x = state.targetRotation.x + Math.sin(now * 0.0015) * 0.02;
            state.currentRot.y = state.targetRotation.y + Math.cos(now * 0.0015) * 0.02;
            state.currentRot.z = 0;
          }

          // ----------------------------------------------------
          // 3. 绘制地面全屏动态柔光阴影
          // ----------------------------------------------------
          const groundY = centerY + baseRadius * 1.25;
          const shadowDist = Math.max(0, -state.currentPos.y);
          const shadowScale = Math.max(0.25, 1 - shadowDist / (height * 0.5));
          const shadowAlpha = Math.max(0.06, 0.45 * shadowScale);

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(
            centerX + state.currentPos.x,
            groundY,
            Math.max(20, baseRadius * 0.85 * shadowScale),
            Math.max(6, baseRadius * 0.24 * shadowScale),
            0,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
          ctx.fill();
          ctx.restore();

          // ----------------------------------------------------
          // 4. 3D 正二十面体渲染 (高光晶面 Specular + Backface Culling)
          // ----------------------------------------------------
          const { x: rx, y: ry, z: rz } = state.currentRot;
          const cosX = Math.cos(rx), sinX = Math.sin(rx);
          const cosY = Math.cos(ry), sinY = Math.sin(ry);
          const cosZ = Math.cos(rz), sinZ = Math.sin(rz);

          const transformVertex = (v: number[]) => {
            const x = v[0] * baseRadius;
            const y = v[1] * baseRadius;
            const z = v[2] * baseRadius;

            const y1 = y * cosX - z * sinX;
            const z1 = y * sinX + z * cosX;

            const x2 = x * cosY + z1 * sinY;
            const z2 = -x * sinY + z1 * cosY;

            const x3 = x2 * cosZ - y1 * sinZ;
            const y3 = x2 * sinZ + y1 * cosZ;

            return [x3, y3, z2];
          };

          const transformedVertices = RAW_VERTICES.map(transformVertex);

          const lightDir = [0.45, 0.65, 0.75];
          const lLen = Math.sqrt(lightDir[0] ** 2 + lightDir[1] ** 2 + lightDir[2] ** 2);
          const lx = lightDir[0] / lLen, ly = lightDir[1] / lLen, lz = lightDir[2] / lLen;

          const visibleFaces: Array<{
            pts: number[][];
            num: number;
            depth: number;
            diffuse: number;
            specular: number;
            isFront: boolean;
          }> = [];

          for (const face of FACES) {
            const v0 = transformedVertices[face.verts[0]];
            const v1 = transformedVertices[face.verts[1]];
            const v2 = transformedVertices[face.verts[2]];

            const ax = v1[0] - v0[0], ay = v1[1] - v0[1], az = v1[2] - v0[2];
            const bx = v2[0] - v0[0], by = v2[1] - v0[1], bz = v2[2] - v0[2];
            const nx = ay * bz - az * by;
            const ny = az * bx - ax * bz;
            const nz = ax * by - ay * bx;

            // 背面剔除：nz > 0 表示朝向镜头
            if (nz > 0) {
              const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
              const normX = nx / nLen, normY = ny / nLen, normZ = nz / nLen;

              const diffuse = Math.max(0.15, normX * lx + normY * ly + normZ * lz);
              
              // Blinn-Phong 晶体反光高光 (Specular Highlight)
              const hx = lx, hy = ly, hz = lz + 1.0;
              const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
              const specDot = Math.max(0, (normX * hx + normY * hy + normZ * hz) / hLen);
              const specular = Math.pow(specDot, 20);

              const depth = (v0[2] + v1[2] + v2[2]) / 3;

              visibleFaces.push({
                pts: [v0, v1, v2],
                num: face.num,
                depth,
                diffuse,
                specular,
                isFront: face.num === state.targetRoll && state.phase === 'SETTLED',
              });
            }
          }

          // 深度排序
          visibleFaces.sort((a, b) => a.depth - b.depth);

          // 绘制每个可见晶面 (带反光高光扫射与立体棱边)
          for (const face of visibleFaces) {
            const p2d = face.pts.map(([x, y, z]) => {
              const worldX = x + state.currentPos.x;
              const worldY = y + state.currentPos.y;
              const worldZ = z + state.currentPos.z;
              const scale = fov / (fov + Math.max(-600, worldZ));
              return [centerX + worldX * scale, centerY - worldY * scale];
            });

            ctx.beginPath();
            ctx.moveTo(p2d[0][0], p2d[0][1]);
            ctx.lineTo(p2d[1][0], p2d[1][1]);
            ctx.lineTo(p2d[2][0], p2d[2][1]);
            ctx.closePath();

            const d = face.diffuse;
            const sp = face.specular;
            const isTarget = face.isFront;
            if (isTarget) {
              ctx.fillStyle = `rgba(230, 168, 92, 0.88)`;
            } else {
              const r = Math.min(255, Math.floor(18 + d * 40 + sp * 140));
              const g = Math.min(255, Math.floor(25 + d * 50 + sp * 140));
              const b = Math.min(255, Math.floor(48 + d * 75 + sp * 160));
              ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            }
            ctx.fill();

            // 金色金属棱边 (高光动态加粗)
            ctx.strokeStyle = isTarget
              ? 'rgba(255, 220, 120, 0.95)'
              : `rgba(230, 168, 92, ${0.5 + d * 0.45 + sp * 0.4})`;
            ctx.lineWidth = isTarget ? 3.5 : (2 + sp * 1.5);
            ctx.stroke();

            // 绘制晶面数字
            const faceCenterX = (p2d[0][0] + p2d[1][0] + p2d[2][0]) / 3;
            const faceCenterY = (p2d[0][1] + p2d[1][1] + p2d[2][1]) / 3;

            ctx.save();
            ctx.translate(faceCenterX, faceCenterY);

            const fontSize = isTarget ? Math.floor(baseRadius * 0.32) : Math.floor(baseRadius * 0.17);
            ctx.font = `900 ${fontSize}px 'Cinzel', 'Noto Serif SC', serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (isTarget) {
              ctx.fillStyle = '#0B1020';
              ctx.shadowColor = 'rgba(255, 212, 133, 0.95)';
              ctx.shadowBlur = 10;
            } else {
              ctx.fillStyle = `rgba(230, 168, 92, ${0.4 + d * 0.5 + sp * 0.3})`;
            }

            ctx.fillText(String(face.num), 0, 0);
            ctx.restore();
          }

          // ----------------------------------------------------
          // 5. 粒子特效系统渲染
          // ----------------------------------------------------
          const aliveParticles = [];
          for (const p of particlesRef.current) {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.022;
            if (p.life > 0) {
              ctx.fillStyle = p.color;
              ctx.globalAlpha = p.life;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size || 2.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1;
              aliveParticles.push(p);
            }
          }
          particlesRef.current = aliveParticles;
        }
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [targetDC]);

  const tier = targetDC !== undefined && settledResult ? getExplorationOutcome(settledResult.total, targetDC) : undefined;

  const handleConfirmAdvance = () => {
    if (!settledResult) return;
    onRollFinish(settledResult);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-[#05070F]/95 backdrop-blur-2xl select-none overflow-hidden animate-fade-in flex flex-col justify-between p-6">
      {/* 1. 动态全屏星空光晕背景 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-gradient-to-r from-[#E6A85C]/15 via-[#8296D8]/10 to-[#3B182B]/20 rounded-full blur-[110px] animate-pulse" />
      </div>

      {/* 2. 真正的全屏 3D Canvas 渲染视口 (跨越整个屏幕投掷与弹跳) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* 3. 顶部行动与检定指示浮层 */}
      <div className="relative z-20 text-center max-w-lg mx-auto pointer-events-auto">
        {actionTitle && (
          <div className="text-xs sm:text-sm font-bold text-[#E6A85C] mb-1 font-serif-title flex items-center justify-center gap-2">
            <span>🗡️ 执行行动：</span>
            <span className="text-[#FFD485] bg-[#151D30]/90 px-3 py-0.5 rounded-full border border-[#E6A85C]/40">
              {actionTitle}
            </span>
          </div>
        )}

        <div className="inline-flex items-center gap-2 px-5 py-1 rounded-full bg-[#0E1424]/95 border border-[#E6A85C]/50 shadow-2xl mt-1">
          <span className="text-base">🎲</span>
          <span className="text-xs sm:text-sm font-serif-title font-black text-[#FFD485] tracking-wider uppercase">
            {targetAttr ? `【${ATTRIBUTE_LABELS[targetAttr]}${targetSkill ? ` · ${targetSkill}` : ''}】D20 检定` : 'D&D 5e 二十面体 (D20) 物理投掷'}
          </span>
          {targetDC && (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono font-extrabold border border-amber-400/40">
              目标 DC {targetDC}
            </span>
          )}
        </div>

        <p className="text-[11px] text-[#8296D8] mt-1">
          {bonusBreakdown ? `角色定制加值: ${bonusBreakdown} (共计 ${bonus >= 0 ? `+${bonus}` : bonus})` : bonus !== 0 ? `角色调整加值: ${bonus >= 0 ? `+${bonus}` : bonus}` : '基于 D&D 5e 核心规则'}
        </p>
      </div>

      {/* 4. 底部判定战报与推进确认面板 (无重投，结果与 3D 骰面 100% 一致) */}
      <div className="relative z-20 text-center max-w-lg w-full mx-auto flex flex-col items-center gap-2.5 pointer-events-auto">
        {!settledResult && (
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-serif-title font-bold text-[#FFD485] animate-pulse bg-[#0E1424]/90 px-6 py-2 rounded-full border border-[#E6A85C]/40 shadow-xl">
            <span className="animate-spin text-base">🔮</span>
            <span>从虚空中投掷命运之骰，锁定因果……</span>
          </div>
        )}

        {settledResult && (
          <div className="w-full bg-[#0E1424]/95 border border-[#E6A85C]/60 p-4 rounded-2xl shadow-2xl backdrop-blur-md animate-fade-in-up flex flex-col items-center gap-2.5">
            {/* 判定等级标语 */}
            <div className="text-sm sm:text-base font-bold">
              {tier ? <span className={settledResult.total >= (targetDC ?? 0) ? 'text-emerald-400' : 'text-amber-400'}>
                {EXPLORATION_OUTCOME_LABELS[tier]} · 总点数 {settledResult.total} / DC {targetDC}
              </span> : <span className="text-[#FFD485]">D20 投掷点数 {settledResult.roll}</span>}
            </div>

            <p className="text-xs text-[#8296D8] font-mono">
              {settledResult.text}
            </p>
            {outcomeSummary && <p className="text-sm leading-relaxed text-[#F1E5CE]">{outcomeSummary}</p>}

            <div className="w-full pt-2 border-t border-[#8296D8]/20 flex flex-wrap items-center justify-center gap-2">
              {onOpenJournal && <button type="button" onClick={onOpenJournal} className="rounded-xl border border-[#E6A85C]/40 px-4 py-2.5 text-sm text-[#FFD485] hover:bg-[#E6A85C]/15">打开存档</button>}
              <button
                type="button"
                onClick={handleConfirmAdvance}
                className="btn-gold w-full sm:w-auto px-10 py-2.5 rounded-xl text-sm font-extrabold shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>✨ 确认判定并推进剧情</span>
                <span>➔</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
