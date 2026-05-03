import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../src/cli/main.js";

const originalLog = console.log;
const originalError = console.error;
const originalProfile = process.env.PROFILE;

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
  process.exitCode = undefined;
  if (originalProfile === undefined) {
    delete process.env.PROFILE;
  } else {
    process.env.PROFILE = originalProfile;
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

  it("enables and disables claude/codex shell hooks with agc on/off", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    const profile = path.join(root, "profile.ps1");
    process.env.PROFILE = profile;

    const output = await captureOutput(async () => {
      await runCli(["node", "agc", "on", "--shell", "powershell"]);
      await runCli(["node", "agc", "on", "--shell", "powershell"]);
    });
    const installed = await readFile(profile, "utf8");

    expect(output.stdout).toContain("Enabled for powershell");
    expect(output.stdout).toContain("Already enabled for powershell");
    expect(installed).toContain("function claude { agc run claude -- @args }");
    expect(installed).toContain("function codex { agc run codex -- @args }");

    await captureOutput(async () => {
      await runCli(["node", "agc", "off", "--shell", "powershell"]);
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
