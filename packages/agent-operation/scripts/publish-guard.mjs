import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const packageRoot = path.resolve(__dirname, "..");

function assertValidBinEntries(pkgJson) {
  const binConfig = pkgJson.bin;
  if (!binConfig || typeof binConfig !== "object" || Array.isArray(binConfig)) {
    throw new Error("package.json bin field must be an object with command-to-path mappings.");
  }

  for (const [commandName, relativePath] of Object.entries(binConfig)) {
    if (typeof relativePath !== "string" || !relativePath.trim()) {
      throw new Error(`Invalid bin path for "${commandName}".`);
    }

    const resolvedPath = path.resolve(packageRoot, relativePath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Bin path for "${commandName}" does not exist: ${relativePath}`);
    }

    const fileContents = readFileSync(resolvedPath, "utf8");
    const firstLine = fileContents.split(/\r?\n/, 1)[0]?.trim();
    if (firstLine !== "#!/usr/bin/env node") {
      throw new Error(`Bin script "${relativePath}" must start with "#!/usr/bin/env node".`);
    }
  }
}

const packageName = packageJson.name;
const packageVersion = packageJson.version;
const githubRef = process.env.GITHUB_REF || "";
const isTagRef = githubRef.startsWith("refs/tags/");
const shouldEnforce = process.env.FAQ_AGENT_PUBLISH_GUARD === "1" || isTagRef;

assertValidBinEntries(packageJson);

if (!shouldEnforce) {
  console.log("Publish guard skipped (set FAQ_AGENT_PUBLISH_GUARD=1 or run on tag refs).");
  process.exit(0);
}

try {
  const publishedVersion = execSync(`npm view ${packageName}@${packageVersion} version`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  if (publishedVersion === packageVersion) {
    console.error(`Publish guard failed: ${packageName}@${packageVersion} is already published.`);
    process.exit(1);
  }
} catch (error) {
  if (typeof error?.status === "number" && error.status !== 0) {
    console.log(`Publish guard passed: ${packageName}@${packageVersion} is not published yet.`);
    process.exit(0);
  }
  throw error;
}

console.log(`Publish guard passed: ${packageName}@${packageVersion} is available for publish.`);
