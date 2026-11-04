import { safeArray } from './validation.js';
const BOARD_THEMES = new Set(['classic', 'wood', 'blue', 'slate', 'emerald', 'ocean', 'arctic', 'graphite', 'rose', 'mint', 'chesscom_green', 'chesscom_brown', 'chesscom_blue', 'chesscom_gray']);

export const WEBSITE_SETTING_DEFAULTS = Object.freeze({
  siteTitle: 'ChessArena',
  siteDescription: 'Nền tảng chơi, luyện tập và phân tích cờ vua.',
  ownerName: '',
  developerName: '',
  accentColor: '#7c3aed',
  defaultAppearance: 'system',
  defaultBoardTheme: 'classic',
  supportEmail: '',
  maintenanceMessage: '',
  homepageAnnouncement: '',
  showMaintenanceBanner: false
});

export function cleanWebsiteSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const supportEmail = String(source.supportEmail || '').trim().slice(0, 160);
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) throw new Error('Email hỗ trợ không hợp lệ.');
  if (source.showMaintenanceBanner === true && !String(source.maintenanceMessage || '').trim()) throw new Error('Hãy nhập nội dung thông báo bảo trì.');
  return {
    siteTitle: String(source.siteTitle || WEBSITE_SETTING_DEFAULTS.siteTitle).trim().slice(0, 80) || WEBSITE_SETTING_DEFAULTS.siteTitle,
    siteDescription: String(source.siteDescription || WEBSITE_SETTING_DEFAULTS.siteDescription).trim().slice(0, 300) || WEBSITE_SETTING_DEFAULTS.siteDescription,
    ownerName: String(source.ownerName || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    developerName: String(source.developerName || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    accentColor: /^#[0-9a-f]{6}$/i.test(String(source.accentColor || '')) ? source.accentColor : WEBSITE_SETTING_DEFAULTS.accentColor,
    defaultAppearance: ['system', 'dark', 'light'].includes(source.defaultAppearance) ? source.defaultAppearance : WEBSITE_SETTING_DEFAULTS.defaultAppearance,
    defaultBoardTheme: BOARD_THEMES.has(source.defaultBoardTheme) ? source.defaultBoardTheme : WEBSITE_SETTING_DEFAULTS.defaultBoardTheme,
    supportEmail,
    maintenanceMessage: String(source.maintenanceMessage || '').trim().slice(0, 300),
    homepageAnnouncement: String(source.homepageAnnouncement || '').trim().slice(0, 500),
    showMaintenanceBanner: source.showMaintenanceBanner === true
  };
}

export async function readWebsiteSettings(supabase) {
  const { data, error } = await supabase.from('website_settings').select('setting_key, value');
  if (error) throw error;
  return safeArray(data).reduce((settings, row) => {
    if (Object.hasOwn(WEBSITE_SETTING_DEFAULTS, row.setting_key)) settings[row.setting_key] = row.value;
    return settings;
  }, { ...WEBSITE_SETTING_DEFAULTS });
}
