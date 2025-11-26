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

```bash
cd logicstamp-mcp
npm install
npm run build
```

## 3. Configure Claude Desktop

On macOS, edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "logicstamp": {
      "command": "node",
      "args": ["/absolute/path/to/logicstamp-mcp/dist/index.js"],
      "env": {
        "PROJECT_PATH": "/path/to/your/react/project"
      }
    }
  }
}
```

On Windows, edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "logicstamp": {
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\logicstamp-mcp\\dist\\index.js"],
      "env": {
        "PROJECT_PATH": "C:\\path\\to\\your\\react\\project"
      }
    }
  }
}
```

## 4. Restart Claude Desktop

Completely quit and restart Claude Desktop for the changes to take effect.

## 5. Test the Integration

In Claude Desktop, try:

```
Can you analyze my React project using LogicStamp?
```

Claude should now be able to use the 4 tools:
- `logicstamp_refresh_snapshot` - Analyze the project
- `logicstamp_list_bundles` - List components
- `logicstamp_read_bundle` - Read component details
- `logicstamp_compare_snapshot` - Detect changes

## Example Conversation

```
You: Analyze the Button component in my project

Claude:
1. [Uses logicstamp_refresh_snapshot to create snapshot]
2. [Uses logicstamp_list_bundles to find Button component]
3. [Uses logicstamp_read_bundle to read Button's contract]
4. [Provides detailed analysis of Button's props, state, hooks, etc.]
```

## Troubleshooting

### "stamp: command not found"

The LogicStamp Context CLI is not installed. Run:

```bash
npm install -g logicstamp-context
```

### Server doesn't show up in Claude

1. Check the config file path is correct
2. Ensure absolute paths are used (not relative)
3. Verify the JSON syntax is valid
4. Completely restart Claude Desktop
5. Check Claude's logs for errors

### "Snapshot not found"

Always call `logicstamp_refresh_snapshot` first before using other tools.

## Next Steps

- Read [README.md](README.md) for full documentation
- Check [MCP_INTEGRATION.md](MCP_INTEGRATION.md) for architecture details
- See [TOOL_DESCRIPTION.md](TOOL_DESCRIPTION.md) for LogicStamp Context details
