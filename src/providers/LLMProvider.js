import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

export class LLMProvider {
  constructor(options = {}) {
    this.model = options.model || 'claude-3-5-sonnet-20241022';
    this.provider = this.detectProvider(this.model);
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second base delay
    
    if (this.provider === 'anthropic') {
      this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!this.apiKey) {
        throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable.');
      }
      this.client = new Anthropic({
        apiKey: this.apiKey
      });
    } else {
      this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
      if (!this.apiKey) {
        throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
      }
      this.client = new OpenAI({
        apiKey: this.apiKey
      });
    }
  }
  
  detectProvider(model) {
    if (model.startsWith('claude')) {
      return 'anthropic';
    }
    return 'openai';
  }
  
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  isRetryableError(error) {
    // Check for rate limiting, server errors, and network issues
    if (error.status) {
      return error.status === 429 || // Rate limited
             error.status === 500 || // Internal server error
             error.status === 502 || // Bad gateway
             error.status === 503 || // Service unavailable
             error.status === 504;   // Gateway timeout
    }
    
    // Network errors
    if (error.code) {
      return error.code === 'ECONNRESET' ||
             error.code === 'ENOTFOUND' ||
             error.code === 'ECONNREFUSED' ||
             error.code === 'ETIMEDOUT';
    }
    
    // Anthropic specific errors
    if (error.type) {
      return error.type === 'rate_limit_error' ||
             error.type === 'api_error' ||
             error.type === 'overloaded_error';
    }
    
    return false;
  }
  
  calculateDelay(attempt) {
    // Exponential backoff with jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay; // Add up to 10% jitter
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }
  
  async executeWithRetry(operation, operationName = 'API call') {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateDelay(attempt - 1);
          console.log(`⏳ Retrying ${operationName} in ${Math.round(delay/1000)}s (attempt ${attempt + 1}/${this.maxRetries + 1})...`);
          await this.sleep(delay);
        }
        
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!this.isRetryableError(error)) {
          // Non-retryable error, throw immediately
          throw error;
        }
        
        if (attempt === this.maxRetries) {
          // Last attempt failed, throw the error
          console.error(`❌ ${operationName} failed after ${this.maxRetries + 1} attempts`);
          throw error;
        }
        
        // Log the retry-able error
        console.warn(`⚠️  ${operationName} failed (attempt ${attempt + 1}): ${error.message}`);
      }
    }
    
    throw lastError;
  }
  
  async complete(prompt, options = {}) {
    return await this.executeWithRetry(async () => {
      if (this.provider === 'anthropic') {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: options.maxTokens || 4000,
          temperature: options.temperature || 0.1,
          messages: [
            { role: 'user', content: prompt }
          ],
          ...options
        });
        
        return response.content[0].text;
      } else {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: options.temperature || 0.1,
          max_tokens: options.maxTokens || 4000,
          ...options
        });
        
        return response.choices[0].message.content;
      }
    }, 'LLM completion');
  }
  
  async streamComplete(prompt, onChunk, options = {}) {
    return await this.executeWithRetry(async () => {
      if (this.provider === 'anthropic') {
        const stream = await this.client.messages.create({
          model: this.model,
          max_tokens: options.maxTokens || 4000,
          temperature: options.temperature || 0.1,
          messages: [
            { role: 'user', content: prompt }
          ],
          stream: true,
          ...options
        });
        
        let fullResponse = '';
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta') {
            const content = chunk.delta.text || '';
            fullResponse += content;
            if (onChunk) {
              onChunk(content);
            }
          }
        }
        
        return fullResponse;
      } else {
        const stream = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: options.temperature || 0.1,
          max_tokens: options.maxTokens || 4000,
          stream: true,
          ...options
        });
        
        let fullResponse = '';
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          fullResponse += content;
          if (onChunk) {
            onChunk(content);
          }
        }
        
        return fullResponse;
      }
    }, 'LLM streaming');
  }
}
