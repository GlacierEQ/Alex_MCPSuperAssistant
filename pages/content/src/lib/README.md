# Library Utilities

This directory contains library utilities and shared code for MCP SuperAssistant.

## Overview

The lib directory contains utility functions and shared code that are used across multiple parts of the application.

## Files

### Utils

**File**: `utils.ts`

Contains general utility functions used throughout the application.

#### Functions
- General utility functions for common operations
- Shared helper methods
- Cross-cutting concerns

## Usage

Library utilities are designed to be:
- **Reusable**: Functions can be used across multiple modules
- **Pure**: Functions have no side effects where possible
- **Well-tested**: Utilities are thoroughly tested
- **Documented**: All functions have clear documentation

## Architecture

Library utilities follow these principles:
- **Single Responsibility**: Each function has a single, clear purpose
- **Composability**: Functions can be easily combined
- **Immutability**: Functions don't modify input parameters
- **Error Handling**: Proper error handling and validation

## Import

```typescript
import { utilityFunction } from '@src/lib/utils';
``` 