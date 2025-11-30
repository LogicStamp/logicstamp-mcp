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

If you installed from source, use absolute paths to the built file. See `.claude.json.example` in this repository for a template.

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

### "Snapshot not found"

Always call `logicstamp_refresh_snapshot` first before using other tools. The snapshot ID from that call is needed for subsequent operations.

## Next Steps

- Read [README.md](README.md) for full documentation
- Check [MCP_INTEGRATION.md](MCP_INTEGRATION.md) for architecture details
- See [TOOL_DESCRIPTION.md](TOOL_DESCRIPTION.md) for LogicStamp Context details
