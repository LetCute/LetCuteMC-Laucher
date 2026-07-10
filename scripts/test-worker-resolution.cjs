const path = require('node:path');
const { createRequire } = require('node:module');

const workerPath = path.resolve(
  'release',
  'win-unpacked',
  'resources',
  'app.asar.unpacked',
  'dist-electron',
  'main',
  'workers',
  'launchWorker.js'
);

const workerRequire = createRequire(workerPath);

const packages = [
  '@xmcl/core',
  '@xmcl/unzip',
  'yauzl'
];

for (const packageName of packages) {
  try {
    const resolvedPath = workerRequire.resolve(packageName);
    console.log(`${packageName} -> ${resolvedPath}`);
  } catch (err) {
    console.error(`Failed to resolve ${packageName}:`, err.message);
    process.exit(1);
  }
}

console.log('Worker resolution tests passed successfully.');
process.exit(0);
