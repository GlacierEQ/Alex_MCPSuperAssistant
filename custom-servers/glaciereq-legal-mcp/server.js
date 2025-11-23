/**
 * GlacierEQ Legal Automation MCP Server
 * 
 * Custom MCP server for Hawaii Family Court Case 1FDV-23-0001009
 * Provides legal document automation, motion generation, and case management tools
 * 
 * Author: Casey del Carpio Barton
 * Contact: glacier.equilibrium@gmail.com
 * Repository: https://github.com/GlacierEQ/Alex_MCPSuperAssistant
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');

// Server configuration
const CASE_NUMBER = process.env.CASE_NUMBER || '1FDV-23-0001009';
const EVIDENCE_DB_PATH = process.env.EVIDENCE_DB_PATH || './evidence-database';
const ASPEN_GROVE_API = process.env.ASPEN_GROVE_API || 'http://localhost:8080';

// Complete server implementation from artifact 43
// See glaciereq-legal-server.js for full code

module.exports = { GlacierEQLegalServer };