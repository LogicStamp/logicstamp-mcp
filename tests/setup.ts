/**
 * Global test setup
 */

import { jest, afterEach } from '@jest/globals';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  // Keep log for debugging if needed
  log: console.log,
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
