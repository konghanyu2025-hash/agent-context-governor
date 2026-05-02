import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { AgentMemoryConfig, ProjectIndex } from "../types.js";
import { MemoryStore } from "../store/memoryStore.js";

const languageByExtension = new Map<string, string>([
  [".ts", "TypeScript"],
  [".tsx", "TypeScript"],
  [".js", "JavaScript"],
  [".jsx", "JavaScript"],
  [".mjs", "JavaScript"],
  [".cjs", "JavaScript"],
  [".py", "Python"],
  [".rs", "Rust"],
  [".go", "Go"],
  [".java", "Java"],
  [".kt", "Kotlin"],
  [".cs", "C#"],
  [".rb", "Ruby"],
  [".php", "PHP"],
  [".swift", "Swift"],
  [".md", "Markdown"]
]);

const entryFileNames = new Set([
  "package.json",
  "src/index.ts",
  "src/main.ts",
  "src/cli/main.ts",
  "src/mcp/server.ts",
  "index.ts",
  "main.ts",
  "app.py",
  "main.py",
  "Cargo.toml",
  "pyproject.toml",
  "go.mod"
]);

const keyDirectoryNames = new Set([
  "src",
  "tests",
  "test",
  "app",
  "lib",
  "packages",
  "docs",
  "examples",
  "scripts"
]);

export async function buildProjectIndex(store: MemoryStore): Promise<ProjectIndex> {
  await store.init();
  const config = await store.readConfig();
  const files = await scanFiles(store.paths.root, config);
  const packageJson = await readPackageJson(store.paths.root);
  const languages = Array.from(
    new Set(
      files
        .map((file) => languageByExtension.get(path.extname(file)))
        .filter((language): language is string => Boolean(language))
    )
  ).sort();
  const keyDirectories = await findKeyDirectories(store.paths.root, config);
  const packageManager = detectPackageManager(files);
  const scripts = packageJson?.scripts ?? {};
  const testCommands = scriptCommands(packageManager, scripts, ["test", "test:unit", "check"]);
  const buildCommands = scriptCommands(packageManager, scripts, ["build", "typecheck", "lint"]);

  const index: ProjectIndex = {
    generatedAt: new Date().toISOString(),
    root: store.paths.root,
    ...(packageManager ? { packageManager } : {}),
    languages,
    entryFiles: files.filter((file) => entryFileNames.has(file)).sort(),
    testCommands,
    buildCommands,
    keyDirectories
  };

  return store.writeProjectIndex(index);
}

async function scanFiles(root: string, config: AgentMemoryConfig): Promise<string[]> {
  const results: string[] = [];
  await scanDirectory(root, root, config, results, 0);
  return results.sort();
}

async function scanDirectory(
  root: string,
  directory: string,
  config: AgentMemoryConfig,
  results: string[],
  depth: number
): Promise<void> {
  if (depth > 5 || results.length >= 2000) {
    return;
  }

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = toPosix(path.relative(root, absolute));

    if (shouldExclude(relative, config.exclude)) {
      continue;
    }

    if (entry.isDirectory()) {
      await scanDirectory(root, absolute, config, results, depth + 1);
    } else if (entry.isFile()) {
      results.push(relative);
    }
  }
}

async function findKeyDirectories(root: string, config: AgentMemoryConfig): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const directories: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (shouldExclude(entry.name, config.exclude)) {
      continue;
    }

    if (keyDirectoryNames.has(entry.name)) {
      directories.push(entry.name);
    }
  }

  return directories.sort();
}

function detectPackageManager(files: string[]): string | undefined {
  if (files.includes("pnpm-lock.yaml")) {
    return "pnpm";
  }

  if (files.includes("yarn.lock")) {
    return "yarn";
  }

  if (files.includes("bun.lockb") || files.includes("bun.lock")) {
    return "bun";
  }

  if (files.includes("package-lock.json")) {
    return "npm";
  }

  if (files.includes("package.json")) {
    return "npm";
  }

  if (files.includes("Cargo.toml")) {
    return "cargo";
  }

  if (files.includes("pyproject.toml")) {
    return "python";
  }

  if (files.includes("go.mod")) {
    return "go";
  }

  return undefined;
}

async function readPackageJson(root: string): Promise<{ scripts?: Record<string, string> } | undefined> {
  try {
    const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    return packageJson;
  } catch {
    return undefined;
  }
}

function scriptCommands(
  packageManager: string | undefined,
  scripts: Record<string, string>,
  names: string[]
): string[] {
  const runner = packageManager === "pnpm" ? "pnpm" : packageManager === "yarn" ? "yarn" : "npm run";
  const directNpmTest = packageManager === "npm" || !packageManager;

  return names
    .filter((name) => typeof scripts[name] === "string")
    .map((name) => {
      if (name === "test" && directNpmTest) {
        return "npm test";
      }

      return `${runner} ${name}`;
    });
}

function shouldExclude(relativePath: string, patterns: string[]): boolean {
  const normalized = toPosix(relativePath);
  return patterns.some((pattern) => {
    const normalizedPattern = toPosix(pattern);

    if (normalizedPattern.endsWith("/**")) {
      const prefix = normalizedPattern.slice(0, -3);
      return normalized === prefix || normalized.startsWith(`${prefix}/`);
    }

    return normalized === normalizedPattern;
  });
}

function toPosix(value: string): string {
  return value.replace(/\\/gu, "/");
}
