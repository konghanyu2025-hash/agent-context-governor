import type {
  AttemptRecord,
  ContextPackOptions,
  DecisionRecord,
  DependencyReviewRecord,
  EvidenceRef,
  ProjectIndex,
  SearchResult
} from "../types.js";
import { MemoryStore } from "../store/memoryStore.js";
import { searchMemory } from "../search/search.js";

export interface ContextPackResult {
  markdown: string;
  savedTo?: string;
}

export async function generateContextPack(
  store: MemoryStore,
  task: string,
  options: ContextPackOptions = {}
): Promise<ContextPackResult> {
  const config = await store.readConfig();
  const budget = options.budget ?? 3000;
  const limit = options.limit ?? config.maxContextItems;
  const results = await searchMemory(store, task, { limit });
  const grouped = groupResults(results);
  const lines: string[] = [
    "# Agent Memory Context Pack",
    "",
    `Task: ${task}`,
    `Generated: ${new Date().toISOString()}`,
    `Budget: ~${budget} tokens`,
    "",
    "Use this as a compact, evidence-backed starting point. Re-check source files when the memory is old, expired, or conflicts with current code."
  ];

  if (grouped.projectIndex.length > 0) {
    lines.push("", "## Project Index");
    for (const result of grouped.projectIndex) {
      lines.push(formatProjectIndex(result.record as ProjectIndex, result.source));
    }
  }

  if (grouped.decisions.length > 0) {
    lines.push("", "## Relevant Decisions");
    for (const result of grouped.decisions) {
      lines.push(formatDecision(result.record as DecisionRecord, result.source));
    }
  }

  if (grouped.failedAttempts.length > 0) {
    lines.push(
      "",
      "## Negative Cache: Do Not Repeat Blindly",
      "These attempts already failed or were abandoned. Retry only when the retry condition is satisfied or the environment has materially changed."
    );
    for (const result of grouped.failedAttempts) {
      lines.push(formatAttempt(result.record as AttemptRecord, result.source));
    }
  }

  if (grouped.successfulAttempts.length > 0) {
    lines.push("", "## Useful Prior Attempts");
    for (const result of grouped.successfulAttempts) {
      lines.push(formatAttempt(result.record as AttemptRecord, result.source));
    }
  }

  if (grouped.dependencies.length > 0) {
    lines.push("", "## Dependency Reviews");
    for (const result of grouped.dependencies) {
      lines.push(formatDependency(result.record as DependencyReviewRecord, result.source));
    }
  }

  if (results.length === 0) {
    lines.push("", "## No Matching Memory", "- No relevant local memory was found. Record decisions, failed attempts, and dependency reviews as work proceeds.");
  }

  const markdown = enforceTokenBudget(lines.join("\n"), budget);
  const savedTo = options.save === false ? undefined : await store.saveContextPack(task, markdown);
  return savedTo ? { markdown, savedTo } : { markdown };
}

function groupResults(results: SearchResult[]): {
  projectIndex: SearchResult[];
  decisions: SearchResult[];
  failedAttempts: SearchResult[];
  successfulAttempts: SearchResult[];
  dependencies: SearchResult[];
} {
  const deduped = dedupeBySource(results);
  return {
    projectIndex: deduped.filter((result) => result.kind === "project-index"),
    decisions: deduped.filter((result) => result.kind === "decision"),
    failedAttempts: deduped.filter(
      (result) =>
        result.kind === "attempt" &&
        ((result.record as AttemptRecord).result === "failure" ||
          (result.record as AttemptRecord).result === "abandoned")
    ),
    successfulAttempts: deduped.filter(
      (result) => result.kind === "attempt" && (result.record as AttemptRecord).result === "success"
    ),
    dependencies: deduped.filter((result) => result.kind === "dependency")
  };
}

function dedupeBySource(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const result of results) {
    if (seen.has(result.source)) {
      continue;
    }

    seen.add(result.source);
    deduped.push(result);
  }

  return deduped;
}

function formatProjectIndex(index: ProjectIndex, source: string): string {
  return [
    `- Package manager: ${index.packageManager ?? "unknown"}; languages: ${index.languages.join(", ") || "unknown"}. Source: ${source}`,
    `  Entry files: ${index.entryFiles.join(", ") || "none indexed"}.`,
    `  Test commands: ${index.testCommands.join(" && ") || "none indexed"}. Build commands: ${index.buildCommands.join(" && ") || "none indexed"}.`,
    `  Key directories: ${index.keyDirectories.join(", ") || "none indexed"}.`
  ].join("\n");
}

function formatDecision(record: DecisionRecord, source: string): string {
  return [
    `- ${record.title} (${record.status}). Source: ${source}`,
    `  Rationale: ${record.rationale}`,
    `  Scope: ${record.scope.join(", ") || "not specified"}.${record.expiresWhen ? ` Expires when: ${record.expiresWhen}.` : ""}`,
    formatEvidence(record.evidence)
  ]
    .filter(Boolean)
    .join("\n");
}

function formatAttempt(record: AttemptRecord, source: string): string {
  const retry = record.retryable
    ? `Retryable: yes${record.retryWhen ? `, when ${record.retryWhen}` : ""}.`
    : "Retryable: no unless the recorded conditions materially change.";
  return [
    `- ${record.result.toUpperCase()}: ${record.approach}. Source: ${source}`,
    `  Task: ${record.task}`,
    record.errorSignature ? `  Error signature: ${record.errorSignature}` : "",
    record.failureReason ? `  Reason: ${record.failureReason}` : "",
    `  ${retry}`,
    formatEvidence(record.evidence)
  ]
    .filter(Boolean)
    .join("\n");
}

function formatDependency(record: DependencyReviewRecord, source: string): string {
  return [
    `- ${record.packageName}: ${record.recommendation.toUpperCase()} for ${record.useCase}. Source: ${source}`,
    `  Rationale: ${record.rationale}`,
    `  Maintenance: ${record.maintenance.status}${record.maintenance.latestVersion ? `, latest ${record.maintenance.latestVersion}` : ""}${record.maintenance.publishedAt ? `, published ${record.maintenance.publishedAt}` : ""}. License: ${record.license ?? "unknown"}.`,
    `  Risks: ${record.risks.join("; ") || "none recorded"}. Alternatives: ${record.alternatives.join(", ") || "none recorded"}.`,
    formatEvidence(record.evidence)
  ]
    .filter(Boolean)
    .join("\n");
}

function formatEvidence(evidence: EvidenceRef[] | undefined): string {
  if (!evidence || evidence.length === 0) {
    return "";
  }

  const rendered = evidence.map((item) => {
    const location = item.url ?? (item.file ? `${item.file}${item.line ? `:${item.line}` : ""}` : "unknown");
    return `${location}${item.note ? ` (${item.note})` : ""}`;
  });

  return `  Evidence: ${rendered.join("; ")}`;
}

export function enforceTokenBudget(markdown: string, budget: number): string {
  const maxChars = Math.max(400, budget * 4);

  if (markdown.length <= maxChars) {
    return markdown;
  }

  const suffix = "\n\n[Truncated to fit context budget. Run a narrower search or increase --budget for more memory.]";
  const allowed = Math.max(0, maxChars - suffix.length);
  const kept: string[] = [];
  let used = 0;

  for (const line of markdown.split("\n")) {
    const next = used + line.length + (kept.length > 0 ? 1 : 0);

    if (next > allowed) {
      break;
    }

    kept.push(line);
    used = next;
  }

  return `${kept.join("\n").trimEnd()}${suffix}`;
}
