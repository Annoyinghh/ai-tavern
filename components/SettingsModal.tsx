'use client';
// ============================================================
// AI 酒馆 - AI 模型与主持风格设置 (Galgame 风格)
// ============================================================

import { useState } from 'react';
import type { AISettings, DMPersonality } from '@/lib/types';
import { playCoinSound } from '@/lib/audio';
import { loadAISettings, saveAISettings } from '@/lib/preferences';
import EileenAside from './EileenAside';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AISettings) => void;
}

export default function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<AISettings>(() => loadAISettings());
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchStatusMsg, setFetchStatusMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    saveAISettings(settings);
    playCoinSound();
    onSave(settings);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 800);
  };

  const personalities: { key: DMPersonality; name: string; desc: string }[] = [
    { key: 'classic', name: '🍺 经典酒馆老汤姆', desc: '风趣幽默，注重剧情氛围与冒险代入感' },
    { key: 'dark', name: '👁️ 黑暗哥特 / 克苏鲁', desc: '冷酷诡谲，充满神秘恐怖与不可名状压迫感' },
    { key: 'humorous', name: '🤡 欢声笑语无厘头', desc: '轻松搞笑，充满奇妙吐槽与戏剧反转效果' },
    { key: 'epic', name: '⚔️ 史诗勇者漫', desc: '热血沸腾，宏大壮丽的战场与英雄命运之名' },
    { key: 'strict', name: '📏 严谨硬核规则型', desc: '严格校验 DC 技能与生命值，硬核生存挑战' },
  ];

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setFetchStatusMsg('⏳ 正在拉取 API 可用模型列表…');
    try {
      let cleanBaseUrl = (settings.baseUrl || '').trim().replace(/\/+$/, '');
      if (!cleanBaseUrl) {
        cleanBaseUrl = 'https://api.openai.com/v1';
      }
      const modelsUrl = cleanBaseUrl.endsWith('/models') ? cleanBaseUrl : `${cleanBaseUrl}/models`;

      const res = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: unknown = await res.json();
      const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      const models = Array.isArray(record.data) ? record.data
        : Array.isArray(record.models) ? record.models : Array.isArray(data) ? data : [];
      const preferName = Array.isArray(record.models) && !Array.isArray(record.data);
      const modelList = models.flatMap((model: unknown): string[] => {
        if (typeof model === 'string') return model.trim() ? [model] : [];
        if (!model || typeof model !== 'object') return [];
        const entry = model as Record<string, unknown>;
        const candidates = preferName ? [entry.name, entry.id] : [entry.id, entry.name];
        const name = candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
        return name ? [name] : [];
      });

      if (modelList.length > 0) {
        setFetchedModels(modelList);
        setFetchStatusMsg(`✅ 成功拉取 ${modelList.length} 个可用模型！`);
        if (!settings.model || !modelList.includes(settings.model)) {
          setSettings(prev => ({ ...prev, model: modelList[0] }));
        }
      } else {
        setFetchStatusMsg('⚠️ 成功连接但未返回模型列表，请直接在上方框内粘贴');
      }
    } catch (err: unknown) {
      console.warn('Fetch models error:', err);
      setFetchStatusMsg(`⚠️ 获取失败 (${err instanceof Error ? err.message : '网络限速/跨域'})，可直接手动粘贴`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in-up" onClick={onClose}>
      <div
        className="galgame-card rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto border border-[#E6A85C]/35"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-[#8296D8]/20 pb-3">
          <h3 className="text-lg font-bold font-serif-title text-[#FFD485] flex items-center gap-2">
            <span>⚙️</span> AI 模型与 DM 风格设置
          </h3>
          <button onClick={onClose} className="text-[#8296D8] hover:text-[#FFD485] text-lg font-bold">✕</button>
        </div>

        <EileenAside context="settings" />

        {/* API Key 与 Base URL */}
        <div className="space-y-3 bg-[#151D30] text-[#F1E5CE] p-4 rounded-xl border border-[#8296D8]/20">
          <h4 className="text-sm font-bold text-[#FFD485] flex items-center gap-1.5">
            <span>🔗</span> 自定义 API 接口 (可选)
          </h4>
          <p className="text-xs text-[#8296D8]">
            留空将自动使用后端默认接口或内建本地模拟回应。
          </p>

          <div>
            <label className="text-xs text-[#F1E5CE]/80 block mb-1">API Key</label>
            <input
              type="password"
              placeholder="sk-..."
              value={settings.apiKey}
              onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
              className="tavern-input py-1.5 text-xs"
            />
          </div>

          <div>
            <label className="text-xs text-[#F1E5CE]/80 block mb-1">Base URL (兼容 OpenAI 格式)</label>
            <input
              type="text"
              placeholder="https://api.openai.com/v1 或 本地 http://localhost:11434/v1"
              value={settings.baseUrl}
              onChange={e => setSettings({ ...settings, baseUrl: e.target.value })}
              className="tavern-input py-1.5 text-xs"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-[#F1E5CE]/80">模型名称 (Model) / 粘贴模型标识</label>
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={isFetchingModels}
                className="text-[11px] text-[#FFD485] hover:text-amber-300 bg-[#1E2942] hover:bg-[#28385A] border border-[#E6A85C]/40 px-2.5 py-0.5 rounded flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
              >
                <span>{isFetchingModels ? '⏳' : '🔄'}</span>
                <span>{isFetchingModels ? '查询中...' : '获取可用模型列表'}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <input
                type="text"
                placeholder="直接输入/粘贴模型名称 (如: deepseek-v4-flash / gpt-4o-mini)"
                value={settings.model}
                onChange={e => setSettings({ ...settings, model: e.target.value })}
                className="w-full flex-1 px-3 py-1.5 rounded-lg border border-[#8296D8]/30 bg-[#0B1020] text-xs font-mono text-[#FFD485] focus:outline-none focus:border-[#FFD485] placeholder:text-[#8296D8]/40"
              />

              <select
                value={fetchedModels.includes(settings.model) ? settings.model : ''}
                onChange={e => {
                  if (e.target.value) setSettings({ ...settings, model: e.target.value });
                }}
                className="px-3 py-1.5 rounded-lg border border-[#E6A85C]/40 text-xs sm:w-44 bg-[#0B1020] text-[#FFD485] cursor-pointer focus:outline-none focus:border-[#FFD485]"
              >
                <option value="">下拉快速选库...</option>
                {fetchedModels.length > 0 ? (
                  fetchedModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))
                ) : (
                  <>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="deepseek-chat">deepseek-chat</option>
                    <option value="deepseek-reasoner">deepseek-reasoner</option>
                    <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="qwen2.5-72b-instruct">qwen2.5-72b</option>
                  </>
                )}
              </select>
            </div>

            {fetchStatusMsg && (
              <p className="text-[11px] mt-1.5 text-[#FFD485] animate-fade-in font-medium">
                {fetchStatusMsg}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-[#F1E5CE]/80 block mb-1">创造力 (Temp: {settings.temperature})</label>
            <input
              type="range"
              min={0.2}
              max={1.2}
              step={0.1}
              value={settings.temperature}
              onChange={e => setSettings({ ...settings, temperature: Number(e.target.value) })}
              className="w-full mt-1 accent-[#E6A85C]"
            />
          </div>
        </div>

        {/* DM 人设 */}
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-[#FFD485]">🎭 DM 主持性格风格</h4>
          <div className="space-y-1.5">
            {personalities.map(p => (
              <button
                key={p.key}
                onClick={() => setSettings({ ...settings, dmPersonality: p.key })}
                className={`w-full text-left p-3 rounded-xl text-xs transition-all flex justify-between items-center ${
                  settings.dmPersonality === p.key
                    ? 'bg-[#18243C] text-[#FFD485] border border-[#E6A85C] shadow-md font-bold'
                    : 'bg-[#151D30] text-[#F1E5CE]/80 hover:bg-[#1E2942] border border-[#8296D8]/15'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold">{p.name}</div>
                  <div className="text-[#8296D8] text-[11px] mt-0.5">{p.desc}</div>
                </div>
                {settings.dmPersonality === p.key && <span className="text-[#FFD485] text-sm">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-between items-center pt-2">
          {savedNotice ? (
            <span className="text-xs text-[#52B788] font-bold">✓ 设置已保存！</span>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3.5 py-1.5 rounded-lg text-xs text-[#8296D8] hover:text-[#F1E5CE] transition-colors">
              取消
            </button>
            <button onClick={handleSave} className="btn-gold px-5 py-1.5 rounded-lg text-xs font-bold shadow-md">
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
