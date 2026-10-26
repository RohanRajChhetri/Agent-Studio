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
    expect(typeof vault.deleteVaultBatch).toBe('function');
    expect(typeof vault.countVaultNotes).toBe('function');

    // Test that re-exports work
    expect(typeof vault.generateGalaxyData).toBe('function');
    expect(typeof vault.getGraphStats).toBe('function');
  });

  it('should batch delete files and folders gracefully', async () => {
    // Write temporary test files into vault
    await vault.writeVaultFile('test-batch/note1.md', '# Test Note 1');
    await vault.writeVaultFile('test-batch/note2.md', '# Test Note 2');
    
    // Batch delete both notes and folder
    const res = await vault.deleteVaultBatch([
      { path: 'test-batch/note1.md', isFolder: false },
      { path: 'test-batch/note2.md', isFolder: false },
      { path: 'test-batch', isFolder: true },
    ]);

    expect(res.deletedCount).toBeGreaterThanOrEqual(1);
    expect(res.errors).toHaveLength(0);
  });
});