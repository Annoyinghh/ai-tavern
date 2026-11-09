'use client';
// ============================================================
// AI 酒馆 - Galgame 回想记录 (Backlog / 历史对白抽屉)
// ============================================================

import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '@/lib/types';
import CharacterAvatarRenderer from './CharacterAvatarRenderer';

interface GalgameHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
}

export default function GalgameHistoryDrawer({
  isOpen,
  onClose,
  messages,
}: GalgameHistoryDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isOpen, messages.length]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-end backdrop-blur-sm animate-fade-in-up"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-full bg-[#0E1424]/95 border-l border-[#E6A85C]/35 shadow-2xl p-5 flex flex-col justify-between overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-[#8296D8]/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[#FFD485] text-lg">📜</span>
            <h3 className="text-base font-bold font-serif-title text-[#FFD485]">
              剧情回想记录 (Backlog)
            </h3>
            <span className="text-xs text-[#8296D8] font-mono">
              ({messages.length} 条记录)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#8296D8] hover:text-[#FFD485] text-lg font-bold p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 历史对白滚动列表 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-4 py-4 pr-1 scroll-smooth"
        >
          {messages.length === 0 ? (
            <div className="text-center text-xs text-[#8296D8]/60 py-16">
              暂无历史对白记录
            </div>
          ) : (
            messages.map(m => {
              const isPlayer = m.role === 'player';
              const isDice = m.role === 'dice';
              const isSystem = m.role === 'system';

              if (isSystem) {
                return (
                  <div
                    key={m.id}
                    className="text-center text-[11px] text-[#8296D8] bg-[#151D30]/60 border border-[#8296D8]/20 py-1.5 px-3 rounded-full mx-auto max-w-md italic"
                  >
                    {m.content}
                  </div>
                );
              }

              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    isPlayer
                      ? 'bg-[#15231C]/60 border-[#52B788]/30 flex-row-reverse'
                      : isDice
                      ? 'bg-[#2A1820]/60 border-[#E67E22]/30'
                      : 'bg-[#151D30]/75 border-[#8296D8]/20'
                  }`}
                >
                  <CharacterAvatarRenderer
                    characterId={m.characterId || (isPlayer ? 'traveler' : 'old_tom')}
                    expression={m.expression || 'normal'}
                    size="sm"
                    shape="circle"
                  />

                  <div className={`flex-1 space-y-1 ${isPlayer ? 'text-right' : 'text-left'}`}>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="text-[#FFD485]">{m.sender}</span>
                      {m.speakerTitle && (
                        <span className="text-[10px] text-[#8296D8] font-normal">
                          [{m.speakerTitle}]
                        </span>
                      )}
                      <span className="text-[10px] text-[#8296D8]/60 font-mono">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-xs sm:text-sm text-[#F1E5CE] leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 底部返回操作 */}
        <div className="pt-3 border-t border-[#8296D8]/20 flex justify-between items-center text-xs">
          <span className="text-[#8296D8]">按 ESC 或点击右上角关闭</span>
          <button
            onClick={onClose}
            className="btn-gold px-4 py-1.5 rounded-lg font-bold"
          >
            返回舞台
          </button>
        </div>
      </div>
    </div>
  );
}
