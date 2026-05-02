import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateContextPack } from "../src/pack/contextPack.js";
import { MemoryStore } from "../src/store/memoryStore.js";

describe("generateContextPack", () => {
  it("includes negative cache and dependency reviews with sources", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    const store = new MemoryStore(root);

    await store.recordAttempt({
      task: "add CLI parser",
      approach: "hand-roll nested command parsing",
      result: "failure",
      errorSignature: "ambiguous nested command parsing",
      failureReason: "Commander already handles nested commands with less custom code",
      retryable: false
    });
    await store.recordDependency({
      packageName: "commander",
      useCase: "CLI parser",
      recommendation: "use",
      rationale: "It is already adopted for the CLI command surface",
      license: "MIT",
      maintenance: {
        status: "active",
        latestVersion: "14.0.1"
      }
    });

    const result = await generateContextPack(store, "extend CLI parser with commander", {
      budget: 260,
      save: false
    });

    expect(result.markdown).toContain("Negative Cache");
    expect(result.markdown).toContain("hand-roll nested command parsing");
    expect(result.markdown).toContain("commander");
    expect(result.markdown).toContain("Source: .agent-memory/");
    expect(result.markdown.length).toBeLessThanOrEqual(1040);
  });

  it("treats abandoned attempts as non-retryable by default", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    const store = new MemoryStore(root);

    const record = await store.recordAttempt({
      task: "choose storage",
      approach: "use hosted vector database",
      result: "abandoned"
    });

    expect(record.retryable).toBe(false);
  });
});
