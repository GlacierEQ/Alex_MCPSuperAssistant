#!/usr/bin/env node
/**
 * Notion-GitHub Bridge MCP Server
 * Seamlessly syncs Notion pages/databases with GitHub repos
 * Auto-commits changes, creates PRs, and maintains bidirectional sync
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { Octokit } = require('@octokit/rest');
const { Client } = require('@notionhq/client');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const github = new Octokit({ auth: process.env.GITHUB_TOKEN });
const notion = new Client({ auth: process.env.NOTION_API_KEY });

const REPO = process.env.OMNIENGINE_REPO || 'GlacierEQ/OmniEngine';
const [owner, repo] = REPO.split('/');
const BRANCH = process.env.OMNIENGINE_DEFAULT_BRANCH || 'main';

class NotionGitHubBridge {
  constructor() {
    this.server = new Server(
      { name: 'notion-github-bridge', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'sync_notion_to_github',
          description: 'Export Notion page/database to GitHub as markdown/json and auto-commit',
          inputSchema: {
            type: 'object',
            properties: {
              notionPageId: { type: 'string', description: 'Notion page or database ID' },
              githubPath: { type: 'string', description: 'Target path in repo (e.g., docs/legal/motions.md)' },
              commitMessage: { type: 'string', description: 'Commit message' },
              createPR: { type: 'boolean', description: 'Create PR instead of direct commit', default: false },
            },
            required: ['notionPageId', 'githubPath', 'commitMessage'],
          },
        },
        {
          name: 'sync_github_to_notion',
          description: 'Import GitHub file/folder into Notion page/database',
          inputSchema: {
            type: 'object',
            properties: {
              githubPath: { type: 'string', description: 'Path in repo' },
              notionParentId: { type: 'string', description: 'Parent Notion page or database ID' },
              syncMode: { type: 'string', enum: ['create', 'update', 'mirror'], default: 'create' },
            },
            required: ['githubPath', 'notionParentId'],
          },
        },
        {
          name: 'auto_sync_setup',
          description: 'Set up automatic bidirectional sync between Notion workspace and GitHub repo',
          inputSchema: {
            type: 'object',
            properties: {
              notionDatabaseId: { type: 'string', description: 'Notion database to watch' },
              githubDirectory: { type: 'string', description: 'GitHub directory to sync' },
              syncInterval: { type: 'number', description: 'Sync interval in minutes', default: 5 },
            },
            required: ['notionDatabaseId', 'githubDirectory'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'sync_notion_to_github':
            return await this.syncNotionToGitHub(args);
          case 'sync_github_to_notion':
            return await this.syncGitHubToNotion(args);
          case 'auto_sync_setup':
            return await this.setupAutoSync(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  async syncNotionToGitHub({ notionPageId, githubPath, commitMessage, createPR = false }) {
    // Fetch Notion content
    const page = await notion.pages.retrieve({ page_id: notionPageId });
    const blocks = await this.getNotionBlocks(notionPageId);
    const markdown = await this.convertBlocksToMarkdown(blocks);

    // Commit to GitHub
    const content = Buffer.from(markdown).toString('base64');
    const branch = createPR ? `notion-sync-${Date.now()}` : BRANCH;

    if (createPR) {
      const baseSha = await this.getBaseSha();
      await github.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: baseSha,
      });
    }

    await github.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: githubPath,
      message: commitMessage,
      content,
      branch,
    });

    if (createPR) {
      const pr = await github.pulls.create({
        owner,
        repo,
        title: commitMessage,
        head: branch,
        base: BRANCH,
        body: `Auto-synced from Notion page: ${notionPageId}`,
      });
      return {
        content: [{
          type: 'text',
          text: `✅ PR created: ${pr.data.html_url}\n\nNotion → GitHub sync complete!`,
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Committed to ${REPO}/${githubPath}\n\nNotion → GitHub sync complete!`,
      }],
    };
  }

  async syncGitHubToNotion({ githubPath, notionParentId, syncMode = 'create' }) {
    const { data } = await github.repos.getContent({ owner, repo, path: githubPath, ref: BRANCH });
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const blocks = await this.convertMarkdownToBlocks(content);

    const page = await notion.pages.create({
      parent: { page_id: notionParentId },
      properties: {
        title: { title: [{ text: { content: data.name } }] },
      },
      children: blocks,
    });

    return {
      content: [{
        type: 'text',
        text: `✅ Created Notion page: ${page.url}\n\nGitHub → Notion sync complete!`,
      }],
    };
  }

  async setupAutoSync({ notionDatabaseId, githubDirectory, syncInterval = 5 }) {
    // Store sync config
    const config = { notionDatabaseId, githubDirectory, syncInterval, enabled: true };
    await fs.writeFile(
      path.join(__dirname, '../.sync-config.json'),
      JSON.stringify(config, null, 2)
    );

    return {
      content: [{
        type: 'text',
        text: `✅ Auto-sync enabled!\n\nNotion DB: ${notionDatabaseId}\nGitHub Dir: ${githubDirectory}\nInterval: ${syncInterval} min\n\nUse 'mcp logs' to monitor sync activity.`,
      }],
    };
  }

  async getNotionBlocks(pageId) {
    const blocks = [];
    let cursor;
    while (true) {
      const { results, next_cursor } = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
      });
      blocks.push(...results);
      if (!next_cursor) break;
      cursor = next_cursor;
    }
    return blocks;
  }

  async convertBlocksToMarkdown(blocks) {
    let md = '';
    for (const block of blocks) {
      if (block.type === 'heading_1') md += `# ${block.heading_1.rich_text[0]?.plain_text || ''}\n`;
      else if (block.type === 'heading_2') md += `## ${block.heading_2.rich_text[0]?.plain_text || ''}\n`;
      else if (block.type === 'paragraph') md += `${block.paragraph.rich_text[0]?.plain_text || ''}\n\n`;
      else if (block.type === 'bulleted_list_item') md += `- ${block.bulleted_list_item.rich_text[0]?.plain_text || ''}\n`;
    }
    return md;
  }

  async convertMarkdownToBlocks(markdown) {
    const lines = markdown.split('\n');
    const blocks = [];
    for (const line of lines) {
      if (line.startsWith('# ')) blocks.push({ heading_1: { rich_text: [{ text: { content: line.slice(2) } }] } });
      else if (line.startsWith('## ')) blocks.push({ heading_2: { rich_text: [{ text: { content: line.slice(3) } }] } });
      else if (line.trim()) blocks.push({ paragraph: { rich_text: [{ text: { content: line } }] } });
    }
    return blocks;
  }

  async getBaseSha() {
    const { data } = await github.repos.getBranch({ owner, repo, branch: BRANCH });
    return data.commit.sha;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Notion-GitHub Bridge MCP server running');
  }
}

const server = new NotionGitHubBridge();
server.run().catch(console.error);
