import fs from "node:fs";
import path from "node:path";

const requiredFiles = [
  "dist-electron/main/workers/prepareWorker.js",
  "dist-electron/main/workers/launchWorker.js",
  "dist-electron/main/services/download-manager.js",
  "dist-electron/main/services/prepareGameService.js",
  "dist-electron/main/services/launchManager.js",
  "dist-electron/main/main.js",
];

const missingFiles = requiredFiles.filter((file) => {
  return !fs.existsSync(path.resolve(file));
});

if (missingFiles.length > 0) {
  console.error("Electron build is missing required files:");
  missingFiles.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

// Ensure prepareWorker still requires the download-manager module by relative path
const prepareWorker = fs.readFileSync(
  path.resolve("dist-electron/main/workers/prepareWorker.js"),
  "utf8",
);
if (!prepareWorker.includes("../services/download-manager")) {
  console.error(
    "prepareWorker.js does not require ../services/download-manager — check imports.",
  );
  process.exit(1);
}

console.log("Electron build artifacts verified.");
