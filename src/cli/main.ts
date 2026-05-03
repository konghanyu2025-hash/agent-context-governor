#!/usr/bin/env node
import { access } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { MemoryStore } from "../store/memoryStore.js";
import { generateContextPack } from "../pack/contextPack.js";
import { buildProjectIndex } from "../indexer/projectIndex.js";
import { searchMemory } from "../search/search.js";
import { reviewNpmPackage } from "../review/npmReview.js";
import { startMcpServer } from "../mcp/server.js";
import { formatDoctorReport, runDoctor } from "../doctor/doctor.js";
import {
  defaultShell,
  installShellHook,
  removeShellHook,
  type HookInstallResult,
  type HookRemoveResult,
  type ShellKind
} from "../shell/hooks.js";
import { runToolWithContext } from "../wrap/runTool.js";
import {
  getMcpToolStatus,
  installMcpServerForTool,
  removeMcpServerForTool,
  resolveMcpServerLaunch,
  supportedAgentTools,
  type McpInstallResult,
  type McpRemoveResult,
  type McpServerLaunch,
  type McpToolStatus
} from "../install/mcpInstall.js";
import {
  inspectProjectInstructions,
  installProjectInstructions,
  removeProjectInstructions,
  type ProjectInstructionChange,
  type ProjectInstructionStatus
} from "../install/projectInstructions.js";
import type { EvidenceRef } from "../types.js";

interface IntegrationStatus {
  state: "ready" | "partial" | "not-ready";
  memoryReady: boolean;
  mcpLaunch: McpServerLaunch;
  instructions: ProjectInstructionStatus;
  tools: McpToolStatus[];
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name("agent-context")
    .description("Local-first context and memory governor for coding agents.")
    .version("0.1.0")
    .option("-C, --cwd <path>", "project root", process.cwd());

  program
    .command("on")
    .description("Enable local MCP memory for claude/codex in this project.")
    .option("--shell-hook", "also install legacy shell wrapper hooks")
    .option("--shell <name>", "powershell, bash, or zsh")
    .option("--dry-run", "preview optional shell hook changes without writing them")
    .action(async (options: { shellHook?: boolean; shell?: ShellKind; dryRun?: boolean }) => {
      const cwd = program.opts<{ cwd: string }>().cwd;
      const store = new MemoryStore(cwd);
      const paths = await store.init();
      const index = await buildProjectIndex(store);
      const instructions = await installProjectInstructions(cwd);
      const launch = await resolveMcpServerLaunch(cwd);
      const mcpResults: McpInstallResult[] = [];

      for (const tool of supportedAgentTools()) {
        mcpResults.push(await installMcpServerForTool(tool, launch, { cwd }));
      }

      console.log(formatEnableReport(paths.memoryDir, index.languages, launch, instructions, mcpResults));

      if (options.shellHook) {
        const result = await installShellHook(parseShell(options.shell), { dryRun: options.dryRun });
        console.log(formatShellInstallResult(result));
      }
    });

  program
    .command("off")
    .description("Disable local MCP memory for claude/codex in this project.")
    .option("--shell-hook", "also remove legacy shell wrapper hooks")
    .option("--shell <name>", "powershell, bash, or zsh")
    .option("--dry-run", "preview optional shell hook changes without writing them")
    .action(async (options: { shellHook?: boolean; shell?: ShellKind; dryRun?: boolean }) => {
      const cwd = program.opts<{ cwd: string }>().cwd;
      const mcpResults: McpRemoveResult[] = [];

      for (const tool of supportedAgentTools()) {
        mcpResults.push(await removeMcpServerForTool(tool, { cwd }));
      }

      const instructions = await removeProjectInstructions(cwd);
      console.log(formatDisableReport(instructions, mcpResults));

      if (options.shellHook) {
        const result = await removeShellHook(parseShell(options.shell), { dryRun: options.dryRun });
        console.log(formatShellRemoveResult(result));
      }
    });

