import { describe, it, expect } from 'vitest';
import * as routerExecution from '@/lib/router-execution';

describe('Router Execution - Exports', () => {
  it('should export all expected functions', () => {
    // Test that the main functions are exported
    expect(typeof routerExecution.getActiveApiKeys).toBe('function');
    expect(typeof routerExecution.invalidateActiveApiKeysCache).toBe('function');
    expect(typeof routerExecution.cleanupExpiredCache).toBe('function');
    expect(typeof routerExecution.checkOmnirouteStatusCached).toBe('function');
    expect(typeof routerExecution.normalizeModelName).toBe('function');
    expect(typeof routerExecution.executeChatCompletion).toBe('function');
    expect(typeof routerExecution.testProviderKey).toBe('function');
  });
});