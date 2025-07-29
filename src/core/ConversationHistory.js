import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/Logger.js';

export class ConversationHistory {
  constructor() {
    this.messages = [];
    this.maxMessages = 20; // Keep last 20 exchanges to avoid token limits
    this.historyFile = '.coolcode.history';
    this.loadHistory();
  }
  
  addUserMessage(message) {
    this.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    this.trimHistory();
    this.saveHistory();
  }
  
  addAssistantMessage(message) {
    this.messages.push({
      role: 'assistant', 
      content: message,
      timestamp: new Date().toISOString()
    });
    this.trimHistory();
    this.saveHistory();
  }
  
  trimHistory() {
    // Keep only the most recent messages to avoid token limits
    if (this.messages.length > this.maxMessages * 2) {
      // Remove oldest messages but keep pairs (user + assistant)
      const toRemove = this.messages.length - this.maxMessages * 2;
      this.messages.splice(0, toRemove);
    }
  }
  
  getHistory() {
    return [...this.messages];
  }
  
  getFormattedHistory() {
    if (this.messages.length === 0) {
      return '';
    }
    
    return this.messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');
  }
  
  clear() {
    this.messages = [];
    this.saveHistory();
  }
  
  isEmpty() {
    return this.messages.length === 0;
  }
  
  async loadHistory() {
    try {
      if (await fs.pathExists(this.historyFile)) {
        const data = await fs.readFile(this.historyFile, 'utf8');
        const parsed = JSON.parse(data);
        
        if (Array.isArray(parsed.messages)) {
          this.messages = parsed.messages;
          logger.debug(`Loaded ${this.messages.length} messages from history file`);
        }
      }
    } catch (error) {
      logger.debug('Could not load conversation history:', error.message);
      // Continue with empty history if file is corrupted or missing
      this.messages = [];
    }
  }
  
  async saveHistory() {
    try {
      const data = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        messages: this.messages
      };
      
      await fs.writeFile(this.historyFile, JSON.stringify(data, null, 2), 'utf8');
      logger.debug(`Saved ${this.messages.length} messages to history file`);
    } catch (error) {
      logger.debug('Could not save conversation history:', error.message);
      // Don't throw - history saving is not critical
    }
  }
  
  async flush() {
    this.messages = [];
    try {
      if (await fs.pathExists(this.historyFile)) {
        await fs.remove(this.historyFile);
        logger.debug('Flushed conversation history file');
      }
    } catch (error) {
      logger.debug('Could not remove history file:', error.message);
    }
  }
}
