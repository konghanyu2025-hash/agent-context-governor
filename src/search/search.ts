import type {
  AttemptRecord,
  DecisionRecord,
  DependencyReviewRecord,
  MemoryRecord,
  ProjectIndex,
  SearchResult
} from "../types.js";
import { MemoryStore } from "../store/memoryStore.js";

export interface SearchOptions {
  limit?: number | undefined;
}

export async function searchMemory(
  store: MemoryStore,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const [decisions, attempts, dependencies, projectIndex] = await Promise.all([
    store.readDecisions(),
    store.readAttempts(),
    store.readDependencies(),
    store.readProjectIndex()
  ]);
  const tokens = tokenize(query);
  const results: SearchResult[] = [];

  for (const record of decisions) {
    pushIfRelevant(results, tokens, record, decisionText(record), `.agent-memory/decisions.jsonl#${record.id}`);
  }

  for (const record of attempts) {
    pushIfRelevant(results, tokens, record, attemptText(record), `.agent-memory/attempts.jsonl#${record.id}`);
  }

  for (const record of dependencies) {
    pushIfRelevant(
      results,
      tokens,
      record,
      dependencyText(record),
      `.agent-memory/dependencies.jsonl#${record.id}`
    );
  }

  if (projectIndex) {
    pushIfRelevant(
      results,
      tokens,
      projectIndex,
      projectIndexText(projectIndex),
      ".agent-memory/project-index.json"
    );
  }

  const limit = options.limit ?? (await store.readConfig()).maxContextItems;
  return results
    .sort((left, right) => right.score - left.score || left.source.localeCompare(right.source))
    .slice(0, limit);
}

export function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^\p{L}\p{N}_@./-]+/u)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    )
  );
}

export function recordToText(record: MemoryRecord | ProjectIndex): string {
  if ("kind" in record) {
    if (record.kind === "decision") {
      return decisionText(record);
    }

    if (record.kind === "attempt") {
      return attemptText(record);
    }

    return dependencyText(record);
  }

  return projectIndexText(record);
}

function pushIfRelevant(
  results: SearchResult[],
  tokens: string[],
  record: MemoryRecord | ProjectIndex,
  text: string,
  source: string
): void {
  const score = scoreText(tokens, text);

  if (score > 0 || tokens.length === 0) {
    results.push({
      kind: "kind" in record ? record.kind : "project-index",
      score: Math.max(score, 0.1),
      source,
      record
    });
  }
}

function scoreText(tokens: string[], text: string): number {
  const haystack = text.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += token.length > 4 ? 2 : 1;
    }
  }

  return score;
}

function decisionText(record: DecisionRecord): string {
  return [
    record.title,
    record.rationale,
    record.scope.join(" "),
    record.expiresWhen,
    record.tags?.join(" "),
    record.evidence?.map((item) => `${item.file ?? ""} ${item.note ?? ""} ${item.url ?? ""}`).join(" ")
  ]
    .filter(Boolean)
    .join(" ");
}

function attemptText(record: AttemptRecord): string {
  return [
    record.task,
    record.approach,
    record.result,
    record.errorSignature,
    record.failureReason,
    record.retryWhen,
    record.tags?.join(" "),
    record.evidence?.map((item) => `${item.file ?? ""} ${item.note ?? ""} ${item.url ?? ""}`).join(" ")
  ]
    .filter(Boolean)
    .join(" ");
}

function dependencyText(record: DependencyReviewRecord): string {
  return [
    record.packageName,
    record.useCase,
    record.license,
    record.maintenance.latestVersion,
    record.maintenance.status,
    record.risks.join(" "),
    record.alternatives.join(" "),
    record.recommendation,
    record.rationale,
    record.tags?.join(" "),
    record.evidence?.map((item) => `${item.file ?? ""} ${item.note ?? ""} ${item.url ?? ""}`).join(" ")
  ]
    .filter(Boolean)
    .join(" ");
}

function projectIndexText(index: ProjectIndex): string {
  return [
    index.root,
    index.packageManager,
    index.languages.join(" "),
    index.entryFiles.join(" "),
    index.testCommands.join(" "),
    index.buildCommands.join(" "),
    index.keyDirectories.join(" ")
  ]
    .filter(Boolean)
    .join(" ");
}
