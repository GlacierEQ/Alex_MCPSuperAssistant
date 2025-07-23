# Services

This directory contains application services that provide core functionality for MCP SuperAssistant.

## Overview

Services are singleton modules that handle specific application concerns and provide centralized functionality across the extension.

## Services

### Automation Service

**File**: `automation.service.ts`

The automation service handles automatic tool execution and form submission functionality.

#### Features
- **Auto Execute**: Automatically executes detected MCP tools
- **Auto Submit**: Automatically submits chat input after tool result insertion
- **Auto Insert**: Automatically inserts tool results into chat input
- **Cooldown Management**: Prevents rapid, unintended submissions
- **Event Handling**: Listens for tool execution completion events

#### Key Methods
- `initialize()` - Initialize the automation service
- `cleanup()` - Clean up the automation service
- `handleAutoSubmit()` - Handle automatic form submission
- `handleAutoInsert()` - Handle automatic result insertion
- `handleAutoExecute()` - Handle automatic tool execution

### Service Management

**File**: `index.ts`

Provides centralized service management including initialization and cleanup of all services.

#### Functions
- `initializeAllServices()` - Initialize all application services
- `cleanupAllServices()` - Clean up all application services

## Usage

Services are automatically initialized when the application starts and cleaned up when the application shuts down. They can be accessed through the service management functions or directly imported where needed.

## Architecture

Services follow a singleton pattern and are designed to be:
- **Stateless**: Services maintain minimal internal state
- **Event-driven**: Services communicate through the event bus
- **Modular**: Each service handles a specific concern
- **Testable**: Services are designed for easy testing and mocking 