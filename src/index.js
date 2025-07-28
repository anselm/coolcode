#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { CodeAssistant } from './core/CodeAssistant.js';
import { CLIInterface } from './interfaces/CLIInterface.js';

const program = new Command();

program
  .name('code-assistant')
  .description('AI-powered coding assistant')
  .version('1.0.0');

program
  .command('chat')
  .description('Start interactive chat session')
  .option('-f, --files <files...>', 'Files to include in context')
  .option('-m, --model <model>', 'LLM model to use', 'claude-3-5-sonnet-20241022')
  .option('--no-auto-apply', 'Disable automatic application of changes')
  .option('--no-auto-commit', 'Disable automatic git commits')
  .option('--dry-run', 'Show changes without applying them')
  .action(async (options) => {
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
  .action(async (message, options) => {
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
      process.exit(1);
    }
  });

program.parse();
