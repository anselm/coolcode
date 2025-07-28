import inquirer from 'inquirer';
import chalk from 'chalk';

export class CLIInterface {
  constructor(assistant) {
    this.assistant = assistant;
    this.running = false;
  }
  
  async start() {
    this.running = true;
    
    console.log(chalk.blue.bold('🤖 Code Assistant'));
    console.log(chalk.gray('Type "help" for commands, "exit" to quit\n'));
    
    // Show current context
    const context = await this.assistant.getContext();
    console.log(chalk.yellow(`Context: ${context.totalFiles} files loaded`));
    
    if (context.files.length > 0) {
      console.log(chalk.gray('Files:'));
      context.files.forEach(file => {
        console.log(chalk.gray(`  - ${file}`));
      });
    }
    
    console.log('');
    
    while (this.running) {
      await this.promptUser();
    }
  }
  
  async promptUser() {
    try {
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: chalk.blue('> '),
          prefix: ''
        }
      ]);
      
      await this.handleInput(input.trim());
    } catch (error) {
      if (error.isTtyError) {
        console.log(chalk.red('Interactive mode not supported in this environment'));
        process.exit(1);
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
    }
  }
  
  async handleInput(input) {
    if (!input) return;
    
    // Handle special commands
    if (input === 'exit' || input === 'quit') {
      console.log(chalk.yellow('Goodbye!'));
      this.running = false;
      return;
    }
    
    if (input === 'help') {
      this.showHelp();
      return;
    }
    
    if (input.startsWith('/add ')) {
      const files = input.substring(5).split(' ').filter(f => f.trim());
      await this.assistant.addFiles(files);
      console.log(chalk.green(`Added ${files.length} files to context`));
      return;
    }
    
    if (input.startsWith('/remove ')) {
      const files = input.substring(8).split(' ').filter(f => f.trim());
      await this.assistant.removeFiles(files);
      console.log(chalk.green(`Removed ${files.length} files from context`));
      return;
    }
    
    if (input === '/context') {
      const context = await this.assistant.getContext();
      console.log(chalk.yellow(`Files in context: ${context.totalFiles}`));
      context.files.forEach(file => {
        console.log(chalk.gray(`  - ${file}`));
      });
      return;
    }
    
    if (input === '/clear') {
      console.clear();
      return;
    }
    
    // Process as coding request
    await this.processCodingRequest(input);
  }
  
  async processCodingRequest(input) {
    try {
      console.log(chalk.blue('🤔 Thinking...'));
      
      const result = await this.assistant.processRequest(input);
      
      console.log(chalk.green('\n✨ Response:'));
      console.log(result.response);
      
      if (result.changes.length > 0) {
        console.log(chalk.yellow(`\n📝 Found ${result.changes.length} file changes:`));
        
        // Show diffs
        for (const diff of result.diffs) {
          this.assistant.diff.displayDiff(diff);
        }
        
        // Ask for confirmation
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Apply these changes?',
            default: true
          }
        ]);
        
        if (confirm) {
          await this.assistant.applyChanges(result);
          console.log(chalk.green('✅ Changes applied successfully!'));
        } else {
          console.log(chalk.yellow('❌ Changes discarded'));
        }
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
    }
  }
  
  showHelp() {
    console.log(chalk.blue.bold('\n📖 Available Commands:'));
    console.log(chalk.gray('  help                 - Show this help'));
    console.log(chalk.gray('  exit, quit           - Exit the assistant'));
    console.log(chalk.gray('  /add <files...>      - Add files to context'));
    console.log(chalk.gray('  /remove <files...>   - Remove files from context'));
    console.log(chalk.gray('  /context             - Show current context'));
    console.log(chalk.gray('  /clear               - Clear screen'));
    console.log(chalk.gray('  <message>            - Send coding request to AI'));
    console.log('');
  }
}
