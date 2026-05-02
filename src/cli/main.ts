#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { MemoryStore } from "../store/memoryStore.js";
import { generateContextPack } from "../pack/contextPack.js";
import { buildProjectIndex } from "../indexer/projectIndex.js";
import { searchMemory } from "../search/search.js";
import { reviewNpmPackage } from "../review/npmReview.js";
import { startMcpServer } from "../mcp/server.js";
import type { EvidenceRef } from "../types.js";

export async function runCli(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name("agent-memory")
    .description("Local-first memory layer for coding agents.")
    .version("0.1.0")
    .option("-C, --cwd <path>", "project root", process.cwd());

  program
    .command("init")
    .description("Create local agent memory storage.")
    .action(async () => {
      const store = createStore(program);
      const paths = await store.init();
      console.log(`Initialized local memory at ${paths.memoryDir}`);
      console.log("Keep .agent-memory/ private by leaving it in .gitignore.");
    });

  program
    .command("index")
    .description("Scan project structure, scripts, languages, and key directories.")
    .action(async () => {
      const store = createStore(program);
      const index = await buildProjectIndex(store);
      console.log(JSON.stringify(index, null, 2));
    });

  program
    .command("preflight")
    .description("Generate a compact task context pack before an agent starts work.")
    .argument("<task>", "task description")
    .option("--budget <tokens>", "approximate token budget", parseInteger, 3000)
    .option("--no-save", "do not save the generated pack")
    .action(async (task: string, options: { budget: number; save: boolean }) => {
      const store = createStore(program);
      const result = await generateContextPack(store, task, {
        budget: options.budget,
        save: options.save
      });
      console.log(result.markdown);
      if (result.savedTo) {
        console.error(`Saved context pack to ${result.savedTo}`);
      }
    });

  program
    .command("pack")
    .description("Generate a context pack for a task.")
    .argument("<task>", "task description")
    .option("--budget <tokens>", "approximate token budget", parseInteger, 3000)
    .option("--limit <count>", "maximum memory items", parseInteger)
    .option("--no-save", "do not save the generated pack")
    .action(
      async (
        task: string,
        options: { budget: number; limit: number | undefined; save: boolean }
      ) => {
        const store = createStore(program);
        const result = await generateContextPack(store, task, {
          budget: options.budget,
          limit: options.limit,
          save: options.save
        });
        console.log(result.markdown);
        if (result.savedTo) {
          console.error(`Saved context pack to ${result.savedTo}`);
        }
      }
    );

  program
    .command("search")
    .description("Search decisions, attempts, dependency reviews, and project index.")
    .argument("<query>", "search query")
    .option("--limit <count>", "maximum results", parseInteger, 12)
    .option("--json", "print raw JSON")
    .action(async (query: string, options: { limit: number; json?: boolean }) => {
      const store = createStore(program);
      const results = await searchMemory(store, query, { limit: options.limit });

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        console.log("No matching memory found.");
        return;
      }

      for (const result of results) {
        console.log(`[${result.kind}] score=${result.score} source=${result.source}`);
        console.log(summaryForRecord(result.record));
        console.log("");
      }
    });

  const record = program.command("record").description("Record durable project memory.");

  record
    .command("decision")
    .description("Record an implementation or architecture decision.")
    .requiredOption("--title <text>", "decision title")
    .requiredOption("--rationale <text>", "why this decision was made")
    .option("--scope <items>", "comma-separated files, modules, or areas")
    .option("--evidence <items>", "comma-separated evidence refs such as src/app.ts:10")
    .option("--expires-when <text>", "condition that should invalidate this memory")
    .option("--tag <items>", "comma-separated tags")
    .action(
      async (options: {
        title: string;
        rationale: string;
        scope?: string;
        evidence?: string;
        expiresWhen?: string;
        tag?: string;
      }) => {
        const store = createStore(program);
        const record = await store.recordDecision({
          title: options.title,
          rationale: options.rationale,
          scope: parseList(options.scope),
          evidence: parseEvidenceList(options.evidence),
          expiresWhen: options.expiresWhen,
          tags: parseList(options.tag)
        });
        console.log(JSON.stringify(record, null, 2));
      }
    );

  record
    .command("attempt")
    .description("Record a successful, failed, or abandoned attempt.")
    .requiredOption("--task <text>", "task this attempt belonged to")
    .requiredOption("--approach <text>", "approach that was tried")
    .option("--result <result>", "success, failure, or abandoned", "failure")
    .option("--error-signature <text>", "stable error signature")
    .option("--failure-reason <text>", "why this failed or was abandoned")
    .option("--retryable", "mark this as retryable")
    .option("--retry-when <text>", "condition that permits retrying")
    .option("--evidence <items>", "comma-separated evidence refs")
    .option("--tag <items>", "comma-separated tags")
    .action(
      async (options: {
        task: string;
        approach: string;
        result: "success" | "failure" | "abandoned";
        errorSignature?: string;
        failureReason?: string;
        retryable?: boolean;
        retryWhen?: string;
        evidence?: string;
        tag?: string;
      }) => {
        const store = createStore(program);
        const record = await store.recordAttempt({
          task: options.task,
          approach: options.approach,
          result: options.result,
          errorSignature: options.errorSignature,
          failureReason: options.failureReason,
          retryable: options.retryable,
          retryWhen: options.retryWhen,
          evidence: parseEvidenceList(options.evidence),
          tags: parseList(options.tag)
        });
        console.log(JSON.stringify(record, null, 2));
      }
    );

  record
    .command("dependency")
    .description("Record a dependency review manually.")
    .requiredOption("--package <name>", "package name")
    .requiredOption("--use-case <text>", "why the package is being considered")
    .requiredOption("--recommendation <value>", "use, avoid, or spike")
    .requiredOption("--rationale <text>", "why this recommendation was made")
    .option("--license <value>", "license")
    .option("--maintenance <value>", "active, stale, inactive, or unknown", "unknown")
    .option("--risk <items>", "comma-separated risks")
    .option("--alternative <items>", "comma-separated alternatives")
    .option("--evidence <items>", "comma-separated evidence refs")
    .option("--tag <items>", "comma-separated tags")
    .action(
      async (options: {
        package: string;
        useCase: string;
        recommendation: "use" | "avoid" | "spike";
        rationale: string;
        license?: string;
        maintenance: "active" | "stale" | "inactive" | "unknown";
        risk?: string;
        alternative?: string;
        evidence?: string;
        tag?: string;
      }) => {
        const store = createStore(program);
        const record = await store.recordDependency({
          packageName: options.package,
          useCase: options.useCase,
          recommendation: options.recommendation,
          rationale: options.rationale,
          license: options.license,
          maintenance: {
            status: options.maintenance
          },
          risks: parseList(options.risk),
          alternatives: parseList(options.alternative),
          evidence: parseEvidenceList(options.evidence),
          tags: parseList(options.tag)
        });
        console.log(JSON.stringify(record, null, 2));
      }
    );

  const deps = program.command("deps").description("Review and record open-source dependencies.");

  deps
    .command("review")
    .description("Review an npm package using registry metadata.")
    .argument("<package>", "npm package name")
    .requiredOption("--use-case <text>", "why the package is being considered")
    .option("--no-save", "print the review without recording it")
    .action(async (packageName: string, options: { useCase: string; save: boolean }) => {
      const store = createStore(program);
      const review = await reviewNpmPackage(packageName, options.useCase);

      if (!options.save) {
        console.log(JSON.stringify(review, null, 2));
        return;
      }

      const record = await store.recordDependency(review);
      console.log(JSON.stringify(record, null, 2));
    });

  program
    .command("mcp")
    .description("Start the MCP stdio server.")
    .action(async () => {
      await startMcpServer({ cwd: program.opts<{ cwd: string }>().cwd });
    });

  await program.parseAsync(argv);
}