  program
    .command("status")
    .alias("st")
    .description("Check local memory, MCP registration, and project instructions.")
    .option("--json", "print raw JSON")
    .action(async (options: { json?: boolean }) => {
      const cwd = program.opts<{ cwd: string }>().cwd;
      const status = await collectIntegrationStatus(cwd);

      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(formatStatusReport(status));
      }
    });

  const shell = program.command("sh").description("Manage optional legacy shell wrapper hooks.");

  shell
    .command("on")
    .description("Install optional claude/codex shell wrapper hooks.")
    .option("--shell <name>", "powershell, bash, or zsh")
    .option("--dry-run", "preview changes without writing the shell profile")
    .action(async (options: { shell?: ShellKind; dryRun?: boolean }) => {
      const result = await installShellHook(parseShell(options.shell), { dryRun: options.dryRun });
      console.log(formatShellInstallResult(result));
    });

  shell
    .command("off")
    .description("Remove optional claude/codex shell wrapper hooks.")
    .option("--shell <name>", "powershell, bash, or zsh")
    .option("--dry-run", "preview changes without writing the shell profile")
    .action(async (options: { shell?: ShellKind; dryRun?: boolean }) => {
      const result = await removeShellHook(parseShell(options.shell), { dryRun: options.dryRun });
      console.log(formatShellRemoveResult(result));
    });

  program
    .command("run")
    .description("Run claude/codex with project memory prepared. Used by shell hooks.")
    .argument("<tool>", "tool to run, usually claude or codex")
    .argument("[args...]", "arguments passed to the tool")
    .allowUnknownOption(true)
    .action(async (tool: string, args: string[] = []) => {
      const forwardedArgs = args[0] === "--" ? args.slice(1) : args;
      const exitCode = await runToolWithContext(tool, forwardedArgs, {
        cwd: program.opts<{ cwd: string }>().cwd
      });
      process.exitCode = exitCode;
    });

  program
    .command("setup")
    .description("Initialize local memory, index the project, and run doctor in one step.")
    .option("--json", "print raw JSON")
    .action(async (options: { json?: boolean }) => {
      const store = createStore(program);
      const paths = await store.init();
      const index = await buildProjectIndex(store);
      const report = await runDoctor(store);

      if (options.json) {
        console.log(JSON.stringify({ paths, index, doctor: report }, null, 2));
      } else {
        console.log(`Initialized local memory at ${paths.memoryDir}`);
        console.log(`Indexed project: ${index.languages.join(", ") || "unknown language"}; ${index.entryFiles.length} entry file(s).`);
        console.log("");
        console.log(formatDoctorReport(report));
        console.log("");
        console.log("Next: run agc on, then use claude or codex normally. Check with agc st.");
      }

      if (!report.ok) {
        process.exitCode = 1;
      }
    });

  program
    .command("doctor")
    .description("Check local setup, privacy guardrails, and project memory health.")
    .option("--json", "print raw JSON")
    .action(async (options: { json?: boolean }) => {
      const store = createStore(program);
      const report = await runDoctor(store);

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatDoctorReport(report));
      }

      if (!report.ok) {
        process.exitCode = 1;
      }
    });

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
    .alias("pf")
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

async function collectIntegrationStatus(cwd: string): Promise<IntegrationStatus> {
  const store = new MemoryStore(cwd);
  const memoryReady = await exists(store.paths.memoryDir);
  const mcpLaunch = await resolveMcpServerLaunch(cwd);
  const instructions = await inspectProjectInstructions(cwd);
  const tools: McpToolStatus[] = [];

  for (const tool of supportedAgentTools()) {
    tools.push(await getMcpToolStatus(tool, { cwd }));
  }

  const hasRegisteredTool = tools.some((tool) => tool.registered);
  const hasAvailableTool = tools.some((tool) => tool.detected.available);
  const instructionsReady = instructions.agentsInstalled && instructions.claudeInstalled;
  const ready = memoryReady && mcpLaunch.available && instructionsReady && hasRegisteredTool;
  const partial = memoryReady || mcpLaunch.available || instructionsReady || hasAvailableTool || hasRegisteredTool;

  return {
    state: ready ? "ready" : partial ? "partial" : "not-ready",
    memoryReady,
    mcpLaunch,
    instructions,
    tools
  };
}

