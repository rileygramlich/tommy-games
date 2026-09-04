// Small persisted preferences store. Runes, so components just read the fields.
const KEY = 'tommy-games:settings';

const defaults = {
  theme: 'auto',           // auto | light | dark
  name: '',                // remembered player name
  serverUrl: import.meta.env.VITE_GAME_SERVER ?? '',
  botSpeed: 'normal'       // brisk | normal | relaxed
};

function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...defaults };
  }
}

export const settings = $state(load());

export function saveSettings(patch = {}) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...settings }));
  } catch { /* private browsing: preferences just do not stick */ }
  applyTheme();
}

export function applyTheme() {
  const dark = settings.theme === 'dark'
    || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export const BOT_DELAYS = { brisk: 320, normal: 700, relaxed: 1300 };
export function botDelay() {
  return BOT_DELAYS[settings.botSpeed] ?? BOT_DELAYS.normal;
}
