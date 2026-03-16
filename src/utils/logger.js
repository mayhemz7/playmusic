const chalk = require('chalk');
const ora = require('ora');

/**
 * Colored logger for terminal output with spinners and progress bars
 */

let currentSpinner = null;

const logger = {
  /**
   * Create or update a spinner
   * @param {string} message - Spinner message
   * @returns {object} Ora spinner instance
   */
  spinner(message) {
    if (currentSpinner) {
      currentSpinner.stop();
    }
    currentSpinner = ora({
      text: chalk.cyan(message),
      color: 'cyan',
      spinner: 'dots'
    }).start();
    return currentSpinner;
  },

  /**
   * Stop current spinner with success message
   * @param {string} message
   */
  spinnerSuccess(message) {
    if (currentSpinner) {
      currentSpinner.succeed(chalk.green(message));
      currentSpinner = null;
    } else {
      console.log(`${chalk.green('✓')} ${chalk.green(message)}`);
    }
  },

  /**
   * Stop current spinner with error message
   * @param {string} message
   */
  spinnerError(message) {
    if (currentSpinner) {
      currentSpinner.fail(chalk.red(message));
      currentSpinner = null;
    } else {
      console.error(`${chalk.red('✗')} ${chalk.red(message)}`);
    }
  },

  /**
   * Stop current spinner with warning message
   * @param {string} message
   */
  spinnerWarning(message) {
    if (currentSpinner) {
      currentSpinner.warn(chalk.yellow(message));
      currentSpinner = null;
    } else {
      console.log(`${chalk.yellow('⚠️')} ${chalk.yellow(message)}`);
    }
  },

  /**
   * Stop current spinner with info message
   * @param {string} message
   */
  spinnerInfo(message) {
    if (currentSpinner) {
      currentSpinner.info(chalk.blue(message));
      currentSpinner = null;
    } else {
      console.log(`${chalk.blue('ℹ️')} ${chalk.blue(message)}`);
    }
  },

  /**
   * Stop current spinner without message
   */
  spinnerStop() {
    if (currentSpinner) {
      currentSpinner.stop();
      currentSpinner = null;
    }
  },

  /**
   * Log info message
   * @param {string} message
   * @param {string} prefix - Optional prefix
   */
  info(message, prefix = 'ℹ️') {
    if (currentSpinner) {
      currentSpinner.stop();
      currentSpinner = null;
    }
    console.log(`${prefix} ${chalk.blue(message)}`);
  },

  /**
   * Log success message
   * @param {string} message
   */
  success(message) {
    if (currentSpinner) {
      currentSpinner.stop();
      currentSpinner = null;
    }
    console.log(`${chalk.green('✓')} ${chalk.green(message)}`);
  },

  /**
   * Log warning message
   * @param {string} message
   */
  warn(message) {
    if (currentSpinner) {
      currentSpinner.stop();
      currentSpinner = null;
    }
    console.log(`${chalk.yellow('⚠️')} ${chalk.yellow(message)}`);
  },

  /**
   * Log error message
   * @param {string} message
   * @param {boolean} showStack - Show stack trace
   */
  error(message, showStack = false) {
    if (currentSpinner) {
      currentSpinner.stop();
      currentSpinner = null;
    }
    console.error(`${chalk.red('✗')} ${chalk.red(message)}`);
    if (showStack && message.stack) {
      console.error(chalk.dim(message.stack));
    }
  },

  /**
   * Log search query with spinner
   * @param {string} query
   */
  search(query) {
    if (currentSpinner) {
      currentSpinner.stop();
      currentSpinner = null;
    }
    this.spinner(`Поиск: ${chalk.bold(query)}`);
  },

  /**
   * Log found track
   * @param {string} title
   * @param {string} channel
   * @param {string} duration
   */
  found(title, channel, duration) {
    if (currentSpinner) {
      currentSpinner.stop();
      currentSpinner = null;
    }
    console.log(`  ${chalk.cyan('🎵')} ${chalk.white(title)}`);
    console.log(`     ${chalk.gray(channel)} • ${chalk.gray(duration)}`);
  },

  /**
   * Log playback status
   * @param {string} status - 'playing' | 'paused' | 'stopped'
   * @param {string} title - Current track title
   */
  playback(status, title) {
    // Stop any existing spinner
    if (currentSpinner) {
      currentSpinner.stop();
      currentSpinner = null;
    }

    const icons = {
      playing: '▶️',
      paused: '⏸️',
      stopped: '⏹️'
    };
    const colors = {
      playing: chalk.green,
      paused: chalk.yellow,
      stopped: chalk.gray
    };

    // Safe access with defaults
    const icon = icons[status] || icons.stopped;
    const color = colors[status] || colors.stopped;
    const statusText = (status || 'stopped').toUpperCase();

    console.log(`  ${color(`${icon}`)} ${color(statusText)}: ${chalk.white(title || 'Unknown')}`);
  },

  /**
   * Create a progress bar for downloads
   * @param {number} total - Total value
   * @returns {object} Progress bar instance
   */
  createProgressBar(total) {
    const cliProgress = require('cli-progress');
    return new cliProgress.SingleBar({
      format: `${chalk.cyan('Загрузка')} [{bar}] {percentage}% | {value}/{total} MB`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true
    }, cliProgress.Presets.shades_classic);
  }
};

module.exports = logger;
