import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProjectIndex } from "../src/indexer/projectIndex.js";
import { searchMemory } from "../src/search/search.js";
import { MemoryStore } from "../src/store/memoryStore.js";

describe("searchMemory", () => {
  it("always includes the project index when it exists", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
    await writeFile(path.join(root, "src", "index.ts"), "export {};\n", "utf8");

    const store = new MemoryStore(root);
    await buildProjectIndex(store);
    const results = await searchMemory(store, "unrelated words without local memory", { limit: 3 });

    expect(results.some((result) => result.kind === "project-index")).toBe(true);
  });
});
