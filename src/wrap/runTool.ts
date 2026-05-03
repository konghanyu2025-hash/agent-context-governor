import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { buildProjectIndex } from "../indexer/projectIndex.js";
import { generateContextPack } from "../pack/contextPack.js";
import { MemoryStore } from "../store/memoryStore.js";

export interface RunToolOptions {
  cwd?: string;
  quiet?: boolean;
}

export async function runToolWithContext(
  tool: string,
  args: string[],
  options: RunToolOptions = {}
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const store = new MemoryStore(cwd);
  await store.init();
  await buildProjectIndex(store);

  let contextPath: string | undefined;
  const task = taskFromArgs(tool, args);

  if (task) {
    const pack = await generateContextPack(store, task, {
      budget: 1200,
      save: true
    });
    contextPath = pack.savedTo;

    if (!options.quiet && contextPath) {
      console.error(`[agc] context ready: ${contextPath}`);
    }
  } else if (!options.quiet) {
    console.error("[agc] project memory ready");
  }

  return spawnTool(tool, args, cwd, contextPath, store.paths.memoryDir);
}

function taskFromArgs(tool: string, args: string[]): string | undefined {
  const meaningful = args.filter((arg) => arg !== "--" && !arg.startsWith("-"));

  if (meaningful.length === 0) {
    return undefined;
  }

  return `${tool}: ${meaningful.join(" ")}`;
}

async function spawnTool(
  tool: string,
  args: string[],
  cwd: string,
  contextPath: string | undefined,
  memoryDir: string
): Promise<number> {
  const commandPath = process.platform === "win32" ? await resolveWindowsCommand(tool) : tool;
  return new Promise((resolve, reject) => {
    const child = spawnCommand(commandPath, args, {
      cwd,
      env: {
        ...process.env,
        AGC_MEMORY_DIR: memoryDir,
        ...(contextPath ? { AGC_CONTEXT_PACK: contextPath } : {})
      }
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function spawnCommand(
  commandPath: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  }
) {
  const extension = path.extname(commandPath).toLowerCase();

  if (process.platform === "win32" && (extension === ".cmd" || extension === ".bat")) {
    const shell = process.env.ComSpec ?? "cmd.exe";
    return spawn(shell, ["/d", "/c", commandPath, ...args], {
      cwd: options.cwd,
      env: options.env,
      stdio: "inherit",
      shell: false
    });
  }

  return spawn(commandPath, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: "inherit",
    shell: false
  });
}

async function resolveWindowsCommand(tool: string): Promise<string> {
  if (path.isAbsolute(tool) || tool.includes("\\") || tool.includes("/")) {
    return tool;
  }

  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const extensions = path.extname(tool)
    ? [""]
    : (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
      .split(";")
      .filter(Boolean);

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(entry, `${tool}${extension.toLowerCase()}`);
      if (await exists(candidate)) {
        return candidate;
      }

      const upperCandidate = path.join(entry, `${tool}${extension.toUpperCase()}`);
      if (await exists(upperCandidate)) {
        return upperCandidate;
      }
    }
  }

  return tool;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
