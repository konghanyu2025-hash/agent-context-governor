import { access, chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../src/cli/main.js";

const originalLog = console.log;
const originalError = console.error;
const originalProfile = process.env.PROFILE;
const originalPath = process.env.PATH;
const originalFakeState = process.env.AGC_FAKE_STATE;
const originalFakeLog = process.env.AGC_FAKE_LOG;

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
  process.exitCode = undefined;
  if (originalProfile === undefined) {
    delete process.env.PROFILE;
  } else {
    process.env.PROFILE = originalProfile;
  }
  if (originalPath === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = originalPath;
  }
  if (originalFakeState === undefined) {
    delete process.env.AGC_FAKE_STATE;
  } else {
    process.env.AGC_FAKE_STATE = originalFakeState;
  }
  if (originalFakeLog === undefined) {
    delete process.env.AGC_FAKE_LOG;
  } else {
    process.env.AGC_FAKE_LOG = originalFakeLog;
  }
});

describe("CLI", () => {
  it("runs init, index, record, search, doctor, and preflight", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    await writeFile(path.join(root, ".gitignore"), ".agent-memory/\n", "utf8");
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
    const output = await captureOutput(async () => {
      await runCli(["node", "agent-context", "--cwd", root, "setup"]);
      await runCli([
        "node",
        "agent-context",
        "--cwd",
        root,
        "record",
        "decision",
        "--title",
        "Prefer small context packs",
        "--rationale",
        "They reduce repeated repository scans"
      ]);
      await runCli(["node", "agent-context", "--cwd", root, "search", "context packs"]);
      await runCli(["node", "agent-context", "--cwd", root, "doctor"]);
      await runCli(["node", "agc", "--cwd", root, "pf", "generate context packs", "--no-save"]);
    });

    expect(output.stdout).toContain("Initialized local memory");
    expect(output.stdout).toContain("Indexed project");
    expect(output.stdout).toContain("Next: run agc on");
    expect(output.stdout).toContain("Prefer small context packs");
    expect(output.stdout).toContain("Agent Context Doctor");
    expect(output.stdout).toContain("Agent Context Pack");
  });

  it("prints JSON from setup", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    await writeFile(path.join(root, ".gitignore"), ".agent-memory/\n", "utf8");
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");

    const output = await captureOutput(async () => {
      await runCli(["node", "agent-context", "--cwd", root, "setup", "--json"]);
    });
    const parsed = JSON.parse(output.stdout) as { doctor: { ok: boolean }; index: { packageManager?: string } };

    expect(parsed.doctor.ok).toBe(true);
    expect(parsed.index.packageManager).toBe("npm");
  });

  it("enables MCP and project instructions without touching shell hooks by default", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
    const fake = await installFakeAgentTools(root);
    const profile = path.join(root, "profile.ps1");
    process.env.PROFILE = profile;

    const output = await captureOutput(async () => {
      await runCli(["node", "agc", "--cwd", root, "on"]);
      await runCli(["node", "agc", "--cwd", root, "on"]);
      await runCli(["node", "agc", "--cwd", root, "st"]);
    });
    const agents = await readFile(path.join(root, "AGENTS.md"), "utf8");
    const claude = await readFile(path.join(root, "CLAUDE.md"), "utf8");
    const log = await readFakeLog(fake.logPath);

    expect(output.stdout).toContain("Agent Context Governor: enabled");
    expect(output.stdout).toContain("Agent Context Status: ready");
    expect(agents).toContain("context.pack");
    expect(agents.match(/agent-context-governor:start/gu)).toHaveLength(1);
    expect(claude).toContain("@AGENTS.md");
    expect(await fileExists(profile)).toBe(false);
    expect(log).toContainEqual({
      tool: "claude",
      args: ["mcp", "add", "--transport", "stdio", "--scope", "local", "agent-context-governor", "--", "agent-context-mcp"]
    });
    expect(log).toContainEqual({
      tool: "codex",
      args: ["mcp", "add", "agent-context-governor", "--", "agent-context-mcp"]
    });

    const offOutput = await captureOutput(async () => {
      await runCli(["node", "agc", "--cwd", root, "off"]);
    });
    const offLog = await readFakeLog(fake.logPath);

    expect(offOutput.stdout).toContain("Agent Context Governor: disabled");
    expect(offLog).toContainEqual({
      tool: "claude",
      args: ["mcp", "remove", "agent-context-governor"]
    });
    expect(offLog).toContainEqual({
      tool: "codex",
      args: ["mcp", "remove", "agent-context-governor"]
    });
    expect(await fileExists(path.join(root, "AGENTS.md"))).toBe(false);
    expect(await fileExists(path.join(root, "CLAUDE.md"))).toBe(false);
  });

  it("manages optional legacy shell hooks through agc sh", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    const profile = path.join(root, "profile.ps1");
    process.env.PROFILE = profile;

    const output = await captureOutput(async () => {
      await runCli(["node", "agc", "sh", "on", "--shell", "powershell"]);
      await runCli(["node", "agc", "sh", "on", "--shell", "powershell"]);
    });
    const installed = await readFile(profile, "utf8");

    expect(output.stdout).toContain("Enabled optional shell hook for powershell");
    expect(output.stdout).toContain("Already enabled optional shell hook for powershell");
    expect(installed).toContain("function claude { agc run claude -- @args }");
    expect(installed).toContain("function codex { agc run codex -- @args }");

    await captureOutput(async () => {
      await runCli(["node", "agc", "sh", "off", "--shell", "powershell"]);
    });
    const removed = await readFile(profile, "utf8");

    expect(removed).not.toContain("agent-context-governor");
  });
});

