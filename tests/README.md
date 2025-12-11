# LogicStamp MCP Tests

Comprehensive test suite for the LogicStamp MCP server.

## Test Structure

```
tests/
├── unit/               # Unit tests for individual modules
│   └── state.test.ts   # State manager tests
├── integration/        # Integration tests for tools
│   ├── refresh-snapshot.test.ts
│   ├── list-bundles.test.ts
│   ├── read-bundle.test.ts
│   └── compare-snapshot.test.ts
├── e2e/               # End-to-end server tests
│   └── server.test.ts
├── helpers/           # Test utilities and helpers
│   └── test-utils.ts
├── fixtures/          # Test fixtures and mock data
│   └── example-project.ts
└── setup.ts          # Global test setup
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run with coverage
```bash
npm run test:coverage
```

### Run specific test suites
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e
```

### Run a specific test file
```bash
npm test -- tests/unit/state.test.ts
```

### Run tests matching a pattern
```bash
npm test -- --testNamePattern="snapshot"
```

## Test Categories

### Unit Tests
Test individual modules in isolation:
- **state.test.ts**: State management functionality
  - Snapshot ID generation
  - Snapshot storage and retrieval
  - Compare result management
  - Cleanup operations

### Integration Tests
Test tool implementations with realistic data:

- **refresh-snapshot.test.ts**: Snapshot creation workflow
  - Command execution
  - File system operations
  - State updates
  - Error handling

- **list-bundles.test.ts**: Bundle listing functionality
  - Folder filtering
  - Bundle descriptors
  - Token estimation
  - Multi-folder scenarios

- **read-bundle.test.ts**: Bundle reading operations
  - Component selection
  - Contract parsing
  - Code inclusion
  - Complex bundle structures

- **compare-snapshot.test.ts**: Change detection logic
  - Added/removed bundles
  - Modified contracts
  - Token deltas
  - Folder changes

### E2E Tests
Test the complete MCP server:
- **server.test.ts**: Full server workflow
  - Tool registration
  - Request handling
  - Parameter validation
  - State persistence
  - Error responses

## Test Helpers

### Test Utilities (`test-utils.ts`)
- `createTempDir()` - Create temporary test directories
- `cleanupTempDir()` - Remove temporary directories
- `createMockIndex()` - Generate mock LogicStamp indexes
- `createMockBundle()` - Generate mock component bundles
- `createMockContract()` - Generate mock UIF contracts
- `createMockBundleFiles()` - Write bundle files to disk
- `validateSnapshot()` - Validate snapshot structure
- `validateBundleDescriptor()` - Validate bundle descriptor format
- `validateCompareResult()` - Validate compare result structure

### Test Fixtures (`example-project.ts`)
- `createExampleProject()` - Create realistic React project structure
- `createExampleContextFiles()` - Generate LogicStamp context files
- `createMinimalProject()` - Create minimal test project

## Writing New Tests

### Unit Test Example
```typescript
import { stateManager } from '../../src/mcp/state.js';

describe('MyFeature', () => {
  beforeEach(() => {
    stateManager.reset();
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Integration Test Example
```typescript
import { createTempDir, cleanupTempDir, createMockIndex } from '../helpers/test-utils.js';
import { myTool } from '../../src/mcp/tools/my-tool.js';

describe('myTool integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir(tmpdir());
    await createMockIndex(tempDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should process files correctly', async () => {
    const result = await myTool({ projectPath: tempDir });
    expect(result).toBeDefined();
  });
});
```

## Coverage Goals

Target coverage thresholds:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

View coverage report:
```bash
npm run test:coverage
open coverage/index.html
```

## Mocking

### File System Operations
Tests use temporary directories created via `createTempDir()`. Real file system operations are performed, ensuring accurate integration testing.

### External Commands
The `stamp context` command is mocked using Jest:
```typescript
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));
```

### MCP SDK
The MCP SDK is used directly (not mocked) in E2E tests to ensure realistic server behavior.

## Test Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up temporary resources
3. **Descriptive Names**: Use clear test descriptions
4. **AAA Pattern**: Arrange, Act, Assert
5. **Error Cases**: Test both success and failure paths
6. **Edge Cases**: Test boundary conditions
7. **Async/Await**: Properly handle async operations
8. **Mock Sparingly**: Use real implementations when possible

## Debugging Tests

### Run single test in debug mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand tests/unit/state.test.ts
```

### Enable verbose output
```bash
npm test -- --verbose
```

### View console output
Console methods are mocked by default. To see logs:
```typescript
// In your test
console.log = jest.fn((...args) => {
  process.stdout.write(args.join(' ') + '\n');
});
```

## CI/CD Integration

Tests are designed to run in CI environments:
- No interactive prompts
- Deterministic results
- Fast execution
- Comprehensive error reporting

Example GitHub Actions workflow:
```yaml
- name: Run tests
  run: npm test -- --ci --coverage
```

## Troubleshooting

### Tests timing out
Increase timeout in specific test:
```typescript
it('slow test', async () => {
  // test code
}, 10000); // 10 second timeout
```

### File permission errors
Ensure cleanup is properly handled:
```typescript
afterEach(async () => {
  await cleanupTempDir(tempDir).catch(() => {});
});
```

### Module resolution errors
Check that imports use `.js` extensions:
```typescript
import { myFunction } from '../../src/module.js'; // ✓
import { myFunction } from '../../src/module';    // ✗
```

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain coverage thresholds
4. Update this documentation
5. Add test fixtures if needed

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [TypeScript Jest](https://kulshekhar.github.io/ts-jest/)
- [MCP SDK Documentation](https://modelcontextprotocol.io/docs)
