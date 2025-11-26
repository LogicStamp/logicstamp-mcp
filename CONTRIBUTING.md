# Contributing to LogicStamp Context MCP

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn
- Git
- LogicStamp Context CLI (`npm install -g logicstamp-context`)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd logicstamp-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Development Workflow

```bash
# Watch mode - auto-recompile on changes
npm run dev

# Run the server locally
npm start

# Build for production
npm run build
```

## Project Architecture

### Directory Structure

```
src/
├── index.ts              # Entry point
├── types/
│   └── schemas.ts        # All TypeScript types
└── mcp/
    ├── server.ts         # MCP protocol handler
    ├── state.ts          # Snapshot state manager
    └── tools/            # Individual tool implementations
        ├── refresh-snapshot.ts
        ├── list-bundles.ts
        ├── read-bundle.ts
        └── compare-snapshot.ts
```

### Key Principles

1. **Thin Wrapper** - Shell out to `stamp` CLI, don't re-implement logic
2. **Type Safety** - All inputs/outputs are strongly typed
3. **Error Handling** - Use MCP error codes appropriately
4. **Read-Only** - Never modify project files directly

## Adding a New Tool

### 1. Define Types

Add to `src/types/schemas.ts`:

```typescript
export interface MyToolInput {
  param1: string;
  param2?: number;
}

export interface MyToolOutput {
  result: string;
  data: any;
}
```

### 2. Implement Tool

Create `src/mcp/tools/my-tool.ts`:

```typescript
import type { MyToolInput, MyToolOutput } from '../../types/schemas.js';
import { stateManager } from '../state.js';

export async function myTool(input: MyToolInput): Promise<MyToolOutput> {
  // Validate input
  if (!input.param1) {
    throw new Error('param1 is required');
  }

  // Do work (usually shell out to stamp CLI)
  // ...

  // Return typed result
  return {
    result: 'success',
    data: {},
  };
}
```

### 3. Register Tool

Add to `src/mcp/server.ts`:

```typescript
// Import
import { myTool } from './tools/my-tool.js';

// In ListToolsRequestSchema handler
{
  name: 'logicstamp_my_tool',
  description: 'What this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Parameter description',
      },
    },
    required: ['param1'],
  },
}

// In CallToolRequestSchema handler
case 'logicstamp_my_tool': {
  if (!args || !args.param1) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'param1 is required'
    );
  }
  const result = await myTool(args as any);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
```

### 4. Document

Update README.md with tool documentation.

## Testing

### Manual Testing with Claude Code

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Configure Claude Code:**
   ```bash
   # Add your local build (replace with your actual path)
   claude mcp add --scope user --transport stdio logicstamp-dev -- node /absolute/path/to/dist/index.js
   ```

3. **Verify server connection:**
   ```bash
   claude mcp list
   # Should show: logicstamp-dev: ✓ Connected
   ```

4. **Test in a React project:**
   ```bash
   cd /path/to/your/react-project
   claude
   ```

5. **Test all tools:**

   **Test refresh_snapshot:**
   ```
   You: "Create a snapshot of this project using LogicStamp"
   Claude: [Should call logicstamp_refresh_snapshot and return snapshot ID]
   ```

   **Test list_bundles:**
   ```
   You: "List all component bundles in the snapshot"
   Claude: [Should call logicstamp_list_bundles]
   ```

   **Test read_bundle:**
   ```
   You: "Read the first bundle you found"
   Claude: [Should call logicstamp_read_bundle with bundle path]
   ```

   **Test compare_snapshot:**
   ```
   You: "Make a small change to a component, then compare the snapshot"
   Claude: [Should make edit, then call logicstamp_compare_snapshot]
   ```

### Testing Edge Cases

Always test these scenarios:

- ✅ Empty projects (no components)
- ✅ Very large projects (100+ components)
- ✅ Invalid project paths
- ✅ Missing `stamp` CLI
- ✅ Corrupted snapshot data
- ✅ Concurrent tool calls
- ✅ Different modes (none, header, full)
- ✅ Different profiles (llm-chat, llm-safe, ci-strict)

### Testing Error Handling

Test error scenarios:

```bash
# Test without stamp CLI installed
npm uninstall -g logicstamp-context
# Try using tools - should fail gracefully

# Test with invalid snapshot ID
# Ask Claude to list bundles with fake snapshot ID

# Test with non-existent bundle
# Ask Claude to read a bundle that doesn't exist
```

### Manual Testing Checklist

- [ ] All 4 tools work correctly
- [ ] Error messages are helpful
- [ ] Snapshot cache works across multiple calls
- [ ] Performance is acceptable for large projects
- [ ] Token estimates are accurate
- [ ] Folder filtering works
- [ ] Git baseline comparison works (if implemented)

### Automated Testing (Future)

We welcome contributions for:
- Unit tests for tool functions
- Integration tests with mock CLI
- Schema validation tests
- Error handling tests
- Performance benchmarks

Suggested test framework: Vitest or Jest

## Code Style

### TypeScript

- Use `async/await` over promises
- Prefer `const` over `let`
- Use explicit types for public APIs
- Add JSDoc comments for exported functions

### Naming Conventions

- Tool names: `logicstamp_tool_name` (snake_case)
- Function names: `camelCase`
- Type names: `PascalCase`
- File names: `kebab-case.ts`

### Error Handling

```typescript
// Use MCP error codes
throw new McpError(
  ErrorCode.InvalidParams,
  'Descriptive error message'
);

// Wrap external errors
try {
  await externalCall();
} catch (error) {
  throw new Error(
    `Operation failed: ${error instanceof Error ? error.message : String(error)}`
  );
}
```

## Commit Guidelines

### Commit Messages

Use conventional commits format:

```
feat: add new tool for X
fix: resolve issue with Y
docs: update README
refactor: improve error handling
test: add tests for Z
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Build and test: `npm run build`
5. Commit with clear messages
6. Push to your fork
7. Open a pull request

## Documentation

When adding features, update:

- `README.md` - User-facing docs
- `IMPLEMENTATION_SUMMARY.md` - Technical overview
- Code comments - JSDoc for functions
- Type definitions - Document complex types

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md (if exists)
3. Build: `npm run build`
4. Test thoroughly
5. Commit: `git commit -am "release: v0.x.x"`
6. Tag: `git tag v0.x.x`
7. Push: `git push && git push --tags`
8. Publish: `npm publish`

## Getting Help

- Check existing issues
- Read MCP_INTEGRATION.md for architecture
- Review TOOL_DESCRIPTION.md for LogicStamp details
- Ask questions in issues or discussions

## Areas for Contribution

### High Priority

- Unit tests for all tools
- Integration tests for MCP server workflow
- Integration test suite
- Error recovery improvements

### Medium Priority

- Git baseline comparison support
- Semantic component search tool
- Performance optimization
- Better error messages

### Future Enhancements

- Incremental snapshot updates
- Streaming for large bundles
- WebSocket support
- Configuration file support
- Multiple project support

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
