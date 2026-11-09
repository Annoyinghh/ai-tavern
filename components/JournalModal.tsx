'use client';
// ============================================================
// AI 酒馆 - 冒险编年史与多档位存档管理 (Galgame 风格)
// ============================================================

import { useRef, useState, type ChangeEvent } from 'react';
import { TavernState } from '@/lib/types';
import {
  exportAdventureChronicle,
  listSaveSlots,
  saveStateToSlot,
  loadStateFromSlot,
  deleteSaveSlot,
  SaveSlotMetadata,
} from '@/lib/journal';
import { exportCampaignSave, importCampaignSave } from '@/lib/saveFile';
import { playCoinSound } from '@/lib/audio';

const MAX_SAVE_BYTES = 12 * 1024 * 1024;

interface JournalModalProps {
  state: TavernState;
  onClose: () => void;
  onLoadState: (newState: TavernState) => void;
}

function download(text: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  playCoinSound();
}

export default function JournalModal({
  state,
  onClose,
  onLoadState,
}: JournalModalProps) {
  const [slots, setSlots] = useState<SaveSlotMetadata[]>(() => listSaveSlots());
  const [newSlotName, setNewSlotName] = useState('');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [pendingImport, setPendingImport] = useState<TavernState | null>(null);
  const [readingSave, setReadingSave] = useState(false);
  const [saveError, setSaveError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const handleExportMarkdown = () => {
    const md = exportAdventureChronicle(state);
    navigator.clipboard.writeText(md).then(() => {
      playCoinSound();
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    });
  };

  const handleDownloadMarkdown = () => {
    download(exportAdventureChronicle(state), 'text/markdown;charset=utf-8', `${state.character?.name || '未知勇者'}_冒险史诗.md`);
  };

  const handleDownloadSave = (campaign: TavernState, name?: string) => {
    download(exportCampaignSave(campaign), 'application/json', `${name || campaign.currentScript?.title || 'AI酒馆'}_存档.json`);
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setSaveError('');
    setPendingImport(null);
    if (file.size > MAX_SAVE_BYTES) {
      setSaveError('存档文件超过 12 MB，无法导入。');
      return;
    }
    setReadingSave(true);
    try {
      setPendingImport(importCampaignSave(await file.text()));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '无法读取存档文件。');
    } finally {
      setReadingSave(false);
    }
  };

  const loadCampaign = (campaign: TavernState) => {
    try {
      onLoadState(campaign);
      playCoinSound();
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '无法读取存档，请重试。');
    }
  };

  const handleSaveNewSlot = () => {
    const name = newSlotName.trim() || `存档 ${slots.length + 1}`;
    const id = Date.now().toString(36);
    saveStateToSlot(id, name, state);
    setNewSlotName('');
    setSlots(listSaveSlots());
    playCoinSound();
  };

  const readSlot = (slotId: string) => {
    setSaveError('');
    try {
      const loaded = loadStateFromSlot(slotId);
      if (loaded) return loaded;
    } catch {
      // The browser may deny access to local storage.
    }
    setSaveError('无法读取这个存档位。');
    return null;
  };

  const handleDeleteSlot = (slotId: string) => {
    if (confirm('确定要删除这个存档档位吗？')) {
      deleteSaveSlot(slotId);
      setSlots(listSaveSlots());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[130] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in-up" onClick={onClose}>
      <div
        className="galgame-card rounded-2xl p-6 max-w-xl w-full space-y-5 shadow-2xl max-h-[88vh] overflow-y-auto border border-[#E6A85C]/35"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-[#8296D8]/20 pb-3">
          <h3 id="journal-title" className="text-lg font-bold font-serif-title text-[#FFD485] flex items-center gap-2">
            <span>📖</span> 冒险编年史 & 多档位存档
          </h3>
          <button type="button" onClick={onClose} aria-label="关闭存档" className="text-[#8296D8] hover:text-[#FFD485] text-lg font-bold">✕</button>
        </div>
        {saveError && <p role="alert" className="text-xs text-red-300">{saveError}</p>}

        <div className="bg-[#151D30] text-[#F1E5CE] p-4 rounded-xl border border-[#8296D8]/20 space-y-3">
          <h4 className="text-sm font-bold text-[#FFD485]">JSON 战役存档</h4>
          <p className="text-xs text-[#F1E5CE]/80 leading-relaxed">备份当前剧本、队伍和进度，也能在其他浏览器继续未完成的战斗或检定。</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => handleDownloadSave(state)} className="btn-gold px-4 py-1.5 rounded-lg text-xs font-bold">导出当前进度</button>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={readingSave} className="bg-[#0B1020] border border-[#8296D8]/30 hover:border-[#E6A85C]/50 px-4 py-1.5 rounded-lg text-xs disabled:opacity-60">
              {readingSave ? '正在读取…' : '导入 JSON'}
            </button>
            <input type="file" accept=".json,application/json" ref={fileInput} onChange={handleImportFile} hidden />
          </div>
          {pendingImport && <div className="border-t border-[#8296D8]/20 pt-3 space-y-2">
            <p className="text-xs leading-relaxed">《{pendingImport.currentScript?.title || '出发前整备'}》 · 第 {pendingImport.gameTime.day} 天。读取后将替换当前自动存档。</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => loadCampaign(pendingImport)} className="btn-gold px-3 py-1.5 rounded-md text-xs font-bold">确认读取</button>
              <button type="button" onClick={() => { setPendingImport(null); setSaveError(''); }} className="px-3 py-1.5 text-xs">取消导入</button>
            </div>
          </div>}
        </div>

        {/* 导出冒险传奇 */}
        <div className="bg-[#151D30] text-[#F1E5CE] p-4 rounded-xl border border-[#8296D8]/20 space-y-3">
          <h4 className="text-sm font-bold text-[#FFD485] flex items-center gap-2">
            <span>📜</span> 导出《冒险史诗传记》
          </h4>
          <p className="text-xs text-[#F1E5CE]/80 leading-relaxed">
            将当前的全部对话、角色能力、战斗细节与跑团历程一键整理导出为格式精美优雅的 Markdown 传记文本。
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleExportMarkdown}
              className="btn-gold flex-1 py-1.5 rounded-lg text-xs font-bold"
            >
              {copiedNotice ? '✓ 已复制 Markdown 内容到剪贴板！' : '📋 复制 Markdown 传记'}
            </button>
            <button
              onClick={handleDownloadMarkdown}
              className="bg-[#0B1020] border border-[#8296D8]/30 hover:border-[#E6A85C]/50 text-[#F1E5CE] px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              💾 下载 .md 文件
            </button>
          </div>
        </div>

        {/* 存档管理 */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[#FFD485] flex items-center gap-1.5">
            <span>💾</span> 多档位进度存档管理
          </h4>

          {/* 新增存档 */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="输入新存档名称（例如：古堡第三层前夕）"
              value={newSlotName}
              onChange={e => setNewSlotName(e.target.value)}
              className="tavern-input py-1.5 text-xs flex-1"
            />
            <button onClick={handleSaveNewSlot} className="btn-gold px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap">
              + 保存当前进度
            </button>
          </div>

          {/* 存档列表 */}
          <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
            {slots.length === 0 ? (
              <p className="text-xs text-[#8296D8]/70 text-center py-4 italic">暂无自定义存档位</p>
            ) : (
              slots.map(s => (
                <div
                  key={s.slotId}
                  className="bg-[#151D30] text-[#F1E5CE] p-3 rounded-xl border border-[#8296D8]/20 flex justify-between items-center text-xs hover:border-[#E6A85C]/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[#FFD485] truncate" title={s.name}>{s.name}</div>
                    <div className="text-[#8296D8] text-[10px] mt-0.5">
                      角色: {s.charName} · 第 {s.day} 天 · {s.updatedAt}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => { const loaded = readSlot(s.slotId); if (loaded) loadCampaign(loaded); }}
                      className="btn-gold px-3 py-1 rounded-md text-[11px] font-bold"
                    >
                      读取
                    </button>
                    <button
                      onClick={() => { const loaded = readSlot(s.slotId); if (loaded) handleDownloadSave(loaded, s.name); }}
                      className="text-[#F1E5CE] hover:text-[#FFD485] text-[11px] px-1"
                      aria-label={`导出 ${s.name} 的 JSON 存档`}
                    >
                      导出
                    </button>
                    <button
                      onClick={() => handleDeleteSlot(s.slotId)}
                      className="text-red-400 hover:text-red-300 text-[11px] px-1"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-[#8296D8]/20 text-right">
          <button onClick={onClose} className="btn-gold px-5 py-1.5 rounded-lg text-xs">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
