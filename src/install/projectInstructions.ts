import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface InstructionFileResult {
  file: "AGENTS.md" | "CLAUDE.md";
  path: string;
  changed: boolean;
  removed: boolean;
  backupPath?: string;
}

export interface ProjectInstructionStatus {
  agentsInstalled: boolean;
  claudeInstalled: boolean;
  claudeImportsAgents: boolean;
}

export interface ProjectInstructionChange {
  status: ProjectInstructionStatus;
  files: InstructionFileResult[];
}

const startMarker = "<!-- agent-context-governor:start -->";
const endMarker = "<!-- agent-context-governor:end -->";

const agentsBlock = [
  startMarker,
  "## Agent Context Governor",
  "",
  "- Before non-trivial coding work, call MCP tool `context.pack` with the task and current `cwd`.",
  "- Use `memory.search` before rebuilding existing logic or retrying an approach.",
  "- Do not repeat failed attempts from the context pack unless the retry condition is now true.",
  "- Before adding a dependency, call `dependency.review` and prefer recorded reviews.",
  "- Record durable decisions, failed or abandoned attempts, and dependency conclusions with the MCP record tools.",
  endMarker
].join("\n");

const claudeImportBlock = [
  startMarker,
  "@AGENTS.md",
  endMarker
].join("\n");

const claudeReferenceBlock = [
  startMarker,
  "Agent Context Governor rules are in `AGENTS.md`.",
  endMarker
].join("\n");

export async function installProjectInstructions(root: string): Promise<ProjectInstructionChange> {
  const agentsResult = await upsertInstructionFile(root, "AGENTS.md", agentsBlock);
  const claudeCurrent = await readTextIfExists(path.join(root, "CLAUDE.md"));
  const claudeBlock = importsAgents(stripManagedBlock(claudeCurrent.text)) ? claudeReferenceBlock : claudeImportBlock;
  const claudeResult = await upsertInstructionFile(root, "CLAUDE.md", claudeBlock);
  const status = await inspectProjectInstructions(root);

  return {
    status,
    files: [agentsResult, claudeResult]
  };
}

export async function removeProjectInstructions(root: string): Promise<ProjectInstructionChange> {
  const agentsResult = await removeInstructionFileBlock(root, "AGENTS.md");
  const claudeResult = await removeInstructionFileBlock(root, "CLAUDE.md");
  const status = await inspectProjectInstructions(root);

  return {
    status,
    files: [agentsResult, claudeResult]
  };
}

export async function inspectProjectInstructions(root: string): Promise<ProjectInstructionStatus> {
  const agents = await readTextIfExists(path.join(root, "AGENTS.md"));
  const claude = await readTextIfExists(path.join(root, "CLAUDE.md"));

  return {
    agentsInstalled: hasManagedBlock(agents.text),
    claudeInstalled: hasManagedBlock(claude.text),
    claudeImportsAgents: importsAgents(claude.text)
  };
}

function upsertInstructionFile(root: string, file: "AGENTS.md" | "CLAUDE.md", block: string): Promise<InstructionFileResult> {
  const filePath = path.join(root, file);
  return updateInstructionFile(filePath, file, (current) => appendManagedBlock(stripManagedBlock(current), block));
}

function removeInstructionFileBlock(root: string, file: "AGENTS.md" | "CLAUDE.md"): Promise<InstructionFileResult> {
  const filePath = path.join(root, file);
  return updateInstructionFile(filePath, file, (current) => stripManagedBlock(current).trimEnd());
}

async function updateInstructionFile(
  filePath: string,
  file: "AGENTS.md" | "CLAUDE.md",
  update: (current: string) => string
): Promise<InstructionFileResult> {
  const current = await readTextIfExists(filePath);
  const nextRaw = update(current.text);
  const next = nextRaw.length > 0 ? `${nextRaw.trimEnd()}\n` : "";

  if (next === current.text) {
    return {
      file,
      path: filePath,
      changed: false,
      removed: false
    };
  }

  const backupPath = await backupIfNeeded(filePath, current.text, current.exists);

  if (next.length === 0 && current.exists) {
    await unlink(filePath);
    return result(file, filePath, true, true, backupPath);
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, next, "utf8");
  return result(file, filePath, true, false, backupPath);
}

function appendManagedBlock(current: string, block: string): string {
  const base = current.trimEnd();
  return `${base}${base.length > 0 ? "\n\n" : ""}${block}`;
}

function stripManagedBlock(current: string): string {
  const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\r?\\n?`, "gu");
  return current.replace(pattern, "");
}

function hasManagedBlock(current: string): boolean {
  return current.includes(startMarker) && current.includes(endMarker);
}

function importsAgents(current: string): boolean {
  return /^@AGENTS\.md\s*$/mu.test(current) || current.includes("@AGENTS.md");
}

async function backupIfNeeded(filePath: string, current: string, exists: boolean): Promise<string | undefined> {
  if (!exists) {
    return undefined;
  }

  const backupDir = path.join(path.dirname(filePath), ".agent-memory", "backups");
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const backupPath = path.join(backupDir, `${path.basename(filePath)}.${timestamp}.bak`);
  await mkdir(backupDir, { recursive: true });
  await writeFile(backupPath, current, "utf8");
  return backupPath;
}

async function readTextIfExists(filePath: string): Promise<{ text: string; exists: boolean }> {
  try {
    return {
      text: await readFile(filePath, "utf8"),
      exists: true
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        text: "",
        exists: false
      };
    }

    throw error;
  }
}

function result(
  file: "AGENTS.md" | "CLAUDE.md",
  filePath: string,
  changed: boolean,
  removed: boolean,
  backupPath: string | undefined
): InstructionFileResult {
  const item: InstructionFileResult = {
    file,
    path: filePath,
    changed,
    removed
  };

  if (backupPath !== undefined) {
    item.backupPath = backupPath;
  }

  return item;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
