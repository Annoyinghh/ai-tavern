'use client';
// ============================================================
// AI 酒馆 - 战役全局记忆与同伴羁绊中枢 (Memory Radar Modal)
// 展示长剧本全局状态：历史信标、同伴好感度雷达、已知秘密与剧情前情提要
// ============================================================

import { StoryMemory } from '@/lib/types';

interface MemoryRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory?: StoryMemory;
}

export default function MemoryRadarModal({ isOpen, onClose, memory }: MemoryRadarModalProps) {
  if (!isOpen) return null;

  const companionConfig: Record<string, { name: string; title: string; avatar: string; color: string }> = {
    shadowheart: { name: '影心', title: '暗影神官 · 莎尔信徒', avatar: '🖤', color: '#9B59B6' },
    astarion: { name: '阿斯代伦', title: '高等精灵 · 吸血鬼衍体', avatar: '🩸', color: '#E74C3C' },
    gale: { name: '盖尔', title: '深水城博学法师 · 耐色法球', avatar: '🔮', color: '#3498DB' },
    wyll: { name: '威尔', title: '边境之刃 · 邪术师', avatar: '🗡️', color: '#E67E22' },
    laezel: { name: '莱埃泽尔', title: '吉斯洋基利刃 · 养育间精兵', avatar: '⚔️', color: '#2ECC71' },
  };

  const milestones = memory?.milestones || [];
  const affinity = memory?.companionAffinity || {
    shadowheart: 10,
    astarion: 10,
    gale: 10,
    wyll: 10,
    laezel: 10,
  };
  const secrets = memory?.discoveredSecrets || [];
  const summary = memory?.storySummary || '冒险才刚刚拉开序幕……';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#0E1424] border-2 border-[#E6A85C]/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#F1E5CE]">
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 border-b border-[#E6A85C]/30 bg-[#151D30]/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <h2 className="text-base sm:text-lg font-serif-title font-bold text-[#FFD485] tracking-wide">
              长线战役全局记忆库 & 同伴羁绊
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#1F2942] hover:bg-[#E74C3C] text-xs text-[#8296D8] hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 内容滚动区域 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs sm:text-sm">
          {/* 1. 同伴羁绊好感度雷达 */}
          <div className="bg-[#151D30]/60 border border-[#8296D8]/20 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-[#FFD485] flex items-center gap-1.5">
              <span>🤝</span> 同伴关系与好感度 (Affinity Radar)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(affinity).map(([compId, score]) => {
                const comp = companionConfig[compId] || { name: compId, title: '旅途伙伴', avatar: '👤', color: '#E6A85C' };
                const pct = Math.min(100, Math.max(0, score));
                return (
                  <div key={compId} className="bg-[#0B1020]/70 p-2.5 rounded-lg border border-[#8296D8]/20 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span>{comp.avatar}</span>
                        <span className="font-bold text-[#FFD485]">{comp.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-[#8296D8]">好感 {score}/100</span>
                    </div>
                    <div className="text-[10px] text-[#8296D8]/80">{comp.title}</div>
                    <div className="w-full h-1.5 bg-[#1F2942] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: comp.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. 核心剧情重大信标 */}
          <div className="bg-[#151D30]/60 border border-[#8296D8]/20 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-[#FFD485] flex items-center gap-1.5">
              <span>📜</span> 核心历史信标 (Milestones)
            </h3>
            {milestones.length === 0 ? (
              <p className="text-[#8296D8] italic text-xs">尚未达成重大分支信标，随着主线抉择将自动沉淀。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {milestones.map((m, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-[#E6A85C]/15 border border-[#E6A85C]/40 text-[#FFD485] text-xs font-medium flex items-center gap-1"
                  >
                    <span>✦</span>
                    <span>{m}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 3. 已知秘密情报与环境暗线 */}
          <div className="bg-[#151D30]/60 border border-[#8296D8]/20 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-[#FFD485] flex items-center gap-1.5">
              <span>🗝️</span> 场景探索搜集的秘密情报 (Discovered Secrets)
            </h3>
            {secrets.length === 0 ? (
              <p className="text-[#8296D8] italic text-xs">暂无发现。在各章节使用「场景探索」检定可搜寻暗道与秘密！</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-[#F1E5CE]">
                {secrets.map((sec, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#E6A85C] mt-0.5">🔍</span>
                    <span>{sec}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 4. 状态特质与前情提要浓缩记忆 */}
          <div className="bg-[#151D30]/60 border border-[#8296D8]/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#FFD485] flex items-center gap-1.5">
                <span>📖</span> 跨章节全篇剧情压缩摘要 (AI Context Ledger)
              </h3>
              <span className="text-[10px] text-[#8296D8]">自动喂给 AI DM</span>
            </div>
            <div className="p-3 bg-[#0B1020]/90 rounded-lg border border-[#8296D8]/30 font-mono text-xs text-[#8296D8] leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
              {summary}
            </div>
          </div>
        </div>

        {/* 底部关闭栏 */}
        <div className="px-6 py-3 border-t border-[#E6A85C]/20 bg-[#151D30]/80 flex justify-end">
          <button
            onClick={onClose}
            className="btn-gold px-5 py-1.5 rounded-lg text-xs font-bold"
          >
            返回冒险舞台
          </button>
        </div>
      </div>
    </div>
  );
}
