# ChatGPT Components

This directory contains website-specific components for ChatGPT integration.

## Overview

ChatGPT components provide the interface between MCP SuperAssistant and the ChatGPT platform, handling DOM manipulation, input insertion, and form submission.

## Files

### Chat Input Handler

**File**: `chatInputHandler.ts`

Handles all interactions with the ChatGPT interface including:
- Text insertion into chat input
- File attachment functionality
- Form submission
- DOM element detection and manipulation
- File detachment (ChatGPT-specific functionality)

#### Key Functions
- `insertTextToChatInput()` - Insert text into the chat input
- `attachFileToChat()` - Attach files to the chat
- `submitChatInput()` - Submit the chat form
- `detachFileFromChat()` - Remove attached files (ChatGPT-specific)
- `findChatInput()` - Locate the chat input element

### Index

**File**: `index.ts`

Exports all ChatGPT-specific components and utilities for easy importing.

## Usage

These components are automatically loaded when the user visits ChatGPT and provide seamless integration with the MCP SuperAssistant functionality.

## Platform Support

- **ChatGPT**: Full support for chat interactions
- **File Attachments**: Support for file upload and attachment
- **File Detachment**: Special handling for file removal (ChatGPT-specific)
- **Auto-submit**: Integration with the auto-submission system
- **Tool Execution**: Support for MCP tool execution and result insertion

## Special Features

ChatGPT has special handling for file detachment to prevent unwanted auto-submission when the MCP tool is disabled. 