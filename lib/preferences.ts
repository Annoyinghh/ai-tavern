import { DEFAULT_AI_SETTINGS, type AISettings } from './types';

const SETTINGS_KEY = 'ai-tavern-settings';
const LOCAL_MODE_KEY = 'ai-tavern-local-mode';

export function loadAISettings(): AISettings {
  if (typeof window === 'undefined') return DEFAULT_AI_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) } : DEFAULT_AI_SETTINGS;
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAISettings(settings: AISettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadLocalMode(): boolean {
  try {
    return localStorage.getItem(LOCAL_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveLocalMode(enabled: boolean) {
  localStorage.setItem(LOCAL_MODE_KEY, String(enabled));
}
