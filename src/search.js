const { execa } = require('execa');
const logger = require('./utils/logger');
const validators = require('./utils/validators');
const cache = require('./cache');
const { ERROR_MESSAGES } = require('./config');

/**
 * Search module for finding tracks via yt-dlp
 */

class SearchService {
  constructor() {
    this.ytDlpPath = 'yt-dlp';
  }

  /**
   * Check if yt-dlp is installed
   * @returns {Promise<{ available: boolean, version?: string }>}
   */
  async checkYtDlp() {
    try {
      const { stdout } = await execa(this.ytDlpPath, ['--version']);
      return { available: true, version: stdout.trim() };
    } catch (error) {
      return { available: false };
    }
  }

  /**
   * Search for a track on YouTube
   * @param {string} query - Search query
   * @returns {Promise<{ success: boolean, track?: object, error?: string, fromCache?: boolean }>}
   */
  async search(query) {
    // Validate query
    const validation = validators.validateQuery(query);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check yt-dlp availability
    const ytDlpCheck = await this.checkYtDlp();
    if (!ytDlpCheck.available) {
      return { success: false, error: ERROR_MESSAGES.YT_DLP_NOT_FOUND };
    }

    try {
      logger.search(query);

      // Build search query with ytsearch prefix
      const searchQuery = `ytsearch1:${query}`;

      // Execute yt-dlp with JSON output
      const { stdout } = await execa(this.ytDlpPath, [
        '--dump-json',
        '--no-warnings',
        '--no-playlist',
        searchQuery
      ], {
        timeout: 30000, // 30 second timeout
        env: { LANG: 'en_US.UTF-8' } // Ensure UTF-8 encoding
      });

      // Parse JSON result
      let result;
      try {
        result = JSON.parse(stdout);
      } catch (parseError) {
        // Empty or invalid JSON usually means no results found
        logger.spinnerError(ERROR_MESSAGES.TRACK_NOT_FOUND);
        return { success: false, error: ERROR_MESSAGES.TRACK_NOT_FOUND };
      }

      if (!result || !result.id) {
        logger.spinnerError(ERROR_MESSAGES.TRACK_NOT_FOUND);
        return { success: false, error: ERROR_MESSAGES.TRACK_NOT_FOUND };
      }

      // Extract track info
      const track = {
        id: result.id,
        title: result.title || 'Unknown Title',
        channel: result.uploader || result.channel || 'Unknown Artist',
        duration: this.formatDuration(result.duration),
        durationSeconds: result.duration || 0,
        url: `https://www.youtube.com/watch?v=${result.id}`,
        thumbnail: result.thumbnail || null,
        searchQuery: query
      };

      // Check if track is in cache
      const cached = cache.check(track.id);
      if (cached.exists && cached.valid) {
        track.cachedPath = cached.path;
        track.fromCache = true;
        logger.spinnerInfo('Найдено в кэше 💾');
      } else {
        logger.spinnerSuccess('Трек найден');
      }

      logger.found(track.title, track.channel, track.duration);

      // Stop spinner to release terminal
      if (typeof logger.spinnerStop === 'function') {
        logger.spinnerStop();
      }

      return { success: true, track };

    } catch (error) {
      return this.handleSearchError(error);
    }
  }

  /**
   * Get direct audio URL for streaming
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<{ success: boolean, audioUrl?: string, error?: string }>}
   */
  async getAudioUrl(videoId) {
    try {
      const { stdout } = await execa(this.ytDlpPath, [
        '--get-url',
        '-f', 'bestaudio',
        `https://www.youtube.com/watch?v=${videoId}`
      ], {
        timeout: 30000,
        env: { LANG: 'en_US.UTF-8' }
      });

      const audioUrl = stdout.trim();
      
      if (!audioUrl) {
        return { success: false, error: 'Не удалось получить URL аудио' };
      }

      return { success: true, audioUrl };

    } catch (error) {
      return { success: false, error: 'Ошибка получения URL: ' + error.message };
    }
  }

  /**
   * Handle search errors
   * @param {Error} error 
   * @returns {{ success: false, error: string }}
   */
  handleSearchError(error) {
    // Network error
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return { success: false, error: ERROR_MESSAGES.NO_INTERNET };
    }

    // Timeout
    if (error.code === 'ETIMEDOUT' || error.killed) {
      return { success: false, error: 'Превышено время ожидания ответа от YouTube' };
    }

    // yt-dlp specific errors
    if (error.stderr) {
      const stderr = error.stderr.toLowerCase();
      if (stderr.includes('not found') || stderr.includes('unavailable')) {
        return { success: false, error: ERROR_MESSAGES.TRACK_NOT_FOUND };
      }
      if (stderr.includes('private') || stderr.includes('members-only')) {
        return { success: false, error: 'Видео недоступно (приватное или только для участников)' };
      }
    }

    // Generic error
    return { success: false, error: `Ошибка поиска: ${error.message}` };
  }

  /**
   * Format duration from seconds to MM:SS or HH:MM:SS
   * @param {number} seconds 
   * @returns {string}
   */
  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) {
      return 'Unknown';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (num) => num.toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(secs)}`;
    }
    return `${pad(minutes)}:${pad(secs)}`;
  }
}

// Export singleton instance
module.exports = new SearchService();
