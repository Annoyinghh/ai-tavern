'use client';
// ============================================================
// AI 酒馆 - 剧本分支可视化节点图 (Galgame 风格)
// ============================================================

import { Script } from '@/lib/types';

interface ScriptGraphModalProps {
  script: Script | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectChapter: (chapterId: string) => void;
}

export default function ScriptGraphModal({
  script,
  isOpen,
  onClose,
  onSelectChapter,
}: ScriptGraphModalProps) {
  if (!isOpen || !script) return null;

  const chapters = Object.values(script.chapters);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in-up" onClick={onClose}>
      <div
        className="galgame-card rounded-2xl p-6 max-w-5xl w-full space-y-4 shadow-2xl max-h-[90vh] flex flex-col border border-[#E6A85C]/35"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-[#8296D8]/20 pb-3">
          <div>
            <h3 className="text-lg font-bold font-serif-title text-[#FFD485] flex items-center gap-2">
              <span>🗺️</span> 剧本分支架构图：《{script.title}》
            </h3>
            <p className="text-xs text-[#8296D8] mt-0.5">
              共有 {chapters.length} 个章节分支 · 点击节点直接进入该章节编辑
            </p>
          </div>
          <button onClick={onClose} className="text-[#8296D8] hover:text-[#FFD485] text-lg font-bold">✕</button>
        </div>

        {/* 节点树图形化容器 */}
        <div className="flex-1 overflow-auto bg-[#0B1020]/90 p-5 rounded-xl border border-[#8296D8]/20 min-h-[350px] space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {chapters.map(ch => {
              const isStart = ch.id === script.startChapter;
              const hasChoices = ch.choices && ch.choices.length > 0;

              return (
                <div
                  key={ch.id}
                  onClick={() => {
                    onSelectChapter(ch.id);
                    onClose();
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] shadow-lg relative ${
                    isStart
                      ? 'bg-[#15231C] border-[#52B788] text-[#F1E5CE]'
                      : 'bg-[#151D30] border-[#8296D8]/25 text-[#F1E5CE] hover:border-[#E6A85C]'
                  }`}
                >
                  {isStart && (
                    <span className="absolute -top-2.5 left-4 bg-[#52B788] text-[10px] px-2 py-0.5 rounded-full font-bold text-[#0B1020] shadow">
                      ★ 起始章节
                    </span>
                  )}

                  <div className="font-bold text-sm text-[#FFD485] mb-1 truncate">
                    {ch.title}
                  </div>

                  <p className="text-xs text-[#F1E5CE]/70 line-clamp-2 mb-2.5">
                    {ch.content || '（暂无详细描述）'}
                  </p>

                  {ch.dcCheck && (
                    <div className="mb-2 px-2 py-1 bg-[#0B1020] rounded-lg border border-[#E6A85C]/30 text-[10px] text-[#FFD485] flex items-center justify-between font-mono">
                      <span>🎯 DC 检定: {ch.dcCheck.attribute.toUpperCase()}</span>
                      <span className="font-bold">DC {ch.dcCheck.dc}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#8296D8]/15 text-[11px] space-y-1">
                    <span className="text-[#8296D8] block text-[10px]">下游选择分支:</span>
                    {hasChoices ? (
                      ch.choices.map((choice, i) => {
                        const targetCh = script.chapters[choice.nextChapter];
                        return (
                          <div key={i} className="flex items-center gap-1 text-[#FFD485] truncate">
                            <span className="text-xs">➔</span>
                            <span className="truncate">{choice.text}</span>
                            {targetCh && (
                              <span className="text-[10px] text-[#8296D8]">({targetCh.title})</span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-[#52B788] font-bold text-[10px]">🏁 剧本终点 / 结局</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-[#8296D8]">💡 提示：点击任意分支卡片可快速调出该章节进行编辑</span>
          <button onClick={onClose} className="btn-gold px-4 py-1.5 rounded-lg text-xs font-bold">
            关闭视图
          </button>
        </div>
      </div>
    </div>
  );
}
