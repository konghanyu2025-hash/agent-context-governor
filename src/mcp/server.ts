#!/usr/bin/env node
import readline from "node:readline";
import { pathToFileURL } from "node:url";
import { MemoryStore } from "../store/memoryStore.js";
import { generateContextPack } from "../pack/contextPack.js";
import { searchMemory } from "../search/search.js";
import { buildProjectIndex } from "../indexer/projectIndex.js";
import { reviewNpmPackage } from "../review/npmReview.js";
import type { AttemptRecord, DependencyReviewRecord, EvidenceRef } from "../types.js";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface StartMcpServerOptions {
  cwd?: string;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export async function startMcpServer(options: StartMcpServerOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const lines = readline.createInterface({
    input,
    crlfDelay: Number.POSITIVE_INFINITY
  });

  for await (const line of lines) {
    const normalizedLine = line.replace(/^\uFEFF/u, "");

    if (normalizedLine.trim().length === 0) {
      continue;
    }

    let request: JsonRpcRequest;

    try {
      request = JSON.parse(normalizedLine) as JsonRpcRequest;
    } catch (error) {
      writeMessage(output, errorResponse(null, -32700, "Parse error", String(error)));
      continue;
    }

    const hasId = Object.prototype.hasOwnProperty.call(request, "id");

    try {
      const result = await handleRequest(request, cwd);

      if (hasId) {
        writeMessage(output, {
          jsonrpc: "2.0",
          id: request.id ?? null,
          result
        });
      }
    } catch (error) {
      if (hasId) {
        writeMessage(
          output,
          errorResponse(
            request.id ?? null,
            error instanceof McpError ? error.code : -32603,
            error instanceof Error ? error.message : String(error)
          )
        );
      } else {
        console.error(error instanceof Error ? error.message : String(error));
      }
    }
  }
}

async function handleRequest(request: JsonRpcRequest, defaultCwd: string): Promise<unknown> {
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    throw new McpError(-32600, "Invalid JSON-RPC request");
  }

  switch (request.method) {
    case "initialize":
      return {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "agent-context-governor",
          version: "0.1.0"
        }
      };

    case "notifications/initialized":
      return {};

    case "ping":
      return {};

    case "tools/list":
      return {
        tools: toolDefinitions()
      };

    case "tools/call":
      return callTool(request.params, defaultCwd);

    default:
      throw new McpError(-32601, `Method not found: ${request.method}`);
  }
}

async function callTool(params: unknown, defaultCwd: string): Promise<unknown> {
  const object = asObject(params, "tools/call params");
  const name = asString(object.name, "tool name");
  const args = asObject(object.arguments ?? {}, "tool arguments");
  const cwd = typeof args.cwd === "string" ? args.cwd : defaultCwd;
  const store = new MemoryStore(cwd);

  switch (name) {
    case "memory.search": {
      const query = asString(args.query, "query");
      const limit = optionalNumber(args.limit);
      const results = await searchMemory(store, query, { limit });
      return textResult(JSON.stringify(results, null, 2));
    }

    case "context.pack": {
      const task = asString(args.task, "task");
      const budget = optionalNumber(args.budget);
      const save = typeof args.save === "boolean" ? args.save : true;
      const result = await generateContextPack(store, task, { budget, save });
      return textResult(result.savedTo ? `${result.markdown}\n\nSaved to: ${result.savedTo}` : result.markdown);
    }

    case "decision.record": {
      const record = await store.recordDecision({
        title: asString(args.title, "title"),
        rationale: asString(args.rationale, "rationale"),
        scope: optionalStringArray(args.scope),
        evidence: optionalEvidence(args.evidence),
        expiresWhen: optionalString(args.expiresWhen),
        tags: optionalStringArray(args.tags)
      });
      return textResult(JSON.stringify(record, null, 2));
    }

    case "attempt.record": {
      const result = optionalString(args.result) ?? "failure";
      assertAttemptResult(result);
      const record = await store.recordAttempt({
        task: asString(args.task, "task"),
        approach: asString(args.approach, "approach"),
        result,
        errorSignature: optionalString(args.errorSignature),
        failureReason: optionalString(args.failureReason),
        retryable: typeof args.retryable === "boolean" ? args.retryable : undefined,
        retryWhen: optionalString(args.retryWhen),
        evidence: optionalEvidence(args.evidence),
        tags: optionalStringArray(args.tags)
      });
      return textResult(JSON.stringify(record, null, 2));
    }

    case "dependency.review": {
      const packageName = asString(args.packageName, "packageName");
      const useCase = asString(args.useCase, "useCase");
      const save = typeof args.save === "boolean" ? args.save : true;
      const review = await reviewNpmPackage(packageName, useCase);
      const output = save ? await store.recordDependency(review) : review;
      return textResult(JSON.stringify(output, null, 2));
    }

    case "project.index": {
      const index = await buildProjectIndex(store);
      return textResult(JSON.stringify(index, null, 2));
    }

    default:
      throw new McpError(-32602, `Unknown tool: ${name}`);
  }
}

