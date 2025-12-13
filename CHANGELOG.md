# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Technical Details

- **Dependencies**: `@modelcontextprotocol/sdk@^1.24.0`
- **Node.js Support**: >=18.0.0
- **License**: MIT
- **Read-Only Design**: Server never modifies project files directly

### Notes

- This is the initial public release
- Requires `logicstamp-context` CLI to be installed globally (`npm install -g logicstamp-context`)
- All tools are read-only - they analyze but never modify your codebase

[0.1.0]: https://github.com/LogicStamp/logicstamp-mcp/releases/tag/v0.1.0

