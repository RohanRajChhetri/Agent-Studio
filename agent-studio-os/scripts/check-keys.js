const path = require('path');
const fs = require('fs/promises');
const os = require('os');

async function testKeys() {
  const localEnvPath = path.join(process.cwd(), '.env.local');
  console.log('.env.local:');
  try {
    console.log(await fs.readFile(localEnvPath, 'utf-8'));
  } catch (e) {
    console.log('No .env.local');
  }

  const hermesHome = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes');
  const hermesEnvPath = path.join(hermesHome, '.env');
  console.log('Hermes .env path:', hermesEnvPath);
  try {
    console.log(await fs.readFile(hermesEnvPath, 'utf-8'));
  } catch (e) {
    console.log('No hermes .env found');
  }
}

testKeys();
