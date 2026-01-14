# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2026-01-14

### Added

- **Comprehensive Test Coverage** - Added 26 new tests significantly improving code coverage
  - **Coverage Improvements**: Overall coverage increased from ~78% to ~86% (statements, branches, lines)
  - **Cache Cleanup Tests** (10 tests) - Added tests for cache corruption detection, stale path detection, and cleanup logic
    - Tests for corrupted cache detection (invalid JSON in `context_main.json`)
    - Tests for stale cache detection (mismatched project paths in config files)
    - Tests for valid cache preservation and explicit cleanup
  - **Parameter Validation Tests** (7 tests) - Added comprehensive validation tests for `depth` parameter
    - Invalid depth values (non-integer, zero, negative)
    - Valid depth values (1, 3, default 2)
    - String-to-number conversion handling
  - **Error Code Preservation Tests** (4 tests) - Added tests ensuring error information is properly preserved
    - Error code preservation from exec errors
    - stdout/stderr preservation in error objects
    - ENOENT error handling for missing files
  - **Server Error Handling Tests** (4 tests) - Added tests for server-level error handling
    - Tool execution error wrapping in MCP format
    - Non-Error exception handling
    - Graceful error handling for all tools
  - **Documentation Error Handling Tests** (2 tests) - Added tests for error message structure and consistency
  - **File Coverage Improvements**:
    - `compare-modes.ts`: 60% → ~95% statements (+35%)
    - `refresh-snapshot.ts`: ~67% → ~96% statements (+29%)
  - Total test count: 163 → 189 tests (+26 tests)
  - All tests passing with improved confidence in error handling and edge cases

- **Enhanced Error Messages** - Improved error messages throughout all MCP tools to be more actionable and helpful
  - All error messages now include context about what was attempted and why it failed
  - Added suggestions for common errors (e.g., "Run logicstamp_refresh_snapshot first" when snapshot is missing)
  - Included relevant file paths and next steps in error messages
  - Error messages now guide users toward solutions instead of just reporting failures
  - Enhanced messages in: `logicstamp_refresh_snapshot`, `logicstamp_list_bundles`, `logicstamp_read_bundle`, `logicstamp_compare_snapshot`, `logicstamp_compare_modes`, `logicstamp_read_logicstamp_docs`
  - Example improvement: "context_main.json not found" → "context_main.json not found in /path/to/project. This file is required for comparison but hasn't been generated yet. Options: (1) Run logicstamp_refresh_snapshot first to generate context files, (2) Use forceRegenerate: true in this call to regenerate automatically before comparing, (3) Run 'stamp context' manually from the project directory."

- **Code of Conduct** - Added Contributor Covenant Code of Conduct to establish community standards and promote a respectful, inclusive environment
  - Available at [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)

- **Roadmap** - Added roadmap document outlining planned enhancements and future features to guide project development
  - Available at [`ROADMAP.md`](ROADMAP.md)

### Fixed

- **Version Consistency** - Fixed version mismatches across codebase to ensure all version references match `package.json`
  - **README.md** - Updated version badge from `0.1.2` to `0.1.4`
  - **src/mcp/server.ts** - Updated server version from `0.1.2` to `0.1.4` (was incorrectly `0.1.2` for version `0.1.3`)
  - **docs/mcp_integration.md** - Updated example config version from `0.1.2` to `0.1.4`
  - All version references now consistently match `package.json` version `0.1.4`
  - Prevents confusion when users check version information across different sources

## [0.1.3] - 2026-01-13

### Changed

- **Default Depth Parameter** - Changed default dependency traversal depth from `1` to `2` across all tools
  - Default depth now includes nested components (e.g., App → Hero → Button) instead of only direct dependencies
  - Applies to `logicstamp_refresh_snapshot`, `logicstamp_compare_snapshot`, and all analysis profiles (`llm-chat`, `llm-safe`, `ci-strict`)
  - Ensures full component trees are captured by default, including contracts and styles for nested components
  - Set `depth: 1` explicitly if you only need direct dependencies
  - Updated all documentation, tool descriptions, and examples to reflect the new default
  - This change ensures React projects with component hierarchies get complete dependency graphs without requiring explicit depth configuration

### Fixed

