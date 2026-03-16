const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./utils/logger');
const { CACHE_DIR, DEFAULT_CONFIG } = require('./config');

/**
 * Cache module for storing and managing downloaded tracks
 */

class CacheService {
  constructor() {
    this.cacheDir = CACHE_DIR;
    this.indexFile = path.join(CACHE_DIR, 'index.json');
  }

  /**
   * Initialize cache directory and index
   */
  init() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.indexFile)) {
      this.saveIndex({ tracks: {}, totalSize: 0 });
    }
  }

  /**
   * Generate cache key from search query
   * @param {string} query - Search query
   * @returns {string}
   */
  getCacheKey(query) {
    return crypto.createHash('md5').update(query.toLowerCase().trim()).digest('hex');
  }

  /**
   * Get cache file path for a track
   * @param {string} trackId - YouTube video ID
   * @returns {string}
   */
  getTrackPath(trackId) {
    return path.join(this.cacheDir, `${trackId}.m4a`);
  }

  /**
   * Load cache index
   * @returns {object}
   */
  loadIndex() {
    try {
      if (fs.existsSync(this.indexFile)) {
        return JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
      }
    } catch (error) {
      logger.warn(`Ошибка загрузки индекса кэша: ${error.message}`);
    }
    return { tracks: {}, totalSize: 0 };
  }

  /**
   * Save cache index
   * @param {object} index - Cache index
   */
  saveIndex(index) {
    try {
      fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      logger.warn(`Ошибка сохранения индекса кэша: ${error.message}`);
    }
  }

  /**
   * Check if track exists in cache and is valid
   * @param {string} trackId - YouTube video ID
   * @returns {{ exists: boolean, path?: string, valid: boolean }}
   */
  check(trackId) {
    const filePath = this.getTrackPath(trackId);
    
    if (!fs.existsSync(filePath)) {
      return { exists: false, valid: false };
    }

    // Check file size (should be > 0)
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { exists: true, path: filePath, valid: false };
    }

    // Check file integrity (try to get duration via ffprobe or yt-dlp)
    const isValid = this.validateFile(filePath);
    
    return { exists: true, path: filePath, valid: isValid, size: stats.size };
  }

  /**
   * Validate cache file integrity
   * @param {string} filePath - Path to audio file
   * @returns {boolean}
   */
  validateFile(filePath) {
    try {
      // Use ffprobe or yt-dlp to check file integrity
      // Use execa with argument array to prevent command injection
      const { execaSync } = require('execa');
      execaSync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
      ], {
        timeout: 5000,
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'ignore'
      });
      return true;
    } catch (error) {
      // ffprobe not available, try basic check
      try {
        const stats = fs.statSync(filePath);
        // Consider file valid if it's > 100KB
        return stats.size > 100 * 1024;
      } catch {
        return false;
      }
    }
  }

  /**
   * Save track to cache
   * @param {object} track - Track object with id, title
   * @param {string} audioUrl - Direct audio URL for download (not used, we download from YouTube)
   * @returns {Promise<{ success: boolean, path?: string, error?: string }>}
   */
  async save(track, audioUrl) {
    try {
      this.init();

      const filePath = this.getTrackPath(track.id);

      // Check if already cached
      const cached = this.check(track.id);
      if (cached.exists && cached.valid) {
        logger.info('Трек уже в кэше', '💾');
        return { success: true, path: cached.path, cached: true };
      }

      logger.spinner('Сохранение в кэш...');

      // Download using yt-dlp directly from YouTube
      const { execa } = require('execa');
      const youtubeUrl = `https://www.youtube.com/watch?v=${track.id}`;

      // Create progress bar for download
      const cliProgress = require('cli-progress');
      const progressBar = new cliProgress.SingleBar({
        format: '  [{bar}] {percentage}% | {value}MB/{totalMB}MB | {speed} | ETA: {eta}s',
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true
      }, cliProgress.Presets.shades_classic);

      // Start download with progress callback
      const downloadProcess = execa('yt-dlp', [
        '-o', filePath,
        '-f', 'bestaudio[ext=m4a]/bestaudio',
        '--extract-audio',
        '--audio-format', 'm4a',
        '--no-playlist',
        '--newline', // Output progress on new lines
        youtubeUrl
      ], {
        timeout: 300000, // 5 minutes timeout
        env: { LANG: 'en_US.UTF-8' }
      });

      // Parse progress from stderr
      let totalMB = null;
      let downloadedMB = 0;

      downloadProcess.stderr?.on('data', (data) => {
        const line = data.toString();
        
        // Parse download progress: [download]   0.5% of    5.12MiB at    2.34MiB/s ETA 00:02
        const progressMatch = line.match(/(\d+(?:\.\d+)?)%\s+of\s+([\d.]+)([KM]i?B)/i);
        if (progressMatch) {
          const percent = parseFloat(progressMatch[1]);
          const size = parseFloat(progressMatch[2]);
          const unit = progressMatch[3];
          
          // Convert to MB
          totalMB = unit.toLowerCase().includes('k') ? size / 1024 : size;
          downloadedMB = (percent / 100) * totalMB;
          
          if (!progressBar.isActive) {
            progressBar.start(Math.round(totalMB), 0, { totalMB: totalMB.toFixed(1), speed: '0MB/s' });
          }
          
          progressBar.update(Math.round(downloadedMB), { totalMB: totalMB.toFixed(1) });
        }
        
        // Parse speed: at    2.34MiB/s
        const speedMatch = line.match(/at\s+([\d.]+)([KM]i?B)\/s/i);
        if (speedMatch) {
          const speed = parseFloat(speedMatch[1]);
          const unit = speedMatch[2];
          const speedStr = unit.toLowerCase().includes('k') ? `${(speed / 1024).toFixed(1)}MB/s` : `${speed.toFixed(1)}MB/s`;
          progressBar.update(progressBar.getValue(), { speed: speedStr });
        }
      });

      await downloadProcess;

      // Stop progress bar
      if (progressBar.isActive) {
        progressBar.stop();
      }

      // Verify download
      const result = this.check(track.id);
      if (result.exists && result.valid) {
        logger.spinnerSuccess(`Сохранено в кэш: ${this.formatSize(result.size)}`);
        
        // Update index
        const index = this.loadIndex();
        index.tracks[track.id] = {
          id: track.id,
          title: track.title,
          channel: track.channel,
          path: filePath,
          size: result.size,
          cachedAt: new Date().toISOString()
        };
        index.totalSize = (index.totalSize || 0) + result.size;
        this.saveIndex(index);

        // Auto-cleanup if cache exceeds limit
        const cleanup = this.enforceLimit();
        if (cleanup.removed > 0) {
          logger.info(`Удалено старых треков: ${cleanup.removed} (${this.formatSize(cleanup.freed)})`, '🗑️');
        }

        return { success: true, path: filePath, cached: false };
      }

      return { success: false, error: 'Файл не прошёл проверку целостности' };

    } catch (error) {
      // Stop progress bar on error
      if (progressBar && progressBar.isActive) {
        progressBar.stop();
      }

      // Clean up partial download
      const filePath = this.getTrackPath(track.id);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return { success: false, error: `Ошибка кэширования: ${error.message}` };
    }
  }

  /**
   * Get track from cache
   * @param {string} trackId - YouTube video ID
   * @returns {{ success: boolean, path?: string, error?: string }}
   */
  get(trackId) {
    const result = this.check(trackId);
    
    if (!result.exists) {
      return { success: false, error: 'Трека нет в кэше' };
    }
    
    if (!result.valid) {
      // Remove invalid cache entry
      this.remove(trackId);
      return { success: false, error: 'Кэш повреждён' };
    }
    
    return { success: true, path: result.path };
  }

  /**
   * Remove track from cache
   * @param {string} trackId - YouTube video ID
   * @returns {boolean}
   */
  remove(trackId) {
    const filePath = this.getTrackPath(trackId);
    
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        fs.unlinkSync(filePath);
        
        // Update index
        const index = this.loadIndex();
        if (index.tracks[trackId]) {
          delete index.tracks[trackId];
          index.totalSize = Math.max(0, (index.totalSize || 0) - stats.size);
          this.saveIndex(index);
        }
        
        return true;
      }
    } catch (error) {
      logger.warn(`Ошибка удаления из кэша: ${error.message}`);
    }
    
    return false;
  }

  /**
   * Clear all cache
   * @returns {{ success: boolean, freed?: number, error?: string }}
   */
  clear() {
    try {
      const index = this.loadIndex();
      let totalSize = index.totalSize || 0;

      // Remove all cached files
      for (const trackId of Object.keys(index.tracks)) {
        const filePath = this.getTrackPath(trackId);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Also remove temporary/partial download files
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.part') || file.endsWith('.ytdl') || file.endsWith('.tmp')) {
          const filePath = path.join(this.cacheDir, file);
          try {
            const stats = fs.statSync(filePath);
            totalSize += stats.size;
            fs.unlinkSync(filePath);
          } catch (e) {
            // Ignore
          }
        }
      }

      // Reset index
      this.saveIndex({ tracks: {}, totalSize: 0 });

      logger.success(`Кэш очищен, освобождено: ${this.formatSize(totalSize)}`);
      return { success: true, freed: totalSize };

    } catch (error) {
      return { success: false, error: `Ошибка очистки кэша: ${error.message}` };
    }
  }

  /**
   * Get cache statistics
   * @returns {{ count: number, totalSize: number, tracks: array }}
   */
  getStats() {
    const index = this.loadIndex();
    const tracks = Object.values(index.tracks);
    
    return {
      count: tracks.length,
      totalSize: index.totalSize || 0,
      totalSizeFormatted: this.formatSize(index.totalSize || 0),
      tracks: tracks.sort((a, b) => new Date(b.cachedAt) - new Date(a.cachedAt))
    };
  }

  /**
   * Check cache against size limit and remove oldest if needed
   * @param {number} limitMB - Size limit in MB
   * @returns {{ removed: number, freed: number }}
   */
  enforceLimit(limitMB = DEFAULT_CONFIG.cacheLimit) {
    const index = this.loadIndex();
    const limitBytes = limitMB * 1024 * 1024;
    
    let removed = 0;
    let freed = 0;
    
    while (index.totalSize > limitBytes && Object.keys(index.tracks).length > 0) {
      // Find oldest track
      const tracks = Object.values(index.tracks);
      if (tracks.length === 0) break;
      
      const oldest = tracks.reduce((a, b) => 
        new Date(a.cachedAt) < new Date(b.cachedAt) ? a : b
      );
      
      // Remove oldest
      const filePath = this.getTrackPath(oldest.id);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        fs.unlinkSync(filePath);
        freed += stats.size;
      }
      
      delete index.tracks[oldest.id];
      index.totalSize = Math.max(0, index.totalSize - (oldest.size || 0));
      removed++;
    }
    
    if (removed > 0) {
      this.saveIndex(index);
    }
    
    return { removed, freed };
  }

  /**
   * Format bytes to human-readable size
   * @param {number} bytes 
   * @returns {string}
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }
}

// Export singleton instance
module.exports = new CacheService();