function formatEnableReport(
  memoryDir: string,
  languages: string[],
  launch: McpServerLaunch,
  instructions: ProjectInstructionChange,
  mcpResults: McpInstallResult[]
): string {
  return [
    "Agent Context Governor: enabled",
    `Memory: ${memoryDir}`,
    `Project index: ${languages.join(", ") || "unknown language"}`,
    `MCP server: ${formatLaunch(launch)}`,
    `Project instructions: ${formatInstructionChange(instructions)}`,
    ...mcpResults.map(formatMcpInstallResult),
    "Daily use: restart any open agent session, then run claude or codex normally.",
    "Check: agc st"
  ].join("\n");
}

function formatDisableReport(instructions: ProjectInstructionChange, mcpResults: McpRemoveResult[]): string {
  return [
    "Agent Context Governor: disabled",
    `Project instructions: ${formatInstructionChange(instructions)}`,
    ...mcpResults.map(formatMcpRemoveResult),
    "Optional legacy shell hooks are not touched unless you pass --shell-hook or run agc sh off."
  ].join("\n");
}

function formatStatusReport(status: IntegrationStatus): string {
  const instructions =
    status.instructions.agentsInstalled && status.instructions.claudeInstalled
      ? "installed"
      : status.instructions.agentsInstalled || status.instructions.claudeInstalled
        ? "partial"
        : "missing";

  return [
    `Agent Context Status: ${status.state}`,
    `Memory: ${status.memoryReady ? "ready" : "missing"}`,
    `MCP server: ${formatLaunch(status.mcpLaunch)}`,
    `Project instructions: ${instructions}`,
    ...status.tools.map((tool) => `MCP ${tool.tool}: ${formatMcpStatus(tool)}`),
    status.state === "ready" ? "Daily use: claude or codex" : "Next: run agc on"
  ].join("\n");
}

function formatMcpInstallResult(result: McpInstallResult): string {
  const suffix = result.error ? ` (${result.error})` : "";
  return `MCP ${result.tool}: ${result.action}${suffix}`;
}

function formatMcpRemoveResult(result: McpRemoveResult): string {
  const suffix = result.error ? ` (${result.error})` : "";
  return `MCP ${result.tool}: ${result.action}${suffix}`;
}

function formatMcpStatus(status: McpToolStatus): string {
  if (!status.detected.available) {
    return "not found";
  }

  if (status.error) {
    return `unknown (${status.error})`;
  }

  return status.registered ? "registered" : "not registered";
}

function formatLaunch(launch: McpServerLaunch): string {
  if (!launch.available) {
    return "not found";
  }

  return launch.args.length > 0
    ? `${launch.command} ${launch.args.join(" ")} (${launch.source})`
    : `${launch.command} (${launch.source})`;
}

function formatInstructionChange(change: ProjectInstructionChange): string {
  const changed = change.files.filter((file) => file.changed);
  if (changed.length === 0) {
    return "already up to date";
  }

  return changed
    .map((file) => `${file.removed ? "removed" : "updated"} ${file.file}${file.backupPath ? `; backup ${file.backupPath}` : ""}`)
    .join(", ");
}

function formatShellInstallResult(result: HookInstallResult): string {
  const action = result.dryRun
    ? result.installed ? "Would enable" : "Already enabled"
    : result.installed ? "Enabled" : "Already enabled";
  const backup = result.backupPath ? `; backup ${result.backupPath}` : "";
  return `${action} optional shell hook for ${result.shell}: ${result.profilePath}${backup}`;
}

function formatShellRemoveResult(result: HookRemoveResult): string {
  const action = result.dryRun
    ? result.removed ? "Would disable" : "Already disabled"
    : result.removed ? "Disabled" : "Already disabled";
  const backup = result.backupPath ? `; backup ${result.backupPath}` : "";
  return `${action} optional shell hook for ${result.shell}: ${result.profilePath}${backup}`;
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

function parseShell(value: string | undefined): ShellKind {
  if (value === undefined) {
    return defaultShell();
  }

  if (value === "powershell" || value === "bash" || value === "zsh") {
    return value;
  }

  throw new Error(`Unsupported shell: ${value}`);
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

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

if (isDirectCli(import.meta.url)) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
