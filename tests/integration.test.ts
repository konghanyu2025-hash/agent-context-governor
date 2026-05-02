import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { PassThrough } from "node:stream";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProjectIndex } from "../src/indexer/projectIndex.js";
import { generateContextPack } from "../src/pack/contextPack.js";
import { startMcpServer } from "../src/mcp/server.js";
import { MemoryStore } from "../src/store/memoryStore.js";

describe("agent-context-governor integration", () => {
  it("indexes a project, records memory, and generates preflight context", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    await mkdir(path.join(root, "src"));
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        scripts: {
          test: "vitest run",
          build: "tsc -p tsconfig.json"
        }
      }),
      "utf8"
    );
    await writeFile(path.join(root, "src", "index.ts"), "export const ok = true;\n", "utf8");

    const store = new MemoryStore(root);
    const index = await buildProjectIndex(store);
    expect(index.packageManager).toBe("npm");
    expect(index.entryFiles).toContain("package.json");
    expect(index.entryFiles).toContain("src/index.ts");
    expect(index.testCommands).toContain("npm test");

    await store.recordDecision({
      title: "Keep memory local-first",
      rationale: "MVP should work without cloud sync or external vector databases.",
      scope: [".agent-memory", "src/store"]
    });
    await store.recordAttempt({
      task: "choose storage",
      approach: "use external vector database",
      result: "abandoned",
      failureReason: "Adds infrastructure and privacy risk to the MVP",
      retryable: false
    });

    const pack = await generateContextPack(store, "choose local storage for agent memory", {
      save: false
    });

    expect(pack.markdown).toContain("Project Index");
    expect(pack.markdown).toContain("Keep memory local-first");
    expect(pack.markdown).toContain("Do Not Repeat Blindly");
    expect(pack.markdown).toContain("external vector database");
  });

  it("exposes MCP tool definitions over newline-delimited stdio", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    const input = new PassThrough();
    const output = new PassThrough();
    let raw = "";
    output.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
    });

    const server = startMcpServer({ cwd: root, input, output });
    input.end(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`);
    await server;

    const response = JSON.parse(raw.trim()) as { result: { tools: Array<{ name: string }> } };
    expect(response.result.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["memory.search", "context.pack", "decision.record", "attempt.record", "dependency.review", "project.index"])
    );
  });

  it("handles MCP tool calls for recording and context packing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-memory-"));
    const input = new PassThrough();
    const output = new PassThrough();
    let raw = "";
    output.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
    });

    const server = startMcpServer({ cwd: root, input, output });
    input.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "decision.record",
        arguments: {
          title: "Use context packs",
          rationale: "Agents need small cited summaries before work starts"
        }
      }
    })}\n`);
    input.end(`${JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "context.pack",
        arguments: {
          task: "generate context packs",
          save: false
        }
      }
    })}\n`);
    await server;

    const responses = raw.trim().split(/\r?\n/u).map((line) => JSON.parse(line)) as Array<{
      id: number;
      result: { content: Array<{ text: string }> };
    }>;
    expect(responses).toHaveLength(2);
    expect(responses[0]?.result.content[0]?.text).toContain("Use context packs");
    expect(responses[1]?.result.content[0]?.text).toContain("Use context packs");
  });
});
