// Small persisted preferences store. Runes, so components just read the fields.
const KEY = 'tommy-games:settings';

/** The game server this site was published with (GAME_SERVER_URL), if any. */
export const DEFAULT_SERVER = import.meta.env.VITE_GAME_SERVER ?? '';

const defaults = {
  theme: 'auto',           // auto | light | dark
  name: '',                // remembered player name
  serverUrl: DEFAULT_SERVER,
  botSpeed: 'normal'       // brisk | normal | relaxed
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    // A blank address means "the published one". Older versions saved the blank
    // along with every other setting, which then hid the server once it existed.
    if (!saved.serverUrl) delete saved.serverUrl;
    return { ...defaults, ...saved };
  } catch {
    return { ...defaults };
  }
}

export const settings = $state(load());

export function saveSettings(patch = {}) {
  Object.assign(settings, patch);
  if (!settings.serverUrl) settings.serverUrl = DEFAULT_SERVER;
  // Only remember an address someone chose, so a new published one still reaches them.
  const { serverUrl, ...rest } = settings;
  const own = serverUrl && serverUrl !== DEFAULT_SERVER ? { serverUrl } : {};
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...rest, ...own }));
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
