# T3 Chat Components

This directory contains website-specific components for T3 Chat integration.

## Overview

T3 Chat components provide the interface between MCP SuperAssistant and the T3 Chat platform, handling DOM manipulation, input insertion, and form submission.

## Files

### Chat Input Handler

**File**: `chatInputHandler.ts`

Handles all interactions with the T3 Chat interface including:
- Text insertion into chat input
- File attachment functionality
- Form submission
- DOM element detection and manipulation

#### Key Functions
- `insertTextToChatInput()` - Insert text into the chat input
- `attachFileToChat()` - Attach files to the chat
- `submitChatInput()` - Submit the chat form
- `findChatInput()` - Locate the chat input element

### Index

**File**: `index.ts`

Exports all T3 Chat-specific components and utilities for easy importing.

## Usage

These components are automatically loaded when the user visits T3 Chat and provide seamless integration with the MCP SuperAssistant functionality.

## Platform Support

- **T3 Chat**: Full support for chat interactions
- **File Attachments**: Support for file upload and attachment
- **Auto-submit**: Integration with the auto-submission system
- **Tool Execution**: Support for MCP tool execution and result insertion 