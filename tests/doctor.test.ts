import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatDoctorReport, runDoctor } from "../src/doctor/doctor.js";
import { buildProjectIndex } from "../src/indexer/projectIndex.js";
import { MemoryStore } from "../src/store/memoryStore.js";

describe("runDoctor", () => {
  it("reports actionable warnings before initialization", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    const report = await runDoctor(new MemoryStore(root));

    expect(report.ok).toBe(true);
    expect(formatDoctorReport(report)).toContain("not initialized");
  });

  it("reports an initialized and indexed project as healthy", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    await writeFile(path.join(root, ".gitignore"), ".agent-memory/\n", "utf8");
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");

    const store = new MemoryStore(root);
    await store.init();
    await buildProjectIndex(store);
    const report = await runDoctor(store);

    expect(report.ok).toBe(true);
    expect(report.checks.every((check) => check.status === "ok")).toBe(true);
  });
});
