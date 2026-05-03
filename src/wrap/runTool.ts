import { buildProjectIndex } from "../indexer/projectIndex.js";
import { generateContextPack } from "../pack/contextPack.js";
import { MemoryStore } from "../store/memoryStore.js";
import { resolveCommand, spawnPortable } from "../install/toolDetect.js";

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
  const commandPath = await resolveCommand(tool);

  if (commandPath === undefined) {
    throw new Error(`Command not found: ${tool}`);
  }

  return new Promise((resolve, reject) => {
    const child = spawnPortable(commandPath, args, {
      cwd,
      env: {
        ...process.env,
        AGC_MEMORY_DIR: memoryDir,
        ...(contextPath ? { AGC_CONTEXT_PACK: contextPath } : {})
      },
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
