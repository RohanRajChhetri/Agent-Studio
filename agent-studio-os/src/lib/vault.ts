/**
 * Agent Studio OS — Vault & Memory Galaxy Facade
 * 
 * Modular architecture:
 * - obsidian-integration.ts: Path resolution, configuration, and desktop app integration
 * - vault-operations.ts: File/folder CRUD and counting operations
 * - galaxy-generation.ts: Celestial knowledge graph generation with enhanced clustering
 */

export type { GalaxyNode, GalaxyLink, GalaxyData } from "./galaxy-generation";
export { generateGalaxyData, getGraphStats } from "./galaxy-generation";

export {
  getVaultPath,
  getObsidianExecutable,
  ensureVaultExists,
  seedSampleNotes,
  openVaultInObsidian,
} from "./obsidian-integration";

export {
  listVaultFiles,
  readVaultFile,
  writeVaultFile,
  deleteVaultFile,
  createVaultFolder,
  renameVaultPath,
  deleteVaultFolder,
  countVaultNotes,
  resolveSafeVaultPath,
} from "./vault-operations";