function createStore(program: Command): MemoryStore {
  const options = program.opts<{ cwd: string }>();
  return new MemoryStore(options.cwd);
}

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseEvidenceList(value: string | undefined): EvidenceRef[] {
  return parseList(value).map((item) => {
    if (/^https?:\/\//u.test(item)) {
      return { url: item };
    }

    const match = /^(?<file>.+?)(?::(?<line>\d+))?$/u.exec(item);
    const file = match?.groups?.file ?? item;
    const line = match?.groups?.line ? Number.parseInt(match.groups.line, 10) : undefined;
    return line ? { file, line } : { file };
  });
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }

  return parsed;
}

function summaryForRecord(record: unknown): string {
  if (record && typeof record === "object" && "kind" in record) {
    const item = record as { kind: string; title?: string; task?: string; packageName?: string; rationale?: string; approach?: string };

    if (item.kind === "decision") {
      return `${item.title ?? "decision"} - ${item.rationale ?? ""}`;
    }

    if (item.kind === "attempt") {
      return `${item.task ?? "attempt"} - ${item.approach ?? ""}`;
    }

    if (item.kind === "dependency") {
      return `${item.packageName ?? "dependency"} - ${item.rationale ?? ""}`;
    }
  }

  return JSON.stringify(record);
}

function isDirectCli(metaUrl: string): boolean {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(entry).href === metaUrl);
}

if (isDirectCli(import.meta.url)) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
