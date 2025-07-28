import OpenAI from 'openai';

export class LLMProvider {
  constructor(options = {}) {
    this.model = options.model || 'gpt-4';
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }
    
    this.client = new OpenAI({
      apiKey: this.apiKey
    });
  }
  
  async complete(prompt, options = {}) {
    try {
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
    } catch (error) {
      throw new Error(`LLM API error: ${error.message}`);
    }
  }
  
  async streamComplete(prompt, onChunk, options = {}) {
    try {
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
    } catch (error) {
      throw new Error(`LLM API error: ${error.message}`);
    }
  }
}
