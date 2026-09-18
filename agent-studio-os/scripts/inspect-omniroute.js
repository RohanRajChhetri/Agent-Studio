let Database;
try {
  Database = require('better-sqlite3');
} catch {
  console.log('better-sqlite3 is not installed.');
  process.exit(0);
}
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), '.omniroute', 'storage.sqlite');
let db;
try {
  db = new Database(dbPath, { readonly: true });
} catch (e) {
  console.log('Cannot open omniroute database:', e.message);
  process.exit(0);
}

console.log('--- provider_connections ---');
console.log(db.prepare("SELECT * FROM provider_connections").all());

console.log('--- combos ---');
console.log(db.prepare("SELECT * FROM combos").all());

console.log('--- api_keys ---');
console.log(db.prepare("SELECT id, name, key_hash, created_at FROM api_keys").all());

console.log('--- circuit breakers ---');
console.log(db.prepare("SELECT * FROM domain_circuit_breakers").all());
