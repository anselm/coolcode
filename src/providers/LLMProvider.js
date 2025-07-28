import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

export class LLMProvider {
  constructor(options = {}) {
    this.model = options.model || 'claude-3-5-sonnet-20241022';
    this.provider = this.detectProvider(this.model);
    
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
  
  async complete(prompt, options = {}) {
    try {
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
    } catch (error) {
      throw new Error(`LLM API error: ${error.message}`);
    }
  }
  
  async streamComplete(prompt, onChunk, options = {}) {
    try {
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
    } catch (error) {
      throw new Error(`LLM API error: ${error.message}`);
    }
  }
}
