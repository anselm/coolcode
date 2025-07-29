import inquirer from 'inquirer';
import chalk from 'chalk';

export class CLIInterface {
  constructor(assistant) {
    this.assistant = assistant;
    this.running = false;
    this.setupSignalHandlers();
  }
  
  setupSignalHandlers() {
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\nReceived SIGINT (Ctrl+C). Exiting gracefully...'));
      this.running = false;
      process.exit(0);
    });
    
    // Handle Ctrl+Z (suspend) - restore default behavior
    process.on('SIGTSTP', () => {
      console.log(chalk.yellow('\n\nReceived SIGTSTP (Ctrl+Z). Suspending...'));
      // Restore terminal to normal mode before suspending
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      // Send SIGTSTP to self to actually suspend
      process.kill(process.pid, 'SIGTSTP');
    });
    
    // Handle resume from suspension
    process.on('SIGCONT', () => {
      console.log(chalk.blue('\nResumed. Type anything to continue...'));
      // Restore raw mode if needed
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
    });
    
    // Handle other termination signals
    process.on('SIGTERM', () => {
      console.log(chalk.yellow('\n\nReceived SIGTERM. Exiting gracefully...'));
      this.running = false;
      process.exit(0);
    });
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
      // Set up inquirer with better signal handling
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: chalk.blue('> '),
          prefix: '',
          // Allow inquirer to handle signals more gracefully
          transformer: (input) => input,
          validate: () => true
        }
      ], {
        // Enable signal handling in inquirer
        onCancel: () => {
          console.log(chalk.yellow('\nOperation cancelled'));
          this.running = false;
          process.exit(0);
        }
      });
      
      await this.handleInput(input.trim());
    } catch (error) {
      if (error.isTtyError) {
        console.log(chalk.red('Interactive mode not supported in this environment'));
        process.exit(1);
      } else if (error.name === 'ExitPromptError' || error.message.includes('User force closed')) {
        // Handle Ctrl+C in inquirer
        console.log(chalk.yellow('\nExiting...'));
        this.running = false;
        process.exit(0);
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

    if (input === '/history') {
      this.showConversationHistory();
      return;
    }

    if (input === '/clear-history') {
      this.assistant.clearConversation();
      console.log(chalk.green('Conversation history cleared'));
      return;
    }

    if (input === '/config') {
      this.showConfig();
      return;
    }

    if (input.startsWith('/set ')) {
      await this.handleConfigSet(input.substring(5));
      return;
    }

    if (input === '/multi-start') {
      const multilineInput = await this.collectMultilineInput();
      if (multilineInput) {
        await this.handleInput(multilineInput);
      }
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
        
        // If auto-apply is disabled, ask for confirmation
        if (!this.assistant.autoApply) {
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
        } else {
          console.log(chalk.green('✅ Changes applied and committed automatically!'));
        }
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
    }
  }
  
  async collectMultilineInput() {
    console.log(chalk.gray('Entering multiline mode. Type /multi-end on an empty line to finish.'));
    const lines = [];
    
    while (this.running) {
      try {
        const { line } = await inquirer.prompt([
          {
            type: 'input',
            name: 'line',
            message: chalk.gray('| '),
            prefix: '',
            transformer: (input) => input,
            validate: () => true
          }
        ], {
          onCancel: () => {
            console.log(chalk.yellow('\nMultiline input cancelled'));
            return '';
          }
        });
        
        // Check if user wants to exit multiline mode
        if (line.trim() === '/multi-end') {
          break;
        }
        
        lines.push(line);
      } catch (error) {
        if (error.name === 'ExitPromptError' || error.message.includes('User force closed')) {
          console.log(chalk.yellow('\nMultiline input cancelled'));
          return '';
        }
        throw error;
      }
    }
    
    return lines.join('\n').trim();
  }

  showHelp() {
    console.log(chalk.blue.bold('\n📖 Available Commands:'));
    console.log(chalk.gray('  help                 - Show this help'));
    console.log(chalk.gray('  exit, quit           - Exit the assistant'));
    console.log(chalk.gray('  /add <files...>      - Add files to context'));
    console.log(chalk.gray('  /remove <files...>   - Remove files from context'));
    console.log(chalk.gray('  /context             - Show current context'));
    console.log(chalk.gray('  /history             - Show conversation history'));
    console.log(chalk.gray('  /clear-history       - Clear conversation history'));
    console.log(chalk.gray('  /config              - Show current configuration'));
    console.log(chalk.gray('  /set <key>=<value>   - Set configuration option'));
    console.log(chalk.gray('  /clear               - Clear screen'));
    console.log(chalk.gray('  /multi-start         - Start multiline input mode'));
    console.log(chalk.gray('  <message>            - Send coding request to AI'));
    console.log('');
    console.log(chalk.blue.bold('📝 Multiline Input:'));
    console.log(chalk.gray('  Type /multi-start to begin multiline input'));
    console.log(chalk.gray('  Type /multi-end on an empty line to finish and send'));
    console.log('');
    console.log(chalk.blue.bold('📝 Configuration Options:'));
    console.log(chalk.gray('  autoApply=true/false - Auto-apply changes (default: true)'));
    console.log(chalk.gray('  autoCommit=true/false - Auto-commit changes (default: true)'));
    console.log(chalk.gray('  dryRun=true/false    - Show changes without applying (default: false)'));
    console.log('');
  }

  showConfig() {
    console.log(chalk.blue.bold('\n⚙️ Current Configuration:'));
    console.log(chalk.gray(`  Model: ${this.assistant.model}`));
    console.log(chalk.gray(`  Auto-apply: ${this.assistant.autoApply}`));
    console.log(chalk.gray(`  Auto-commit: ${this.assistant.autoCommit}`));
    console.log(chalk.gray(`  Dry run: ${this.assistant.dryRun}`));
    console.log('');
  }

  showConversationHistory() {
    const history = this.assistant.getConversationHistory();
    
    if (history.length === 0) {
      console.log(chalk.yellow('No conversation history'));
      return;
    }
    
    console.log(chalk.blue.bold('\n💬 Conversation History:'));
    
    history.forEach((message, index) => {
      const role = message.role === 'user' ? 
        chalk.blue('👤 User') : 
        chalk.green('🤖 Assistant');
      
      console.log(`\n${role} (${new Date(message.timestamp).toLocaleTimeString()}):`);
      
      // Truncate long messages for display
      const content = message.content.length > 200 ? 
        message.content.substring(0, 200) + '...' : 
        message.content;
      
      console.log(chalk.gray(content));
    });
    
    console.log('');
  }

  async handleConfigSet(configString) {
    const [key, value] = configString.split('=');
    if (!key || value === undefined) {
      console.log(chalk.red('Usage: /set <key>=<value>'));
      return;
    }

    const boolValue = value.toLowerCase() === 'true';
    
    switch (key.trim()) {
      case 'autoApply':
        this.assistant.autoApply = boolValue;
        console.log(chalk.green(`Set autoApply to ${boolValue}`));
        break;
      case 'autoCommit':
        this.assistant.autoCommit = boolValue;
        console.log(chalk.green(`Set autoCommit to ${boolValue}`));
        break;
      case 'dryRun':
        this.assistant.dryRun = boolValue;
        console.log(chalk.green(`Set dryRun to ${boolValue}`));
        break;
      default:
        console.log(chalk.red(`Unknown configuration key: ${key}`));
    }
  }
}
