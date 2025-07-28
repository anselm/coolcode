# Code Assistant

A command-line AI coding assistant similar to aider, built with Node.js.

## Features

- 🤖 Interactive chat interface for code modifications
- 📁 Smart context management with auto-file detection
- 🔍 SEARCH/REPLACE block parsing and application
- 🛠️ Git integration and diff visualization
- 🎯 Consolidated prompt management
- 🔧 Modular tool abstractions

## Installation

```bash
npm install
```

## Setup

Set your OpenAI API key:

```bash
export OPENAI_API_KEY="your-api-key-here"
```

## Usage

### Interactive Chat Mode

```bash
npm start chat
```

Or with specific files:

```bash
npm start chat -f src/index.js package.json
```

### Single Command Mode

```bash
npm start apply "Add error handling to the main function"
```

With dry run:

```bash
npm start apply "Refactor the user interface" --dry-run
```

### CLI Commands

In interactive mode:

- `help` - Show available commands
- `/add <files...>` - Add files to context
- `/remove <files...>` - Remove files from context
- `/context` - Show current context
- `/clear` - Clear screen
- `exit` or `quit` - Exit

## Architecture

```
src/
├── index.js              # CLI entry point
├── core/
│   ├── CodeAssistant.js  # Main assistant orchestrator
│   ├── ContextManager.js # File context management
│   └── PromptManager.js  # Centralized prompt templates
├── providers/
│   └── LLMProvider.js    # OpenAI API integration
├── tools/
│   ├── GitTool.js        # Git operations abstraction
│   └── DiffTool.js       # Diff generation and application
└── interfaces/
    └── CLIInterface.js   # Interactive command line interface
```

## Configuration

The assistant supports various models and options:

```bash
npm start chat --model gpt-3.5-turbo
npm start apply "Fix the bug" --files src/bug.js --model gpt-4
```

## Development

Run in development mode with auto-reload:

```bash
npm run dev
```

## License

MIT