function toolDefinitions(): unknown[] {
  return [
    {
      name: "memory.search",
      description: "Search local agent memory records and the project index.",
      inputSchema: objectSchema({
        query: { type: "string" },
        limit: { type: "number" },
        cwd: { type: "string" }
      }, ["query"])
    },
    {
      name: "context.pack",
      description: "Generate an evidence-backed context pack for a task.",
      inputSchema: objectSchema({
        task: { type: "string" },
        budget: { type: "number" },
        save: { type: "boolean" },
        cwd: { type: "string" }
      }, ["task"])
    },
    {
      name: "decision.record",
      description: "Record an implementation or architecture decision.",
      inputSchema: objectSchema({
        title: { type: "string" },
        rationale: { type: "string" },
        scope: stringArraySchema(),
        evidence: evidenceArraySchema(),
        expiresWhen: { type: "string" },
        tags: stringArraySchema(),
        cwd: { type: "string" }
      }, ["title", "rationale"])
    },
    {
      name: "attempt.record",
      description: "Record a successful, failed, or abandoned attempt.",
      inputSchema: objectSchema({
        task: { type: "string" },
        approach: { type: "string" },
        result: { type: "string", enum: ["success", "failure", "abandoned"] },
        errorSignature: { type: "string" },
        failureReason: { type: "string" },
        retryable: { type: "boolean" },
        retryWhen: { type: "string" },
        evidence: evidenceArraySchema(),
        tags: stringArraySchema(),
        cwd: { type: "string" }
      }, ["task", "approach"])
    },
    {
      name: "dependency.review",
      description: "Review an npm dependency using registry metadata and optionally record it.",
      inputSchema: objectSchema({
        packageName: { type: "string" },
        useCase: { type: "string" },
        save: { type: "boolean" },
        cwd: { type: "string" }
      }, ["packageName", "useCase"])
    },
    {
      name: "project.index",
      description: "Index project structure, package manager, scripts, languages, and key directories.",
      inputSchema: objectSchema({
        cwd: { type: "string" }
      })
    }
  ];
}

function objectSchema(properties: Record<string, unknown>, required: string[] = []): unknown {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false
  };
}

function stringArraySchema(): unknown {
  return {
    type: "array",
    items: {
      type: "string"
    }
  };
}

function evidenceArraySchema(): unknown {
  return {
    type: "array",
    items: objectSchema({
      file: { type: "string" },
      line: { type: "number" },
      note: { type: "string" },
      url: { type: "string" }
    })
  };
}

function textResult(text: string): unknown {
  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new McpError(-32602, `Expected object for ${field}`);
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new McpError(-32602, `Expected non-empty string for ${field}`);
  }

  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new McpError(-32602, "Expected positive number");
  }

  return value;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new McpError(-32602, "Expected string array");
  }

  return value;
}

function optionalEvidence(value: unknown): EvidenceRef[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new McpError(-32602, "Expected evidence array");
  }

  return value.map((item) => {
    const evidence = asObject(item, "evidence item");
    const result: EvidenceRef = {};

    if (typeof evidence.file === "string") {
      result.file = evidence.file;
    }

    if (typeof evidence.line === "number") {
      result.line = evidence.line;
    }

    if (typeof evidence.note === "string") {
      result.note = evidence.note;
    }

    if (typeof evidence.url === "string") {
      result.url = evidence.url;
    }

    return result;
  });
}

function assertAttemptResult(value: string): asserts value is AttemptRecord["result"] {
  if (!["success", "failure", "abandoned"].includes(value)) {
    throw new McpError(-32602, `Invalid attempt result: ${value}`);
  }
}

function errorResponse(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data }
  };
}

function writeMessage(output: NodeJS.WritableStream, message: JsonRpcResponse): void {
  output.write(`${JSON.stringify(message)}\n`);
}

class McpError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

function isDirectCli(metaUrl: string): boolean {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(entry).href === metaUrl);
}

if (isDirectCli(import.meta.url)) {
  startMcpServer().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
