import fs from "node:fs";
import path from "node:path";

const requiredFiles = [
  "dist-electron/main/workers/prepareWorker.js",
  "dist-electron/main/workers/launchWorker.js",
  "dist-electron/main/services/system/downloadManager.js",
  "dist-electron/main/services/launcher/prepareGameService.js",
  "dist-electron/main/services/launcher/launchManager.js",
  "dist-electron/main/services/index.js",
  "dist-electron/main/main.js",
  "dist-electron/main/ipc/index.js",
  "dist-electron/main/ipc/ipcHelper.js",
  "dist-electron/main/ipc/accountIpc.js",
  "dist-electron/main/ipc/profileIpc.js",
  "dist-electron/main/ipc/launchIpc.js",
  "dist-electron/main/ipc/contentIpc.js",
  "dist-electron/main/ipc/modrinthIpc.js",
  "dist-electron/main/ipc/systemIpc.js",
  "dist-electron/main/ipc/statsIpc.js",
];

const missingFiles = requiredFiles.filter((file) => {
  return !fs.existsSync(path.resolve(file));
});

if (missingFiles.length > 0) {
  console.error("Electron build is missing required files:");
  missingFiles.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

// Ensure prepareWorker or versionResolver requires downloadManager
const versionResolver = fs.readFileSync(
  path.resolve("dist-electron/main/services/launcher/versionResolver.js"),
  "utf8",
);
if (!versionResolver.includes("../system/downloadManager")) {
  console.error(
    "versionResolver.js does not require ../system/downloadManager — check imports.",
  );
  process.exit(1);
}

console.log("Electron build artifacts verified.");
