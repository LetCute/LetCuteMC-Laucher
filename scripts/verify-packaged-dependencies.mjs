import fs from 'node:fs';
import path from 'node:path';

const unpackedRoot = path.resolve(
  'release',
  'win-unpacked',
  'resources',
  'app.asar.unpacked'
);

const requiredFiles = [
  'dist-electron/main/workers/launchWorker.js',
  'node_modules/@xmcl/core/package.json'
];

const missingFiles = requiredFiles.filter((relativePath) => {
  return !fs.existsSync(path.join(unpackedRoot, relativePath));
});

if (missingFiles.length === 0) {
  console.log('Packaged worker dependencies verified.');
  process.exit(0);
}

console.error('Missing packaged dependencies:');

for (const file of missingFiles) {
  console.error(`- ${file}`);
}

process.exit(1);
