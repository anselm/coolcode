import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

export class ContextManager {
  constructor() {
    this.files = new Map(); // filepath -> content
    this.metadata = new Map(); // filepath -> metadata
  }
  
  async addFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const stats = await fs.stat(filePath);
        
        this.files.set(filePath, content);
        this.metadata.set(filePath, {
          size: stats.size,
          modified: stats.mtime,
          extension: path.extname(filePath)
        });
      } catch (error) {
        console.warn(`Warning: Could not read file ${filePath}:`, error.message);
      }
    }
  }
  
  async removeFiles(filePaths) {
    for (const filePath of filePaths) {
      this.files.delete(filePath);
      this.metadata.delete(filePath);
    }
  }
  
  async refresh() {
    // Reload all currently tracked files
    const filePaths = Array.from(this.files.keys());
    this.files.clear();
    this.metadata.clear();
    await this.addFiles(filePaths);
  }
  
  async detectRelevantFiles() {
    // Auto-detect relevant files in the current directory
    const patterns = [
      '*.js', '*.ts', '*.jsx', '*.tsx',
      '*.py', '*.java', '*.cpp', '*.c', '*.h',
      '*.html', '*.css', '*.scss',
      '*.json', '*.yaml', '*.yml',
      '*.md', '*.txt',
      'package.json', 'tsconfig.json', '.gitignore'
    ];
    
    const files = [];
    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, { 
          ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
          maxDepth: 3
        });
        files.push(...matches);
      } catch (error) {
        // Ignore glob errors
      }
    }
    
    // Limit to reasonable number of files
    return files.slice(0, 20);
  }
  
  getFileContents() {
    const contents = {};
    for (const [filePath, content] of this.files) {
      contents[filePath] = content;
    }
    return contents;
  }
  
  async getCurrentContext() {
    return {
      files: Array.from(this.files.keys()),
      totalFiles: this.files.size,
      totalSize: Array.from(this.metadata.values())
        .reduce((sum, meta) => sum + meta.size, 0)
    };
  }
  
  hasFile(filePath) {
    return this.files.has(filePath);
  }
  
  getFile(filePath) {
    return this.files.get(filePath);
  }
}
