import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const packageName = packageJson.name;
const packageVersion = packageJson.version;
const githubRef = process.env.GITHUB_REF || "";
const isTagRef = githubRef.startsWith("refs/tags/");
const shouldEnforce = process.env.FAQ_AGENT_PUBLISH_GUARD === "1" || isTagRef;

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
