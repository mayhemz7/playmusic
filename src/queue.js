const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const { APP_DIR } = require('./config');

/**
 * Queue module for managing playback queue
 */

class QueueService {
  constructor() {
    this.queueFile = path.join(APP_DIR, 'queue.json');
    this.maxQueue = 100;
  }

  /**
   * Initialize queue file
   */
  init() {
    if (!fs.existsSync(APP_DIR)) {
      fs.mkdirSync(APP_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(this.queueFile)) {
      this.saveQueue({ tracks: [], currentIndex: -1, playing: false });
    }
  }

  /**
   * Load queue from file
   * @returns {object}
   */
  loadQueue() {
    try {
      if (fs.existsSync(this.queueFile)) {
        return JSON.parse(fs.readFileSync(this.queueFile, 'utf8'));
      }
    } catch (error) {
      logger.warn(`Ошибка загрузки очереди: ${error.message}`);
    }
    return { tracks: [], currentIndex: -1, playing: false };
  }

  /**
   * Save queue to file
   * @param {object} queue - Queue object
   */
  saveQueue(queue) {
    try {
      fs.writeFileSync(this.queueFile, JSON.stringify(queue, null, 2));
    } catch (error) {
      logger.warn(`Ошибка сохранения очереди: ${error.message}`);
    }
  }

  /**
   * Add track to queue
   * @param {object} track - Track object
   * @param {boolean} playNow - Play immediately
   * @returns {{ position: number, queue: array }}
   */
  add(track, playNow = false) {
    this.init();
    
    const queue = this.loadQueue();
    
    // Add to queue
    queue.tracks.push({
      id: track.id,
      title: track.title,
      channel: track.channel,
      url: track.url,
      query: track.searchQuery || track.title,
      addedAt: new Date().toISOString()
    });

    // Limit queue size
    if (queue.tracks.length > this.maxQueue) {
      queue.tracks = queue.tracks.slice(0, this.maxQueue);
    }

    // Set current index if playing now
    if (playNow) {
      queue.currentIndex = queue.tracks.length - 1;
      queue.playing = true;
    }

    this.saveQueue(queue);
    
    return {
      position: queue.tracks.length,
      queue: queue.tracks
    };
  }

  /**
   * Get next track from queue
   * @returns {{ found: boolean, track?: object, index?: number, remaining?: number }}
   */
  getNext() {
    const queue = this.loadQueue();

    // If queue is empty
    if (queue.tracks.length === 0) {
      return { found: false };
    }

    // If at start or before first track, play first
    if (queue.currentIndex < 0) {
      queue.currentIndex = 0;
      queue.playing = true;
      this.saveQueue(queue);
      return {
        found: true,
        track: queue.tracks[0],
        index: 0,
        remaining: queue.tracks.length - 1
      };
    }

    // If at end, no more tracks
    if (queue.currentIndex >= queue.tracks.length - 1) {
      return { found: false };
    }

    // Get next track
    const nextIndex = queue.currentIndex + 1;
    queue.currentIndex = nextIndex;
    queue.playing = true;
    this.saveQueue(queue);

    return {
      found: true,
      track: queue.tracks[nextIndex],
      index: nextIndex,
      remaining: queue.tracks.length - nextIndex - 1
    };
  }

  /**
   * Get previous track from queue
   * @returns {{ found: boolean, track?: object, index?: number }}
   */
  getPrev() {
    const queue = this.loadQueue();
    
    if (queue.currentIndex <= 0) {
      return { found: false };
    }

    const prevIndex = queue.currentIndex - 1;
    queue.currentIndex = prevIndex;
    this.saveQueue(queue);

    return {
      found: true,
      track: queue.tracks[prevIndex],
      index: prevIndex
    };
  }

  /**
   * Get current track
   * @returns {{ found: boolean, track?: object }}
   */
  getCurrent() {
    const queue = this.loadQueue();
    
    if (queue.currentIndex < 0 || queue.currentIndex >= queue.tracks.length) {
      return { found: false };
    }

    return {
      found: true,
      track: queue.tracks[queue.currentIndex],
      index: queue.currentIndex
    };
  }

  /**
   * Get queue status
   * @returns {object}
   */
  getStatus() {
    const queue = this.loadQueue();
    
    return {
      total: queue.tracks.length,
      currentIndex: queue.currentIndex,
      playing: queue.playing,
      current: queue.currentIndex >= 0 ? queue.tracks[queue.currentIndex] : null,
      upcoming: queue.tracks.slice(queue.currentIndex + 1, queue.currentIndex + 6)
    };
  }

  /**
   * Clear queue
   * @returns {boolean}
   */
  clear() {
    try {
      this.saveQueue({ tracks: [], currentIndex: -1, playing: false });
      logger.success('Очередь очищена');
      return true;
    } catch (error) {
      logger.warn(`Ошибка очистки очереди: ${error.message}`);
      return false;
    }
  }

  /**
   * Remove track from queue
   * @param {number} index - Track index (1-based)
   * @returns {boolean}
   */
  remove(index) {
    try {
      const queue = this.loadQueue();
      
      if (index < 1 || index > queue.tracks.length) {
        return false;
      }

      const removed = queue.tracks.splice(index - 1, 1);
      
      // Adjust current index if needed
      if (index - 1 < queue.currentIndex) {
        queue.currentIndex--;
      } else if (index - 1 === queue.currentIndex) {
        // Removed current track
        if (queue.currentIndex >= queue.tracks.length) {
          queue.currentIndex = queue.tracks.length - 1;
        }
      }

      this.saveQueue(queue);
      logger.info(`Удалено из очереди: ${removed[0].title}`, '🗑️');
      return true;
      
    } catch (error) {
      logger.warn(`Ошибка удаления из очереди: ${error.message}`);
      return false;
    }
  }

  /**
   * Set queue as playing
   * @param {number} index - Track index to start from (0-based)
   */
  setPlaying(index = 0) {
    const queue = this.loadQueue();
    queue.currentIndex = index;
    queue.playing = true;
    this.saveQueue(queue);
  }

  /**
   * Stop queue playback
   */
  stop() {
    const queue = this.loadQueue();
    queue.playing = false;
    this.saveQueue(queue);
  }
}

// Export singleton instance
module.exports = new QueueService();
