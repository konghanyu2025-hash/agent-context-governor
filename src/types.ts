export type MemoryKind = "decision" | "attempt" | "dependency";

export interface EvidenceRef {
  file?: string | undefined;
  line?: number | undefined;
  note?: string | undefined;
  url?: string | undefined;
}

export interface MemoryBase {
  id: string;
  kind: MemoryKind;
  createdAt: string;
  updatedAt?: string;
  tags?: string[];
  evidence?: EvidenceRef[];
}

export interface DecisionRecord extends MemoryBase {
  kind: "decision";
  title: string;
  rationale: string;
  scope: string[];
  expiresWhen?: string;
  status: "active" | "superseded";
}

export interface AttemptRecord extends MemoryBase {
  kind: "attempt";
  task: string;
  approach: string;
  result: "success" | "failure" | "abandoned";
  errorSignature?: string;
  failureReason?: string;
  retryable: boolean;
  retryWhen?: string;
  environment?: Record<string, string>;
}

export interface DependencyReviewRecord extends MemoryBase {
  kind: "dependency";
  packageName: string;
  useCase: string;
  license?: string;
  maintenance: {
    latestVersion?: string;
    publishedAt?: string;
    dependencyCount?: number;
    status: "active" | "stale" | "inactive" | "unknown";
  };
  risks: string[];
  alternatives: string[];
  recommendation: "use" | "avoid" | "spike";
  rationale: string;
}

export type MemoryRecord =
  | DecisionRecord
  | AttemptRecord
  | DependencyReviewRecord;

export interface ProjectIndex {
  generatedAt: string;
  root: string;
  packageManager?: string;
  languages: string[];
  entryFiles: string[];
  testCommands: string[];
  buildCommands: string[];
  keyDirectories: string[];
}

export interface AgentMemoryConfig {
  version: 1;
  include: string[];
  exclude: string[];
  maxContextItems: number;
}

export interface SearchResult<T = MemoryRecord | ProjectIndex> {
  kind: MemoryKind | "project-index";
  score: number;
  source: string;
  record: T;
}

export interface ContextPackOptions {
  budget?: number | undefined;
  limit?: number | undefined;
  save?: boolean | undefined;
}

export interface MemoryPaths {
  root: string;
  memoryDir: string;
  config: string;
  decisions: string;
  attempts: string;
  dependencies: string;
  projectIndex: string;
  contextPacksDir: string;
}
