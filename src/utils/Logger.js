import chalk from 'chalk';

export class Logger {
  constructor(level = 'info') {
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    this.setLevel(level);
  }
  
  setLevel(level) {
    this.currentLevel = this.levels[level] || this.levels.info;
  }
  
  debug(...args) {
    if (this.currentLevel <= this.levels.debug) {
      console.log(chalk.gray('[DEBUG]'), ...args);
    }
  }
  
  info(...args) {
    if (this.currentLevel <= this.levels.info) {
      console.log(chalk.blue('[INFO]'), ...args);
    }
  }
  
  warn(...args) {
    if (this.currentLevel <= this.levels.warn) {
      console.log(chalk.yellow('[WARN]'), ...args);
    }
  }
  
  error(...args) {
    if (this.currentLevel <= this.levels.error) {
      console.log(chalk.red('[ERROR]'), ...args);
    }
  }
  
  success(...args) {
    if (this.currentLevel <= this.levels.info) {
      console.log(chalk.green('[SUCCESS]'), ...args);
    }
  }
}

// Global logger instance
export const logger = new Logger(process.env.DEBUG ? 'debug' : 'info');
