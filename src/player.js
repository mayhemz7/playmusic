const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const { APP_DIR, ERROR_MESSAGES, DEFAULT_CONFIG } = require('./config');

class PlayerService {
  constructor() {
    this.mpvPath = 'mpv';
    this.socketPath = path.join(APP_DIR, 'mpv-socket');
    this.stateFile = path.join(APP_DIR, 'state.json');
    this.monitorInterval = null;
    this.onEndMode = DEFAULT_CONFIG.onEnd;
    this.setupCleanupHandlers();
  }

  setupCleanupHandlers() {
    const cleanup = () => {
      this.stopMonitor();
      this.cleanupSocket();
    };
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  }

  checkMpv() {
    try {
      const stdout = execSync(`${this.mpvPath} --version`, { encoding: 'utf8' });
      return { available: true, version: stdout.split('\n')[0] };
    } catch (error) {
      return { available: false };
    }
  }

  ensureAppDir() {
    if (!fs.existsSync(APP_DIR)) {
      fs.mkdirSync(APP_DIR, { recursive: true });
    }
  }

  async play(track, volume = 100) {
    const mpvCheck = this.checkMpv();
    if (!mpvCheck.available) {
      return { success: false, error: ERROR_MESSAGES.MPV_NOT_FOUND };
    }

    try {
      const existingState = this.loadState();
      if (existingState && existingState.track) {
        logger.info('Остановка предыдущего трека...', '⏹️');
        await this.stop();
      }

      this.ensureAppDir();
      this.cleanupSocket();

      let audioSource = track.cachedPath;
      let fromCache = !!track.cachedPath;

      if (!audioSource) {
        const cache = require('./cache');
        const search = require('./search');
        const urlResult = await search.getAudioUrl(track.id);
        if (!urlResult.success) {
          return { success: false, error: urlResult.error };
        }
        audioSource = urlResult.audioUrl;

        cache.save(track, urlResult.audioUrl).then(cacheResult => {
          if (cacheResult.success && !cacheResult.cached) {
            logger.info(`Сохранено в кэш: ${cache.formatSize(cacheResult.path ? require('fs').statSync(cacheResult.path).size : 0)}`, '💾');
          }
        }).catch(err => {
          logger.warn(`Фоновое кэширование: ${err.message}`);
        });
      }

      logger.spinnerInfo(fromCache ? 'Воспроизведение из кэша 🎵' : 'Запуск воспроизведения... 🎵');

      const args = [
        `--input-ipc-server=${this.socketPath}`,
        `--volume=${volume}`,
        '--no-video',
        '--keep-open=yes',
        '--idle',
        audioSource
      ];

      const { spawn } = require('child_process');
      const mpvProcess = spawn(this.mpvPath, args, {
        detached: true,
        stdio: 'ignore',
        shell: false
      });

      const pid = mpvProcess.pid;

      // Fully detach
      mpvProcess.unref();

      // Wait for socket to be created
      await this.sleep(2000);

      // Verify socket was created
      if (!fs.existsSync(this.socketPath)) {
        logger.spinnerError('Не удалось запустить mpv (socket не создан)');
        return { success: false, error: 'Не удалось запустить mpv (socket не создан)' };
      }

      // Save state with PID from spawn
      this.saveState({
        status: 'playing',
        track: {
          id: track.id,
          title: track.title,
          channel: track.channel,
          url: track.url
        },
        volume: volume,
        pid: pid,
        startedAt: new Date().toISOString(),
        onEndMode: this.onEndMode
      });

      logger.playback('playing', track.title);

      // Start monitoring for track end
      this.startMonitor(track);

      // Stop any spinner to release terminal
      if (typeof logger.spinnerInfo === 'function') {
        // Spinner already stopped by playback()
      }

      return { success: true, pid: pid };

    } catch (error) {
      return { success: false, error: `Ошибка воспроизведения: ${error.message}` };
    }
  }

