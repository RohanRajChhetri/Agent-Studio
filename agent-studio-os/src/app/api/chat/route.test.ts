import { describe, it, expect } from 'vitest';

// Import the route handler functions
import * as chatRoute from '@/app/api/chat/route';

describe('Chat Route - Exports', () => {
  it('should export all expected handler functions', () => {
    // Test that the main handler functions are exported
    expect(typeof chatRoute.GET).toBe('function');
    expect(typeof chatRoute.DELETE).toBe('function');
    expect(typeof chatRoute.POST).toBe('function');
  });
});