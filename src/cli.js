const { Command } = require('commander');
const chalk = require('chalk');
const pkg = require('../package.json');
const search = require('./search');
const player = require('./player');
const cache = require('./cache');
const history = require('./history');
const queue = require('./queue');
const logger = require('./utils/logger');
const validators = require('./utils/validators');
const { DEFAULT_CONFIG } = require('./config');

/**
 * Initialize and configure the CLI program
 * @returns {Command} Configured commander program
 */
function createProgram() {
  const program = new Command();

  program
    .name('mplay')
    .description(chalk.bold('🎵 PlayMusic — search and play music from terminal'))
    .version(pkg.version, '-v, --version', 'Show version number')
    .helpOption('-h, --help', 'Show help information')
    .addHelpText('afterAll', `
${chalk.bold('Examples:')}
  $ mplay "never gonna give you up"    Search and play a track
  $ mplay --stop                       Stop current playback
  $ mplay --next                       Play next track
  $ mplay --status                     Show current status
  $ mplay --history                    Show play history

${chalk.bold('Learn more:')}
  Documentation: https://github.com/playmusic/playmusic#readme
`);

  // Search and play (default command)
  program
    .argument('[query...]', 'Search query for the track')
    .option('-s, --stop', 'Stop current playback')
    .option('-n, --next', 'Play next track from queue')
    .option('--prev', 'Play previous track')
    .option('-q, --queue', 'Add track to queue (do not play)')
    .option('--on-end <mode>', 'Action when track ends: stop | next | loop | queue')
    .option('--status', 'Show current playback status (track info)')
    .option('--history', 'Show playback history')
    .option('--cache-status', 'Show cache statistics')
    .option('--clear-cache', 'Clear music cache')
    .action((query, options) => {
      handleCommand(query, options);
    });

  return program;
}

/**
 * Handle command execution
 * @param {string[]} query - Search query array
 * @param {object} options - Parsed options
 */
async function handleCommand(query, options) {
  // Handle flag-based commands first
  if (options.stop) {
    const result = await player.stop();
    if (!result.success) {
      logger.error(result.error);
      process.exit(1);
    }
    return;
  }

  if (options.next) {
    const nextResult = queue.getNext();
    if (!nextResult.found) {
      logger.error('Нет треков в очереди');
      process.exit(1);
    }
    
    // Play next track
    const playResult = await player.play(nextResult.track, 100);
    if (!playResult.success) {
      logger.error(playResult.error);
      process.exit(1);
    }
    
    history.add(nextResult.track);
    logger.success(`Воспроизведение: ${nextResult.track.title}`);
    console.log(chalk.dim(`   Осталось в очереди: ${nextResult.remaining}`));
    return;
  }

  if (options.prev) {
    const prevResult = queue.getPrev();
    if (!prevResult.found) {
      logger.error('Нет предыдущего трека');
      process.exit(1);
    }
    
    // Play previous track
    const playResult = await player.play(prevResult.track, 100);
    if (!playResult.success) {
      logger.error(playResult.error);
      process.exit(1);
    }
    
    history.add(prevResult.track);
    logger.success(`Воспроизведение: ${prevResult.track.title}`);
    return;
  }

  if (options.onEnd) {
    const validModes = ['stop', 'next', 'loop', 'queue'];
    if (!validModes.includes(options.onEnd)) {
      logger.error(`Неверный режим: ${options.onEnd}. Допустимые: ${validModes.join(', ')}`);
      process.exit(1);
    }
    const success = player.setOnEndMode(options.onEnd);
    if (success) {
      logger.success(`Режим завершения установлен: ${options.onEnd}`);
    } else {
      logger.error('Не удалось установить режим');
      process.exit(1);
    }
    return;
  }

  if (options.status) {
    const status = player.getSimpleStatus();
    if (!status) {
      logger.error('Ничего не играет');
      process.exit(1);
    }
    displaySimpleStatus(status);
    return;
  }

  if (options.history) {
    displayHistory();
    return;
  }

  if (options.cacheStatus) {
    displayCacheStatus();
    return;
  }

  if (options.clearCache) {
    const result = cache.clear();
    if (!result.success) {
      logger.error(result.error);
      process.exit(1);
    }
    return;
  }

  // Handle search query
  if (query && query.length > 0) {
    const searchQuery = query.join(' ');
    await handleSearch(searchQuery, options.queue);
    return;
  }

  // No arguments provided — show help
  program.help();
}

/**
 * Display playback status
 * @param {object} status
 */
