import { LLMProvider } from '../providers/LLMProvider.js';
import { ContextManager } from './ContextManager.js';
import { GitTool } from '../tools/GitTool.js';
import { DiffTool } from '../tools/DiffTool.js';
import { PromptLoader } from './PromptLoader.js';
import chalk from 'chalk';

export class CodeAssistant {
  constructor(options = {}) {
    this.model = options.model || 'claude-3-5-sonnet-20241022';
    this.files = options.files || [];
    this.autoApply = options.autoApply !== false; // Default to true
    this.autoCommit = options.autoCommit !== false; // Default to true
    this.dryRun = options.dryRun || false;
    
    this.llm = new LLMProvider({ model: this.model });
    this.context = new ContextManager();
    this.git = new GitTool();
    this.diff = new DiffTool();
    this.prompts = new PromptLoader();
    
    this.initialized = false;
  }
  
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
      this.initialized = true;
    }
  }
  
  async initialize() {
    // Load prompts first
    await this.prompts.loadPrompts();
    
    // Load initial context
    if (this.files.length > 0) {
      await this.context.addFiles(this.files);
    }
    
    // Auto-detect relevant files if none specified
    if (this.files.length === 0) {
      const relevantFiles = await this.context.detectRelevantFiles();
      await this.context.addFiles(relevantFiles);
    }
  }
  
  async processRequest(userInput) {
    await this.ensureInitialized();
    
    console.log(chalk.blue('Processing request...'));
    
    // Get current context
    const context = await this.context.getCurrentContext();
    
    // Build prompt
    const prompt = this.prompts.buildCodingPrompt({
      userRequest: userInput,
      context: context,
      files: this.context.getFileContents()
    });
    
    // Get LLM response
    const response = await this.llm.complete(prompt);
    
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
    // Parse SEARCH/REPLACE blocks from LLM response
    const searchReplaceRegex = /```(\w+)?\n<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE\n```/g;
    const changes = [];
    let match;
    
    // Extract file path from preceding line
    const lines = response.split('\n');
    let currentFile = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line looks like a file path
      if (line && !line.startsWith('```') && !line.startsWith('#') && 
          (line.includes('/') || line.includes('.')) && 
          !line.includes(' ')) {
        currentFile = line;
      }
      
      // Check if next lines contain a SEARCH/REPLACE block
      if (line.startsWith('```') && i + 1 < lines.length) {
        const blockStart = i;
        let blockEnd = -1;
        
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === '```') {
            blockEnd = j;
            break;
          }
        }
        
        if (blockEnd > -1) {
          const blockContent = lines.slice(blockStart + 1, blockEnd).join('\n');
          const searchMatch = blockContent.match(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/);
          
          if (searchMatch && currentFile) {
            changes.push({
              file: currentFile,
              search: searchMatch[1],
              replace: searchMatch[2]
            });
          }
        }
      }
    }
    
    return changes;
  }
  
  async applyChanges(result) {
    if (this.dryRun) {
      console.log(chalk.yellow('Dry run - changes would be:'));
      for (const diff of result.diffs) {
        this.diff.displayDiff(diff);
      }
      return;
    }

    console.log(chalk.blue('Applying changes...'));
    
    const changedFiles = [];
    for (const change of result.changes) {
      await this.diff.applyChange(change);
      console.log(chalk.green(`✓ Applied changes to ${change.file}`));
      changedFiles.push(change.file);
    }
    
    // Update context with new file contents
    await this.context.refresh();
    
    // Auto-commit if enabled and we're in a git repo
    if (this.autoCommit && changedFiles.length > 0) {
      await this.commitChanges(changedFiles, result.userRequest);
    }
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
}