async function captureOutput(action: () => Promise<void>): Promise<{ stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  console.log = (message?: unknown, ...optional: unknown[]) => {
    stdout += [message, ...optional].map(String).join(" ") + "\n";
  };
  console.error = (message?: unknown, ...optional: unknown[]) => {
    stderr += [message, ...optional].map(String).join(" ") + "\n";
  };

  await action();
  return { stdout, stderr };
}

async function installFakeAgentTools(root: string): Promise<{ logPath: string }> {
  const bin = path.join(root, "bin");
  const fakeScript = path.join(root, "fake-agent-tool.cjs");
  const statePath = path.join(root, "fake-state.json");
  const logPath = path.join(root, "fake-log.jsonl");
  await mkdir(bin, { recursive: true });
  await writeFile(statePath, JSON.stringify({ claude: false, codex: false }), "utf8");
  await writeFile(logPath, "", "utf8");
  await writeFile(fakeScript, fakeAgentScript(), "utf8");
  await writeFakeCommand(bin, "claude", fakeScript);
  await writeFakeCommand(bin, "codex", fakeScript);
  await writeFakeCommand(bin, "agent-context-mcp", fakeScript);
  process.env.PATH = `${bin}${path.delimiter}${process.env.PATH ?? ""}`;
  process.env.AGC_FAKE_STATE = statePath;
  process.env.AGC_FAKE_LOG = logPath;
  return { logPath };
}

async function writeFakeCommand(bin: string, name: string, fakeScript: string): Promise<void> {
  if (process.platform === "win32") {
    await writeFile(path.join(bin, `${name}.cmd`), `@echo off\r\n"${process.execPath}" "${fakeScript}" ${name} %*\r\n`, "utf8");
    return;
  }

  const target = path.join(bin, name);
  await writeFile(target, `#!/bin/sh\nexec "${process.execPath}" "${fakeScript}" ${name} "$@"\n`, "utf8");
  await chmod(target, 0o755);
}

function fakeAgentScript(): string {
  return `
const fs = require("node:fs");
const tool = process.argv[2];
const args = process.argv.slice(3);
const statePath = process.env.AGC_FAKE_STATE;
const logPath = process.env.AGC_FAKE_LOG;
fs.appendFileSync(logPath, JSON.stringify({ tool, args }) + "\\n", "utf8");
const readState = () => JSON.parse(fs.readFileSync(statePath, "utf8"));
const writeState = (state) => fs.writeFileSync(statePath, JSON.stringify(state), "utf8");
if (tool === "agent-context-mcp") {
  process.exit(0);
}
if (args[0] === "mcp" && args[1] === "list") {
  const state = readState();
  if (state[tool]) {
    console.log("agent-context-governor");
  }
  process.exit(0);
}
if (args[0] === "mcp" && args[1] === "add") {
  const state = readState();
  state[tool] = true;
  writeState(state);
  process.exit(0);
}
if (args[0] === "mcp" && args[1] === "remove") {
  const state = readState();
  state[tool] = false;
  writeState(state);
  process.exit(0);
}
process.exit(0);
`;
}

async function readFakeLog(logPath: string): Promise<Array<{ tool: string; args: string[] }>> {
  return (await readFile(logPath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { tool: string; args: string[] });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
