# Legacy Adapters

This directory contains the legacy adapter system for MCP SuperAssistant. These adapters provide site-specific functionality for different AI platforms.

## Overview

The legacy adapter system was the original implementation for handling different AI platforms. It has been superseded by the new plugin-based adapter system in `../plugins/adapters/`, but is kept for backward compatibility.

## Adapters

- **chatgptAdapter.ts** - ChatGPT platform integration
- **geminiAdapter.ts** - Google Gemini platform integration  
- **grokAdapter.ts** - Grok platform integration
- **aistudioAdapter.ts** - Google AI Studio platform integration
- **deepseekAdapter.ts** - DeepSeek platform integration
- **kagiAdapter.ts** - Kagi platform integration
- **openrouterAdapter.ts** - OpenRouter platform integration
- **perplexityAdapter.ts** - Perplexity platform integration
- **t3chatAdapter.ts** - T3 Chat platform integration

## Key Files

- **adapterRegistry.ts** - Registry for managing legacy adapters
- **index.ts** - Main adapter exports and utilities
- **common/** - Shared adapter utilities and components
- **adaptercomponents/** - Adapter-specific UI components

## Migration

New development should use the plugin-based adapter system in `../plugins/adapters/` which provides:
- Better modularity
- Improved type safety
- Enhanced plugin architecture
- Better separation of concerns

## Status

⚠️ **Legacy System** - This directory is maintained for backward compatibility but is not actively developed. 