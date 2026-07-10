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
  'node_modules/@xmcl/core/package.json',
  'node_modules/@xmcl/unzip/package.json',
  'node_modules/yauzl/package.json'
];

const missingFiles = requiredFiles.filter((relativePath) => {
  return !fs.existsSync(path.join(unpackedRoot, relativePath));
});

if (missingFiles.length > 0) {
  console.error('Missing packaged runtime files:');

  for (const missingFile of missingFiles) {
    console.error(`- ${missingFile}`);
  }

  process.exit(1);
}

console.log('Packaged runtime dependencies verified.');
process.exit(0);
