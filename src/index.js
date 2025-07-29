#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { CodeAssistant } from './core/CodeAssistant.js';
import { CLIInterface } from './interfaces/CLIInterface.js';
import { logger } from './utils/Logger.js';

const VERSION = '1.0.0';

// Set debug mode if DEBUG environment variable is set
if (process.env.DEBUG) {
  logger.setLevel('debug');
  logger.debug('Debug mode enabled');
}

// Global signal handlers for non-interactive mode
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nReceived SIGINT (Ctrl+C). Exiting...'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n\nReceived SIGTERM. Exiting...'));
  process.exit(0);
});

// Handle Ctrl+Z globally
process.on('SIGTSTP', () => {
  console.log(chalk.yellow('\n\nReceived SIGTSTP (Ctrl+Z). Suspending...'));
  // Restore terminal state before suspending
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.kill(process.pid, 'SIGTSTP');
});

// Handle resume
process.on('SIGCONT', () => {
  console.log(chalk.blue('\nProcess resumed'));
});

const program = new Command();

program
  .name('coolcode')
  .description('AI-powered coding assistant')
  .version(VERSION);

program
  .command('chat')
  .description('Start interactive chat session')
  .option('-f, --files <files...>', 'Files to include in context')
  .option('-m, --model <model>', 'LLM model to use', 'claude-3-5-sonnet-20241022')
  .option('--no-auto-apply', 'Disable automatic application of changes')
  .option('--no-auto-commit', 'Disable automatic git commits')
  .option('--dry-run', 'Show changes without applying them')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    if (options.debug) {
      logger.setLevel('debug');
      logger.debug('Debug mode enabled via CLI flag');
    }
    
    const assistant = new CodeAssistant({
      model: options.model,
      files: options.files || [],
      autoApply: options.autoApply,
      autoCommit: options.autoCommit,
      dryRun: options.dryRun
    });
    
    const cli = new CLIInterface(assistant);
    await cli.start();
  });

program
  .command('apply <message>')
  .description('Apply a single change request')
  .option('-f, --files <files...>', 'Files to include in context')
  .option('-m, --model <model>', 'LLM model to use', 'claude-3-5-sonnet-20241022')
  .option('--no-auto-apply', 'Disable automatic application of changes')
  .option('--no-auto-commit', 'Disable automatic git commits')
  .option('--dry-run', 'Show changes without applying them')
  .option('--debug', 'Enable debug logging')
  .action(async (message, options) => {
    if (options.debug) {
      logger.setLevel('debug');
      logger.debug('Debug mode enabled via CLI flag');
    }
    
    const assistant = new CodeAssistant({
      model: options.model,
      files: options.files || [],
      autoApply: options.autoApply,
      autoCommit: options.autoCommit,
      dryRun: options.dryRun
    });
    
    try {
      const result = await assistant.processRequest(message);
      
      if (result.changes.length === 0) {
        console.log(chalk.yellow('No changes were generated.'));
      } else if (!options.autoApply && !options.dryRun) {
        // Show diffs and ask for confirmation
        for (const diff of result.diffs) {
          assistant.diff.displayDiff(diff);
        }
        console.log(chalk.green('Changes applied and committed successfully!'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      logger.debug('Full error:', error);
      process.exit(1);
    }
  });

program.parse();
