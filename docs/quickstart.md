# Quick Start Guide

## 1. Prerequisites

Install the LogicStamp Context CLI (this MCP server is a wrapper around it):

```bash
npm install -g logicstamp-context
```

Verify installation:

```bash
stamp --version
```

## 2. Install the MCP Server

### Option A: Use Published Package (Recommended)

```bash
npm install -g logicstamp-context-mcp
```

### Option B: Install from Source

```bash
cd logicstamp-mcp
npm install
npm run build
```

## 3. Configure Your MCP Client

### For Claude Code Users (Recommended)

Claude Code is Anthropic's official CLI for Claude. Choose one setup option:

#### Global Setup (Available Everywhere)

**Option 1: Edit `~/.claude.json` manually (Recommended)**

Create or edit `~/.claude.json` in your home directory:

**On macOS/Linux:**
```bash
nano ~/.claude.json
```

**On Windows:**
```bash
notepad %USERPROFILE%\.claude.json
```

Add the following configuration:

```json
{
  "mcpServers": {
    "logicstamp": {
      "type": "stdio",
      "command": "npx",
      "args": ["logicstamp-context-mcp"]
    }
  }
}
```

**Option 2: Use CLI command (Alternative)**

```bash
claude mcp add --scope user --transport stdio logicstamp -- npx logicstamp-context-mcp
```

This automatically adds LogicStamp to `~/.claude.json` and makes it available in all your projects.

#### Project Setup (For Teams)

**Option 1: Edit `.mcp.json` manually (Recommended)**

Create `.mcp.json` in your project root directory. You can copy `.mcp.json.example` from this repository:

```bash
cp .mcp.json.example .mcp.json
```

Or create it manually with this content:

```json
{
  "mcpServers": {
    "logicstamp": {
      "type": "stdio",
      "command": "npx",
      "args": ["logicstamp-context-mcp"]
    }
  }
}
```

**Option 2: Use CLI command (Alternative)**

```bash
cd /path/to/your/project
claude mcp add --scope project --transport stdio logicstamp -- npx logicstamp-context-mcp
```

This automatically creates `.mcp.json` in your project root. The file can be committed to git for team collaboration.

**Verify installation:**
```bash
claude mcp list
```

You should see `logicstamp: ✓ Connected`.

### For Claude Desktop Users

#### Using Published Package (Recommended)

On macOS, edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "logicstamp": {
      "command": "npx",
      "args": ["logicstamp-context-mcp"]
    }
  }
}
```

On Windows, edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "logicstamp": {
      "command": "npx",
      "args": ["logicstamp-context-mcp"]
    }
  }
}
```

#### Using Local Installation

If you installed from source (for development or testing), use absolute paths to the built file:

**On macOS/Linux:**
```json
{
  "mcpServers": {
    "logicstamp": {
      "command": "node",
      "args": ["/absolute/path/to/logicstamp-context-mcp/dist/index.js"]
    }
  }
}
```

**On Windows:**
```json
{
  "mcpServers": {
    "logicstamp": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\path\\to\\logicstamp-context-mcp\\dist\\index.js"]
    }
  }
}
```

**Global Install vs Local Development:**

The recommended approach is to use `npx` with the globally installed package:

```json
{
  "mcpServers": {
    "logicstamp": {
      "command": "npx",
      "args": ["logicstamp-context-mcp"]
    }
  }
}
```

**Why use global install?**
- ✅ Simpler - No absolute paths needed
- ✅ Portable - Works on any machine
- ✅ Auto-updates - `npm update -g` updates it
- ✅ Team-friendly - Same config for everyone

**When to use local development:**
- Contributing to the codebase
- Testing before publishing
- Package isn't published yet

### For Cursor Users

Cursor is an AI-powered code editor that supports MCP servers. Choose one setup option:

#### Global Setup (Available Everywhere)

**Create `~/.cursor/mcp.json` manually:**

**On macOS/Linux:**
```bash
mkdir -p ~/.cursor
nano ~/.cursor/mcp.json
```

**On Windows:**
```bash
mkdir %USERPROFILE%\.cursor
notepad %USERPROFILE%\.cursor\mcp.json
```

Add the following configuration:

```json
{
  "mcpServers": {
    "logicstamp": {
      "command": "npx",
      "args": ["logicstamp-context-mcp"]
    }
  }
}
```

This makes LogicStamp available in all projects you open in Cursor.

#### Project Setup (For Teams)

**Create `.cursor/mcp.json` in your project root:**

```bash
cd /path/to/your/project
mkdir -p .cursor
```

Create `.cursor/mcp.json` with this content:

