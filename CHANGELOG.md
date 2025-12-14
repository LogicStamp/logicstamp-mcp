# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-12-14

### Fixed

- **Documentation Fix** - Corrected `projectPath` parameter documentation for `logicstamp_refresh_snapshot`
  - Updated docs to correctly mark `projectPath` as required (was incorrectly marked as optional)
  - Added explanation of why `projectPath` is required (prevents hangs when `stamp init` has been run)
  - Updated all examples to include `projectPath` parameter
  - Fixes issue where users following documentation would encounter errors when omitting `projectPath`

## [0.1.0] - 2025-12-13

### Added

#### Core Features
- **MCP Server Implementation** - Full Model Context Protocol server for LogicStamp Context
- **Snapshot Management** - In-memory snapshot state management with automatic cleanup (1-hour TTL)
- **6 MCP Tools** - Complete tool suite for codebase analysis:
  - `logicstamp_refresh_snapshot` - Create snapshots of codebase state
  - `logicstamp_list_bundles` - List available component bundles
  - `logicstamp_read_bundle` - Read full component contracts and dependency graphs
  - `logicstamp_compare_snapshot` - Detect changes after edits (drift detection)
  - `logicstamp_compare_modes` - Generate token cost comparisons across modes
  - `logicstamp_read_logicstamp_docs` - Access LogicStamp documentation

#### Analysis Capabilities
- **Component Contract Extraction** - Extract props, state, hooks, and dependencies
- **Style Metadata Support** - Extract Tailwind classes, SCSS modules, framer-motion animations, color palettes, layout patterns
- **Dependency Graph Analysis** - Understand component relationships
- **Token Optimization** - Configurable code inclusion modes (none/header/full)
- **Multiple Analysis Profiles** - Support for `llm-chat`, `llm-safe`, and `ci-strict` profiles

#### Developer Experience
- **Comprehensive Documentation** - README, quick start guide, integration guides, API reference
- **Integration Guides** - Setup instructions for Claude CLI, Claude Desktop, and Cursor IDE
- **Example Configurations** - `.claude.json.example` and `.mcp.json.example` files
- **TypeScript Support** - Full type safety with comprehensive type definitions
- **Error Handling** - Proper MCP error codes and descriptive error messages

#### Testing & Quality
- **Test Suite** - 150 tests covering unit, integration, and E2E scenarios
- **CI/CD Pipeline** - GitHub Actions workflow testing on Ubuntu, Windows, and macOS
- **Multi-Node Testing** - CI tests on Node.js 18.x and 20.x
- **Type Checking** - TypeScript compilation verification in CI

#### Documentation
- **Quick Start Guide** - Get up and running in minutes
- **Startup Ritual** - Recommended workflow for AI assistants
- **MCP Integration Guide** - Complete API reference and architecture documentation
- **Tool Descriptions** - Detailed documentation for each MCP tool
- **Troubleshooting Guide** - Common issues and solutions
- **Contributing Guidelines** - Guide for contributors
- **Security Policy** - Security reporting and best practices

#### Configuration
- **Example Config Files** - Ready-to-use configuration templates
- **Flexible Project Paths** - Support for custom project paths
- **Baseline Comparison** - Compare against disk or snapshot baselines
- **Smart Cache Cleanup** - Automatic detection and cleanup of corrupted `.logicstamp` cache directories
  - Detects invalid JSON in `context_main.json`
  - Detects stale project paths in cache metadata files
  - Preserves cache when healthy for improved performance
- **`forceRegenerate` Parameter** - Added to `logicstamp_compare_snapshot` tool
  - When `false` (default): Fast comparison using existing `context_main.json` from disk
  - When `true`: Regenerates context before comparing to ensure fresh data
- **`cleanCache` Parameter** - Added to `logicstamp_refresh_snapshot`, `logicstamp_compare_snapshot`, and `logicstamp_compare_modes` tools
  - Manual override to force cache cleanup
  - Works alongside automatic corruption detection

### Changed

- **Improved Error Handling** - Better error messages for missing `context_main.json` files
  - Clear guidance when context files are missing
  - Suggests using `forceRegenerate: true` or running `logicstamp_refresh_snapshot` first
- **Enhanced `logicstamp_compare_snapshot` Tool** - More flexible regeneration control
  - Independent control over regeneration (`forceRegenerate`) and style inclusion (`includeStyle`)
  - Better documentation of when each parameter takes effect

### Fixed

- Cache corruption issues that could cause analysis failures
- Path mismatch detection for projects moved or renamed

### Technical Details

- **Dependencies**: `@modelcontextprotocol/sdk@^1.24.0`
- **Node.js Support**: >=18.0.0
- **License**: MIT
- **Read-Only Design**: Server never modifies project files directly

### Notes

- This is the initial public release
- Requires `logicstamp-context` CLI to be installed globally (`npm install -g logicstamp-context`)
- All tools are read-only - they analyze but never modify your codebase

[0.1.1]: https://github.com/LogicStamp/logicstamp-mcp/releases/tag/v0.1.1

[0.1.0]: https://github.com/LogicStamp/logicstamp-mcp/releases/tag/v0.1.0

