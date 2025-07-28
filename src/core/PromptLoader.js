import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PromptLoader {
  constructor() {
    this.promptsDir = path.join(__dirname, '../../prompts');
    this.templates = {};
    this.loadPrompts();
  }
  
  async loadPrompts() {
    try {
      this.templates.system = await fs.readFile(path.join(this.promptsDir, 'system.txt'), 'utf8');
      this.templates.coding = await fs.readFile(path.join(this.promptsDir, 'coding.txt'), 'utf8');
      this.templates.context = await fs.readFile(path.join(this.promptsDir, 'context.txt'), 'utf8');
    } catch (error) {
      throw new Error(`Failed to load prompt templates: ${error.message}`);
    }
  }
  
  getSystemPrompt() {
    return this.templates.system;
  }
  
  getCodingPrompt() {
    return this.templates.coding;
  }
  
  getContextPrompt() {
    return this.templates.context;
  }
  
  buildCodingPrompt({ userRequest, context, files }) {
    const filesList = Object.keys(files).join('\n- ');
    const fileContents = Object.entries(files)
      .map(([path, content]) => `=== ${path} ===\n${content}\n`)
      .join('\n');
    
    const contextInfo = this.templates.context
      .replace('{totalFiles}', context.totalFiles)
      .replace('{totalSize}', context.totalSize)
      .replace('{filesList}', filesList);
    
    return [
      this.templates.system,
      '',
      this.templates.coding
        .replace('{userRequest}', userRequest)
        .replace('{context}', contextInfo)
        .replace('{filesList}', filesList)
        .replace('{fileContents}', fileContents)
    ].join('\n');
  }
  
  buildSystemPrompt() {
    return this.templates.system;
  }
}
