#!/usr/bin/env node

/**
 * prepare-release.js
 *
 * Creates and pushes a git tag for a new release.
 * A GitHub Actions workflow should listen to tag pushes and:
 * - build the plugin
 * - create a DRAFT GitHub release
 * - upload main.js, manifest.json, styles.css as release assets
 *
 * Usage:
 *   npm run pre-release 2.1.1
 *   npm run pre-release v2.1.1
 *
 *   # If your npm doesn't forward args without `--`:
 *   npm run pre-release -- 2.1.1
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function getVersionArg() {
  if (process.argv[2]) return process.argv[2];

  // Some npm versions require `--` to forward args. As a fallback, try to read the
  // original argv from npm's env var.
  const npmArgv = process.env.npm_config_argv;
  if (npmArgv) {
    try {
      const parsed = JSON.parse(npmArgv);
      const remain = parsed?.remain;
      if (Array.isArray(remain) && remain[0]) return remain[0];
    } catch {
      // ignore
    }
  }

  return null;
}

const versionArg = getVersionArg();

if (!versionArg) {
  console.error("❌ Please provide a version number: npm run pre-release X.Y.Z");
  console.error("   (If args aren't forwarded on your npm version: npm run pre-release -- X.Y.Z)");
  process.exit(1);
}

// Support both formats: 1.2.3 and v1.2.3
const versionRegex = /^v?\d+\.\d+\.\d+$/;
if (!versionRegex.test(versionArg)) {
  console.error("❌ Version must be in format X.Y.Z or vX.Y.Z");
  process.exit(1);
}

const cleanVersion = versionArg.replace(/^v/, "");
const tagName = cleanVersion; // use `v${cleanVersion}` if you prefer v-prefixed tags

// Read current version from manifest.json (informational only)
const manifestPath = path.join(process.cwd(), "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const currentVersion = manifest.version;

console.log(`\n📦 Current manifest version: ${currentVersion}`);
console.log(`🚀 Creating release tag: ${tagName}\n`);

try {
  // Ensure clean working tree
  const status = execSync("git status --porcelain").toString();
  if (status) {
    console.error("⚠️  You have uncommitted changes. Please commit or stash them first.");
    console.error("\nUncommitted files:");
    console.error(status);
    process.exit(1);
  }

  // Ensure tag doesn't already exist locally
  try {
    execSync(`git rev-parse ${tagName}`, { stdio: "pipe" });
    console.error(`❌ Tag ${tagName} already exists locally.`);
    console.error(`   To delete it: git tag -d ${tagName}`);
    process.exit(1);
  } catch {
    // ok
  }

  // Ensure tag doesn't already exist on remote
  try {
    const remoteTag = execSync(`git ls-remote --tags origin refs/tags/${tagName}`, {
      stdio: "pipe",
    })
      .toString()
      .trim();

    if (remoteTag) {
      console.error(`❌ Tag ${tagName} already exists on remote.`);
      console.error("   This version has already been released.");
      process.exit(1);
    }
  } catch {
    // If origin isn't reachable, let git push fail with a clear message later.
  }

  // Fetch latest refs and warn if behind
  console.log("📡 Fetching latest from remote...");
  execSync("git fetch", { stdio: "inherit" });

  const currentBranch = execSync("git branch --show-current").toString().trim();
  if (currentBranch) {
    const remoteBranch = `origin/${currentBranch}`;
    try {
      const behind = execSync(`git rev-list HEAD..${remoteBranch} --count`)
        .toString()
        .trim();

      if (behind !== "0") {
        console.warn(`⚠️  Your branch is ${behind} commits behind ${remoteBranch}.`);
        console.warn("   Consider pulling latest changes first: git pull");
      }
    } catch {
      // Ignore if remote branch doesn't exist.
    }
  }

  // Create annotated tag
  execSync(`git tag -a ${tagName} -m "Release ${cleanVersion}"`, { stdio: "inherit" });
  console.log(`✅ Created tag ${tagName}`);

  // Push tag to trigger GitHub Actions
  console.log("\n📤 Pushing tag to remote...");
  execSync(`git push origin ${tagName}`, { stdio: "inherit" });
  console.log(`✅ Pushed tag ${tagName} to remote`);

  console.log(`\n🎉 Release tag ${tagName} created successfully!`);
  console.log("\n📝 Next steps:");
  console.log("1) GitHub Actions will build and create a DRAFT release");
  console.log("2) Review the draft release assets (main.js, manifest.json, styles.css)");
  console.log("3) Publish the release (optionally triggers a sync workflow to bump versions in the repo)");
} catch (error) {
  console.error("\n❌ Error during release preparation:", error?.message || error);

  // Cleanup local tag if it was created
  try {
    execSync(`git tag -d ${tagName}`, { stdio: "pipe" });
    console.log("🧹 Cleaned up local tag");
  } catch {
    // ignore
  }

  process.exit(1);
}
