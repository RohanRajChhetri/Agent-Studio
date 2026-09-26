import { describe, it, expect } from 'vitest';
import * as vault from '@/lib/vault';

describe('Vault Facade - Exports', () => {
  it('should export all expected functions and types', () => {
    // Test that the main functions are exported
    expect(typeof vault.getVaultPath).toBe('function');
    expect(typeof vault.getObsidianExecutable).toBe('function');
    expect(typeof vault.ensureVaultExists).toBe('function');
    expect(typeof vault.seedSampleNotes).toBe('function');
    expect(typeof vault.openVaultInObsidian).toBe('function');

    expect(typeof vault.listVaultFiles).toBe('function');
    expect(typeof vault.readVaultFile).toBe('function');
    expect(typeof vault.writeVaultFile).toBe('function');
    expect(typeof vault.deleteVaultFile).toBe('function');
    expect(typeof vault.createVaultFolder).toBe('function');
    expect(typeof vault.renameVaultPath).toBe('function');
    expect(typeof vault.deleteVaultFolder).toBe('function');
    expect(typeof vault.countVaultNotes).toBe('function');

    // Test that re-exports work
    expect(typeof vault.generateGalaxyData).toBe('function');
    expect(typeof vault.getGraphStats).toBe('function');

    // Galaxy types might be undefined at runtime but that's OK for export check
  });
});