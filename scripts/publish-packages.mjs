import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = new URL("..", import.meta.url).pathname;
const packagesDir = path.join(root, "packages");
const registry =
  process.env.PACKAGE_REGISTRY_URL ||
  "https://git.waffleophagus.com/api/packages/waffleophagus/npm/";

const publishOrder = [
  "remend",
  "streamdown-core",
  "streamdown-code",
  "streamdown-code-native",
  "streamdown-cjk",
  "streamdown-math",
  "streamdown-mermaid",
  "streamdown-react-native",
  "streamdown",
];

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const packageDir of publishOrder) {
  const fullDir = path.join(packagesDir, packageDir);
  if (!statSync(fullDir).isDirectory()) {
    continue;
  }

  const pkg = JSON.parse(
    readFileSync(path.join(fullDir, "package.json"), "utf8")
  );
  if (pkg.private) {
    continue;
  }

  const versionCheck = spawnSync(
    "npm",
    ["view", `${pkg.name}@${pkg.version}`, "version", "--registry", registry],
    {
      cwd: fullDir,
      env: process.env,
      encoding: "utf8",
    }
  );

  if (versionCheck.status === 0 && versionCheck.stdout.trim() === pkg.version) {
    console.log(`Skipping ${pkg.name}@${pkg.version}; already published.`);
    continue;
  }

  console.log(`Publishing ${pkg.name}@${pkg.version}`);
  run("npm", ["publish", "--registry", registry], fullDir);
}
