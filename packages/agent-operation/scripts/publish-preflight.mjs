import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.resolve(packageRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

function fail(message) {
  console.error(`Preflight failed: ${message}`);
  process.exit(1);
}

function runCommand(command, { allowFailure = false } = {}) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

function validateBinEntries() {
  const binConfig = packageJson.bin;
  if (!binConfig || typeof binConfig !== "object" || Array.isArray(binConfig)) {
    fail("package.json bin field must be an object.");
  }

  for (const [commandName, relativePath] of Object.entries(binConfig)) {
    if (typeof relativePath !== "string" || !relativePath.trim()) {
      fail(`Invalid bin path for "${commandName}".`);
    }

    const normalizedPath = relativePath.startsWith("./") ? relativePath : `./${relativePath}`;
    const absolutePath = path.resolve(packageRoot, normalizedPath);
    if (!existsSync(absolutePath)) {
      fail(`Bin path for "${commandName}" does not exist: ${normalizedPath}`);
    }

    const firstLine = readFileSync(absolutePath, "utf8").split(/\r?\n/, 1)[0]?.trim();
    if (firstLine !== "#!/usr/bin/env node") {
      fail(`Bin script "${normalizedPath}" must start with "#!/usr/bin/env node".`);
    }
  }
}

function checkScopedPublishAccess() {
  if (packageJson.name.startsWith("@")) {
    console.log("Scoped package detected. Publish with: npm publish --access public");
  }
}

function checkNpmAuthAndTfa() {
  if (process.env.FAQ_AGENT_SKIP_NPM_AUTH_CHECK === "1") {
    console.log("Skipping npm auth/TFA checks (FAQ_AGENT_SKIP_NPM_AUTH_CHECK=1).");
    return;
  }

  const currentUser = runCommand("npm whoami", { allowFailure: true });
  if (!currentUser) {
    fail("Not logged in to npm. Run `npm login` before publishing.");
  }

  console.log(`npm account: ${currentUser}`);

  const profileRaw = runCommand("npm profile get --json", { allowFailure: true });
  if (!profileRaw) {
    console.log("Could not read npm profile. If publish fails with E403, retry with --otp.");
    return;
  }

  let profile;
  try {
    profile = JSON.parse(profileRaw);
  } catch {
    console.log("Could not parse npm profile output. If publish fails with E403, retry with --otp.");
    return;
  }

  const tfaMode = profile?.tfa?.mode || null;
  if (tfaMode === "auth-and-writes") {
    console.log("2FA mode auth-and-writes detected. Use: npm publish --access public --otp <code>");
  } else if (tfaMode) {
    console.log(`2FA mode: ${tfaMode}`);
  } else {
    console.log("2FA mode unavailable in profile output. If publish fails with E403, use --otp.");
  }
}

validateBinEntries();
checkScopedPublishAccess();
checkNpmAuthAndTfa();

console.log("Publish preflight passed.");
