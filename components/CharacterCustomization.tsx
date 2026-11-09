'use client';

import { useEffect, useState } from 'react';
import {
  appearanceFor, bodies, bodyStyles, colorLabels, defaultAppearance, frameShapes, outfits,
  type Appearance,
} from '@/lib/appearance';
import type { Character } from '@/lib/types';
import { castVoices, voiceFor } from '@/lib/voiceAssets';
import CharacterAvatarRenderer from './CharacterAvatarRenderer';
import VoiceButton from './VoiceButton';
import styles from './CharacterCustomization.module.css';

function Choice<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return <label className={styles.choice}>
    <span>{label}</span>
    <select value={value} onChange={event => onChange(event.target.value as T)}>
      {Object.entries<string>(options).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
    </select>
  </label>;
}

const bodyOptions = Object.fromEntries(Object.keys(bodies).map(body => [body, body])) as Record<Appearance['body'], string>;

export default function CharacterCustomization({ character, onAppearance, onVoice }: {
  character: Character;
  onAppearance: (value: Appearance) => void;
  onVoice: (id: string) => void;
}) {
  const [voices, setVoices] = useState(castVoices);
  const layers = appearanceFor(character);
  const chosenVoice = voiceFor(character.portraitId, character.voiceId);
  const voice = voices.find(candidate => candidate.id === chosenVoice);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/voice', { signal: controller.signal }).then(async response => {
      if (response.ok && !controller.signal.aborted) {
        const { voices } = await response.json();
        if (Array.isArray(voices) && !controller.signal.aborted) setVoices(voices);
      }
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  const appearance = character.appearance;
  function change<K extends keyof Appearance>(key: K, value: Appearance[K]) {
    if (appearance) onAppearance({ ...appearance, [key]: value });
  }

  return <section className={styles.panel} aria-labelledby="wardrobe-title">
    <header>
      <span>角色档案 / 外观与配音</span>
      <h2 id="wardrobe-title">试衣间</h2>
    </header>
    {layers && appearance ? <>
      <div className={styles.preview}>
        <CharacterAvatarRenderer layers={layers} name={character.name} size="lg" />
        <div><strong>{character.name}</strong><small>{layers.body} · {outfits[layers.outfit]}</small></div>
      </div>
      <div className={styles.fields}>
        <Choice label="人物底图" options={bodyOptions} value={appearance.body} onChange={value => change('body', value)} />
        <Choice label="人物版本" options={bodyStyles} value={appearance.bodyStyle} onChange={value => change('bodyStyle', value)} />
        <Choice label="外装" options={outfits} value={appearance.outfit} onChange={value => change('outfit', value)} />
        <Choice label="衣服配色" options={colorLabels} value={appearance.outfitColor} onChange={value => change('outfitColor', value)} />
        <Choice label="头像框形状" options={frameShapes} value={appearance.frameShape} onChange={value => change('frameShape', value)} />
        <Choice label="头像框颜色" options={colorLabels} value={appearance.frameColor} onChange={value => change('frameColor', value)} />
      </div>
      <button type="button" className={styles.textButton} onClick={() => onAppearance({ ...appearance, active: false })}>使用整张立绘</button>
    </> : <>
      <p>{character.avatarUrl ? '正在使用上传的立绘。' : '当前使用种族与职业搭配的立绘。'}</p>
      <button type="button" className={styles.textButton}
        onClick={() => onAppearance({ ...(appearance ?? defaultAppearance(character.race, chosenVoice === 'selene' ? 'female' : 'male')), active: true })}>
        使用分层立绘
      </button>
    </>}
    <div className={styles.voice}>
      <label className={styles.choice}>
        <span>角色声线</span>
        <select value={chosenVoice} onChange={event => onVoice(event.target.value)}>
          {!voice && <option value={chosenVoice}>此声线在本机不可用</option>}
          {voices.map(entry => <option value={entry.id} key={entry.id}>{entry.name} · {entry.description}</option>)}
        </select>
      </label>
      {voice && <VoiceButton key={voice.id} line={voice.sample} characterId={voice.id} voiceId={voice.id}
        sample label="试听声线" className={styles.listen} />}
    </div>
  </section>;
}
