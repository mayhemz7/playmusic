const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const { HISTORY_FILE, APP_DIR } = require('./config');

/**
 * History module for tracking played tracks
 */

class HistoryService {
  constructor() {
    this.historyFile = HISTORY_FILE;
    this.maxHistory = 100; // Maximum history entries
  }

  /**
   * Initialize history file
   */
  init() {
    if (!fs.existsSync(APP_DIR)) {
      fs.mkdirSync(APP_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(this.historyFile)) {
      this.saveHistory({ entries: [] });
    }
  }

  /**
   * Load history from file
   * @returns {object}
   */
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }
    } catch (error) {
      logger.warn(`Ошибка загрузки истории: ${error.message}`);
    }
    return { entries: [] };
  }

  /**
   * Save history to file
   * @param {object} history - History object
   */
  saveHistory(history) {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      logger.warn(`Ошибка сохранения истории: ${error.message}`);
    }
  }

  /**
   * Add track to history
   * @param {object} track - Track object
   * @returns {boolean}
   */
  add(track) {
    try {
      this.init();
      
      const history = this.loadHistory();
      
      // Check if already in history (avoid duplicates)
      const existingIndex = history.entries.findIndex(e => e.id === track.id);
      if (existingIndex !== -1) {
        // Move to top (most recent)
        const [existing] = history.entries.splice(existingIndex, 1);
        existing.playedAt = new Date().toISOString();
        existing.playCount = (existing.playCount || 1) + 1;
        history.entries.unshift(existing);
      } else {
        // Add new entry
        history.entries.unshift({
          id: track.id,
          title: track.title,
          channel: track.channel,
          url: track.url,
          query: track.searchQuery || track.title,
          playedAt: new Date().toISOString(),
          playCount: 1
        });
      }

      // Limit history size
      if (history.entries.length > this.maxHistory) {
        history.entries = history.entries.slice(0, this.maxHistory);
      }

      this.saveHistory(history);
      return true;
      
    } catch (error) {
      logger.warn(`Ошибка добавления в историю: ${error.message}`);
      return false;
    }
  }

  /**
   * Get history entries
   * @param {number} limit - Maximum entries to return
   * @returns {array}
   */
  get(limit = 20) {
    const history = this.loadHistory();
    return history.entries.slice(0, limit);
  }

  /**
   * Get track by index (1-based)
   * @param {number} index - Track index (1-based)
   * @returns {{ found: boolean, track?: object, index?: number }}
   */
  getByIndex(index) {
    const history = this.loadHistory();
    
    if (index < 1 || index > history.entries.length) {
      return { found: false };
    }

    const track = history.entries[index - 1];
    return { 
      found: true, 
      track,
      index: index - 1 // 0-based index
    };
  }

  /**
   * Search history by query
   * @param {string} query - Search query
   * @returns {array}
   */
  search(query) {
    const history = this.loadHistory();
    const lowerQuery = query.toLowerCase();
    
    return history.entries.filter(entry => 
      entry.title.toLowerCase().includes(lowerQuery) ||
      entry.channel.toLowerCase().includes(lowerQuery) ||
      (entry.query && entry.query.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Clear history
   * @returns {boolean}
   */
  clear() {
    try {
      this.saveHistory({ entries: [] });
      logger.success('История очищена');
      return true;
    } catch (error) {
      logger.warn(`Ошибка очистки истории: ${error.message}`);
      return false;
    }
  }

  /**
   * Remove entry from history
   * @param {number} index - Entry index (1-based)
   * @returns {boolean}
   */
  remove(index) {
    try {
      const history = this.loadHistory();
      
      if (index < 1 || index > history.entries.length) {
        return false;
      }

      const removed = history.entries.splice(index - 1, 1);
      this.saveHistory(history);
      
      logger.info(`Удалено: ${removed[0].title}`, '🗑️');
      return true;
      
    } catch (error) {
      logger.warn(`Ошибка удаления из истории: ${error.message}`);
      return false;
    }
  }

  /**
   * Get statistics
   * @returns {object}
   */
  getStats() {
    const history = this.loadHistory();
    
    // Calculate total plays
    const totalPlays = history.entries.reduce((sum, e) => sum + (e.playCount || 1), 0);
    
    // Find most played
    const mostPlayed = [...history.entries]
      .sort((a, b) => (b.playCount || 1) - (a.playCount || 1))
      .slice(0, 5);

    return {
      totalTracks: history.entries.length,
      totalPlays,
      mostPlayed
    };
  }
}

// Export singleton instance
module.exports = new HistoryService();
