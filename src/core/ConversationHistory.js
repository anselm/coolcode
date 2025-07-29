export class ConversationHistory {
  constructor() {
    this.messages = [];
    this.maxMessages = 20; // Keep last 20 exchanges to avoid token limits
  }
  
  addUserMessage(message) {
    this.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    this.trimHistory();
  }
  
  addAssistantMessage(message) {
    this.messages.push({
      role: 'assistant', 
      content: message,
      timestamp: new Date().toISOString()
    });
    this.trimHistory();
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
  }
  
  isEmpty() {
    return this.messages.length === 0;
  }
}