  /**
   * Start monitoring for track end
   * @param {object} currentTrack - Current track info
   */
  startMonitor(currentTrack) {
    // Clear any existing monitor
    this.stopMonitor();

    let lastPosition = 0;
    let samePositionCount = 0;

    this.monitorInterval = setInterval(async () => {
      try {
        const state = this.loadState();
        if (!state || !state.track) {
          this.stopMonitor();
          return;
        }

        // Get current position via IPC
        const position = await this.sendCommand('get_property time-pos');
        
        if (position === false || position === null) {
          // Can't get position, check if process is still running
          if (state.pid) {
            try {
              process.kill(state.pid, 0); // Check if process exists
            } catch (e) {
              // Process dead, track ended
              this.handleTrackEnd(currentTrack);
            }
          }
          return;
        }

        const currentPosition = parseFloat(position) || 0;

        // Check if track ended (position reset or stuck)
        if (currentPosition < lastPosition && currentPosition < 5) {
          // Position reset - likely track ended or changed
          samePositionCount++;
          if (samePositionCount >= 3) {
            this.handleTrackEnd(currentTrack);
            samePositionCount = 0;
          }
        } else {
          samePositionCount = 0;
        }

        lastPosition = currentPosition;

      } catch (error) {
        // Ignore monitoring errors
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Stop monitoring
   */
  stopMonitor() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Handle track end based on onEnd mode
   * @param {object} endedTrack - Track that ended
   */
  async handleTrackEnd(endedTrack) {
    logger.info(`Трек завершён: ${endedTrack.title}`, '🎵');

    switch (this.onEndMode) {
      case 'loop':
        logger.info('Режим: зацикливание', '🔁');
        // Replay current track
        await this.play(endedTrack, this.loadState()?.volume || 100);
        break;

      case 'next':
      case 'queue':
        logger.info('Режим: следующий трек', '⏭️');
        // Try to play next from queue
        const queue = require('./queue');
        const nextResult = queue.getNext();
        if (nextResult.found) {
          const history = require('./history');
          await this.play(nextResult.track, this.loadState()?.volume || 100);
          history.add(nextResult.track);
          logger.success(`Следующий: ${nextResult.track.title}`);
        } else {
          logger.info('Очередь пуста, остановка', '⏹️');
          await this.stop();
        }
        break;

      case 'stop':
      default:
        logger.info('Режим: остановка', '⏹️');
        await this.stop();
        break;
    }
  }

  /**
   * Set on-end mode
   * @param {string} mode - 'stop' | 'next' | 'loop' | 'queue'
   */
  setOnEndMode(mode) {
    const validModes = ['stop', 'next', 'loop', 'queue'];
    if (!validModes.includes(mode)) {
      return false;
    }
    this.onEndMode = mode;
    
    // Save to state
    const state = this.loadState();
    if (state) {
      state.onEndMode = mode;
      this.saveState(state);
    }
    
    return true;
  }

  /**
   * Stop playback
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async stop() {
    // Stop monitoring
    this.stopMonitor();

    const state = this.loadState();

    if (!state || !state.track) {
      // Check if there's a running mpv process via socket
      if (fs.existsSync(this.socketPath)) {
        // No state file, but socket exists - cleanup
        this.cleanupSocket();
        this.saveState({});
        logger.info('Воспроизведение остановлено', '⏹️');
        return { success: true };
      }
      return { success: false, error: 'Ничего не играет' };
    }

    try {
      // First try to stop via IPC (stops playback but keeps mpv running with --keep-open)
      await this.sendCommand('stop');

      // Kill mpv process by PID
      if (state.pid) {
        this.killMpvProcess(state.pid);
      }

      this.cleanupSocket();
      this.saveState({});
      logger.info('Воспроизведение остановлено', '⏹️');
      return { success: true };

    } catch (error) {
      // Fallback: kill by PID if available
      if (state.pid) {
        this.killMpvProcess(state.pid);
      }
      this.cleanupSocket();
      this.saveState({});
      logger.info('Воспроизведение остановлено', '⏹️');
      return { success: true };
    }
  }

  /**
   * Kill mpv process by PID only (safe version - doesn't kill all mpv processes)
   * @param {number} pid - Process ID to kill
   * @returns {boolean} True if killed successfully
   */
  killMpvProcess(pid) {
    if (!pid) return false;
    try {
      process.kill(pid, 'SIGTERM');
      return true;
    } catch (e) {
      return false;
    }
  }

  getSimpleStatus() {
    const state = this.loadState();

    if (!state || !state.track) {
      return null;
    }

    // Check if mpv process is still running
    if (state.pid) {
      try {
        process.kill(state.pid, 0); // Check if process exists
        return {
          track: state.track,
          volume: state.volume || 100
        };
      } catch (e) {
        // Process is dead, clean up state
        this.cleanupSocket();
        this.saveState({});
        return null;
      }
    }

    return {
      track: state.track,
      volume: state.volume || 100
    };
  }

  /**
   * Get current status
   * @returns {Promise<{ success: boolean, status?: object, error?: string }>}
   */
  async getStatus() {
    const state = this.loadState();

    if (!state || !state.track) {
      return { success: false, error: 'Ничего не играет' };
    }

    // Check if mpv process is still running
    if (state.pid) {
      try {
        process.kill(state.pid, 0); // Check if process exists
      } catch (e) {
        // Process is dead, clean up state
        this.cleanupSocket();
        this.saveState({});
        return { success: false, error: 'Ничего не играет (процесс завершён)' };
      }
    }

    try {
      // Get current position and duration via IPC
      const [position, duration, pause] = await Promise.all([
        this.sendCommand('get_property time-pos'),
        this.sendCommand('get_property duration'),
        this.sendCommand('get_property pause')
      ]);

      const status = {
        playing: state.status === 'playing' && pause === false,
        paused: state.status === 'paused' || pause === true,
        track: state.track,
        position: this.formatTime(parseFloat(position) || 0),
        duration: this.formatTime(parseFloat(duration) || 0),
        volume: state.volume || 100
      };

      return { success: true, status };

    } catch (error) {
      // Return basic status even if IPC fails
      return {
        success: true,
        status: {
          playing: state.status === 'playing',
          paused: state.status === 'paused',
          track: state.track,
          position: 'Unknown',
          duration: 'Unknown',
          volume: state.volume || 100
        }
      };
    }
  }

  /**
   * Set volume
   * @param {number} level - Volume level (0-100)
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async setVolume(level) {
    const state = this.loadState();
    
    if (!state || !state.track) {
      return { success: false, error: 'Ничего не играет' };
    }

    try {
      const result = await this.sendCommand(`set_property volume ${level}`);
      
      if (result) {
        this.saveState({ ...state, volume: level });
        logger.info(`Громкость: ${level}%`, '🔊');
        return { success: true };
      }

      return { success: false, error: 'Не удалось изменить громкость' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send command to mpv via IPC socket
   * @param {string} command - Command string (e.g. 'stop', 'set_property pause true')
   * @returns {Promise<any>}
   */
  sendCommand(command) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.socketPath)) {
        resolve(false);
        return;
      }

      const client = net.createConnection({ path: this.socketPath });
      
      let response = '';
      let resolved = false;

      client.on('connect', () => {
        // Parse command into JSON-RPC format
        const parts = command.split(' ');
        
        // Handle boolean values in command (e.g. 'set_property pause true')
        const commandParts = parts.map(part => {
          if (part === 'true') return true;
          if (part === 'false') return false;
          return part;
        });
        
        const request = {
          command: commandParts
        };
        client.write(JSON.stringify(request) + '\n');
      });

      client.on('data', (data) => {
        response += data.toString();
        
        // Try to parse response
        try {
          const lines = response.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              const parsed = JSON.parse(line);
              
              // Check if this is a response (has request_id or is an event)
              if (parsed.request_id !== undefined || parsed.event !== undefined) {
                if (parsed.error && parsed.error !== 'success') {
                  resolved = true;
                  resolve(false);
                  client.destroy();
                } else if (parsed.data !== undefined) {
                  resolved = true;
                  resolve(parsed.data);
                  client.destroy();
                } else if (parsed.error === 'success') {
                  // Command executed successfully (e.g. set_property)
                  resolved = true;
                  resolve(true);
                  client.destroy();
                } else {
                  // Unknown response format
                  resolved = true;
                  resolve(true);
                  client.destroy();
                }
              }
            }
          }
        } catch (e) {
          // Not JSON yet, wait for more data
        }
      });

      client.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
        client.destroy();
      });

      // Timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
        client.destroy();
      }, 2000);
    });
  }

  /**
   * Save state to file
   * @param {object} state 
   */
  saveState(state) {
    try {
      this.ensureAppDir();
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      logger.warn(`Не удалось сохранить состояние: ${error.message}`);
    }
  }

  /**
   * Load state from file
   * @returns {object|null}
   */
  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      }
    } catch (error) {
      logger.warn(`Не удалось загрузить состояние: ${error.message}`);
    }
    return null;
  }

  /**
   * Clean up IPC socket file
   */
  cleanupSocket() {
    try {
      if (fs.existsSync(this.socketPath)) {
        fs.unlinkSync(this.socketPath);
      }
    } catch (error) {
      // Ignore
    }
  }

  /**
   * Format time in seconds to MM:SS or HH:MM:SS
   * @param {number} seconds 
   * @returns {string}
   */
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) {
      return '00:00';
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

  /**
   * Sleep helper
   * @param {number} ms 
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
module.exports = new PlayerService();
