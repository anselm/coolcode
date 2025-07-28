import { diffLines, createPatch } from 'diff';
import fs from 'fs-extra';
import chalk from 'chalk';

export class DiffTool {
  constructor() {}
  
  async generateDiffs(changes) {
    const diffs = [];
    
    for (const change of changes) {
      const diff = await this.generateDiff(change);
      diffs.push(diff);
    }
    
    return diffs;
  }
  
  async generateDiff(change) {
    const { file, search, replace } = change;
    
    let originalContent = '';
    
    // Read existing file content if it exists
    try {
      originalContent = await fs.readFile(file, 'utf8');
    } catch (error) {
      // File doesn't exist, treat as new file
      originalContent = '';
    }
    
    // Apply the search/replace
    const newContent = this.applySearchReplace(originalContent, search, replace);
    
    // Generate diff
    const patch = createPatch(file, originalContent, newContent);
    
    return {
      file,
      originalContent,
      newContent,
      patch,
      isNewFile: originalContent === '',
      hasChanges: originalContent !== newContent
    };
  }
  
  applySearchReplace(content, search, replace) {
    if (search === '') {
      // New file or append
      return replace;
    }
    
    // Find and replace the search content
    const searchIndex = content.indexOf(search);
    if (searchIndex === -1) {
      throw new Error(`Search content not found in file:\n${search}`);
    }
    
    return content.substring(0, searchIndex) + 
           replace + 
           content.substring(searchIndex + search.length);
  }
  
  async applyChange(change) {
    const { file, search, replace } = change;
    
    let content = '';
    
    // Read existing content
    try {
      content = await fs.readFile(file, 'utf8');
    } catch (error) {
      // File doesn't exist
      content = '';
    }
    
    // Apply change
    const newContent = this.applySearchReplace(content, search, replace);
    
    // Ensure directory exists
    const dirPath = path.dirname(file);
    if (dirPath && dirPath !== '.') {
      await fs.ensureDir(dirPath);
    }
    
    // Write new content
    await fs.writeFile(file, newContent, 'utf8');
  }
  
  displayDiff(diff) {
    console.log(chalk.bold(`\n=== ${diff.file} ===`));
    
    if (diff.isNewFile) {
      console.log(chalk.green('New file'));
    }
    
    if (!diff.hasChanges) {
      console.log(chalk.yellow('No changes'));
      return;
    }
    
    // Display the patch with colors
    const lines = diff.patch.split('\n');
    for (const line of lines) {
      if (line.startsWith('+')) {
        console.log(chalk.green(line));
      } else if (line.startsWith('-')) {
        console.log(chalk.red(line));
      } else if (line.startsWith('@@')) {
        console.log(chalk.cyan(line));
      } else {
        console.log(line);
      }
    }
  }
}
