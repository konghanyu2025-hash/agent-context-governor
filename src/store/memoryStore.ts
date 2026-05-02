import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type AgentMemoryConfig,
  type AttemptRecord,
  type DecisionRecord,
  type DependencyReviewRecord,
  type EvidenceRef,
  type MemoryPaths,
  type ProjectIndex
} from "../types.js";
import { redactDeep } from "../privacy/redact.js";
import { appendJsonl, readJsonl, upsertJsonl } from "./jsonlStore.js";
import { defaultConfig, resolveMemoryPaths } from "./paths.js";

export interface DecisionInput {
  id?: string | undefined;
  title: string;
  rationale: string;
  scope?: string[] | undefined;
  evidence?: EvidenceRef[] | undefined;
  expiresWhen?: string | undefined;
  status?: DecisionRecord["status"] | undefined;
  tags?: string[] | undefined;
}

export interface AttemptInput {
  id?: string | undefined;
  task: string;
  approach: string;
  result: AttemptRecord["result"];
  errorSignature?: string | undefined;
  failureReason?: string | undefined;
  retryable?: boolean | undefined;
  retryWhen?: string | undefined;
  environment?: Record<string, string> | undefined;
  evidence?: EvidenceRef[] | undefined;
  tags?: string[] | undefined;
}

export interface DependencyReviewInput {
  id?: string | undefined;
  packageName: string;
  useCase: string;
  license?: string | undefined;
  maintenance?: {
    latestVersion?: string | undefined;
    publishedAt?: string | undefined;
    dependencyCount?: number | undefined;
    status?: DependencyReviewRecord["maintenance"]["status"] | undefined;
  } | undefined;
  risks?: string[] | undefined;
  alternatives?: string[] | undefined;
  recommendation: DependencyReviewRecord["recommendation"];
  rationale: string;
  evidence?: EvidenceRef[] | undefined;
  tags?: string[] | undefined;
}

export class MemoryStore {
  readonly paths: MemoryPaths;

  constructor(root = process.cwd()) {
    this.paths = resolveMemoryPaths(root);
  }

  async init(): Promise<MemoryPaths> {
    await mkdir(this.paths.memoryDir, { recursive: true });
    await mkdir(this.paths.contextPacksDir, { recursive: true });
    await writeJsonIfMissing(this.paths.config, defaultConfig);
    await writeTextIfMissing(this.paths.decisions, "");
    await writeTextIfMissing(this.paths.attempts, "");
    await writeTextIfMissing(this.paths.dependencies, "");
    await writeTextIfMissing(
      path.join(this.paths.memoryDir, ".gitignore"),
      "*\n!.gitignore\n"
    );
    return this.paths;
  }

