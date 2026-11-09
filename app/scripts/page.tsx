'use client';
// ============================================================
// AI 酒馆 - 剧本工坊与可视化分支编辑器 (Galgame 风格)
// ============================================================

import { useState, useEffect } from 'react';
import { type ChapterReward, Script, ScriptChapter } from '@/lib/types';
import {
  createEmptyScript, addChapter, updateChapter, deleteChapter,
  createPresetScript, getDefaultScripts, importScript, exportScript, PresetKey,
} from '@/lib/scripts';
import { loadScripts, saveScripts } from '@/lib/gameState';
import EileenAside from '@/components/EileenAside';
import ScriptGraphModal from '@/components/ScriptGraphModal';
import { playCoinSound } from '@/lib/audio';
import { getSceneProfile, getWorldProfile, isEndingChapter, sceneOptions } from '@/lib/worldLore';
import { ENEMY_CATALOG, isEnemyKind } from '@/lib/combat/catalog';
import Link from 'next/link';

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const stored = loadScripts();
      const initial = stored.length ? stored : getDefaultScripts();
      setScripts(initial);
      setSelectedId(initial[0].id);
      setSelectedChapterId(initial[0].startChapter);
      setHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hydrated) saveScripts(scripts);
  }, [scripts, hydrated]);

  const selected = scripts.find(s => s.id === selectedId) || null;
  const selectedChapter = selected && selectedChapterId
    ? selected.chapters[selectedChapterId] || null
    : null;

  const addScript = (script: Script) => {
    setScripts(prev => [...prev, script]);
    setSelectedId(script.id);
    setSelectedChapterId(script.startChapter);
    playCoinSound();
  };
  const handleCreate = () => addScript(createEmptyScript());

  const handleImport = () => {
    const input = prompt('粘贴剧本 JSON 文本：');
    if (!input) return;
    const s = importScript(input);
    if (s) {
      setScripts(prev => [...prev, s]);
      setSelectedId(s.id);
      playCoinSound();
    } else {
      alert('JSON 格式无效，请核对后再试');
    }
  };

  const handleExport = () => {
    if (!selected) return;
    const json = exportScript(selected);
    navigator.clipboard.writeText(json).then(() => {
      playCoinSound();
      alert('剧本 JSON 已复制到剪贴板！');
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定要删除这个剧本吗？')) return;
    setScripts(prev => prev.filter(s => s.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setSelectedChapterId(null);
    }
  };

  const handleAddChapter = () => {
    if (!selected) return;
    const updated = addChapter(selected, '新章节');
    setScripts(prev => prev.map(s => s.id === selected.id ? updated : s));
    const newCh = Object.values(updated.chapters).find(c => !selected.chapters[c.id]);
    if (newCh) setSelectedChapterId(newCh.id);
    playCoinSound();
  };

  const handleUpdateScript = <K extends keyof Script>(field: K, value: Script[K]) => {
    if (!selected) return;
    setScripts(prev =>
      prev.map(s => s.id === selected.id ? { ...s, [field]: value, updatedAt: new Date().toISOString() } : s)
    );
  };

  const handleUpdateChapter = (field: keyof ScriptChapter, value: unknown) => {
    if (!selected || !selectedChapterId) return;
    setScripts(prev =>
      prev.map(s =>
        s.id === selected.id
          ? updateChapter(s, selectedChapterId, { [field]: value } as Partial<ScriptChapter>)
          : s
      )
    );
  };

  const setChapterReward = (reward: ChapterReward) => {
    handleUpdateChapter('reward', reward.gold || reward.items.length ? reward : undefined);
  };

  const handleDeleteChapter = (chId: string) => {
    if (!selected || chId === selected.startChapter) {
      alert('不能删除起始章节');
      return;
    }
    if (!confirm('确定删除这个章节吗？')) return;
    setScripts(prev =>
      prev.map(s => s.id === selected.id ? deleteChapter(s, chId) : s)
    );
    setSelectedChapterId(null);
  };

  const handleSetStart = (chId: string) => {
    if (!selected) return;
    setScripts(prev =>
      prev.map(s => s.id === selected.id ? { ...s, startChapter: chId, updatedAt: new Date().toISOString() } : s)
    );
  };

  const handleLoadPreset = (preset: PresetKey) => addScript(createPresetScript(preset));

  const handleAddChoice = () => {
    if (!selected || !selectedChapterId) return;
    const ch = selected.chapters[selectedChapterId];
    if (!ch) return;
    const newChoice = { text: '新剧情分支选项', nextChapter: selectedChapterId };
    setScripts(prev =>
      prev.map(s =>
        s.id === selected.id
          ? updateChapter(s, selectedChapterId, { choices: [...ch.choices, newChoice] })
          : s
      )
    );
  };

  const handleUpdateChoice = (index: number, field: 'text' | 'nextChapter', value: string) => {
    if (!selected || !selectedChapterId) return;
    const ch = selected.chapters[selectedChapterId];
    if (!ch) return;
    const newChoices = [...ch.choices];
    newChoices[index] = { ...newChoices[index], [field]: value };
    setScripts(prev =>
      prev.map(s =>
        s.id === selected.id
          ? updateChapter(s, selectedChapterId, { choices: newChoices })
          : s
      )
    );
  };

  const handleDeleteChoice = (index: number) => {
    if (!selected || !selectedChapterId) return;
    const ch = selected.chapters[selectedChapterId];
    if (!ch) return;
    const newChoices = ch.choices.filter((_, i) => i !== index);
    setScripts(prev =>
      prev.map(s =>
        s.id === selected.id
          ? updateChapter(s, selectedChapterId, { choices: newChoices })
          : s
      )
    );
  };

  // AI 辅助剧本构思
  const handleAskAI = async () => {
    if (!selected || !selectedChapterId) return;
    const ch = selected.chapters[selectedChapterId];
    if (!ch) return;
    setIsAsking(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `我正在编写名为《${selected.title}》的跑团剧本章节「${ch.title}」。当前内容：${ch.content || '（空）'}。请帮我丰富这个章节的奇幻场景沉浸感、NPC 细节并给出2-3个戏剧性的剧情分支选项建议。用中文回复。`,
          }],
          systemPrompt: '你是一个顶尖的 D&D 和 Galgame 剧本设计师。帮助用户扩展具有史诗感与代入感的场景，回复紧凑精炼（250字以内）。',
        }),
      });
      const data = await res.json();
      if (data.content) {
        setAiSuggestion(data.content);
      }
    } catch {
      setAiSuggestion('无法连接到 AI 构思服务…');
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-[#0B1020] lg:h-[calc(100vh-60px)] lg:flex-row lg:overflow-hidden">
      {/* 左侧：剧本库导航栏 */}
      <aside className="flex min-w-0 flex-col border-b border-[#8296D8]/20 bg-[#0E1424] lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="p-3.5 border-b border-[#8296D8]/20 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[#FFD485] font-serif-title font-bold text-sm flex items-center gap-1.5">
              <span>📜</span> 剧本工坊
            </h2>
            <span className="text-[11px] text-[#8296D8] font-mono">({scripts.length})</span>
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={handleCreate}
              className="btn-gold flex-1 py-1.5 rounded-lg text-xs font-bold"
            >
              + 新建剧本
            </button>
            <button
              onClick={handleImport}
              className="bg-[#151D30] hover:bg-[#1E2942] border border-[#8296D8]/30 px-3 py-1.5 rounded-lg text-xs text-[#8296D8] hover:text-[#FFD485] transition-colors"
            >
              📥 导入
            </button>
          </div>

          <div>
            <p className="text-[10px] text-[#8296D8] mb-1.5 font-semibold">快速模板</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleLoadPreset('baldurs_gate')}
                className="text-[11px] bg-[#151D30] border border-[#E6A85C]/40 text-[#FFD485] p-1.5 rounded-lg hover:bg-[#1E2942] text-left truncate col-span-2 font-bold"
              >
                🐉 博德之门 (34章)
              </button>
              <button
                onClick={() => handleLoadPreset('dungeon')}
                className="text-[11px] bg-[#151D30] border border-[#8296D8]/15 text-[#F1E5CE]/80 p-1.5 rounded-lg hover:bg-[#1E2942] text-left truncate"
              >
                🗡️ 地牢探险
              </button>
              <button
                onClick={() => handleLoadPreset('mystery')}
                className="text-[11px] bg-[#151D30] border border-[#8296D8]/15 text-[#F1E5CE]/80 p-1.5 rounded-lg hover:bg-[#1E2942] text-left truncate"
              >
                🔍 小镇谜案
              </button>
              <button
                onClick={() => handleLoadPreset('eldritch')}
                className="text-[11px] bg-[#151D30] border border-[#8296D8]/15 text-[#F1E5CE]/80 p-1.5 rounded-lg hover:bg-[#1E2942] text-left truncate"
              >
                👁️ 古宅诡影
              </button>
              <button
                onClick={() => handleLoadPreset('cyberpunk')}
                className="text-[11px] bg-[#151D30] border border-[#8296D8]/15 text-[#F1E5CE]/80 p-1.5 rounded-lg hover:bg-[#1E2942] text-left truncate"
              >
                🏙️ 霓虹追捕
              </button>
            </div>
          </div>
        </div>

        <div className="p-2.5">
          <EileenAside context="workshop" />
        </div>
        {/* 剧本列表 */}
        <div className="max-h-44 flex-1 overflow-y-auto p-2 space-y-1.5 lg:max-h-none">
          {scripts.map(s => (
            <div
              key={s.id}
              onClick={() => { setSelectedId(s.id); setSelectedChapterId(s.startChapter); }}
              className={`p-2.5 rounded-xl cursor-pointer text-xs transition-all flex justify-between items-center ${
                selectedId === s.id
                  ? 'bg-[#18243C] border border-[#E6A85C] shadow-md'
                  : 'bg-[#151D30]/60 hover:bg-[#151D30] border border-transparent'
              }`}
            >
              <div className="truncate">
                <div className="font-bold text-[#FFD485] truncate">{s.title}</div>
                <div className="text-[#8296D8] text-[10px] mt-0.5">
                  {s.genre} · {Object.keys(s.chapters).length} 个章节
                </div>
              </div>
              {selectedId === s.id && (
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
                  className="text-red-400 hover:text-red-300 text-xs px-1"
                  title="删除剧本"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* 右侧：主编辑区 */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0B1020]">
        {selected ? (
          <>
            {/* 顶部剧本属性与工具栏 */}
            <div className="bg-[#0E1424] p-3.5 border-b border-[#8296D8]/20 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex w-full min-w-0 items-center gap-2 sm:flex-1">
                <input
                  value={selected.title}
                  onChange={e => handleUpdateScript('title', e.target.value)}
                  className="tavern-input font-bold font-serif-title text-base py-1.5 min-w-0 flex-1"
                  placeholder="剧本标题"
                />
                <input
                  value={selected.genre}
                  onChange={e => handleUpdateScript('genre', e.target.value)}
                  className="tavern-input w-24 py-1.5 text-xs text-center"
                  placeholder="类型 (如: 奇幻)"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowGraphModal(true)}
                  className="bg-[#151D30] hover:bg-[#1E2942] border border-[#8296D8]/30 hover:border-[#E6A85C]/60 text-[#FFD485] px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>🗺️</span>
                  <span>分支架构图</span>
                </button>

                <button
                  onClick={handleExport}
                  className="bg-[#151D30] hover:bg-[#1E2942] border border-[#8296D8]/30 text-[#8296D8] hover:text-[#FFD485] px-3 py-1.5 rounded-lg text-xs transition-colors"
                >
                  📋 导出 JSON
                </button>

                <Link
                  href="/game"
                  className="btn-gold px-4 py-1.5 rounded-lg text-xs font-bold shadow-md flex items-center gap-1"
                >
                  <span>🎲</span>
                  <span>去跑本</span>
                </Link>
              </div>
            </div>

            <details className="world-setting-editor">
              <summary>剧本背景与知识库</summary>
              <p className="mt-2">{getWorldProfile(selected).title}。资料只在本剧本中使用。</p>
              <label>委托简介<textarea value={selected.description} onChange={e => handleUpdateScript('description', e.target.value)} rows={2} placeholder="供玩家选剧本时阅读。" /></label>
              <label>固定世界设定<textarea value={selected.worldSetting || ''} onChange={e => handleUpdateScript('worldSetting', e.target.value)} rows={4} maxLength={20000} placeholder="时代、地理、阵营和不可违背的规则。谜底请放入下方可解锁的资料。" /></label>
              {(selected.knowledge ?? []).map((entry, index) => {
                const edit = (changes: Partial<typeof entry>) => handleUpdateScript('knowledge', selected.knowledge?.map(item => item.id === entry.id ? { ...item, ...changes } : item));
                const chapters = Object.values(selected.chapters);
                return <fieldset key={entry.id} className="my-3 rounded border border-[#46536b] p-3">
                  <legend className="px-1">背景资料 {index + 1}</legend>
                  <label>资料标题<input className="tavern-input" value={entry.title} maxLength={200} onChange={e => edit({ title: e.target.value })} /></label>
                  <label>资料正文<textarea value={entry.content} rows={3} maxLength={30000} onChange={e => edit({ content: e.target.value })} /></label>
                  <label>到达下列任一章节后可见（不选则全剧本可见）
                    <select className="tavern-input" multiple size={Math.min(5, chapters.length)} value={entry.chapterIds ?? []}
                      onChange={e => edit({ chapterIds: Array.from(e.target.selectedOptions, option => option.value) })}>
                      {chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
                      {entry.chapterIds?.filter(id => !selected.chapters[id]).map(id => <option key={id} value={id}>原章节已删除（资料暂不开放）</option>)}
                    </select>
                  </label>
                  <label>还需发现的线索（选填，填写检定中记录的线索原文）<input className="tavern-input" value={entry.requiresSecret ?? ''} maxLength={1000}
                    onChange={e => edit({ requiresSecret: e.target.value || undefined })} /></label>
                  <button type="button" className="underline" onClick={() => handleUpdateScript('knowledge', selected.knowledge?.filter(item => item.id !== entry.id))}>删除此资料</button>
                </fieldset>;
              })}
              <button type="button" className="btn-gold px-3 py-1.5" disabled={(selected.knowledge?.length ?? 0) >= 300}
                onClick={() => handleUpdateScript('knowledge', [...(selected.knowledge ?? []), { id: crypto.randomUUID(), title: '新背景资料', content: '' }])}>添加背景资料</button>
            </details>
            <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
              {/* 章节导航列表 */}
              <div className="max-h-44 space-y-2 overflow-y-auto border-b border-[#8296D8]/20 bg-[#0E1424]/90 p-2.5 lg:max-h-none lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs text-[#FFD485] font-bold">
                    章节列表 ({Object.keys(selected.chapters).length})
                  </span>
                  <button
                    onClick={handleAddChapter}
                    className="btn-gold px-2 py-0.5 rounded text-xs font-bold"
                  >
                    +
                  </button>
                </div>

                <div className="space-y-1">
                  {Object.values(selected.chapters).map(ch => (
                    <div
                      key={ch.id}
                      onClick={() => setSelectedChapterId(ch.id)}
                      className={`p-2 rounded-xl text-xs cursor-pointer flex justify-between items-center group transition-colors ${
                        selectedChapterId === ch.id
                          ? 'bg-[#18243C] border border-[#E6A85C] text-[#FFD485] font-semibold'
                          : 'bg-[#151D30]/60 hover:bg-[#151D30] text-[#F1E5CE]/80 border border-transparent'
                      } ${ch.id === selected.startChapter ? 'border-l-4 border-l-[#52B788] pl-2' : ''}`}
                    >
                      <span className="truncate">{ch.title}</span>
                      <div className="hidden group-hover:flex gap-1.5">
                        {ch.id !== selected.startChapter && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); handleSetStart(ch.id); }}
                              title="设为起始章节"
                              className="text-[#52B788] font-bold"
                            >
                              ★
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteChapter(ch.id); }}
                              className="text-red-400 font-bold"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 章节核心编辑区域 */}
              <div className="min-w-0 flex-1 p-4 sm:p-6 lg:overflow-y-auto">
                {selectedChapter ? (
                  <div className="max-w-3xl space-y-5">
                    {/* 章节标题 */}
                    <div>
                      <label className="text-xs text-[#FFD485] font-bold block mb-1.5">章节名称</label>
                      <input
                        value={selectedChapter.title}
                        onChange={e => handleUpdateChapter('title', e.target.value)}
                        className="tavern-input text-base font-bold py-1.5"
                        placeholder="章节标题"
                      />
                    </div>

                    <label className="block text-xs text-[#FFD485]">随机事件适用场景
                      <select className="tavern-input mt-1" value={selectedChapter.sceneType ?? ''}
                        onChange={e => handleUpdateChapter('sceneType', e.target.value || undefined)}>
                        <option value="">按剧本默认（{getSceneProfile(selected, { ...selectedChapter, sceneType: undefined }).label}）</option>
                        {sceneOptions(selected).map(scene => <option key={scene.key} value={scene.key}>{scene.label}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[#FFD485]">
                      <input type="checkbox" checked={isEndingChapter(selected, selectedChapter)}
                        onChange={event => handleUpdateChapter('ending', event.target.checked)} />
                      设为主线结局 · 先展示本章正文，由玩家选择是否继续
                    </label>

                    <details className="world-setting-editor">
                      <summary>主线战斗{selectedChapter.encounter ? ` · ${selectedChapter.encounter.title}` : ' · 可选'}</summary>
                      <label>敌方模板
                        <select className="tavern-input mt-1" value={selectedChapter.encounter?.enemyKind ?? ''}
                          onChange={event => {
                            const enemyKind = event.target.value;
                            handleUpdateChapter('encounter', isEnemyKind(enemyKind)
                              ? { title: `${ENEMY_CATALOG[enemyKind].name}挡住去路`, count: 1, ...selectedChapter.encounter, enemyKind }
                              : undefined);
                          }}>
                          <option value="">本章直接推进剧情</option>
                          {Object.entries(ENEMY_CATALOG).map(([kind, enemy]) => <option key={kind} value={kind}>{enemy.name}</option>)}
                        </select>
                      </label>
                      {selectedChapter.encounter && <div className="grid gap-x-3 sm:grid-cols-[1fr_8rem]">
                        <label>战斗名称
                          <input className="tavern-input mt-1" value={selectedChapter.encounter.title} maxLength={120}
                            onChange={event => handleUpdateChapter('encounter', { ...selectedChapter.encounter, title: event.target.value })} />
                        </label>
                        <label>敌方数量
                          <select className="tavern-input mt-1" value={selectedChapter.encounter.count}
                            onChange={event => handleUpdateChapter('encounter', { ...selectedChapter.encounter, count: Number(event.target.value) })}>
                            {[1, 2, 3, 4, 5, 6].map(count => <option key={count}>{count}</option>)}
                          </select>
                        </label>
                        <label className="sm:col-span-2">胜利后对白
                          <textarea rows={3} value={selectedChapter.encounter.aftermath ?? ''} maxLength={4000}
                            placeholder="守敌被击败后，玩家看到什么？" onChange={event =>
                              handleUpdateChapter('encounter', { ...selectedChapter.encounter, aftermath: event.target.value })} />
                        </label>
                      </div>}
                    </details>

                    <details className="world-setting-editor">
                      <summary>抵达奖励</summary>
                      <p className="mt-2">本次战役首次进入本章时发放。</p>
                      <div className="grid gap-x-3 sm:grid-cols-[8rem_1fr]">
                        <label>奖励金币
                          <input className="tavern-input mt-1" type="number" min={0} max={10000} value={selectedChapter.reward?.gold ?? 0}
                            onChange={event => setChapterReward({
                              gold: Math.max(0, Math.min(10000, Math.trunc(Number(event.target.value) || 0))),
                              items: selectedChapter.reward?.items ?? [],
                            })} />
                        </label>
                        <label>奖励物品
                          <input key={selectedChapter.id} className="tavern-input mt-1" defaultValue={selectedChapter.reward?.items.join('、') ?? ''}
                            maxLength={640} placeholder="最多 8 件，用顿号分隔"
                            onBlur={event => setChapterReward({
                              gold: selectedChapter.reward?.gold ?? 0,
                              items: event.target.value.split(/[、，,]/).map(item => item.trim().slice(0, 80)).filter(Boolean).slice(0, 8),
                            })} />
                        </label>
                      </div>
                    </details>

                    {/* 场景旁白与故事描述 */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs text-[#FFD485] font-bold">场景旁白 / 剧情叙事</label>
                        <button
                          onClick={handleAskAI}
                          disabled={isAsking}
                          className="text-xs text-[#8296D8] hover:text-[#FFD485] transition-colors flex items-center gap-1"
                        >
                          <span>🔮</span>
                          <span>{isAsking ? 'AI 构思推演中...' : 'AI 辅助润色扩展'}</span>
                        </button>
                      </div>
                      <textarea
                        value={selectedChapter.content}
                        onChange={e => handleUpdateChapter('content', e.target.value)}
                        className="tavern-input h-36 text-xs sm:text-sm leading-relaxed resize-y"
                        placeholder="书写当前章节的奇幻场景氛围、出场人物与事件背景……"
                      />

                      {aiSuggestion && (
                        <div className="p-3.5 rounded-xl mt-2 text-xs space-y-2 bg-[#151D30] border border-[#E6A85C]/40 text-[#F1E5CE] shadow-lg animate-fade-in-up">
                          <div className="font-bold text-[#FFD485] flex items-center gap-1.5">
                            <span>🔮</span> AI 构思建议：
                          </div>
                          <div className="whitespace-pre-wrap leading-relaxed text-[#F1E5CE]/90">{aiSuggestion}</div>
                          <button
                            onClick={() => {
                              handleUpdateChapter('content', (selectedChapter.content ? selectedChapter.content + '\n\n' : '') + aiSuggestion);
                              setAiSuggestion('');
                            }}
                            className="btn-gold px-3.5 py-1 rounded-lg text-xs font-bold"
                          >
                            采纳并将此构思合并入章节
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 玩家剧情选择分支 */}
                    <div className="pt-3 border-t border-[#8296D8]/20 space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-[#FFD485] font-bold flex items-center gap-1.5">
                          <span>🎯</span> 玩家选择分支选项 ({selectedChapter.choices.length})
                        </label>
                        <button
                          onClick={handleAddChoice}
                          className="btn-gold px-3 py-1 rounded-lg text-xs font-bold"
                        >
                          + 添加分支选项
                        </button>
                      </div>

                      {selectedChapter.choices.length === 0 ? (
                        <p className="text-xs text-[#8296D8]/70 italic bg-[#151D30] p-3 rounded-xl text-center border border-[#8296D8]/15">
                          暂无分支选项 — 本章节将作为故事的结局终点。
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selectedChapter.choices.map((choice, i) => (
                            <div
                              key={i}
                              className="flex gap-2 items-center bg-[#151D30] p-3 rounded-xl border border-[#8296D8]/20"
                            >
                              <span className="text-[#FFD485] font-bold text-xs">{i + 1}.</span>
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  value={choice.text}
                                  onChange={e => handleUpdateChoice(i, 'text', e.target.value)}
                                  className="tavern-input py-1 text-xs"
                                  placeholder="选项文字（例如：拔出圣剑迎战巨龙）"
                                />
                                <select
                                  value={choice.nextChapter}
                                  onChange={e => handleUpdateChoice(i, 'nextChapter', e.target.value)}
                                  className="tavern-input py-1 text-xs"
                                >
                                  {Object.values(selected.chapters).map(ch => (
                                    <option key={ch.id} value={ch.id}>
                                      跳转至 ➔ {ch.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                onClick={() => handleDeleteChoice(i)}
                                className="text-red-400 hover:text-red-300 font-bold px-1.5"
                                title="删除此分支"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* DC 属性挑战规则设置 */}
                    <div className="bg-[#151D30] p-4 rounded-xl border border-[#8296D8]/20 space-y-2">
                      <h4 className="text-xs text-[#FFD485] font-bold flex items-center gap-1.5">
                        <span>🎯</span> 属性 DC 技能挑战检定 (可选)
                      </h4>

                      {selectedChapter.dcCheck ? (
                        <div className="grid grid-cols-2 gap-3 text-xs bg-[#0B1020] p-3 rounded-lg border border-[#8296D8]/20">
                          <div>
                            <label className="text-[#8296D8] block mb-1">检定属性</label>
                            <select
                              value={selectedChapter.dcCheck.attribute}
                              onChange={e => handleUpdateChapter('dcCheck', {
                                ...selectedChapter.dcCheck!,
                                attribute: e.target.value,
                              })}
                              className="tavern-input py-1 text-xs"
                            >
                              <option value="str">力量 (STR)</option>
                              <option value="dex">敏捷 (DEX)</option>
                              <option value="con">体质 (CON)</option>
                              <option value="int">智力 (INT)</option>
                              <option value="wis">感知 (WIS)</option>
                              <option value="cha">魅力 (CHA)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[#8296D8] block mb-1">难度等级 (DC 5~30)</label>
                            <input
                              type="number"
                              value={selectedChapter.dcCheck.dc}
                              onChange={e => handleUpdateChapter('dcCheck', {
                                ...selectedChapter.dcCheck!,
                                dc: Number(e.target.value) || 10,
                              })}
                              className="tavern-input py-1 text-xs text-center"
                              min={5}
                              max={30}
                            />
                          </div>
                          <button
                            onClick={() => handleUpdateChapter('dcCheck', undefined)}
                            className="text-red-400 text-left hover:underline text-xs col-span-2 pt-1"
                          >
                            ✕ 移除当前 DC 检定要求
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleUpdateChapter('dcCheck', {
                            attribute: 'dex',
                            dc: 15,
                            successChapter: selectedChapterId,
                            failureChapter: selectedChapterId,
                          })}
                          className="text-xs text-[#FFD485] hover:underline flex items-center gap-1"
                        >
                          <span>+</span> 为当前章节增加 D20 DC 挑战检定
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-24 text-xs text-[#8296D8]">
                    请在左侧选择一个章节进行详细编辑
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3 p-6">
              <p className="text-5xl">📜</p>
              <p className="text-base font-bold font-serif-title text-[#FFD485]">尚未选择或创建剧本</p>
              <p className="text-xs text-[#8296D8]">在左侧新建剧本或点击上方模板开启你的创作之旅</p>
              <button
                onClick={handleCreate}
                className="btn-gold px-5 py-2 rounded-xl text-xs font-bold shadow-lg mt-2"
              >
                ✍️ 新建空白剧本
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 分支路线图弹窗 */}
      <ScriptGraphModal
        script={selected}
        isOpen={showGraphModal}
        onClose={() => setShowGraphModal(false)}
        onSelectChapter={id => setSelectedChapterId(id)}
      />
    </div>
  );
}
