import { access, chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mcpAddArgs, mcpRemoveArgs, type McpServerLaunch } from "../src/install/mcpInstall.js";
import {
  installProjectInstructions,
  inspectProjectInstructions,
  removeProjectInstructions
} from "../src/install/projectInstructions.js";
import { detectTool } from "../src/install/toolDetect.js";

describe("installer helpers", () => {
  it("builds Claude and Codex MCP command arguments", () => {
    const launch: McpServerLaunch = {
      available: true,
      command: "agent-context-mcp",
      args: [],
      source: "path"
    };

    expect(mcpAddArgs("claude", launch)).toEqual([
      "mcp",
      "add",
      "--transport",
      "stdio",
      "--scope",
      "local",
      "agent-context-governor",
      "--",
      "agent-context-mcp"
    ]);
    expect(mcpAddArgs("codex", launch)).toEqual(["mcp", "add", "agent-context-governor", "--", "agent-context-mcp"]);
    expect(mcpRemoveArgs("claude")).toEqual(["mcp", "remove", "agent-context-governor"]);
    expect(mcpRemoveArgs("codex")).toEqual(["mcp", "remove", "agent-context-governor"]);
  });

  it("updates project instruction files idempotently and only removes managed blocks", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    await writeFile(path.join(root, "AGENTS.md"), "# Existing agent rules\n\n- Keep this.\n", "utf8");
    await writeFile(path.join(root, "CLAUDE.md"), "# Claude rules\n\n- Keep this too.\n", "utf8");

    await installProjectInstructions(root);
    await installProjectInstructions(root);

    const agents = await readFile(path.join(root, "AGENTS.md"), "utf8");
    const claude = await readFile(path.join(root, "CLAUDE.md"), "utf8");
    const status = await inspectProjectInstructions(root);

    expect(status.agentsInstalled).toBe(true);
    expect(status.claudeInstalled).toBe(true);
    expect(status.claudeImportsAgents).toBe(true);
    expect(agents).toContain("- Keep this.");
    expect(agents.match(/agent-context-governor:start/gu)).toHaveLength(1);
    expect(claude).toContain("- Keep this too.");
    expect(claude.match(/agent-context-governor:start/gu)).toHaveLength(1);

    await removeProjectInstructions(root);
    const agentsAfterRemove = await readFile(path.join(root, "AGENTS.md"), "utf8");
    const claudeAfterRemove = await readFile(path.join(root, "CLAUDE.md"), "utf8");

    expect(agentsAfterRemove).toContain("- Keep this.");
    expect(agentsAfterRemove).not.toContain("agent-context-governor");
    expect(claudeAfterRemove).toContain("- Keep this too.");
    expect(claudeAfterRemove).not.toContain("agent-context-governor");
    expect(await exists(path.join(root, ".agent-memory", "backups"))).toBe(true);
  });

  it("detects tools when Windows exposes Path instead of PATH", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    const bin = path.join(root, "bin");
    await mkdir(bin);

    if (process.platform === "win32") {
      await writeFile(path.join(bin, "sample-tool.cmd"), "@echo off\r\n", "utf8");
    } else {
      const target = path.join(bin, "sample-tool");
      await writeFile(target, "#!/bin/sh\n", "utf8");
      await chmod(target, 0o755);
    }

    const env: NodeJS.ProcessEnv = process.platform === "win32"
      ? { Path: bin, PATHEXT: ".CMD" }
      : { PATH: bin };
    const result = await detectTool("sample-tool", env);

    expect(result.available).toBe(true);
  });
});

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
