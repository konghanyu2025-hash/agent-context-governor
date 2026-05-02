import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { MemoryStore } from "../store/memoryStore.js";

export type DoctorStatus = "ok" | "warn" | "error";

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  message: string;
}

export interface DoctorReport {
  ok: boolean;
  root: string;
  checks: DoctorCheck[];
}

export async function runDoctor(store: MemoryStore): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];

  checks.push(checkNodeVersion(process.versions.node));
  checks.push(await checkMemoryDirectory(store));
  checks.push(await checkConfig(store));
  checks.push(await checkGitignore(store.paths.root));
  checks.push(await checkProjectIndex(store));

  return {
    ok: !checks.some((check) => check.status === "error"),
    root: store.paths.root,
    checks
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [
    `Agent Context Doctor (${report.ok ? "ok" : "needs attention"})`,
    `Root: ${report.root}`,
    ""
  ];

  for (const check of report.checks) {
    lines.push(`${iconFor(check.status)} ${check.name}: ${check.message}`);
  }

  return lines.join("\n");
}

function checkNodeVersion(version: string): DoctorCheck {
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);

  if (major >= 20) {
    return {
      name: "Node.js",
      status: "ok",
      message: `running ${version}`
    };
  }

  return {
    name: "Node.js",
    status: "error",
    message: `requires Node.js >=20, found ${version}`
  };
}

async function checkMemoryDirectory(store: MemoryStore): Promise<DoctorCheck> {
  try {
    const info = await stat(store.paths.memoryDir);

    if (!info.isDirectory()) {
      return {
        name: "Local memory",
        status: "error",
        message: `${store.paths.memoryDir} exists but is not a directory`
      };
    }

    return {
      name: "Local memory",
      status: "ok",
      message: ".agent-memory/ exists"
    };
  } catch {
    return {
      name: "Local memory",
      status: "warn",
      message: "not initialized; run agent-context init"
    };
  }
}

async function checkConfig(store: MemoryStore): Promise<DoctorCheck> {
  try {
    await access(store.paths.config);
    const config = await store.readConfig();

    if (!Array.isArray(config.exclude) || !config.exclude.includes(".agent-memory/**")) {
      return {
        name: "Config",
        status: "warn",
        message: "config exists but does not exclude .agent-memory/**"
      };
    }

    return {
      name: "Config",
      status: "ok",
      message: "config is readable"
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        name: "Config",
        status: "warn",
        message: "not initialized; run agent-context init"
      };
    }

    return {
      name: "Config",
      status: "error",
      message: `config cannot be read: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function checkGitignore(root: string): Promise<DoctorCheck> {
  const gitignorePath = path.join(root, ".gitignore");

  try {
    const gitignore = await readFile(gitignorePath, "utf8");
    const ignoresMemory = gitignore
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .some((line) => line === ".agent-memory/" || line === ".agent-memory" || line === ".agent-memory/**");

    if (ignoresMemory) {
      return {
        name: "Git ignore",
        status: "ok",
        message: ".agent-memory/ is ignored"
      };
    }

    return {
      name: "Git ignore",
      status: "warn",
      message: "add .agent-memory/ to .gitignore before recording private memory"
    };
  } catch {
    return {
      name: "Git ignore",
      status: "warn",
      message: "no .gitignore found; add .agent-memory/ before sharing the repository"
    };
  }
}

async function checkProjectIndex(store: MemoryStore): Promise<DoctorCheck> {
  try {
    await access(store.paths.projectIndex);
    const index = await store.readProjectIndex();

    if (!index) {
      return {
        name: "Project index",
        status: "warn",
        message: "index file is missing or empty; run agent-context index"
      };
    }

    return {
      name: "Project index",
      status: "ok",
      message: `indexed ${index.languages.length} language(s), ${index.entryFiles.length} entry file(s)`
    };
  } catch {
    return {
      name: "Project index",
      status: "warn",
      message: "not generated; run agent-context index"
    };
  }
}

function iconFor(status: DoctorStatus): string {
  if (status === "ok") {
    return "OK";
  }

  if (status === "warn") {
    return "WARN";
  }

  return "ERROR";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