  async readConfig(): Promise<AgentMemoryConfig> {
    try {
      const config = JSON.parse(await readFile(this.paths.config, "utf8")) as Partial<AgentMemoryConfig>;
      return {
        ...defaultConfig,
        ...config,
        include: config.include ?? defaultConfig.include,
        exclude: config.exclude ?? defaultConfig.exclude,
        maxContextItems: config.maxContextItems ?? defaultConfig.maxContextItems
      };
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return defaultConfig;
      }

      throw error;
    }
  }

  async readDecisions(): Promise<DecisionRecord[]> {
    return readJsonl<DecisionRecord>(this.paths.decisions);
  }

  async readAttempts(): Promise<AttemptRecord[]> {
    return readJsonl<AttemptRecord>(this.paths.attempts);
  }

  async readDependencies(): Promise<DependencyReviewRecord[]> {
    return readJsonl<DependencyReviewRecord>(this.paths.dependencies);
  }

  async readProjectIndex(): Promise<ProjectIndex | undefined> {
    try {
      return JSON.parse(await readFile(this.paths.projectIndex, "utf8")) as ProjectIndex;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return undefined;
      }

      throw error;
    }
  }

  async writeProjectIndex(index: ProjectIndex): Promise<ProjectIndex> {
    await this.init();
    const sanitized = redactDeep(index);
    await writeFile(this.paths.projectIndex, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
    return sanitized;
  }

  async recordDecision(input: DecisionInput): Promise<DecisionRecord> {
    await this.init();
    assertText(input.title, "decision title");
    assertText(input.rationale, "decision rationale");

    const now = new Date().toISOString();
    const record: DecisionRecord = {
      id: input.id ?? createId("decision"),
      kind: "decision",
      createdAt: now,
      title: input.title.trim(),
      rationale: input.rationale.trim(),
      scope: normalizeList(input.scope),
      status: input.status ?? "active"
    };
    assignOptional(record, "expiresWhen", input.expiresWhen?.trim());
    assignOptional(record, "evidence", normalizeEvidence(input.evidence));
    assignOptional(record, "tags", normalizeList(input.tags));

    return upsertJsonl(this.paths.decisions, redactDeep(record));
  }

  async recordAttempt(input: AttemptInput): Promise<AttemptRecord> {
    await this.init();
    assertText(input.task, "attempt task");
    assertText(input.approach, "attempt approach");
    assertOneOf(input.result, ["success", "failure", "abandoned"], "attempt result");

    const now = new Date().toISOString();
    const retryable = input.retryable ?? input.result === "success";
    const record: AttemptRecord = {
      id: input.id ?? createId("attempt"),
      kind: "attempt",
      createdAt: now,
      task: input.task.trim(),
      approach: input.approach.trim(),
      result: input.result,
      retryable
    };
    assignOptional(record, "errorSignature", input.errorSignature?.trim());
    assignOptional(record, "failureReason", input.failureReason?.trim());
    assignOptional(record, "retryWhen", input.retryWhen?.trim());
    assignOptional(record, "environment", input.environment);
    assignOptional(record, "evidence", normalizeEvidence(input.evidence));
    assignOptional(record, "tags", normalizeList(input.tags));

    return upsertJsonl(this.paths.attempts, redactDeep(record));
  }

  async recordDependency(input: DependencyReviewInput): Promise<DependencyReviewRecord> {
    await this.init();
    assertText(input.packageName, "dependency packageName");
    assertText(input.useCase, "dependency useCase");
    assertText(input.rationale, "dependency rationale");
    assertOneOf(input.recommendation, ["use", "avoid", "spike"], "dependency recommendation");

    const now = new Date().toISOString();
    const maintenance = input.maintenance ?? {};
    const status = maintenance.status ?? "unknown";
    assertOneOf(status, ["active", "stale", "inactive", "unknown"], "dependency maintenance.status");

    const normalizedMaintenance: DependencyReviewRecord["maintenance"] = { status };
    assignOptional(normalizedMaintenance, "latestVersion", maintenance.latestVersion);
    assignOptional(normalizedMaintenance, "publishedAt", maintenance.publishedAt);
    assignOptional(normalizedMaintenance, "dependencyCount", maintenance.dependencyCount);

    const record: DependencyReviewRecord = {
      id: input.id ?? createId("dependency"),
      kind: "dependency",
      createdAt: now,
      packageName: input.packageName.trim(),
      useCase: input.useCase.trim(),
      maintenance: normalizedMaintenance,
      risks: normalizeList(input.risks),
      alternatives: normalizeList(input.alternatives),
      recommendation: input.recommendation,
      rationale: input.rationale.trim()
    };
    assignOptional(record, "license", input.license?.trim());
    assignOptional(record, "evidence", normalizeEvidence(input.evidence));
    assignOptional(record, "tags", normalizeList(input.tags));

    return upsertJsonl(this.paths.dependencies, redactDeep(record));
  }

  async saveContextPack(task: string, markdown: string): Promise<string> {
    await this.init();
    const safeName = task
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 48) || "context-pack";
    const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
    const filePath = path.join(this.paths.contextPacksDir, `${timestamp}-${safeName}.md`);
    await writeFile(filePath, markdown, "utf8");
    return filePath;
  }

  async appendRaw(kind: "decision" | "attempt" | "dependency", record: unknown): Promise<void> {
    await this.init();
    const target =
      kind === "decision"
        ? this.paths.decisions
        : kind === "attempt"
          ? this.paths.attempts
          : this.paths.dependencies;
    await appendJsonl(target, redactDeep(record));
  }
}

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function normalizeList(values: string[] | undefined): string[] {
  return (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeEvidence(evidence: EvidenceRef[] | undefined): EvidenceRef[] | undefined {
  const normalized: EvidenceRef[] = [];

  for (const entry of evidence ?? []) {
    const item: EvidenceRef = {};
    assignOptional(item, "file", entry.file?.trim());
    assignOptional(item, "line", entry.line);
    assignOptional(item, "note", entry.note?.trim());
    assignOptional(item, "url", entry.url?.trim());

    if (Object.keys(item).length > 0) {
      normalized.push(item);
    }
  }

  return normalized.length > 0 ? normalized : undefined;
}

function assertText(value: string, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing ${field}`);
  }
}

function assertOneOf<T extends string>(value: string, allowed: readonly T[], field: string): asserts value is T {
  if (!allowed.includes(value as T)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
}

function assignOptional<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value === undefined) {
    return;
  }

  if (Array.isArray(value) && value.length === 0) {
    return;
  }

  if (typeof value === "string" && value.length === 0) {
    return;
  }

  target[key] = value;
}

async function writeJsonIfMissing(filePath: string, value: unknown): Promise<void> {
  try {
    await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      return;
    }

    throw error;
  }
}

async function writeTextIfMissing(filePath: string, value: string): Promise<void> {
  try {
    await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, value, "utf8");
      return;
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