```json
{
  "mcpServers": {
    "logicstamp": {
      "command": "npx",
      "args": ["logicstamp-context-mcp"]
    }
  }
}
```

This file can be committed to git for team collaboration.

**Local Development Setup:**

If you're developing the MCP server locally, use absolute paths instead:

```json
{
  "mcpServers": {
    "logicstamp": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\path\\to\\logicstamp-context-mcp\\dist\\index.js"]
    }
  }
}
```

**Note:** For production use, prefer the `npx` approach (shown above) as it's simpler and portable. Use absolute paths only when developing locally.

**Verify installation:**
1. Completely quit and restart Cursor
2. Open Cursor settings (Cmd/Ctrl + ,) → Features → Model Context Protocol
3. Check that LogicStamp appears in the list
4. Open AI chat and ask: "Can you analyze my project using LogicStamp?"

## 4. Start Using LogicStamp

### With Claude Code

```bash
cd /path/to/your/react-project
claude
```

Then ask Claude to analyze your project:
```
Can you analyze my React project using LogicStamp?
```

### With Claude Desktop

Completely quit and restart Claude Desktop for the changes to take effect, then start a conversation and ask Claude to analyze your project.

### With Cursor

1. Open your project in Cursor
2. Open Cursor's AI chat (Cmd/Ctrl + L)
3. Ask the AI to analyze your project:
   ```
   Can you analyze my React project using LogicStamp?
   ```

The AI will automatically use the LogicStamp tools to analyze your codebase.

## 5. Available Tools

Claude should now be able to use the 4 LogicStamp tools:
- `logicstamp_refresh_snapshot` - Analyze the project and create snapshot
- `logicstamp_list_bundles` - List available component bundles
- `logicstamp_read_bundle` - Read full component contract + graph
- `logicstamp_compare_snapshot` - Detect changes after edits

## Example Conversation

```
You: Analyze the Button component in my project

Claude:
1. [Uses logicstamp_refresh_snapshot to create snapshot]
2. [Uses logicstamp_list_bundles to find Button component]
3. [Uses logicstamp_read_bundle to read Button's contract]
4. [Provides detailed analysis of Button's props, state, hooks, etc.]

You: Analyze components with style information

Claude:
1. [Uses logicstamp_refresh_snapshot with includeStyle: true]
2. [Uses logicstamp_list_bundles to find components]
3. [Uses logicstamp_read_bundle to read component contracts with style metadata]
4. [Provides analysis including Tailwind classes, color palettes, layout patterns, animations]
```

## Troubleshooting

### "stamp: command not found"

The LogicStamp Context CLI is not installed. Run:

```bash
npm install -g logicstamp-context
```

### Server doesn't show up in Claude Code

**Check if server is configured:**
```bash
claude mcp list
```

**If not listed, add it:**
```bash
# For global setup
claude mcp add --scope user --transport stdio logicstamp -- npx logicstamp-context-mcp

# Or for project setup
claude mcp add --scope project --transport stdio logicstamp -- npx logicstamp-context-mcp
```

**If connection fails:**
- Verify the package is installed: `npm list -g logicstamp-context-mcp`
- Try running manually: `npx logicstamp-context-mcp`
- Check for build errors if using local installation

### Server doesn't show up in Claude Desktop

1. Check the config file path is correct (`claude_desktop_config.json`)
2. Ensure absolute paths are used (not relative)
3. Verify the JSON syntax is valid
4. Completely quit and restart Claude Desktop
5. Check Claude's logs for errors

### Server doesn't show up in Cursor

**Check config file location:**
- Global: `~/.cursor/mcp.json` (macOS/Linux) or `%USERPROFILE%\.cursor\mcp.json` (Windows)
- Project: `.cursor/mcp.json` in project root
- Ensure the `.cursor` directory exists

**If not working:**
1. Verify JSON syntax is valid
2. Check package is installed: `npm list -g logicstamp-context-mcp`
3. Test manually: `npx logicstamp-context-mcp`
4. Completely quit and restart Cursor (not just close window)
5. Check Cursor's developer console (Help → Toggle Developer Tools) for errors

**Verify MCP is enabled:**
- Settings → Features → Model Context Protocol should be enabled
- LogicStamp should appear in the MCP servers list

### "Snapshot not found"

Always call `logicstamp_refresh_snapshot` first before using other tools. The snapshot ID from that call is needed for subsequent operations.

## Next Steps

- Read [README.md](../README.md) for full documentation
- Check [MCP_INTEGRATION.md](MCP_INTEGRATION.md) for architecture details
- See [TOOL_DESCRIPTION.md](TOOL_DESCRIPTION.md) for LogicStamp Context details
