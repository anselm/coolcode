import { LLMProvider } from '../providers/LLMProvider.js';
import { ContextManager } from './ContextManager.js';
import { GitTool } from '../tools/GitTool.js';
import { DiffTool } from '../tools/DiffTool.js';
import { PromptLoader } from './PromptLoader.js';
import { ConversationHistory } from './ConversationHistory.js';
import { logger } from '../utils/Logger.js';
import chalk from 'chalk';

export class CodeAssistant {
  constructor(options = {}) {
    this.model = options.model || 'claude-3-5-sonnet-20241022';
    this.files = options.files || [];
    this.autoApply = options.autoApply !== false; // Default to true
    this.autoCommit = options.autoCommit !== false; // Default to true
    this.dryRun = options.dryRun || false;
    
    logger.debug('CodeAssistant constructor:', {
      model: this.model,
      files: this.files,
      autoApply: this.autoApply,
      autoCommit: this.autoCommit,
      dryRun: this.dryRun
    });
    
    this.llm = new LLMProvider({ model: this.model });
    this.context = new ContextManager();
    this.git = new GitTool();
    this.diff = new DiffTool();
    this.prompts = new PromptLoader();
    this.conversation = new ConversationHistory();
    
    this.initialized = false;
  }
  
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
      this.initialized = true;
    }
  }
  
  async initialize() {
    logger.debug('Initializing CodeAssistant...');
    
    // Load prompts first
    await this.prompts.loadPrompts();
    logger.debug('Prompts loaded');
    
    // Load initial context
    if (this.files.length > 0) {
      logger.debug('Loading specified files:', this.files);
      await this.context.addFiles(this.files);
    }
    
    // Auto-detect relevant files if none specified
    if (this.files.length === 0) {
      logger.debug('Auto-detecting relevant files...');
      const relevantFiles = await this.context.detectRelevantFiles();
      logger.debug('Found relevant files:', relevantFiles);
      await this.context.addFiles(relevantFiles);
    }
    
    logger.debug('CodeAssistant initialization complete');
  }
  
  async processRequest(userInput) {
    await this.ensureInitialized();
    
    console.log(chalk.blue('Processing request...'));
    
    // Add user message to conversation history
    this.conversation.addUserMessage(userInput);
    
    // Get current context
    const context = await this.context.getCurrentContext();
    
    // Build prompt with conversation history
    const prompt = this.prompts.buildCodingPrompt({
      userRequest: userInput,
      context: context,
      files: this.context.getFileContents(),
      conversationHistory: this.conversation.getFormattedHistory()
    });
    
    // Get LLM response
    const response = await this.llm.complete(prompt);
    
    // Add assistant response to conversation history
    this.conversation.addAssistantMessage(response);
    
    // Parse response for file changes
    const changes = this.parseChanges(response);
    
    // Generate diffs
    const diffs = await this.diff.generateDiffs(changes);
    
    const result = {
      response,
      changes,
      diffs,
      context,
      userRequest: userInput
    };

    // Auto-apply changes if enabled
    if (this.autoApply && changes.length > 0) {
      await this.applyChanges(result);
    }
    
    return result;
  }
  
  parseChanges(response) {
    logger.debug('Parsing LLM response for changes...');
    logger.debug('Response length:', response.length);
    
    const changes = [];
    const lines = response.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for *CREATE NEW FILE* pattern
      if (line.includes('*CREATE NEW FILE*') || line.includes('CREATE NEW FILE')) {
        // Look for the file path in the next few lines
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (nextLine && 
              !nextLine.startsWith('*') && 
              !nextLine.startsWith('-') &&
              !nextLine.startsWith('#') &&
              (nextLine.includes('.') || nextLine.includes('/'))) {
            
            // Found potential file path, now look for code block
            let codeBlockIndex = -1;
            for (let k = j + 1; k < Math.min(j + 10, lines.length); k++) {
              if (lines[k].trim().startsWith('```')) {
                codeBlockIndex = k;
                break;
              }
            }
            
            if (codeBlockIndex > -1) {
              // Find the end of the code block
              let blockEnd = -1;
              for (let l = codeBlockIndex + 1; l < lines.length; l++) {
                if (lines[l].trim() === '```') {
                  blockEnd = l;
                  break;
                }
              }
              
              if (blockEnd > -1) {
                const blockContent = lines.slice(codeBlockIndex + 1, blockEnd).join('\n');
                
                // Skip if the block content looks like instructions rather than file content
                if (blockContent.includes('*SEARCH/REPLACE block* Rules:') ||
                    blockContent.includes('<<<<<<< SEARCH') ||
                    blockContent.includes('Every *SEARCH/REPLACE block*') ||
                    blockContent.includes('ONLY EVER RETURN CODE')) {
                  logger.debug('Skipping CREATE NEW FILE block that contains instructions rather than content');
                  i = blockEnd;
                  break;
                }
                
                changes.push({
                  file: nextLine,
                  search: '', // Empty search for new file
                  replace: blockContent
                });
                
                logger.debug('Found CREATE NEW FILE pattern for:', nextLine);
                i = blockEnd; // Skip past this block
                break;
              }
            }
          }
        }
        continue;
      }
      
      // Look for potential file paths - be more permissive
      // A file path should:
      // 1. Not be empty
      // 2. Not start with common markdown/formatting characters
      // 3. Either contain a dot (extension) or forward slash (path)
      // 4. Not contain spaces (unless it's a quoted path)
      // 5. Not be a markdown heading or list item
      if (line && 
          !line.startsWith('```') && 
          !line.startsWith('#') && 
          !line.startsWith('*') && 
          !line.startsWith('-') &&
          !line.startsWith('>') &&
          !line.startsWith('|') &&
          !line.match(/^\d+\./) && // numbered list
          (line.includes('.') || line.includes('/')) &&
          (!line.includes(' ') || (line.startsWith('"') && line.endsWith('"')))) {
        
        // Clean up quoted paths
        let potentialPath = line;
        if (potentialPath.startsWith('"') && potentialPath.endsWith('"')) {
          potentialPath = potentialPath.slice(1, -1);
        }
        
        // Check if the next few lines contain a code block with SEARCH/REPLACE
        let nextCodeBlockIndex = -1;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (nextLine === '') continue; // Skip empty lines
          if (nextLine.startsWith('````') || nextLine.startsWith('```')) {
            nextCodeBlockIndex = j;
            break;
          }
          // If we hit non-empty, non-code content, stop looking
          if (nextLine && !nextLine.startsWith('````') && !nextLine.startsWith('```')) {
            break;
          }
        }
        
        if (nextCodeBlockIndex > -1) {
          // Find the end of this code block
          let blockEnd = -1;
          const blockStartLine = lines[nextCodeBlockIndex].trim();
          const expectedEnd = blockStartLine.startsWith('````') ? '````' : '```';
          
          for (let k = nextCodeBlockIndex + 1; k < lines.length; k++) {
            if (lines[k].trim() === expectedEnd) {
              blockEnd = k;
              break;
            }
          }
          
          if (blockEnd > -1) {
            const blockContent = lines.slice(nextCodeBlockIndex + 1, blockEnd).join('\n');
            const searchMatch = blockContent.match(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/);
            
            if (searchMatch) {
              logger.debug('Found SEARCH/REPLACE block for file:', potentialPath);
              logger.debug('Search content length:', searchMatch[1].length);
              logger.debug('Replace content length:', searchMatch[2].length);
              
              changes.push({
                file: potentialPath,
                search: searchMatch[1],
                replace: searchMatch[2]
              });
              
              // Skip past this block
              i = blockEnd;
            }
          }
        }
      }
    }
    
    logger.debug('Parsed changes:', changes.length, 'changes found');
    changes.forEach((change, i) => {
      logger.debug(`Change ${i + 1}:`, {
        file: change.file,
        isNewFile: change.search === '',
        searchLength: change.search.length,
        replaceLength: change.replace.length
      });
    });
    
    return changes;
  }
  
  async applyChanges(result) {
    logger.debug('applyChanges called with:', {
      dryRun: this.dryRun,
      changesCount: result.changes.length,
      autoCommit: this.autoCommit
    });
    
    if (this.dryRun) {
      console.log(chalk.yellow('Dry run - changes would be:'));
      for (const diff of result.diffs) {
        this.diff.displayDiff(diff);
      }
      return;
    }

    const changedFiles = [];
    const errors = [];
    
    for (const change of result.changes) {
      try {
        logger.debug('Applying change to file:', change.file);
        logger.debug('Change details:', {
          isNewFile: change.search === '',
          searchLength: change.search.length,
          replaceLength: change.replace.length
        });
        
        await this.diff.applyChange(change);
        
        const action = change.search === '' ? 'Created' : 'Modified';
        console.log(chalk.green(`✓ ${action} ${change.file}`));
        changedFiles.push(change.file);
        
      } catch (error) {
        logger.error('Failed to apply change to file:', change.file, error);
        console.log(chalk.red(`✗ Failed to modify ${change.file}: ${error.message}`));
        errors.push({ file: change.file, error: error.message });
      }
    }
    
    logger.debug('Changes applied. Success:', changedFiles.length, 'Errors:', errors.length);
    
    if (errors.length > 0) {
      console.log(chalk.yellow(`\n⚠️  ${errors.length} file(s) failed to update:`));
      errors.forEach(({ file, error }) => {
        console.log(chalk.red(`  - ${file}: ${error}`));
      });
    }
    
    if (changedFiles.length > 0) {
      // Update context with new file contents
      await this.context.refresh();
      
      // Auto-commit if enabled and we're in a git repo
      if (this.autoCommit) {
        logger.debug('Auto-committing changes...');
        await this.commitChanges(changedFiles, result.userRequest);
      }
    }
    
    return { changedFiles, errors };
  }

  async commitChanges(files, userRequest) {
    try {
      const isGitRepo = await this.git.isGitRepo();
      if (!isGitRepo) {
        console.log(chalk.yellow('Not in a git repository, skipping commit'));
        return;
      }

      // Add changed files
      await this.git.add(files);
      
      // Generate commit message
      const commitMessage = this.generateCommitMessage(userRequest, files);
      
      // Commit changes
      const result = await this.git.commit(commitMessage);
      console.log(chalk.green(`✓ Committed changes: ${commitMessage}`));
      
      if (result.commit) {
        console.log(chalk.gray(`  Commit hash: ${result.commit.substring(0, 7)}`));
      }
    } catch (error) {
      console.log(chalk.yellow(`Warning: Could not commit changes: ${error.message}`));
    }
  }

  generateCommitMessage(userRequest, files) {
    // Clean up user request for commit message
    const cleanRequest = userRequest
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .trim()
      .substring(0, 50); // Limit length
    
    const fileCount = files.length;
    const fileList = fileCount <= 3 
      ? files.map(f => f.split('/').pop()).join(', ')
      : `${fileCount} files`;
    
    return `feat: ${cleanRequest} (${fileList})`;
  }
  
  async addFiles(files) {
    await this.context.addFiles(files);
  }
  
  async removeFiles(files) {
    await this.context.removeFiles(files);
  }
  
  async getContext() {
    await this.ensureInitialized();
    return this.context.getCurrentContext();
  }
  
  clearConversation() {
    this.conversation.clear();
  }
  
  async flushConversation() {
    await this.conversation.flush();
  }
  
  getConversationHistory() {
    return this.conversation.getHistory();
  }
}
