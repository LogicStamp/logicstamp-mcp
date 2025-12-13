# LogicStamp MCP Server

<div align="center">
  <img src="./assets/logicstamp-fox.svg" alt="LogicStamp Fox Mascot" width="120" height="120">
</div>

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

### 6 Tools

1. **`logicstamp_refresh_snapshot`** - Analyze project and create snapshot
2. **`logicstamp_list_bundles`** - List available component bundles
3. **`logicstamp_read_bundle`** - Read full component contract + graph
4. **`logicstamp_compare_snapshot`** - Detect changes after edits
5. **`logicstamp_compare_modes`** - Generate token cost comparison across all modes
6. **`logicstamp_read_logicstamp_docs`** - Read LogicStamp documentation

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
   npm install -g logicstamp-mcp
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

The MCP server provides 6 tools. For complete API documentation with input/output examples, see the [MCP Integration Guide](docs/mcp_integration.md#mcp-tools-mvp).

### Quick Reference

**logicstamp_refresh_snapshot** - Create a snapshot of the current codebase state (STEP 1)
- Parameters: `profile` (optional), `mode` (optional), `includeStyle` (optional), `projectPath` (optional)
- Returns: `snapshotId`, `summary`, `folders`
- **Always call this first** when analyzing a new repo

**logicstamp_list_bundles** - List available bundles for selective loading (STEP 2)
- Parameters: `snapshotId` (required), `folderPrefix` (optional)
- Returns: `bundles` array with metadata
- **Call this after refresh_snapshot** to discover available bundles

**logicstamp_read_bundle** - Read full component contract and dependency graph (STEP 3)
- Parameters: `snapshotId` (required), `bundlePath` (required), `rootComponent` (optional)
- Returns: Complete bundle with contracts and dependency graph
- **This is where the valuable data is** - prefer bundles over raw source files

**logicstamp_compare_snapshot** - Detect changes after edits
- Parameters: 
  - `profile` (optional): Analysis profile (default: `llm-chat`)
  - `mode` (optional): Code inclusion mode (default: `header`)
  - `includeStyle` (optional): Include style metadata in comparison. Only takes effect when `forceRegenerate` is `true`. When `forceRegenerate` is `false`, compares whatever style metadata exists on disk (may be incomplete) (default: `false`)
  - `forceRegenerate` (optional): Force regeneration of context before comparing. When `false`, reads existing `context_main.json` from disk (fast). When `true`, runs `stamp context` to regenerate (default: `false`)
  - `projectPath` (optional): Project path (defaults to current directory)
  - `baseline` (optional): Comparison baseline: `disk` (default), `snapshot`, or custom path
- Returns: Comparison result with change details
- **Note**: By default (`forceRegenerate: false`), reads from disk for fast comparison. Set `forceRegenerate: true` to ensure fresh context or when `context_main.json` is missing.

**logicstamp_compare_modes** - Generate token cost comparison across all modes
- Parameters: `projectPath` (optional)
- Returns: Token counts for all modes (none/header/header+style/full), savings percentages, file statistics
- **Use this** to understand token costs before generating context or when user asks about token budgets/optimization

**logicstamp_read_logicstamp_docs** - Read LogicStamp documentation
- Parameters: None
- Returns: Complete LogicStamp documentation bundle
- **Use this when confused** - explains LogicStamp, workflow, and best practices

## Startup Ritual

When starting work with a new project, use the [Startup Ritual](docs/startup-ritual.md) to guide the AI through the recommended workflow. This ensures the AI:
1. Calls `logicstamp_refresh_snapshot` first
2. Uses bundles instead of raw source files when possible
3. Follows the recommended LogicStamp workflow

## Documentation

### MCP-Specific Docs (This Repo)

- **[Quick Start Guide](docs/quickstart.md)** - Get up and running in minutes
- **[Startup Ritual](docs/startup-ritual.md)** - Recommended message to paste when starting with a new project
- **[MCP Integration Guide](docs/mcp_integration.md)** - Complete API reference and architecture
- **[Integration Guides](docs/integrations/)** - Platform-specific setup (Claude CLI, Claude Desktop, Cursor)

### Canonical LogicStamp Docs (Redundant Sources)

**Full CLI & Context Documentation:**
- **Primary:** [logicstamp.dev/docs/logicstamp-context/context](https://logicstamp.dev/docs/logicstamp-context/context) - Complete documentation (landing page, best UX)
- **Fallback:** [CLI Repository Docs](https://github.com/LogicStamp/logicstamp-context) - GitHub docs (always available, versioned)

**Key Topics** (both primary and fallback links):

| Topic | Primary (Landing Page) | Fallback (GitHub) |
|-------|----------------------|-------------------|
| **Usage Guide** | [logicstamp.dev/docs/logicstamp-context/usage](https://logicstamp.dev/docs/logicstamp-context/usage) | [GitHub](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md) |
| **UIF Contracts** | [logicstamp.dev/docs/logicstamp-context/uif-contracts](https://logicstamp.dev/docs/logicstamp-context/uif-contracts) | [GitHub](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/uif_contracts.md) |
| **Schema Reference** | [logicstamp.dev/docs/logicstamp-context/schema](https://logicstamp.dev/docs/logicstamp-context/schema) | [GitHub](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/schema.md) |
| **CLI Commands** | [logicstamp.dev/docs/logicstamp-context/context](https://logicstamp.dev/docs/logicstamp-context/context) | [GitHub](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/context.md) |
| **Compare Modes** | [logicstamp.dev/docs/logicstamp-context/compare-modes](https://logicstamp.dev/docs/logicstamp-context/compare-modes) | [GitHub](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/compare-modes.md) |
| **Limitations** | [logicstamp.dev/docs/complete-reference/known-limitations](https://logicstamp.dev/docs/complete-reference/known-limitations) | [GitHub](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/limitations.md) |

**Note:** 
- Docs are maintained in the CLI repo and synced to the landing page
- If the landing page is unavailable, use the GitHub links as fallback
- The `logicstamp_read_logicstamp_docs` tool returns an embedded LLM-focused doc snapshot (`docs/logicstamp-for-llms.md`) for offline use

## Troubleshooting

### Common Issues

**"stamp: command not found"**
- Install LogicStamp Context CLI: `npm install -g logicstamp-context`

**Server doesn't show up**
- Verify installation: `npm list -g logicstamp-mcp`
- Test server manually: `npx logicstamp-mcp` (should wait for stdin, press Ctrl+C to exit)
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

### Run the Server

The MCP server can be run in several ways:

**After building from source:**
```bash
npm start
# or directly
node dist/index.js
```

**After global installation:**
```bash
npx logicstamp-mcp
```

**Note:** The server runs via stdio (standard input/output) and waits for MCP protocol messages. When configured with an MCP client (Claude CLI, Cursor, etc.), the client automatically starts the server - you don't need to run it manually. The commands above are useful for:
- Testing the server during development
- Debugging connection issues
- Verifying the server starts correctly

When running manually, the server will wait for stdin input. Press `Ctrl+C` to exit.

### Watch Mode

```bash
npm run dev
```

For development details, see [MCP Integration Guide](docs/mcp_integration.md) and [Contributing Guide](CONTRIBUTING.md).

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

## Branding & Attribution

The LogicStamp Fox mascot and related brand assets are © 2025 Amit Levi.

These assets may not be used for third-party branding, logos, or commercial identity without permission. They are included in this repository for documentation and non-commercial use within the LogicStamp ecosystem only.

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed list of changes and version history.

## Links

- [LogicStamp Context](https://github.com/LogicStamp/logicstamp-context)
- [Model Context Protocol](https://modelcontextprotocol.io/)