- **`logicstamp_read_bundle` context_main.json Support** - Fixed issue where reading `context_main.json` returned incomplete data
  - Now correctly detects and parses `context_main.json` as `LogicStampIndex` instead of `LogicStampBundle[]`
  - Returns full index content including `summary`, `folders` array, and all metadata
  - Updated output schema to support both `bundle` (for bundle files) and `index` (for `context_main.json`)
  - Updated documentation to clarify the difference between reading index files vs bundle files
  - Added test coverage for reading `context_main.json`

## [0.1.2] - 2025-12-30

### Changed

- **Node.js Requirement Update** - Updated minimum Node.js version requirement from >=18.0.0 to >=18.18.0 to align with `logicstamp-context` CLI requirements
  - Node 20+ is now recommended for best performance and features
  - Updated all documentation, prerequisites, and integration guides
  - Updated `package.json` engines field

### Added

- **Depth Parameter Documentation** - Added comprehensive recommendations for using `depth: 2` with React/TypeScript projects
  - **README.md** - Added depth parameter guidance emphasizing `depth: 2` recommendation for React projects (line 121)
    - Clarifies that LLM does NOT automatically detect when depth=2 is needed
    - Explains that default depth=1 only includes direct dependencies
  - **docs/mcp_integration.md** - Enhanced depth parameter documentation with React-specific recommendations (lines 76, 85)
    - Added **RECOMMENDED** guidance to start with `depth: 2` for React/TypeScript projects
    - Included example usage: `{ "projectPath": "...", "depth": 2 }`
    - Explained that depth=2 captures nested components (e.g., App → Hero → Button)
    - Added note that LLM must explicitly request depth=2 upfront
  - **docs/logicstamp-for-llms.md** - Added critical depth parameter guidance (lines 44, 158-179)
    - Added **CRITICAL** section recommending `depth: 2` for React/TypeScript projects
    - Explained when depth=1 is insufficient (missing components, incomplete graphs)
    - Added example code showing recommended usage pattern
    - Clarified that LLM does NOT automatically detect when depth=2 is needed
  - **docs/startup-ritual.md** - Updated startup ritual with depth=2 recommendations (lines 12-14, 51-55)
    - Added **RECOMMENDED** guidance in startup workflow
    - Included examples and when to use depth=2
    - Explained difference between depth=1 (direct dependencies) and depth=2 (nested components)
  - **src/mcp/server.ts** - Enhanced tool descriptions with depth=2 recommendations (lines 61-63, 88)
    - Updated `logicstamp_refresh_snapshot` description to recommend depth=2 for React projects
    - Added guidance about nested component hierarchies
    - Clarified that depth=2 ensures nested components are included with contracts and styles

### Fixed

- **Version Consistency** - Fixed version mismatches across codebase to ensure all version references match `package.json`
  - **README.md** - Updated version badge from `0.1.1` to `0.1.2` (line 13)
    - Badge now correctly displays current package version
  - **src/mcp/server.ts** - Updated server version from `0.1.0` to `0.1.2` (line 30)
    - MCP server now reports correct version to clients
    - Fixes discrepancy where server reported older version than package
  - **docs/mcp_integration.md** - Updated example config version from `0.1.0` to `0.1.2` (line 852)
    - Example MCP server configuration now shows correct version
    - Ensures documentation examples match actual implementation
  - All version references now consistently match `package.json` version `0.1.2`
  - Prevents confusion when users check version information across different sources

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
- **Node.js Support**: >=18.18.0 (Node 20+ recommended)
- **License**: MIT
- **Read-Only Design**: Server never modifies project files directly

### Notes

- This is the initial public release
- Requires `logicstamp-context` CLI to be installed globally (`npm install -g logicstamp-context`)
- All tools are read-only - they analyze but never modify your codebase

[0.1.4]: https://github.com/LogicStamp/logicstamp-mcp/releases/tag/v0.1.4

[0.1.3]: https://github.com/LogicStamp/logicstamp-mcp/releases/tag/v0.1.3

[0.1.2]: https://github.com/LogicStamp/logicstamp-mcp/releases/tag/v0.1.2

[0.1.1]: https://github.com/LogicStamp/logicstamp-mcp/releases/tag/v0.1.1

[0.1.0]: https://github.com/LogicStamp/logicstamp-mcp/releases/tag/v0.1.0

