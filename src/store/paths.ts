import path from "node:path";
import type { AgentMemoryConfig, MemoryPaths } from "../types.js";

export const MEMORY_DIR = ".agent-memory";

export const defaultConfig: AgentMemoryConfig = {
  version: 1,
  include: ["**/*"],
  exclude: [
    ".git/**",
    ".agent-memory/**",
    "node_modules/**",
    "dist/**",
    "coverage/**",
    ".env",
    ".env.*"
  ],
  maxContextItems: 12
};

export function resolveMemoryPaths(root = process.cwd()): MemoryPaths {
  const absoluteRoot = path.resolve(root);
  const memoryDir = path.join(absoluteRoot, MEMORY_DIR);

  return {
    root: absoluteRoot,
    memoryDir,
    config: path.join(memoryDir, "config.json"),
    decisions: path.join(memoryDir, "decisions.jsonl"),
    attempts: path.join(memoryDir, "attempts.jsonl"),
    dependencies: path.join(memoryDir, "dependencies.jsonl"),
    projectIndex: path.join(memoryDir, "project-index.json"),
    contextPacksDir: path.join(memoryDir, "context-packs")
  };
}
