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

Create a `.env` file in the project root and add your API keys:

```bash
# For Claude (default)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# For OpenAI (optional)
OPENAI_API_KEY=your_openai_api_key_here
```

Or set environment variables:

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
export OPENAI_API_KEY="your-openai-api-key-here"
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

Disable auto-apply and auto-commit:

```bash
npm start chat --no-auto-apply --no-auto-commit
```

### Single Command Mode

```bash
npm start apply "Add error handling to the main function"
```

With dry run:

```bash
npm start apply "Refactor the user interface" --dry-run
```

Disable automatic behavior:

```bash
npm start apply "Fix the bug" --no-auto-apply --no-auto-commit
```

### CLI Commands

In interactive mode:

- `help` - Show available commands
- `/add <files...>` - Add files to context
- `/remove <files...>` - Remove files from context
- `/context` - Show current context
- `/config` - Show current configuration
- `/set <key>=<value>` - Set configuration (autoApply, autoCommit, dryRun)
- `/clear` - Clear screen
- `exit` or `quit` - Exit

### Default Behavior

By default, the assistant will:
1. **Automatically apply** code changes without asking for confirmation
2. **Automatically commit** changes to git with generated commit messages
3. Show diffs before applying changes

You can override this behavior with command-line flags or runtime configuration.

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
# Use Claude (default)
npm start chat --model claude-3-5-sonnet-20241022

# Use OpenAI
npm start chat --model gpt-4
npm start apply "Fix the bug" --files src/bug.js --model gpt-3.5-turbo
```

Supported models:
- **Claude**: `claude-3-5-sonnet-20241022`, `claude-3-haiku-20240307`, `claude-3-opus-20240229`
- **OpenAI**: `gpt-4`, `gpt-3.5-turbo`, `gpt-4-turbo`

## How It Works

The Code Assistant follows a structured flow from user input to code changes:

### 1. Input Processing
- **CLI Interface** (`CLIInterface.js`) captures user input and handles special commands (`/add`, `/remove`, etc.)
- For coding requests, the input is passed to the **Code Assistant** orchestrator

### 2. Context Assembly
- **Context Manager** (`ContextManager.js`) maintains a map of loaded files and their contents
- Current context (files, metadata) is retrieved and prepared for the LLM
- **Prompt Loader** (`PromptLoader.js`) combines system prompts, context information, and user request

### 3. LLM Interaction
- **LLM Provider** (`LLMProvider.js`) sends the assembled prompt to the configured AI model (Claude/OpenAI)
- The provider handles API communication and returns the model's response

### 4. Response Parsing
- **Code Assistant** parses the LLM response using regex to extract SEARCH/REPLACE blocks
- Each block is validated and converted into a structured change object with file path, search text, and replacement text

### 5. Change Application
- **Diff Tool** (`DiffTool.js`) generates visual diffs showing what will change
- If not in dry-run mode, changes are applied by:
  - Reading existing file content
  - Performing search/replace operations
  - Writing updated content back to files
  - Creating new files when search section is empty

### 6. Git Integration
- **Git Tool** (`GitTool.js`) automatically stages changed files
- Generates descriptive commit messages based on user request and modified files
- Commits changes if auto-commit is enabled

### Internal Flow Diagram
```
User Input → CLI Interface → Code Assistant
                                ↓
Context Manager ← Prompt Loader ← LLM Provider
                                ↓
Response Parsing → Diff Tool → File System
                                ↓
Git Tool → Commit (if enabled)
```

This architecture ensures clean separation of concerns while maintaining a smooth user experience from request to applied changes.

## Development

Run in development mode with auto-reload:

```bash
npm run dev
```

## License

MIT
