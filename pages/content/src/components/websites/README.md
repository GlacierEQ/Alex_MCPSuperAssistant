# Website Components

This directory contains website-specific components for all supported AI platforms.

## Overview

Website components provide the interface between MCP SuperAssistant and various AI platforms, handling DOM manipulation, input insertion, and form submission for each specific platform.

## Supported Platforms

### AI Studio
- **Directory**: `aistudio/`
- **Platform**: Google AI Studio
- **Features**: Chat input handling, file attachments, form submission

### ChatGPT
- **Directory**: `chatgpt/`
- **Platform**: OpenAI ChatGPT
- **Features**: Chat input handling, file attachments, form submission, file detachment
- **Special**: Has special handling for file detachment to prevent unwanted auto-submission

### DeepSeek
- **Directory**: `deepseek/`
- **Platform**: DeepSeek
- **Features**: Chat input handling, file attachments, form submission

### Gemini
- **Directory**: `gemini/`
- **Platform**: Google Gemini
- **Features**: Chat input handling, file attachments, form submission

### Grok
- **Directory**: `grok/`
- **Platform**: Grok
- **Features**: Chat input handling, file attachments, form submission

### Kagi
- **Directory**: `kagi/`
- **Platform**: Kagi
- **Features**: Chat input handling, file attachments, form submission

### OpenRouter
- **Directory**: `openrouter/`
- **Platform**: OpenRouter
- **Features**: Chat input handling, file attachments, form submission

### Perplexity
- **Directory**: `perplexity/`
- **Platform**: Perplexity
- **Features**: Chat input handling, file attachments, form submission

### T3 Chat
- **Directory**: `t3chat/`
- **Platform**: T3 Chat
- **Features**: Chat input handling, file attachments, form submission

## Common Structure

Each platform directory follows the same structure:

```
platform/
├── chatInputHandler.ts  # Main interaction logic
├── index.ts            # Exports
└── README.md           # Platform-specific documentation
```

## Key Functions

All platform components implement these core functions:

- `insertTextToChatInput()` - Insert text into the chat input
- `attachFileToChat()` - Attach files to the chat
- `submitChatInput()` - Submit the chat form
- `findChatInput()` - Locate the chat input element

## Usage

These components are automatically loaded when the user visits any supported platform and provide seamless integration with the MCP SuperAssistant functionality.

## Integration

Website components work together with:
- **Plugin Adapters**: For platform-specific logic
- **Automation Service**: For auto-submit and auto-insert functionality
- **Event System**: For communication between components
- **Stores**: For state management 