const path = require('path');
const os = require('os');

/**
 * Application configuration and constants
 */

// Base directory for app data (~/.playmusic/)
const APP_DIR = path.join(os.homedir(), '.playmusic');

// Subdirectories
const CACHE_DIR = path.join(APP_DIR, 'cache');
const CONFIG_DIR = path.join(APP_DIR, 'config');

// Files
const STATE_FILE = path.join(APP_DIR, 'state.json');
const HISTORY_FILE = path.join(APP_DIR, 'history.json');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Default configuration
const DEFAULT_CONFIG = {
  // Volume (0-100)
  volume: 100,

  // Behavior when track ends: 'stop' | 'next' | 'loop' | 'queue'
  onEnd: 'stop',

  // Cache settings
  cacheLimit: 500, // Max cache size in MB (default 500MB ~ 100-150 tracks)
  useCache: true,

  // Search settings
  autoSelect: true, // Auto-select first result
  maxResults: 5,    // Max search results to show

  // UI settings
  useColors: true,
  showProgress: true,

  // Notifications
  desktopNotifications: false
};

// Error messages
const ERROR_MESSAGES = {
  NO_INTERNET: 'Нет подключения к интернету. Попробуйте воспроизвести из кэша.',
  TRACK_NOT_FOUND: 'Трек не найден. Попробуйте другой запрос.',
  YT_DLP_NOT_FOUND: 'yt-dlp не установлен. Установите: sudo apt install yt-dlp',
  MPV_NOT_FOUND: 'mpv не установлен. Установите: sudo apt install mpv',
  CACHE_ERROR: 'Ошибка кэша. Попробуйте очистить: play --clear-cache',
  PERMISSION_ERROR: 'Ошибка доступа. Проверьте права на папку ~/.playmusic/',
  UNKNOWN_ERROR: 'Произошла неизвестная ошибка. Попробуйте еще раз.'
};

module.exports = {
  APP_DIR,
  CACHE_DIR,
  CONFIG_DIR,
  STATE_FILE,
  HISTORY_FILE,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  ERROR_MESSAGES
};
