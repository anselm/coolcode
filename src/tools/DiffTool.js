import { diffLines, createPatch } from 'diff';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { logger } from '../utils/Logger.js';

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
    logger.debug('generateDiff for file:', file);
    
    let originalContent = '';
    
    // Read existing file content if it exists
    try {
      originalContent = await fs.readFile(file, 'utf8');
      logger.debug('Read existing file content, length:', originalContent.length);
    } catch (error) {
      // File doesn't exist, treat as new file
      logger.debug('File does not exist, treating as new file:', file);
      originalContent = '';
    }
    
    // Apply the search/replace
    const newContent = this.applySearchReplace(originalContent, search, replace);
    logger.debug('Applied search/replace, new content length:', newContent.length);
    
    // Generate diff
    const patch = createPatch(file, originalContent, newContent);
    
    const result = {
      file,
      originalContent,
      newContent,
      patch,
      isNewFile: originalContent === '',
      hasChanges: originalContent !== newContent
    };
    
    logger.debug('Generated diff result:', {
      file: result.file,
      isNewFile: result.isNewFile,
      hasChanges: result.hasChanges,
      originalLength: result.originalContent.length,
      newLength: result.newContent.length
    });
    
    return result;
  }
  
  applySearchReplace(content, search, replace) {
    logger.debug('applySearchReplace called:', {
      contentLength: content.length,
      searchLength: search.length,
      replaceLength: replace.length,
      isNewFile: search === ''
    });
    
    if (search === '') {
      // New file or append
      logger.debug('Creating new file content');
      return replace;
    }
    
    // Find and replace the search content
    const searchIndex = content.indexOf(search);
    logger.debug('Search index:', searchIndex);
    
    if (searchIndex === -1) {
      logger.error('Search content not found in file');
      logger.debug('Search content:', search);
      throw new Error(`Search content not found in file:\n${search}`);
    }
    
    const result = content.substring(0, searchIndex) + 
           replace + 
           content.substring(searchIndex + search.length);
    
    logger.debug('Search/replace result length:', result.length);
    return result;
  }
  
  async applyChange(change) {
    const { file, search, replace } = change;
    logger.debug('applyChange called for file:', file);
    
    let content = '';
    let isNewFile = false;
    
    // Read existing content
    try {
      content = await fs.readFile(file, 'utf8');
      logger.debug('Read existing file content, length:', content.length);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist
        logger.debug('File does not exist, creating new file:', file);
        content = '';
        isNewFile = true;
      } else {
        logger.error('Error reading file:', file, error);
        throw new Error(`Cannot read file ${file}: ${error.message}`);
      }
    }
    
    // Apply change
    let newContent;
    try {
      newContent = this.applySearchReplace(content, search, replace);
      logger.debug('Generated new content, length:', newContent.length);
    } catch (error) {
      logger.error('Error applying search/replace to file:', file, error);
      throw error;
    }
    
    // Ensure directory exists
    const dirPath = path.dirname(file);
    logger.debug('Directory path:', dirPath);
    
    if (dirPath && dirPath !== '.' && dirPath !== '') {
      try {
        logger.debug('Ensuring directory exists:', dirPath);
        await fs.ensureDir(dirPath);
        logger.debug('Directory created/verified');
      } catch (error) {
        logger.error('Error creating directory:', dirPath, error);
        throw new Error(`Cannot create directory ${dirPath}: ${error.message}`);
      }
    }
    
    // Write new content
    logger.debug('Writing file:', file);
    logger.debug('Content preview:', newContent.substring(0, 100) + (newContent.length > 100 ? '...' : ''));
    
    try {
      await fs.writeFile(file, newContent, 'utf8');
      logger.success('File written successfully:', file);
      
      // Verify file was written correctly
      const stats = await fs.stat(file);
      const verifyContent = await fs.readFile(file, 'utf8');
      
      if (verifyContent !== newContent) {
        throw new Error('File content verification failed - written content does not match expected content');
      }
      
      logger.debug('File verification successful:', {
        size: stats.size,
        contentLength: verifyContent.length,
        isNewFile: isNewFile
      });
      
    } catch (error) {
      logger.error('Failed to write file:', file, error);
      throw new Error(`Cannot write file ${file}: ${error.message}`);
    }
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