function displayStatus(status) {
  console.log('');
  if (status.playing) {
    console.log(`${chalk.green('▶️  PLAYING')} ${chalk.white(status.track.title)}`);
  } else if (status.paused) {
    console.log(`${chalk.yellow('⏸️  PAUSED')} ${chalk.white(status.track.title)}`);
  } else {
    console.log(`${chalk.gray('⏹️  STOPPED')}`);
  }

  console.log(`  ${chalk.gray('Artist:')} ${chalk.cyan(status.track.channel)}`);
  console.log(`  ${chalk.gray('Position:')} ${chalk.cyan(status.position)} / ${chalk.cyan(status.duration)}`);
  console.log(`  ${chalk.gray('Volume:')} ${chalk.cyan(status.volume)}%`);
}

/**
 * Display simple status (no IPC)
 * @param {object} status
 */
function displaySimpleStatus(status) {
  console.log('');
  console.log(`${chalk.green('▶️  PLAYING')} ${chalk.white(status.track.title)}`);
  console.log(`  ${chalk.gray('Artist:')} ${chalk.cyan(status.track.channel)}`);
  console.log(`  ${chalk.gray('URL:')} ${chalk.cyan(status.track.url)}`);
}

/**
 * Display playback history
 */
function displayHistory() {
  const entries = history.get(20);
  
  console.log('');
  if (entries.length === 0) {
    console.log(chalk.gray('  История пуста'));
    return;
  }

  console.log(chalk.bold('📜 История воспроизведения:'));
  console.log('');
  
  entries.forEach((entry, index) => {
    const num = (index + 1).toString().padStart(2, ' ');
    const date = new Date(entry.playedAt).toLocaleDateString('ru-RU');
    const plays = entry.playCount > 1 ? chalk.gray(` (${entry.playCount}x)`) : '';
    
    console.log(`  ${chalk.cyan(num)}. ${chalk.white(entry.title)}${plays}`);
    console.log(`      ${chalk.gray(entry.channel)} • ${chalk.gray(date)}`);
  });
  
  console.log('');
  console.log(chalk.dim('  Используйте: play "<запрос>" для воспроизведения из истории'));
}

/**
 * Display cache statistics
 */
function displayCacheStatus() {
  const stats = cache.getStats();

  console.log('');
  console.log(chalk.bold('💾 Статистика кэша:'));
  console.log('');
  console.log(`  Треков в кэше: ${chalk.cyan(stats.count)}`);
  console.log(`  Общий размер: ${chalk.cyan(stats.totalSizeFormatted)}`);
  console.log(`  Лимит: ${chalk.cyan(cache.formatSize(DEFAULT_CONFIG.cacheLimit * 1024 * 1024))}`);

  if (stats.tracks.length > 0) {
    console.log('');
    console.log(chalk.dim('  Последние сохранённые треки:'));
    console.log('');

    stats.tracks.slice(0, 5).forEach((track, index) => {
      const num = (index + 1).toString().padStart(2, ' ');
      const date = new Date(track.cachedAt).toLocaleDateString('ru-RU');
      const size = cache.formatSize(track.size || 0);

      console.log(`  ${chalk.cyan(num)}. ${chalk.white(track.title)}`);
      console.log(`      ${chalk.gray(track.channel)} • ${chalk.gray(size)} • ${chalk.gray(date)}`);
    });
  } else {
    console.log('');
    console.log(chalk.gray('  Кэш пуст'));
  }

  console.log('');
}

/**
 * Handle search and play
 * @param {string} query - Search query
 * @param {boolean} addToQueue - Add to queue instead of playing
 */
async function handleSearch(query, addToQueue = false) {
  try {
    const result = await search.search(query);

    if (!result.success) {
      logger.error(result.error);
      process.exit(1);
    }

    if (addToQueue) {
      // Add to queue
      const queueResult = queue.add(result.track, false);
      logger.success(`Добавлено в очередь: ${result.track.title}`);
      console.log(chalk.dim(`   Позиция: ${queueResult.position}`));
      process.exit(0);
    } else {
      // Track found - start playback
      console.log('');
      const playResult = await player.play(result.track, 100);

      if (!playResult.success) {
        logger.error(playResult.error);
        process.exit(1);
      }

      // Save to history
      history.add(result.track);

      logger.success('Воспроизведение началось!');
      
      // Keep process alive to ensure mpv starts properly
      await new Promise(resolve => setTimeout(resolve, 2500));
      process.exit(0);
    }

  } catch (error) {
    logger.error(`Неожиданная ошибка: ${error.message}`);
    process.exit(1);
  }
}

// Export configured program
module.exports = {
  program: createProgram()
};
