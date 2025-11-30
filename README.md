# LogicStamp Context MCP Server

Model Context Protocol (MCP) server for [LogicStamp Context](https://github.com/LogicStamp/logicstamp-context) - enabling AI assistants to safely analyze and understand React/TypeScript codebases.

## Overview

This MCP server provides AI assistants with structured access to your codebase through LogicStamp Context's analysis engine. It acts as a thin wrapper around the `stamp` CLI, offering:

- **Snapshot-based analysis** - Capture codebase state before making edits
- **Component contracts** - Extract props, state, hooks, and dependencies
- **Style metadata** - Extract Tailwind classes, SCSS modules, framer-motion animations, color palettes, layout patterns
- **Dependency graphs** - Understand component relationships
- **Drift detection** - Verify changes after modifications
- **Token optimization** - Control context size with configurable code inclusion modes

## Features

### 4 Core Tools

1. **`logicstamp_refresh_snapshot`** - Analyze project and create snapshot
2. **`logicstamp_list_bundles`** - List available component bundles
3. **`logicstamp_read_bundle`** - Read full component contract + graph
4. **`logicstamp_compare_snapshot`** - Detect changes after edits

### Key Benefits

- **Context-Aware Edits** - AI reads actual component contracts before modifying
- **Self-Verification** - AI verifies its own changes via drift detection
- **Token-Efficient** - Only load bundles relevant to the task
- **Safe by Default** - Changes must pass drift check before approval

## Prerequisites

1. **Node.js** 18.0.0 or higher
2. **LogicStamp Context CLI** - The `stamp` command must be installed and available in PATH
   ```bash
   npm install -g logicstamp-context
   ```

## Quick Start

1. **Install the MCP server:**
   ```bash
   npm install -g logicstamp-context-mcp
   ```

2. **Configure your MCP client** - See [integration guides](docs/integrations/) for platform-specific instructions:
   - [Claude CLI Integration](docs/integrations/claude-cli.md) - For Claude Code users
   - [Claude Desktop Integration](docs/integrations/claude-desktop.md) - For Claude Desktop users
   - [Cursor Integration](docs/integrations/cursor.md) - For Cursor IDE users

3. **Start using LogicStamp:**
   ```bash
   cd /path/to/your/react-project
   claude  # or open Cursor
   ```
   
   Ask your AI assistant: "Can you analyze my React project using LogicStamp?"

For detailed setup instructions, see the [Quick Start Guide](docs/quickstart.md).

## Usage Example

```
You: "Analyze the Button component in my project"

AI:
1. Uses logicstamp_refresh_snapshot to create snapshot
2. Uses logicstamp_list_bundles to find Button component
3. Uses logicstamp_read_bundle to read Button's contract
4. Provides detailed analysis of Button's props, state, hooks, etc.
```

For more examples and workflows, see [Usage Examples](docs/mcp_integration.md#llm-workflow) in the MCP Integration Guide.

## Tool Reference

The MCP server provides 4 tools. For complete API documentation with input/output examples, see the [MCP Integration Guide](docs/mcp_integration.md#mcp-tools-mvp).

### Quick Reference

**logicstamp_refresh_snapshot** - Create a snapshot of the current codebase state
- Parameters: `profile` (optional), `mode` (optional), `includeStyle` (optional), `projectPath` (optional)
- Returns: `snapshotId`, `summary`, `folders`

**logicstamp_list_bundles** - List available bundles for selective loading
- Parameters: `snapshotId` (required), `folderPrefix` (optional)
- Returns: `bundles` array with metadata

**logicstamp_read_bundle** - Read full component contract and dependency graph
- Parameters: `snapshotId` (required), `bundlePath` (required), `rootComponent` (optional)
- Returns: Complete bundle with contracts and dependency graph

**logicstamp_compare_snapshot** - Detect changes after edits
- Parameters: `profile` (optional), `mode` (optional), `includeStyle` (optional), `projectPath` (optional), `baseline` (optional)
- Returns: Comparison result with change details

## Documentation

- **[Quick Start Guide](docs/quickstart.md)** - Get up and running in minutes
- **[MCP Integration Guide](docs/mcp_integration.md)** - Complete API reference and architecture
- **[Tool Description](docs/tool_description.md)** - LogicStamp Context capabilities
- **[Commands Reference](docs/commands.md)** - CLI command reference
- **[Integration Guides](docs/integrations/)** - Platform-specific setup

## Troubleshooting

### Common Issues

**"stamp: command not found"**
- Install LogicStamp Context CLI: `npm install -g logicstamp-context`

**Server doesn't show up**
- Verify installation: `npm list -g logicstamp-context-mcp`
- Check configuration in your MCP client (see integration guides)
- Restart your MCP client completely

**"Snapshot not found"**
- Always call `logicstamp_refresh_snapshot` first before using other tools

For detailed troubleshooting, see:
- [Troubleshooting in Quick Start Guide](docs/quickstart.md#troubleshooting)
- Platform-specific troubleshooting in [integration guides](docs/integrations/)
- [MCP Integration Guide](docs/mcp_integration.md) for architecture details

## Development

### Build

```bash
npm install
npm run build
```

### Run Locally

```bash
npm start
```

### Watch Mode

```bash
npm run dev
```

For development details, see [Implementation Summary](docs/implementation_summary.md).

## Architecture

The MCP server follows these design principles:

1. **Thin Wrapper** - Shells out to existing `stamp` CLI
2. **Stateful Snapshots** - Tracks context before/after edits
3. **Read-Only** - Server never writes to project files
4. **Token-Efficient** - Selective bundle loading

For detailed architecture documentation, see [MCP Integration Guide](docs/mcp_integration.md#architecture).

## Requirements

This MCP server requires:
- **`stamp context` command** - Must be installed and available in PATH
- The CLI generates `context_main.json` files (already JSON format)
- The MCP reads these JSON files directly - no special JSON output flags needed

## License

MIT

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Links

- [LogicStamp Context](https://github.com/LogicStamp/logicstamp-context)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
