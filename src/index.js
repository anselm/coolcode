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
  .option('-m, --model <model>', 'LLM model to use', 'gpt-4')
  .action(async (options) => {
    const assistant = new CodeAssistant({
      model: options.model,
      files: options.files || []
    });
    
    const cli = new CLIInterface(assistant);
    await cli.start();
  });

program
  .command('apply <message>')
  .description('Apply a single change request')
  .option('-f, --files <files...>', 'Files to include in context')
  .option('-m, --model <model>', 'LLM model to use', 'gpt-4')
  .option('--dry-run', 'Show changes without applying them')
  .action(async (message, options) => {
    const assistant = new CodeAssistant({
      model: options.model,
      files: options.files || []
    });
    
    try {
      const result = await assistant.processRequest(message);
      
      if (options.dryRun) {
        console.log(chalk.yellow('Dry run - changes would be:'));
        console.log(result.diff);
      } else {
        await assistant.applyChanges(result);
        console.log(chalk.green('Changes applied successfully!'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();
