export class PromptManager {
  constructor() {
    this.prompts = {
      system: this.getSystemPrompt(),
      coding: this.getCodingPrompt(),
      context: this.getContextPrompt()
    };
  }
  
  getSystemPrompt() {
    return `You are an expert software developer and coding assistant.

CORE PRINCIPLES:
- Always use best practices when coding
- Respect existing conventions, libraries, and patterns in the codebase
- Ask clarifying questions if requests are ambiguous
- Provide clear, concise explanations for changes

RESPONSE FORMAT:
You MUST respond with code changes using *SEARCH/REPLACE* blocks in this exact format:

filename.ext
\`\`\`\`language
<<<<<<< SEARCH
[exact existing code to find]
