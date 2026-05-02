import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/store/memoryStore.js";

describe("MemoryStore", () => {
  it("initializes local storage and upserts records by id", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    const store = new MemoryStore(root);

    await store.init();
    await store.recordDecision({
      id: "decision_same",
      title: "Use JSONL",
      rationale: "api_key=secret123 should not be persisted",
      scope: ["src/store"]
    });
    await store.recordDecision({
      id: "decision_same",
      title: "Use structured JSONL",
      rationale: "Append-only records are easy to audit",
      scope: ["src/store"]
    });

    const decisions = await store.readDecisions();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.title).toBe("Use structured JSONL");

    await store.recordAttempt({
      task: "debug auth",
      approach: "print env",
      result: "failure",
      environment: {
        API_TOKEN: "secret",
        NODE_ENV: "test"
      }
    });

    const rawAttempts = await readFile(store.paths.attempts, "utf8");
    expect(rawAttempts).toContain("[REDACTED]");
    expect(rawAttempts).not.toContain("secret");
  });

  it("validates required fields", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    const store = new MemoryStore(root);

    await expect(
      store.recordDecision({
        title: "",
        rationale: "missing title"
      })
    ).rejects.toThrow(/Missing decision title/u);
  });
});
